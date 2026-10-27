'use strict';
function tick() {
  S.hour++;
  if (S.hour >= 24) { S.hour = 0; newDay(); }
  const ev = S.event;
  const outage = ev && ev.type === 'outage';

  // halls: power
  S.halls.forEach((H, hi) => {
    if (!H.open) return;
    const st = hallStats(hi);
    H.load = st.load; H.cap = st.cap; H.backup = st.backup;
    const wasDark = H.dark;
    if (H.locked > 0 && --H.locked === 0) log(`${HALLS[hi].name}: системы восстановлены после атаки`, 'good');
    H.dark = (!!outage && st.backup < st.load) || H.locked > 0;
    if (H.dark && !wasDark && !H.locked) log(`${HALLS[hi].name}: резерва не хватило, зал обесточен`, 'crit');
  });

  // capacity
  const cap = { cpu: 0, sto: 0, gpu: 0 };
  S.halls.forEach((H) => {
    if (!H.open) return;
    H.grid.forEach((t) => { if (t && t.k === 'rack') { const c = rackCap(t, H.dark, H.grid); cap.cpu += c.cpu; cap.sto += c.sto; cap.gpu += c.gpu; } });
  });
  for (const k in cap) cap[k] *= techMult(k);

  // demand
  const dem = { cpu: 0, sto: 0, gpu: 0 }, peak = { cpu: 0, sto: 0, gpu: 0 };
  S.contracts.forEach((c) => { dem[c.type] += c.amount * PROF[KINDS[c.kind].prof](S.hour); peak[c.type] += c.amount; });
  // network
  let bwDem = 0, bwCap = 0;
  S.contracts.forEach((c) => {
    const cdn = hasTech('cdn') && (c.kind === 'web' || c.kind === 'media' || c.kind === 'game') ? 0.6 : 1;
    bwDem += c.amount * BW[c.kind] * PROF[KINDS[c.kind].prof](S.hour) * cdn;
  });
  S.halls.forEach((H) => { if (H.open && !H.dark) bwCap += NET_TIERS[H.net || 0].cap; });
  if (ev && ev.type === 'ddos') {
    const shield = hasTech('antiddos') ? 0.15 : 1 - Math.min(0.6, S.staff.guard * 0.15);
    bwDem += Math.min(400, bwCap * 0.9) * shield;
  }
  const netF = bwDem > 0 ? Math.min(1, bwCap / bwDem) : 1;
  S.bw = { dem: bwDem, cap: bwCap };
  const served = {}, util = {};
  for (const k in dem) {
    served[k] = dem[k] > 0 ? Math.min(1, cap[k] / dem[k]) * netF : 1;
    if (ev && ev.type === 'fiber') served[k] *= 0.4;
    util[k] = cap[k] > 0 ? Math.min(1, dem[k] / cap[k]) : 0;
  }
  S.cap = cap; S.dem = dem; S.peak = peak; S.served = served;

  // thermal
  const heatwave = ev && ev.type === 'heat' ? 8 : 0;
  const engMult = 1 + 0.08 * S.staff.eng;
  const fail = 0.002 * (hasTech('aiops') ? 0.4 : 1);
  S.halls.forEach((H, hi) => {
    if (!H.open) return;
    const D = HALLS[hi];
    const amb = D.amb + (D.amb >= 15 ? heatwave : 0);
    const racks = [];
    H.grid.forEach((t, i) => { if (t && (t.k === 'rack' || t.k === 'miner')) { t.cool = 0; racks.push(i); } });
    if (!H.dark) {
      H.grid.forEach((t, i) => {
        if (!t || !BUILD[t.k].cool) return;
        const b = BUILD[t.k];
        const x = i % D.w, y = Math.floor(i / D.w);
        const inRange = racks.filter((j) => Math.max(Math.abs((j % D.w) - x), Math.abs(Math.floor(j / D.w) - y)) <= b.r);
        inRange.forEach((j) => { H.grid[j].cool += (b.cool * engMult) / inRange.length; });
      });
    }
    racks.forEach((i) => {
      const t = H.grid[i];
      let heat = 0;
      if (t.k === 'miner') heat = H.dark ? 0 : MINER_HEAT;
      else if (!H.dark) {
        const working = t.s.length - t.broken;
        for (let n = 0; n < working; n++) {
          const m = MODELS[t.s[n]];
          heat += m.heat * (0.3 + 0.7 * util[m.type]) * (m.type === 'gpu' && hasTech('liquid') ? 0.5 : 1);
        }
      }
      if (t.net && !H.dark) heat += SW[t.net.k].heat;
      if (t.fire) heat += 30;
      t.heat = heat;
      const target = amb + heat * 0.12 + Math.max(0, heat - t.cool) * 1.2;
      t.temp += (target - t.temp) * 0.5;
      if (H.dark || t.fire) return;
      if (t.k === 'miner') { if (t.temp > 44 && !t.fire && Math.random() < 0.04) { t.fire = 5; t.fireAge = 0; log(`ПОЖАР на ASIC-ферме, клетка ${tileName(hi, i)}!`, 'crit'); Sound.alarm(); alertPause('пожар'); } return; }
      // failures (wear grows with age; engineers slow it down)
      t.age = (t.age || 0) + 1 / (1 + 0.15 * S.staff.eng);
      const p = fail * (t.temp > 32 ? 2.5 : 1) * (t.temp > 40 ? 4 : 1) * (1 + t.age / 480);
      const working = t.s.length - t.broken;
      for (let n = 0; n < working; n++) if (Math.random() < p) t.broken++;
      if (t.broken > 0 && t.broken > (t.lastBroken || 0)) log(`Сломался сервер в ${HALLS[hi].name}, стойка ${tileName(hi, i)}`, 'warn');
      t.lastBroken = t.broken;
      if (t.temp > 44 && (t.k === 'miner' || t.s.length) && Math.random() < 0.04) {
        t.fire = 5; t.fireAge = 0;
        log(`ПОЖАР! ${HALLS[hi].name}, клетка ${tileName(hi, i)}. Кликните, чтобы потушить`, 'crit');
        Sound.alarm();
        if (S.cur !== hi) toast(`Пожар: ${HALLS[hi].name}, ${tileName(hi, i)}`, 'bad');
        alertPause('пожар');
      }
    });
    // fires
    racks.forEach((i) => {
      const t = H.grid[i];
      if (!t.fire) return;
      t.fireAge++;
      if (S.staff.guard > 0 && t.fireAge >= 1) { t.fire = 0; log(`Безопасник потушил стойку ${tileName(hi, i)}`, 'good'); return; }
      if (--t.fire <= 0 && t.k === 'miner') {
        H.grid[i] = null;
        log(`ASIC-ферма соседей сгорела дотла. Соседи в ярости`, 'crit');
        Sound.crash();
        return;
      }
      if (t.fire <= 0) {
        const lost = t.s.length;
        if (S.insured && lost) {
          const pay = Math.round(t.s.reduce((a, m) => a + priceOf(m), 0) * 0.8);
          S.money += pay; S.today.other -= pay;
          log(`Страховая выплатила ${fmt$(pay)} за сгоревшую стойку`, 'good');
        }
        t.s = []; t.broken = 0; t.lastBroken = 0; t.fire = 0; t.temp = amb + 20;
        log(`Стойка ${tileName(hi, i)} сгорела: потеряно серверов ${lost}`, 'crit');
        Sound.crash();
      }
    });
  });

  // money: contracts
  let income = 0;
  const finished = [];
  S.contracts.forEach((c) => {
    const f = served[c.type];
    income += c.pay * f;
    c.ok += f; c.hrs++; c.left--;
    if (c.left <= 0) finished.push(c);
  });
  finished.forEach((c) => {
    S.contracts = S.contracts.filter((x) => x !== c);
    const up = (c.ok / c.hrs) * 100;
    if (up >= c.sla - 0.001) {
      const bonus = Math.round(c.pay * 8);
      S.money += bonus; S.today.inc += bonus;
      S.rep = Math.min(100, S.rep + (2 + c.lvl * 1.5) * TARIFFS[S.tariff].rep);
      S.stats.done++;
      log(`Контракт «${c.name}» выполнен (${up.toFixed(2)}%). Бонус ${fmt$(bonus)}`, 'good');
      Sound.coin();
      if (!c.urgent && !c.tender && Math.random() < 0.65) {
        const o = renewOffer(c);
        S.offers.unshift(o);
        log(`«${c.name}» хочет продлить контракт${o.vip ? ' (VIP-клиент)' : ''}: ${fmt$(o.pay)}/ч`, 'good');
      }
    } else {
      const fine = Math.round(c.pay * 12 * (S.insured ? 0.5 : 1));
      S.money -= fine; S.today.other += fine;
      S.rep = Math.max(0, S.rep - 4 - c.lvl * 2);
      S.stats.failed++;
      if (c.loyal) S.rep = Math.max(0, S.rep - 2 * c.loyal);
      log(`SLA нарушен: «${c.name}» (${up.toFixed(2)}% < ${c.sla}%). Штраф ${fmt$(fine)}${c.loyal ? '. Постоянный клиент ушёл и рассказал всем' : ''}`, 'crit');
      Sound.bad();
    }
  });
  income *= 1 - S.equity;
  income += S.subs;
  S.halls.forEach((H) => { if (H.open && !H.dark) H.grid.forEach((t) => { if (t && t.k === 'miner' && !t.fire) income += 30; }); });
  // heat reuse
  let heatInc = 0;
  S.halls.forEach((H, hi) => {
    if (!H.open || H.dark) return;
    const D = HALLS[hi];
    H.grid.forEach((t, i) => {
      if (!t || t.k !== 'heatx') return;
      const x = i % D.w, y = Math.floor(i / D.w);
      H.grid.forEach((r, j) => {
        if (r && (r.k === 'rack' || r.k === 'miner') && Math.max(Math.abs((j % D.w) - x), Math.abs(Math.floor(j / D.w) - y)) <= 2) heatInc += (r.heat || 0) * 0.05 * (D.amb < 15 ? 2 : 1);
      });
    });
  });
  S.heatInc = heatInc;
  income += heatInc;
  // expenses: electricity (spot/fixed tariff, own gas generation)
  const price = elecPrice();
  let elec = 0;
  S.halls.forEach((H, hi) => {
    if (!H.open || H.dark) return;
    const gasCap = H.grid.reduce((a, t) => a + (t && BUILD[t.k] && BUILD[t.k].gas ? BUILD[t.k].gas : 0), 0);
    const useGas = outage || price > GAS_FUEL ? Math.min(H.load, gasCap) : 0;
    const grid = outage ? 0 : H.load - useGas;
    H.gasUsed = useGas;
    elec += grid * price + useGas * GAS_FUEL;
  });
  S.money += income - elec;
  S.today.inc += income; S.today.elec += elec;
  S.hourly.push(income - elec);
  if (S.hourly.length > 24) S.hourly.shift();

  // reputation drift
  let allGood = true;
  for (const k in dem) if (dem[k] > 0 && served[k] < 0.98) { S.rep = Math.max(0, S.rep - (1 - served[k]) * 0.6); allGood = false; }
  if (allGood && S.contracts.length) S.rep = Math.min(100, S.rep + 0.02);

  // offers
  S.offers.forEach((o) => o.expires--);
  S.offers = S.offers.filter((o) => o.expires > 0);
  const want = 3 + S.staff.sales + (S.promo > 0 ? 3 : 0);
  const flow = 0.25 * TARIFFS[S.tariff].flow * (S.promo > 0 ? 2.5 : 1);
  if (S.offers.length < want && Math.random() < flow) S.offers.push(genOffer());
  if (S.promo > 0) S.promo--;
  if (S.sec.pentest > 0) S.sec.pentest--;
  if (S.staff.acct > 0) autoSign();
  if (S.staff.buyer > 0 && S.hour % 3 === 0) autoBuy();
  marketTick();
  tenderTick();

  // mail
  S.inbox.forEach((m) => { m.left--; });
  S.inbox.filter((m) => m.left <= 0).forEach((m) => answerMail(m, 'no', true));
  if (--S.nextMsg <= 0) {
    const ok = MSGS.map((m, i) => i).filter((i) => i !== S.lastMsg && !S.inbox.some((m) => m.i === i) && (!MSGS[i].cond || MSGS[i].cond()));
    if (ok.length && S.inbox.length < 3) {
      const i = pick(ok);
      const m = { id: S.nextId++, i, left: 30, data: MSGS[i].init ? MSGS[i].init() : {} };
      S.lastMsg = i;
      if (S.autoNo) answerMail(m, 'no', true);
      else { S.inbox.push(m); toast(`Новое письмо: ${MSGS[i].from}`); Sound.coin(); }
    }
    S.nextMsg = randi(28, 52);
  }

  // research
  if (S.research) {
    S.research.left--;
    if (S.research.left <= 0) {
      const t = TECH.find((x) => x.id === S.research.id);
      S.tech[t.id] = true; S.research = null;
      log(`Исследование завершено: ${t.name}`, 'good');
      toast(`Изучено: ${t.name}`, 'good');
      Sound.win();
    }
  }

  // staff jobs
  runJobs();
  netTick();
  asmTick();

  // events
  if (ev) {
    ev.left--;
    if (ev.left <= 0) { log(`Закончилось: ${EVENTS[ev.type].name}`, 'good'); S.event = null; }
  } else if (--S.nextEvent <= 0) {
    const types = Object.keys(EVENTS).filter((k) => !EVENTS[k].skip || !hasTech(EVENTS[k].skip));
    const type = pick(types);
    const E = EVENTS[type];
    S.event = { type, left: randi(E.h[0], E.h[1]) };
    log(`${E.name}! ${E.desc}`, type === 'crypto' ? 'good' : 'crit');
    if (type !== 'crypto') { Sound.alarm(); alertPause(E.name.toLowerCase()); }
    S.nextEvent = randi(36, 84);
  }

  checkGoals();
}

