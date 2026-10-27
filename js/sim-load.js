'use strict';
// ================= LOAD =================
// Клиент платит за пик по договору (amount), а использует обычно меньше: c.use — доля от договора,
// медленно гуляет вокруг личной нормы c.base. В пиковый спрос и на рыночном буме все тянут почти всё.
// Поэтому можно продать больше мощности, чем есть (овербукинг), — и надеяться, что пик не придёт.
const OVERSELL = [1, 1.2, 1.5];
const oversell = () => OVERSELL[S.policy.oversell || 0];

// Суточный график нагрузки по договорам (использование 100%), с предложением extra или без.
function contractCurve(type, extra) {
  const out = Array(24).fill(0);
  const list = extra ? [...S.contracts, extra] : S.contracts;
  list.forEach((c) => {
    if (c.type !== type) return;
    const f = PROF[KINDS[c.kind].prof];
    for (let h = 0; h < 24; h++) out[h] += c.amount * f(h);
  });
  return out;
}
const planPeak = (type, extra) => Math.max(0, ...contractCurve(type, extra));

function useTarget(c) {
  if (S.event && S.event.type === 'surge') return 1;
  const boom = S.trend && S.trend.mult[c.type] > 1.2 ? 0.2 : 0;
  return clamp(c.base + boom, 0.3, 1);
}
function usageTick() {
  S.contracts.forEach((c) => {
    if (c.base === undefined) { c.base = rand(0.55, 0.85); c.use = c.base; }
    c.use = clamp(c.use + (useTarget(c) - c.use) * 0.3 + rand(-0.04, 0.04), 0.3, 1);
  });
}
