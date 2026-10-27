'use strict';
// ----- procurement -----
function bestModel(type) {
  return Object.keys(MODELS).filter((k) => !MODELS[k].custom && MODELS[k].type === type && (!MODELS[k].req || hasTech(MODELS[k].req))).sort((a, b) => MODELS[b].cap - MODELS[a].cap)[0];
}
function findSlot(kw) {
  let best = null;
  S.halls.forEach((H, hi) => {
    if (!H.open || H.dark) return;
    const st = hallStats(hi);
    if (st.load + kw > st.cap) return;
    H.grid.forEach((t, i) => {
      if (!t || t.k !== 'rack' || t.fire || slotsFree(t) <= 0 || t.temp > 34 || netMult(H.grid, t) === 0 && t.cable !== 'laying') return;
      if (!best || t.temp < best.t.temp) best = { hi, i, t };
    });
  });
  return best;
}
function findRackSpot(kw) {
  let best = null;
  S.halls.forEach((H, hi) => {
    if (!H.open) return;
    const D = HALLS[hi];
    const st = hallStats(hi);
    if (st.load + kw > st.cap) return;
    H.grid.forEach((t, i) => {
      if (t) return;
      const x = i % D.w, y = Math.floor(i / D.w);
      let score = 0;
      H.grid.forEach((c, j) => {
        const b = c && BUILD[c.k];
        if (!b || !b.cool) return;
        const cx = j % D.w, cy = Math.floor(j / D.w);
        if (Math.max(Math.abs(cx - x), Math.abs(cy - y)) > b.r) return;
        let n = 1;
        H.grid.forEach((r, k) => { if (r && (r.k === 'rack' || r.k === 'miner') && Math.max(Math.abs((k % D.w) - cx), Math.abs(Math.floor(k / D.w) - cy)) <= b.r) n++; });
        score += b.cool / n;
      });
      if (score >= 12 && (!best || score > best.score)) best = { hi, i, score };
    });
  });
  return best && [best.hi, best.i];
}
let buyerWarned = 0;
function autoBuy() {
  const P = S.policy;
  let bought = 0, racks = 0, blocked = false;
  for (const type of ['cpu', 'sto', 'gpu']) {
    if (!S.peak[type]) continue;
    const m = bestModel(type);
    if (!m) continue;
    const M = MODELS[m];
    let need = (S.peak[type] / oversell()) * (1 + P.headroom) - S.cap[type];
    while (need > 0 && bought < 10) {
      const price = priceOf(m);
      if (S.money - price < P.reserve) break;
      let slot = findSlot(M.kw);
      if (!slot && P.racks) {
        const sp = findRackSpot(M.kw);
        if (sp && S.money - price - BUILD.rack.price >= P.reserve) {
          S.halls[sp[0]].grid[sp[1]] = mkRack();
          S.money -= BUILD.rack.price; S.today.other += BUILD.rack.price;
          racks++;
          slot = { hi: sp[0], i: sp[1], t: S.halls[sp[0]].grid[sp[1]] };
          startCable(sp[0], sp[1], S.staff.neteng ? 'eng' : 'contract', true);
        }
      }
      if (!slot) { blocked = true; break; }
      slot.t.s.splice(slot.t.s.length - slot.t.broken, 0, m);
      S.money -= price; S.today.other += price;
      bumpHw(m);
      refreshHall(slot.hi);
      need -= M.cap * techMult(type);
      bought++;
    }
  }
  if (bought) log(`Завхоз докупил серверов: ${bought}${racks ? `, поставил стоек: ${racks}` : ''}`);
  if (blocked && S.day > buyerWarned) { buyerWarned = S.day; log('Завхоз: некуда ставить серверы — нужны кондиционеры, трансформаторы или новый зал', 'warn'); }
}

// ----- mail -----
function answerMail(m, a, silent) {
  S.inbox = S.inbox.filter((x) => x !== m);
  const M = MSGS[m.i];
  if (silent) a = M.def || 'no';
  log(silent ? `${M.from}: без ответа (${M[a][0].toLowerCase()})` : `Вы → ${M.from}: «${M[a][0]}»`);
  M[a][1](m.data);
}

// ----- bulk -----
function hallServerCount(hi, model) {
  return S.halls[hi].grid.reduce((a, t) => a + (t && t.k === 'rack' ? t.s.filter((x) => x === model).length : 0), 0);
}
function fillRacks(list, hi, m) {
  let n = 0;
  const M = MODELS[m];
  for (const t of list) {
    while (slotsFree(t) > 0) {
      const st = hallStats(hi);
      if (st.load + M.kw > st.cap) { if (!n) toast('Не хватает мощности зала. Поставьте трансформатор', 'bad'); return n; }
      if (S.money < priceOf(m)) { if (!n) toast('Не хватает денег', 'bad'); return n; }
      S.money -= priceOf(m); S.today.other += priceOf(m);
      bumpHw(m);
      t.s.splice(t.s.length - t.broken, 0, m);
      n++;
    }
  }
  return n;
}