function runJobs() {
  // drop stale jobs
  S.jobs = S.jobs.filter((j) => {
    const t = S.halls[j.h].grid[j.i];
    return t && t.k === 'rack' && (j.kind === 'fire' ? t.fire > 0 : t.broken > 0);
  });
  // progress
  S.jobs.forEach((j) => {
    j.t++;
    if (j.t >= j.travel + j.work) {
      const t = S.halls[j.h].grid[j.i];
      if (j.kind === 'fire') { t.fire = 0; log(`Админ потушил стойку ${tileName(j.h, j.i)}`, 'good'); }
      else { log(`Админ починил ${t.broken} серв. в стойке ${tileName(j.h, j.i)}`, 'good'); t.broken = 0; t.lastBroken = 0; }
      j.done = true;
    }
  });
  S.jobs = S.jobs.filter((j) => !j.done);
  // assign
  let idle = S.staff.admin - S.jobs.length;
  if (idle <= 0) return;
  const todo = [];
  S.halls.forEach((H, hi) => {
    if (!H.open) return;
    H.grid.forEach((t, i) => {
      if (!t || t.k !== 'rack') return;
      if (S.jobs.some((j) => j.h === hi && j.i === i)) return;
      if (t.fire) todo.unshift({ h: hi, i, kind: 'fire' });
      else if (t.broken) todo.push({ h: hi, i, kind: 'repair' });
    });
  });
  todo.slice(0, idle).forEach((j) => {
    const D = HALLS[j.h];
    const dist = (j.i % D.w) + Math.abs(Math.floor(j.i / D.w) - D.h / 2);
    j.travel = Math.max(1, Math.ceil(dist / 4));
    j.work = j.kind === 'fire' ? 1 : hasTech('aiops') ? 1 : 2;
    j.t = 0;
    S.jobs.push(j);
  });
}

