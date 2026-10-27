'use strict';
// ================= SIMULATION =================
const capsOf = (M) => M.caps || { [M.type]: M.cap };
function rackCap(t, hallDark, grid) {
  const res = { cpu: 0, sto: 0, gpu: 0 };
  if (hallDark || t.fire) return res;
  const throttle = (t.temp > 40 ? 0.6 : t.temp > 32 ? 0.85 : 1) * netMult(grid, t);
  const working = t.s.length - t.broken;
  for (let i = 0; i < working; i++) { const c = capsOf(MODELS[t.s[i]]); for (const k in c) res[k] += c[k] * throttle; }
  return res;
}
// ----- in-hall network -----
const isSwitch = (t) => !!(t && SW[t.k]);
const tdist = (D, a, b) => Math.max(Math.abs((a % D.w) - (b % D.w)), Math.abs(Math.floor(a / D.w) - Math.floor(b / D.w)));
function netMult(grid, t) {
  if (t.link === undefined) return 1;
  if (t.link === null || t.cable !== 'ok') return 0;
  const sw = grid[t.link];
  if (!isSwitch(sw)) return 0;
  return sw.cfg === 'ok' ? 1 : sw.cfg === 'bad' ? 0.6 : 0;
}
const portsUsed = (grid, si) => grid.reduce((a, t) => a + (t && t.k === 'rack' && t.link === si ? 1 : 0), 0);
function switchFor(hi, i) {
  const H = S.halls[hi], D = HALLS[hi];
  let best = null;
  H.grid.forEach((sw, j) => {
    if (!isSwitch(sw)) return;
    const d = tdist(D, i, j);
    if (d > SW[sw.k].range || portsUsed(H.grid, j) >= SW[sw.k].ports) return;
    if (!best || d < best.d) best = { j, d };
  });
  return best;
}
const manualBusy = () => S.netJobs.some((j) => j.by === 'manual') || S.asm.some((j) => j.by === 'manual');
const cableCost = (d, by) => (by === 'contract' ? 150 + 40 * d : 20 * d);
function startCable(hi, i, by, quiet) {
  const t = S.halls[hi].grid[i];
  if (!t || t.k !== 'rack' || t.link !== null) return false;
  if (by === 'manual' && manualBusy()) { if (!quiet) toast('Вы уже заняты другой ручной работой', 'bad'); return false; }
  const sw = switchFor(hi, i);
  if (!sw) { if (!quiet) toast('Рядом нет коммутатора со свободным портом', 'bad'); return false; }
  const cost = cableCost(sw.d, by);
  if (S.money < cost) { if (!quiet) toast('Не хватает денег', 'bad'); return false; }
  S.money -= cost; S.today.other += cost;
  t.link = sw.j; t.cable = 'laying';
  S.netJobs.push({ kind: 'cable', h: hi, i, by, left: by === 'contract' ? 1 : 1 + sw.d });
  return true;
}
function startCfg(hi, i, by) {
  const sw = S.halls[hi].grid[i];
  if (!isSwitch(sw) || sw.cfg === 'work') return false;
  if (by === 'contract') { if (!spend(500)) return false; }
  sw.cfg = 'work';
  S.netJobs.push({ kind: 'cfg', h: hi, i, by, left: by === 'contract' ? 1 : 3 });
  return true;
}
function netTick() {
  S.netJobs = S.netJobs.filter((j) => {
    const t = S.halls[j.h].grid[j.i];
    return j.kind === 'cable' ? t && t.k === 'rack' && t.cable === 'laying' : isSwitch(t) && t.cfg === 'work';
  });
  S.netJobs.forEach((j) => {
    if (--j.left > 0) return;
    const t = S.halls[j.h].grid[j.i];
    if (j.kind === 'cable') { t.cable = 'ok'; if (j.by === 'manual') log(`Вы проложили кабель к стойке ${tileName(j.h, j.i)}`, 'good'); }
    else { t.cfg = 'ok'; log(`Коммутатор ${tileName(j.h, j.i)} настроен`, 'good'); }
    j.done = true;
  });
  S.netJobs = S.netJobs.filter((j) => !j.done);
  if (hasTech('sdn')) S.halls.forEach((H) => H.grid.forEach((t) => { if (isSwitch(t) && t.cfg === 'raw') t.cfg = 'ok'; }));
  let free = S.staff.neteng - S.netJobs.filter((j) => j.by === 'eng').length;
  if (free <= 0) return;
  S.halls.forEach((H, hi) => {
    if (!H.open) return;
    H.grid.forEach((t, i) => { if (free > 0 && isSwitch(t) && (t.cfg === 'raw' || t.cfg === 'bad') && startCfg(hi, i, 'eng')) free--; });
  });
  S.halls.forEach((H, hi) => {
    if (!H.open) return;
    H.grid.forEach((t, i) => { if (free > 0 && t && t.k === 'rack' && t.link === null && startCable(hi, i, 'eng', true)) free--; });
  });
}
function cfgAnswer(hi) {
  const H = S.halls[hi];
  let sto = false, tier = 1;
  H.grid.forEach((t) => { if (t && t.k === 'rack') t.s.forEach((m) => { const M = MODELS[m]; if (capsOf(M).sto) sto = true; tier = Math.max(tier, M.tier); }); });
  const sws = H.grid.filter(isSwitch).length;
  return { vlan: String((hi + 1) * 10), mtu: sto ? '9000' : '1500', uplink: 'trunk', stp: sws > 1 ? 'вкл' : 'выкл', speed: ['10G', '25G', '100G'][tier - 1] };
}
