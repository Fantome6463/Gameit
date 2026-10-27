// Простой бот-игрок для тестов и проверки баланса. Играет как осторожный новичок:
// берёт контракты под свободную мощность, докупает серверы и стойки, нанимает админа, изучает базовые технологии.
// Вызывается раз в игровой час внутри контекста игры.
export const BOT = `
function botHour() {
  S.autoNo = true;
  [...S.inbox].forEach((m) => answerMail(m, null, true));
  const spare = {};
  for (const k in S.cap) spare[k] = S.cap[k] * 0.9 - S.peak[k];
  const bwFull = S.bw.dem > S.bw.cap * 0.75;
  // Канал забит — расширяем аплинк зала.
  if (bwFull) {
    const nx = (S.halls[0].net || 0) + 1;
    if (NET_TIERS[nx] && S.money > NET_TIERS[nx].price + 1000) ACT.netup(0);
  }
  // Резерв питания на случай отключений.
  if (S.money > 3000 && hallStats(0).backup < hallStats(0).load) {
    const e = emptyTiles().find(([h]) => h === 0);
    if (e) place('ups', e[0], e[1]);
  }
  // Контракты, на которые хватает мощности (и канала).
  if (!bwFull) S.offers.filter((o) => o.lvl <= repLevel()).sort((a, b) => b.pay / b.amount - a.pay / a.amount).forEach((o) => {
    if (spare[o.type] >= o.amount) { spare[o.type] -= o.amount; ACT.sign(o.id); }
  });
  // Нехватка мощности под лучшее предложение — докупаем серверы.
  const want = S.offers.filter((o) => o.lvl <= repLevel() && (o.type === 'cpu' || hasTech('gpu') || o.type === 'sto'))[0];
  if (want && S.money > 1500) {
    const m = bestModel(want.type);
    const slot = m && findSlot(MODELS[m].kw);
    if (slot && S.money > priceOf(m) + 800) { S.sel = { h: slot.hi, i: slot.i }; ACT.addsrv(m); }
    else if (!slot && S.money > 2500) {
      const spot = findRackSpot(0.5);
      if (spot && place('rack', spot[0], spot[1])) startCable(spot[0], spot[1], 'manual', true);
      else if (!spot && S.money > 2000) {
        const e = emptyTiles().find(([h]) => h === S.cur);
        if (e) place('crac', e[0], e[1]);
      }
    }
  }
  // Голые стойки без кабеля — подключаем.
  allRacks((t) => t.link === null).forEach((r) => startCable(r.hi, r.i, 'manual', true));
  if (S.day >= 2 && S.staff.admin === 0 && S.money > 1500) ACT.hire('admin');
  if (!S.research && S.money > 8000) {
    const t = ['silver', 'virt', 'chiller', 'flash'].find((id) => !hasTech(id));
    if (t) ACT.research(t);
  }
}
`;