function newDay() {
  S.day++;
  const sal = Object.keys(STAFF).reduce((a, k) => a + STAFF[k].pay * S.staff[k], 0);
  const rent = HALLS.reduce((a, h, i) => a + (S.halls[i].open ? h.rent : 0), 0);
  const interest = Math.round(S.loan * 0.012);
  const netFee = S.halls.reduce((a, H) => a + (H.open ? NET_TIERS[H.net || 0].fee : 0), 0);
  if (netFee) { S.money -= netFee; S.today.other += netFee; }
  S.energy.tariff = S.energy.next;
  S.energy.dayF = rand(0.8, 1.3);
  const premium = S.insured ? insurancePremium() : 0;
  if (premium) { S.money -= premium; S.today.other += premium; }
  CERTS.forEach((c) => {
    const st = S.certs[c.id];
    if (!st) return;
    const ok = c.ok();
    if (st.on && !ok) { st.on = false; log(`Сертификат ${c.name} приостановлен: ${c.need.toLowerCase()}`, 'crit'); Sound.bad(); }
    else if (!st.on && ok) { st.on = true; log(`Сертификат ${c.name} восстановлен`, 'good'); }
  });
  S.money -= sal + rent + interest;
  S.today.sal += sal; S.today.rent += rent; S.today.other += interest;
  if (interest) log(`Проценты по кредиту: ${fmt$(interest)}`);
  const d = S.today;
  const net = d.inc - d.elec - d.sal - d.rent - d.other;
  S.history.push({ inc: Math.round(d.inc), exp: Math.round(d.elec + d.sal + d.rent + d.other), net: Math.round(net) });
  if (S.history.length > 30) S.history.shift();
  S.stats.bestDay = Math.max(S.stats.bestDay, net);
  S.rivals.forEach((r) => { if (!r.bought) r.rep = Math.min(95, r.rep + rand(0, 0.7)); });
  S.mhist.push({ ...S.market });
  if (S.mhist.length > 30) S.mhist.shift();
  S.today = { inc: 0, elec: 0, sal: 0, rent: 0, other: 0 };
  log(`День ${S.day}. Вчера: ${net >= 0 ? 'прибыль' : 'убыток'} ${fmt$(net)}`, net >= 0 ? '' : 'warn');
  securityDay();
  if (S.over) return;
  ipoDay(net);
  if (S.over) return;
  if (S.money < 0) {
    S.debtDays++;
    if (S.debtDays >= 3) { gameOver(); return; }
    toast(`Счёт в минусе уже ${S.debtDays} дн. На 3-й день — банкротство`, 'bad');
    Sound.bad();
  } else S.debtDays = 0;
  save();
}

