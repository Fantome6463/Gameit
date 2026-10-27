'use strict';
// ================= TECH DEBT =================
// Ремонт «на изоленте» дешёвый и быстрый, но копит технический долг зала (H.debt, 0–100).
// Долг повышает шанс поломок и рано или поздно «взыскивается» каскадной аварией.
// Гасится рефакторингом за деньги или потихоньку свободными админами.
const QUICK_SHARE = 0.25;     // изолента стоит четверть честного ремонта
const DEBT_PER_TIER = 4;      // долг за каждый сервер × его поколение
const DEBT_SAFE = 25;         // до этого уровня каскадов не бывает
const brokenOf = (t) => t.s.slice(t.s.length - t.broken);
const repairCost = (t) => brokenOf(t).reduce((a, m) => a + 80 * MODELS[m].tier, 0);
const quickCost = (t) => Math.round(repairCost(t) * QUICK_SHARE);
const quickDebt = (t) => brokenOf(t).reduce((a, m) => a + DEBT_PER_TIER * MODELS[m].tier, 0);
const debtOf = (hi) => S.halls[hi].debt || 0;
const debtFailMult = (hi) => 1 + debtOf(hi) / 50;
const cascadeChance = (hi) => Math.max(0, debtOf(hi) - DEBT_SAFE) * 0.0002;
const refactorCost = (hi) => Math.round(debtOf(hi) * (60 + 40 * HALLS[hi].lvl));
function addDebt(hi, v) { S.halls[hi].debt = clamp(debtOf(hi) + v, 0, 100); }

// Чинит стойку: честно (дороже, без долга) или на изоленте (дешевле, с долгом). Возвращает число починенных серверов.
function fixRack(hi, t, quick) {
  const n = t.broken;
  if (quick) addDebt(hi, quickDebt(t));
  t.broken = 0; t.lastBroken = 0;
  return n;
}

function debtTick() {
  // свободные админы понемногу разгребают костыли там, где их больше всего
  const idle = S.staff.admin - S.jobs.length;
  if (idle > 0) {
    let worst = -1;
    S.halls.forEach((H, hi) => { if (H.open && debtOf(hi) > 0 && (worst < 0 || debtOf(hi) > debtOf(worst))) worst = hi; });
    if (worst >= 0) addDebt(worst, -0.05 * idle);
  }
  S.halls.forEach((H, hi) => {
    if (!H.open || H.dark || Math.random() >= cascadeChance(hi)) return;
    cascade(hi);
  });
}

// Каскадная авария: отказывает стойка и все соседи вокруг неё, долг частично «списывается».
function cascade(hi) {
  const H = S.halls[hi], D = HALLS[hi];
  const racks = [];
  H.grid.forEach((t, i) => { if (t && t.k === 'rack' && t.s.length > t.broken) racks.push(i); });
  if (!racks.length) return;
  const c = pick(racks);
  let n = 0;
  racks.forEach((i) => {
    if (tdist(D, c, i) > 1) return;
    const t = H.grid[i];
    n += t.s.length - t.broken;
    t.broken = t.s.length;
  });
  H.debt = Math.round(debtOf(hi) * 0.6);
  S.stats.cascades = (S.stats.cascades || 0) + 1;
  log(`Технический долг взыскан: в «${D.name}» каскадом отказали ${n} серв. вокруг ${tileName(hi, c)}. Костыли не выдержали`, 'crit');
  Sound.crash();
  if (S.cur !== hi) toast(`Каскадная авария: ${D.name}`, 'bad');
  alertPause('каскадная авария');
}
