'use strict';
// ----- server assembly -----
function designSpec(d) {
  const ch = PARTS.ch[d.ch], cpu = PARTS.cpu[d.cpu], ram = PARTS.ram[d.ram], disk = PARTS.disk[d.disk], gpu = PARTS.gpu[d.gpu];
  const caps = { cpu: Math.round(d.ncpu * cpu.cpu * ram.mult), sto: d.ndisk * (disk.sto || 0), gpu: d.ngpu * (gpu.gpu || 0) };
  const heat = ch.heat + d.ncpu * cpu.heat + d.ndisk * (disk.heat || 0) + d.ngpu * (gpu.heat || 0);
  const kw = ch.kw + d.ncpu * cpu.kw + d.ndisk * (disk.kw || 0) + d.ngpu * (gpu.kw || 0);
  const hwp = (part) => (part.price || 0) * (part.hw ? S.hw[part.hw] : 1);
  const price = Math.round(hwp(ch) + d.ncpu * hwp(cpu) + hwp(ram) + d.ndisk * hwp(disk) + d.ngpu * hwp(gpu));
  const tier = Math.max(cpu.tier, disk.tier || 1, gpu.tier || 1);
  const val = { cpu: caps.cpu * TYPES.cpu.rate, sto: caps.sto * TYPES.sto.rate, gpu: caps.gpu * TYPES.gpu.rate };
  const type = Object.keys(val).sort((a, b) => val[b] - val[a])[0];
  for (const k in caps) if (!caps[k]) delete caps[k];
  const errs = [];
  if (d.ncpu < 1 || d.ncpu > ch.sockets) errs.push(`процессоров должно быть от 1 до ${ch.sockets}`);
  if (d.ndisk > ch.bays) errs.push(`в корпус влезает до ${ch.bays} дисков`);
  if (d.ngpu > ch.gpus) errs.push(`в корпус влезает до ${ch.gpus} ускорителей`);
  [cpu, ram, disk, gpu].forEach((pt) => { if (pt.req && !hasTech(pt.req)) errs.push(`${pt.name}: нужно исследование`); });
  if (d.disk === 'd0' && d.ndisk) errs.push('выберите тип дисков');
  if (d.gpu === 'g0' && d.ngpu) errs.push('выберите тип ускорителей');
  return { caps, cap: caps[type] || 0, type, heat: Math.round(heat * 10) / 10, kw: Math.round(kw * 100) / 100, price, tier, errs };
}
const partsKey = (d) => [d.ch, d.cpu, d.ncpu, d.ram, d.disk, d.ndisk, d.gpu, d.ngpu].join('|');
function registerDesign(ds) {
  MODELS[`d${ds.id}`] = { name: ds.name, type: ds.spec.type, cap: ds.spec.cap, caps: ds.spec.caps, heat: ds.spec.heat, kw: ds.spec.kw, price: ds.spec.price, tier: ds.spec.tier, custom: true };
}
function designFor(d) {
  const key = partsKey(d);
  let ds = S.designs.find((x) => x.key === key);
  if (!ds) {
    const spec = designSpec(d);
    ds = { id: S.nextId++, key, parts: { ...d }, spec, name: `Сборка №${S.designs.length + 1} · ${PARTS.ch[d.ch].name.split(' ')[1]}` };
    S.designs.push(ds);
    registerDesign(ds);
  }
  return ds;
}
function asmTick() {
  let free = S.staff.tech;
  S.asm.forEach((j) => {
    if (j.by === 'tech') {
      const k = Math.min(j.n, free);
      if (k > 0) { S.stock[j.mid] = (S.stock[j.mid] || 0) + k; j.n -= k; free -= k; }
    } else if (--j.left <= 0) {
      const k = j.by === 'contract' ? j.n : 1;
      S.stock[j.mid] = (S.stock[j.mid] || 0) + k; j.n -= k;
      if (j.n > 0) j.left = 2;
    }
    if (j.n <= 0) { j.done = true; log(`Собрано: ${MODELS[j.mid].name}`, 'good'); }
  });
  S.asm = S.asm.filter((j) => !j.done);
}
function installStock(t, hi, mid, max = RACK_SLOTS) {
  let n = 0;
  const M = MODELS[mid];
  while ((S.stock[mid] || 0) > 0 && t.s.length < RACK_SLOTS && n < max) {
    const st = hallStats(hi);
    if (st.load + M.kw > st.cap) { if (!n) toast('Не хватает мощности зала', 'bad'); break; }
    t.s.splice(t.s.length - t.broken, 0, mid);
    S.stock[mid]--; n++;
  }
  refreshHall(hi);
  return n;
}
function placeKit(kit, hi) {
  const H = S.halls[hi], D = HALLS[hi];
  const cools = kit.cools || 1;
  const r = BUILD[kit.cool].r;
  const kw = kit.racks * kit.per * MODELS[kit.model].kw + cools * BUILD[kit.cool].kw + BUILD[kit.sw].kw;
  const st = hallStats(hi);
  if (st.load + kw > st.cap) return 'Не хватает мощности зала';
  for (let c = 0; c < D.w * D.h; c++) {
    if (H.grid[c]) continue;
    const near = [];
    for (let j = 0; j < D.w * D.h; j++) if (j !== c && !H.grid[j] && tdist(D, c, j) <= r) near.push(j);
    near.sort((a, b) => tdist(D, c, a) - tdist(D, c, b));
    if (near.length < kit.racks + cools) continue;
    const swTile = near.find((j) => tdist(D, c, j) === 1);
    if (swTile === undefined) continue;
    const rest = near.filter((j) => j !== swTile);
    const extraCools = rest.slice(0, cools - 1);
    const racks = rest.slice(cools - 1, cools - 1 + kit.racks);
    if (racks.length < kit.racks || racks.some((j) => tdist(D, j, swTile) > SW[kit.sw].range)) continue;
    H.grid[c] = { k: kit.cool };
    extraCools.forEach((j) => { H.grid[j] = { k: kit.cool }; });
    H.grid[swTile] = { k: kit.sw, cfg: 'ok' };
    racks.forEach((j) => { H.grid[j] = Object.assign(mkRack(Array(kit.per).fill(kit.model)), { link: swTile, cable: 'ok' }); });
    refreshHall(hi);
    return null;
  }
  return 'Нет свободного места под модуль';
}
const kitPrice = (kit) => Math.round((kit.racks * (BUILD.rack.price + kit.per * priceOf(kit.model)) + (kit.cools || 1) * BUILD[kit.cool].price + BUILD[kit.sw].price) * 1.25 + 1500);
function techMult(type) {
  if (type === 'cpu') return (hasTech('virt') ? 1.2 : 1) * (hasTech('k8s') ? 1.25 : 1) * (1 + S.capBonus);
  if (type === 'sto') return hasTech('k8s') ? 1.15 : 1;
  return 1;
}
function hallStats(hi) {
  const H = S.halls[hi], D = HALLS[hi];
  let load = 0, cap = D.kw, backup = 0;
  H.grid.forEach((t) => {
    if (!t) return;
    if (t.k === 'rack') t.s.forEach((m) => { load += MODELS[m].kw; });
    else { const b = BUILD[t.k]; load += b.kw || 0; cap += b.power || 0; backup += b.backup || 0; }
  });
  return { load, cap, backup };
}