function checkGoals() {
  while (S.goal < GOALS.length && GOALS[S.goal].ok()) {
    const g = GOALS[S.goal];
    S.money += g.r; S.today.other -= g.r;
    log(`Цель выполнена: ${g.t}. Награда ${fmt$(g.r)}`, 'good');
    toast(`Цель выполнена! +${fmt$(g.r)}`, 'good');
    Sound.win();
    S.goal++;
    if (g.win && !S.won) { S.won = true; showOverlay('win'); }
  }
}

function gameOver(reason = 'bankrupt') {
  S.over = true;
  S.overReason = reason;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  Sound.crash();
  showOverlay('over');
}

function alertPause(what) {
  if (S.autoPause && S.started && !S.paused) {
    S.paused = true;
    toast(`Автопауза: ${what}. Продолжить — ▶ или пробел`, 'bad');
  }
}
function insurancePremium() {
  const eq = S.halls.reduce((a, H) => a + H.grid.reduce((b, t) => b + (t ? refund(t) * 2 : 0), 0), 0);
  return Math.round(eq * 0.004);
}
function valuation() {
  const assets = S.halls.reduce((a, H) => a + H.grid.reduce((b, t) => b + (t ? refund(t) * 2 : 0), 0), 0);
  const halls = S.halls.reduce((a, H, i) => a + (H.open ? HALLS[i].price * 0.5 : 0), 0);
  const yest = S.history.length ? S.history[S.history.length - 1].net : 0;
  return S.money - S.loan + assets * 0.6 + halls + Math.max(0, yest) * 30;
}
function loanLimit() {
  return Math.max(0, Math.floor((Math.max(5000, (valuation() + S.loan) * 0.5) - S.loan) / 1000) * 1000);
}
function emptyTiles() {
  const out = [];
  S.halls.forEach((H, hi) => { if (H.open) H.grid.forEach((t, i) => { if (!t) out.push([hi, i]); }); });
  return out;
}
function allRacks(f = () => true) {
  const out = [];
  S.halls.forEach((H, hi) => { if (H.open) H.grid.forEach((t, i) => { if (t && t.k === 'rack' && f(t)) out.push({ t, hi, i }); }); });
  return out;
}
const freeSlots = () => allRacks().reduce((a, r) => a + slotsFree(r.t), 0);
const hasMiner = () => S.halls.some((H) => H.grid.some((t) => t && t.k === 'miner'));
function minerSpot() {
  for (let hi = 0; hi < S.halls.length; hi++) {
    const H = S.halls[hi];
    if (!H.open) continue;
    const st = hallStats(hi);
    if (st.load + BUILD.miner.kw > st.cap) continue;
    const e = H.grid.findIndex((t) => !t);
    if (e >= 0) return [hi, e];
  }
  return null;
}
