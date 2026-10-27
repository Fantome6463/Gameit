'use strict';
// ================= CONTRACTS =================
function genOffer(small) {
  const L = repLevel();
  const kinds = Object.keys(KINDS).filter((k) => (!KINDS[k].req || hasTech(KINDS[k].req)));
  if (certOn('pci')) kinds.push('bank', 'bank');
  const kind = pick(kinds);
  const K = KINDS[kind];
  let lvl = small ? 1 : clamp(L + pick([-1, 0, 0, 0, 1]), 1, 5);
  if (K.lvl) lvl = Math.max(lvl, K.lvl);
  const [a, b] = AMT[K.type][lvl - 1];
  const amount = Math.round(rand(a, b));
  const sla = K.sla || pick([95, 95, 99]);
  const crypto = S.event && S.event.type === 'crypto' && K.type === 'gpu' ? 2 : 1;
  const urgent = !small && Math.random() < 0.15;
  const pay = amount * TYPES[K.type].rate * SLA_MULT[sla] * rand(0.85, 1.25) * (1 + 0.05 * S.staff.sales) * (hasTech('peering') ? 1.15 : 1) * crypto
    * TARIFFS[S.tariff].pay * (urgent ? 2.2 : 1) * S.market[K.type] * certMult(kind, K.type, sla);
  return {
    id: S.nextId++, name: pick(CLIENTS[kind]), kind, type: K.type, amount, sla, lvl, urgent,
    pay: Math.max(1, Math.round(pay * 10) / 10),
    days: small ? 4 : urgent ? randi(1, 2) : randi(5, 10) + lvl * 2,
    expires: urgent ? randi(12, 20) : randi(60, 110),
  };
}
function certMult(kind, type, sla) {
  let m = 1;
  if (certOn('tier3') && sla >= 99.9) m *= 1.2;
  if (certOn('iso')) m *= 1.1;
  if (certOn('pci') && kind === 'bank') m *= 1.4;
  if (certOn('green') && (type === 'sto' || type === 'gpu')) m *= 1.2;
  return m;
}
