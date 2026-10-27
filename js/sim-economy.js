'use strict';
// ----- energy -----
function spotPrice(h) {
  const curve = h < 6 ? 0.6 : h < 9 ? 0.9 : h < 18 ? 1.15 : h < 22 ? 1.5 : 0.9;
  const heat = S.event && S.event.type === 'heat' ? 1.6 : 1;
  return 0.4 * curve * S.energy.dayF * heat;
}
function elecPrice(h = S.hour) {
  return (S.energy.tariff === 'fixed' ? FIXED_PRICE : spotPrice(h)) * (hasTech('solar') ? 0.65 : 1);
}

// ----- security -----
const revenue24 = () => S.hourly.reduce((a, b) => a + Math.max(0, b), 0);
const threat = () => clamp(5 + revenue24() / 400 + S.rep / 4, 0, 100);
const defense = () => clamp(10 * S.staff.guard + 15 * S.staff.soc + (hasTech('antiddos') ? 10 : 0) + (hasTech('ngfw') ? 20 : 0) + (hasTech('zerotrust') ? 30 : 0) + (S.sec.pentest > 0 ? 20 : 0), 0, 100);
const attackChance = () => clamp(0.04 + (threat() - defense()) / 120, 0.02, 0.5);
function securityDay() {
  if (S.day < 5 || Math.random() >= attackChance()) return;
  const th = threat();
  const types = ['insider', 'leak'];
  if (th >= 30) types.push('ransom', 'ransom');
  const type = pick(types);
  if (type === 'insider') {
    const sum = Math.round(Math.min(Math.max(0, S.money) * 0.05, 20000));
    if (!sum) return;
    S.money -= sum; S.today.other += sum;
    log(`Инсайдер вывел со счёта ${fmt$(sum)}. Усильте защиту`, 'crit');
  } else if (type === 'leak') {
    const fine = Math.round(Math.max(300, revenue24() * 1.5) * (hasTech('offbackup') ? 0.5 : 1) * (S.insured ? 0.5 : 1));
    S.money -= fine; S.today.other += fine;
    S.rep = Math.max(0, S.rep - 6);
    log(`Утечка данных клиентов! Штраф регулятора ${fmt$(fine)}, репутация −6`, 'crit');
  } else {
    const halls = S.halls.map((H, i) => i).filter((i) => S.halls[i].open && !S.halls[i].locked && S.halls[i].grid.some((t) => t && t.k === 'rack' && t.s.length));
    if (!halls.length) return;
    const hi = pick(halls);
    S.halls[hi].locked = hasTech('offbackup') ? 12 : 48;
    const sum = Math.round(Math.max(5000, revenue24() * 2) / 100) * 100;
    S.inbox.unshift({ id: S.nextId++, i: RANSOM, left: 8, data: { hi, sum } });
    log(`Шифровальщик заблокировал «${HALLS[hi].name}» на ${S.halls[hi].locked} ч. Вымогатели ждут ответа в почте`, 'crit');
    toast('Атака шифровальщика! Смотрите почту', 'bad');
  }
  Sound.alarm();
  alertPause('кибератака');
}

// ----- IPO -----
function ipoDay(net) {
  const I = S.ipo;
  if (!I) return;
  I.qProfit += net;
  I.price = Math.max(1, I.price * (1 + rand(-0.02, 0.025) + (net > 0 ? 0.004 : -0.006)));
  I.hist.push(Math.round(I.price * 10) / 10);
  if (I.hist.length > 90) I.hist.shift();
  if (S.day - I.qStart < 30) return;
  if (I.qProfit >= I.target) {
    const g = clamp(I.qProfit / I.target - 1, 0, 1);
    I.price *= 1.05 + g * 0.5;
    I.misses = 0;
    S.rep = Math.min(100, S.rep + 3);
    log(`Квартал закрыт: прибыль ${fmt$(I.qProfit)} при плане ${fmt$(I.target)}. Акции растут`, 'good');
    Sound.win();
  } else {
    I.price *= 0.75;
    I.misses++;
    log(`Квартал провален: ${fmt$(I.qProfit)} при плане ${fmt$(I.target)}. Акции −25%. Промахов подряд: ${I.misses}`, 'crit');
    Sound.bad();
    if (I.misses >= 2) { gameOver('board'); return; }
    toast('Ещё один провальный квартал — и совет директоров вас уволит', 'bad');
  }
  I.target = Math.round(Math.max(I.qProfit, I.target) * 1.1);
  I.qStart = S.day; I.qProfit = 0;
}

// ----- renewals -----
function renewOffer(c) {
  const loyal = (c.loyal || 0) + 1;
  const vip = loyal >= 3;
  const amount = Math.round(c.amount * rand(1, 1.3));
  const pay = Math.round((c.pay / c.amount) * amount * (vip ? 1.3 : 1.12) * 10) / 10;
  return { id: S.nextId++, name: c.name, kind: c.kind, type: c.type, amount, sla: c.sla, lvl: Math.min(c.lvl, repLevel()), pay, days: c.days, expires: 48, renew: true, loyal, vip };
}

// ----- market -----
const hwMult = (type) => S.hw[type];
const priceOf = (m) => Math.round(MODELS[m].price * hwMult(MODELS[m].type));
const sellOf = (m) => Math.round(priceOf(m) * 0.5);
function bumpHw(m, n = 1) { const t = MODELS[m].type; S.hw[t] = Math.min(2.5, S.hw[t] + 0.004 * MODELS[m].tier * n); }
function marketTick() {
  for (const k of ['cpu', 'sto', 'gpu']) {
    const tgt = (S.trend && S.trend.mult[k]) || 1;
    S.market[k] = clamp(S.market[k] + (tgt - S.market[k]) * 0.03 + rand(-0.008, 0.008), 0.4, 2.5);
    const hwT = (0.65 + 0.35 * S.market[k]) * ((S.trend && S.trend.hw && S.trend.hw[k]) || 1);
    S.hw[k] = clamp(S.hw[k] + (hwT - S.hw[k]) * 0.02 + rand(-0.005, 0.005), 0.4, 2.5);
  }
  if (S.trend) {
    if (--S.trend.left <= 0) { log(`Рынок: «${S.trend.name}» закончился`); S.trend = null; }
  } else if (--S.nextTrend <= 0) {
    const T = pick(TRENDS);
    S.trend = { ...T, left: T.days * 24 };
    log(`Рынок: ${T.name}. ${T.desc}`, 'warn');
    toast(`Рынок: ${T.name}`);
    S.nextTrend = randi(5, 9) * 24;
  }
}

// ----- tenders & rivals -----
function tenderTick() {
  const T = S.tender;
  if (T) {
    if (--T.left <= 0) resolveTender();
  } else if (--S.nextTender <= 0) {
    const L = repLevel();
    const lvl = Math.min(5, L + 1);
    const kinds = Object.keys(KINDS).filter((k) => !KINDS[k].req || hasTech(KINDS[k].req));
    const kind = pick(kinds), type = KINDS[kind].type;
    const gov = certOn('gov') && Math.random() < 0.5;
    const amount = Math.round(AMT[type][lvl - 1][1] * rand(0.8, 1.4) * (gov ? 1.5 : 1));
    const sla = gov ? 99.9 : pick([99, 99, 99.9]);
    const base = Math.round(amount * TYPES[type].rate * SLA_MULT[sla] * S.market[type] * 1.15 * (gov ? 1.5 : 1) * certMult(kind, type, sla) * 10) / 10;
    const name = gov ? pick(['Госуслуги Тридевятого царства', 'Минцифры Лукоморья', 'Электронный архив Кощеева ведомства']) : pick(CLIENTS[kind]);
    S.tender = { id: S.nextId++, name, kind, type, amount, sla, lvl, base, days: randi(20, 30) + (gov ? 10 : 0), left: 36, bid: null, gov };
    log(`Объявлен тендер: «${S.tender.name}», ${fmtN(amount)} ${TYPES[type].unit} на ${S.tender.days} дн.`, 'warn');
    toast('Новый тендер! Вкладка «Тендеры»');
    S.nextTender = randi(80, 130);
  }
}
const scoreOf = (bid, rep) => bid / (0.6 + rep / 125);
function resolveTender() {
  const T = S.tender;
  S.tender = null;
  const field = S.rivals.filter((r) => !r.bought).map((r) => ({ name: r.name, r, bid: rand(0.8, 1.15) }));
  field.forEach((f) => { f.score = scoreOf(f.bid, f.r.rep); });
  if (T.bid) field.push({ name: 'Вы', me: true, bid: T.bid, score: scoreOf(T.bid, S.rep) });
  if (!field.length) return;
  field.sort((a, b) => a.score - b.score);
  const win = field[0];
  if (win.me) {
    const pay = Math.round(T.base * T.bid * 10) / 10;
    S.contracts.push({ id: S.nextId++, name: T.name, kind: T.kind, type: T.type, amount: T.amount, sla: T.sla, lvl: T.lvl, pay, days: T.days, left: T.days * 24, ok: 0, hrs: 0, tender: true });
    S.stats.tenders++; S.stats.signed++;
    S.rep = Math.min(100, S.rep + 3);
    log(`Тендер выигран: «${T.name}» на ${T.days} дн., ${fmt$(pay)}/ч. Готовьте мощности!`, 'good');
    toast('Тендер выигран!', 'good');
    Sound.win();
  } else {
    win.r.rep = Math.min(95, win.r.rep + 2);
    log(`Тендер «${T.name}» выиграл ${win.name}${T.bid ? '' : ' (вы не участвовали)'}`, T.bid ? 'warn' : '');
  }
  S.tlog.unshift({ name: T.name, winner: win.name, me: !!win.me });
  S.tlog.length = Math.min(S.tlog.length, 5);
}
const rivalPrice = (r) => Math.round((40000 + r.rep * r.rep * 140) / 1000) * 1000;
