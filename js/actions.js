'use strict';
// ================= ACTIONS =================
function spend(v) {
  if (S.money < v) { toast(`Не хватает денег: нужно ${fmt$(v)}`, 'bad'); Sound.bad(); return false; }
  S.money -= v; S.today.other += v;
  return true;
}
function selTile() { return S.sel ? S.halls[S.sel.h].grid[S.sel.i] : null; }

function place(kind, h, i) {
  const H = S.halls[h];
  if (H.grid[i]) return false;
  const b = BUILD[kind];
  if (!b || b.hidden) return false;
  if (b.req && !hasTech(b.req)) { toast('Сначала изучите технологию', 'bad'); return false; }
  const st = hallStats(h);
  if (b.kw && st.load + b.kw > st.cap) { toast('Не хватает мощности зала. Поставьте трансформатор', 'bad'); Sound.bad(); return false; }
  if (!spend(b.price)) return false;
  H.grid[i] = kind === 'rack' ? mkRack() : SW[kind] ? { k: kind, cfg: hasTech('sdn') ? 'ok' : 'raw' } : { k: kind };
  Sound.build();
  refreshHall(h);
  return true;
}
function refreshHall(h) { const st = hallStats(h); Object.assign(S.halls[h], { load: st.load, cap: st.cap, backup: st.backup }); }

function refund(t) {
  if (t.k === 'rack') return BUILD.rack.price * 0.5 + t.s.reduce((a, m) => a + sellOf(m), 0);
  return BUILD[t.k].price * 0.5;
}

const ACT = {
  pause() { S.paused = !S.paused; },
  speed(a) { S.speed = Number(a); S.paused = false; },
  sound() { Sound.init(); Sound.on = !Sound.on; },
  menu() { S.paused = true; showOverlay('menu'); },
  resume() { $('#overlay').hidden = true; S.paused = false; },
  save() { save(); toast('Игра сохранена', 'good'); },
  reset() { showOverlay('confirm'); },
  newgame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} newState(); S.started = true; $('#overlay').hidden = true; afterLoad(); log('Вы открыли свою первую серверную в каморке под лестницей'); },
  cont() { S.started = true; S.paused = false; $('#overlay').hidden = true; },
  keep() { $('#overlay').hidden = true; S.paused = false; },
  tool(a) { S.tool = S.tool === a ? 'select' : a; },
  view(a) { S.view = a; },
  autopause() { S.autoPause = !S.autoPause; showOverlay('menu'); },
  tariff(a) { S.tariff = Number(a); log(`Тарифы: ${TARIFFS[S.tariff].name}. Новые предложения пойдут по новым ценам`); },
  loan(a) {
    const v = Number(a);
    if (v > loanLimit()) { toast('Банк не даст столько', 'bad'); return; }
    S.loan += v; S.money += v;
    log(`Взят кредит ${fmt$(v)} под 1,2% в день`, 'warn');
    Sound.coin();
  },
  repay(a) {
    const v = Math.min(S.loan, a === 'all' ? S.loan : Number(a));
    if (!v) return;
    if (S.money < v) { toast('Не хватает денег', 'bad'); return; }
    S.money -= v; S.loan -= v;
    log(`Погашено ${fmt$(v)} кредита`, 'good');
  },
  tab(a) { S.tab = a; },
  hall(a) { S.cur = Number(a); S.sel = null; layoutCanvas(); },
  openhall(a) {
    const i = Number(a), D = HALLS[i];
    if (repLevel() < D.lvl) { toast(`Нужна репутация ${'★'.repeat(D.lvl)}`, 'bad'); return; }
    if (!spend(D.price)) return;
    S.halls[i].open = true;
    log(`Арендован зал: ${D.name}`, 'good');
    Sound.win();
    refreshHall(i);
  },
  build(a) { if (S.sel) place(a, S.sel.h, S.sel.i); },
  addsrv(a) {
    const t = selTile(); const m = MODELS[a];
    if (!t || t.k !== 'rack' || t.s.length >= RACK_SLOTS) return;
    const st = hallStats(S.sel.h);
    if (st.load + m.kw > st.cap) { toast('Не хватает мощности зала. Поставьте трансформатор', 'bad'); Sound.bad(); return; }
    if (!spend(priceOf(a))) return;
    bumpHw(a);
    t.s.splice(t.s.length - t.broken, 0, a);
    Sound.build();
    refreshHall(S.sel.h);
  },
  fillrack(a) {
    const t = selTile();
    if (!t || t.k !== 'rack') return;
    const n = fillRacks([t], S.sel.h, a);
    if (n) { Sound.build(); refreshHall(S.sel.h); }
  },
  fillhall(a) {
    const list = S.halls[S.cur].grid.filter((t) => t && t.k === 'rack' && !t.fire);
    const n = fillRacks(list, S.cur, a);
    if (n) { Sound.build(); refreshHall(S.cur); log(`Зал заполнен: +${n} × ${MODELS[a].name}`); }
  },
  upghall(a) {
    const [from, to] = a.split('>');
    const cost = priceOf(to) - sellOf(from);
    let n = 0;
    for (const t of S.halls[S.cur].grid) {
      if (!t || t.k !== 'rack') continue;
      for (let k = 0; k < t.s.length - t.broken; k++) {
        if (t.s[k] !== from) continue;
        const st = hallStats(S.cur);
        if (st.load - MODELS[from].kw + MODELS[to].kw > st.cap || S.money < cost) break;
        S.money -= cost; S.today.other += cost;
        bumpHw(to);
        t.s[k] = to; n++;
      }
    }
    refreshHall(S.cur);
    if (n) { Sound.build(); log(`Модернизация: ${n} × ${MODELS[from].name} → ${MODELS[to].name}`, 'good'); }
    else toast('Не хватает денег или мощности', 'bad');
  },
  maintain() {
    const racks = S.halls[S.cur].grid.filter((t) => t && t.k === 'rack');
    const cost = racks.reduce((a, t) => a + t.s.length, 0) * 40;
    if (!spend(cost)) return;
    racks.forEach((t) => { t.age = 0; });
    log(`Профилактика в зале «${HALLS[S.cur].name}»: износ сброшен`, 'good');
    Sound.coin();
  },
  cert(a) {
    const c = CERTS.find((x) => x.id === a);
    if (!c || S.certs[a]) return;
    if (!c.ok()) { toast(`Не выполнено: ${c.need}`, 'bad'); return; }
    if (!spend(c.price)) return;
    S.certs[a] = { on: true };
    log(`Получен сертификат ${c.name}`, 'good');
    Sound.win();
  },
  cable(a) { if (S.sel) startCable(S.sel.h, S.sel.i, a); },
  swcfg(a) {
    if (!S.sel) return;
    if (a === 'manual') { S.cfgTarget = { h: S.sel.h, i: S.sel.i }; S.paused = true; showOverlay('netcfg'); return; }
    startCfg(S.sel.h, S.sel.i, a);
  },
  cfgApply() {
    const tg = S.cfgTarget;
    const sw = tg && S.halls[tg.h].grid[tg.i];
    if (!isSwitch(sw)) { $('#overlay').hidden = true; return; }
    const ans = cfgAnswer(tg.h);
    let wrong = 0;
    Object.keys(CFG_OPTS).forEach((k) => { if ($(`#cfg-${k}`).value !== ans[k]) wrong++; });
    sw.cfg = wrong ? 'bad' : 'ok';
    if (wrong) { log(`Коммутатор ${tileName(tg.h, tg.i)}: ошибок в конфигурации — ${wrong}. Потери пакетов, −40% мощности стоек`, 'crit'); Sound.bad(); }
    else { log(`Вы настроили коммутатор ${tileName(tg.h, tg.i)} без единой ошибки`, 'good'); Sound.win(); }
    S.cfgTarget = null;
    $('#overlay').hidden = true; S.paused = false;
  },
  cfgCancel() { S.cfgTarget = null; $('#overlay').hidden = true; S.paused = false; },
  netall(a) {
    const H = S.halls[S.cur];
    let n = 0;
    if (a === 'cable') H.grid.forEach((t, i) => { if (t && t.k === 'rack' && t.link === null && startCable(S.cur, i, 'contract', true)) n++; });
    else H.grid.forEach((t, i) => { if (isSwitch(t) && (t.cfg === 'raw' || t.cfg === 'bad') && startCfg(S.cur, i, 'contract')) n++; });
    if (n) log(`Подрядчик принял заказ: ${a === 'cable' ? 'кабелей' : 'коммутаторов'} — ${n}`);
    else toast('Нечего делать или не хватает денег', 'bad');
  },
  draft(a) {
    const [k, v] = a.split(':');
    S.draft[k] = v;
    const ch = PARTS.ch[S.draft.ch];
    S.draft.ncpu = clamp(S.draft.ncpu, 1, ch.sockets);
    S.draft.ndisk = S.draft.disk === 'd0' ? 0 : clamp(S.draft.ndisk || ch.bays, 0, ch.bays);
    S.draft.ngpu = S.draft.gpu === 'g0' ? 0 : clamp(S.draft.ngpu || ch.gpus, 0, ch.gpus);
  },
  draftN(a) {
    const [k, dv] = a.split(':');
    const ch = PARTS.ch[S.draft.ch];
    const lim = { ncpu: [1, ch.sockets], ndisk: [0, S.draft.disk === 'd0' ? 0 : ch.bays], ngpu: [0, S.draft.gpu === 'g0' ? 0 : ch.gpus], qty: [1, 50] }[k];
    S.draft[k] = clamp(S.draft[k] + Number(dv), lim[0], lim[1]);
  },
  assemble(a) {
    const spec = designSpec(S.draft);
    if (spec.errs.length) { toast(spec.errs[0], 'bad'); return; }
    const n = S.draft.qty;
    if (a === 'manual' && manualBusy()) { toast('Вы уже заняты другой ручной работой', 'bad'); return; }
    if (a === 'tech' && !S.staff.tech) { toast('Наймите сборщиков во вкладке «Персонал»', 'bad'); return; }
    const cost = Math.round(spec.price * n * (a === 'contract' ? 1.2 : 1));
    if (!spend(cost)) return;
    const ds = designFor(S.draft);
    ['cpu', 'sto', 'gpu'].forEach((k) => { if (spec.caps[k]) S.hw[k] = Math.min(2.5, S.hw[k] + 0.002 * n * spec.tier); });
    S.asm.push({ mid: `d${ds.id}`, n, by: a, left: 2 });
    log(`Заказ на сборку: ${n} × ${ds.name} (${a === 'manual' ? 'своими руками' : a === 'tech' ? 'сборщики' : 'подрядчик'})`);
  },
  fromstock(a) {
    const t = selTile();
    if (!t || t.k !== 'rack') return;
    if (installStock(t, S.sel.h, a, 1)) Sound.build();
  },
  stockhall() {
    const H = S.halls[S.cur];
    let n = 0;
    Object.keys(S.stock).forEach((mid) => {
      H.grid.forEach((t) => { if (t && t.k === 'rack' && !t.fire && S.stock[mid] > 0) n += installStock(t, S.cur, mid); });
    });
    if (n) { Sound.build(); log(`Со склада установлено серверов: ${n}`); } else toast('Нет свободных слотов или склад пуст', 'bad');
  },
  kit(a) {
    const kit = KITS.find((k) => k.id === a);
    if (!kit) return;
    const price = kitPrice(kit);
    if (S.money < price) { toast('Не хватает денег', 'bad'); return; }
    const err = placeKit(kit, S.cur);
    if (err) { toast(err, 'bad'); return; }
    S.money -= price; S.today.other += price;
    bumpHw(kit.model, kit.racks * kit.per);
    log(`Подрядчик смонтировал «${kit.name}» в зале «${HALLS[S.cur].name}» под ключ`, 'good');
    Sound.win();
  },
  tariffE(a) { S.energy.next = a; log(`С завтрашнего дня тариф на электричество: ${a === 'fixed' ? 'фиксированный' : 'биржевой'}`); },
  netup(a) {
    const H = S.halls[Number(a)];
    const nx = (H.net || 0) + 1;
    if (!NET_TIERS[nx] || !spend(NET_TIERS[nx].price)) return;
    H.net = nx;
    log(`Канал в «${HALLS[Number(a)].name}» расширен до ${NET_TIERS[nx].name}`, 'good');
    Sound.build();
  },
  pentest() {
    const cost = 2000 * repLevel();
    if (S.sec.pentest > 0 || !spend(cost)) return;
    S.sec.pentest = 168;
    log(`Пентест проведён: защита +20 на неделю`, 'good');
  },
  ipo() {
    if (S.ipo || valuation() < 2e6 || S.rep < 70) return;
    const cash = Math.round(valuation() * 0.25);
    S.money += cash; S.today.other -= cash;
    S.equity = Math.min(0.7, S.equity + 0.25);
    const last = S.history.reduce((a, d) => a + d.net, 0);
    S.ipo = { price: 100, hist: [100], qStart: S.day, qProfit: 0, target: Math.round(Math.max(20000, last * 1.1)), misses: 0 };
    log(`IPO! Компания на бирже, привлечено ${fmt$(cash)}. План на квартал: ${fmt$(S.ipo.target)}`, 'good');
    Sound.win();
  },
  insure() { S.insured = !S.insured; log(S.insured ? 'Оборудование застраховано' : 'Страховка отменена'); },
  promoBuy() {
    const cost = 1000 * repLevel();
    if (S.promo) return;
    if (!spend(cost)) return;
    S.promo = 48;
    log(`Рекламная кампания на двое суток за ${fmt$(cost)}`, 'good');
  },
  repairhall() {
    let n = 0;
    for (const t of S.halls[S.cur].grid) {
      if (!t || t.k !== 'rack' || !t.broken) continue;
      const cost = t.s.slice(t.s.length - t.broken).reduce((a, m) => a + 80 * MODELS[m].tier, 0);
      if (S.money < cost) break;
      S.money -= cost; S.today.other += cost;
      n += t.broken; t.broken = 0; t.lastBroken = 0;
    }
    if (n) { Sound.coin(); log(`Починено серверов: ${n}`, 'good'); }
  },
  bid(a) { if (S.tender) S.tender.bid = a === 'off' ? null : Number(a); },
  buyrival(a) {
    const r = S.rivals[Number(a)];
    if (!r || r.bought) return;
    const price = rivalPrice(r);
    if (!spend(price)) return;
    r.bought = true;
    const inc = Math.round((price / (24 * 25)) * 10) / 10;
    S.subs += inc;
    S.rep = Math.min(100, S.rep + 5);
    log(`Поглощена компания ${r.name}. Её клиенты приносят ${fmt$(inc)}/ч`, 'good');
    Sound.win();
  },
  policy(a) {
    const [k, v] = a.split(':');
    S.policy[k] = k === 'racks' ? v === '1' : Number(v);
  },
  mailans(a) {
    const [id, ans] = a.split(':');
    const m = S.inbox.find((x) => x.id === Number(id));
    if (m) answerMail(m, ans);
  },
  autono() { S.autoNo = !S.autoNo; if (S.autoNo) [...S.inbox].forEach((m) => answerMail(m, 'no', true)); },
  sellsrv(a) {
    const t = selTile(); const n = Number(a);
    if (!t || !t.s[n]) return;
    const isBroken = n >= t.s.length - t.broken;
    const back = isBroken ? Math.round(priceOf(t.s[n]) * 0.1) : sellOf(t.s[n]);
    t.s.splice(n, 1);
    if (isBroken) t.broken--;
    S.money += back;
    refreshHall(S.sel.h);
  },
  repair() {
    const t = selTile();
    if (!t || !t.broken) return;
    const cost = t.s.slice(t.s.length - t.broken).reduce((a, m) => a + 80 * MODELS[m].tier, 0);
    if (!spend(cost)) return;
    t.broken = 0; t.lastBroken = 0;
    Sound.coin();
    log(`Стойка ${tileName(S.sel.h, S.sel.i)} починена вручную`, 'good');
  },
  extinguish() { const t = selTile(); if (t && t.fire) { t.fire = 0; Sound.coin(); log('Пожар потушен вручную', 'good'); } },
  demolish() {
    const t = selTile(); if (!t) return;
    const back = refund(t);
    S.money += back;
    if (isSwitch(t)) S.halls[S.sel.h].grid.forEach((r) => { if (r && r.k === 'rack' && r.link === S.sel.i) { r.link = null; r.cable = 'none'; } });
    S.halls[S.sel.h].grid[S.sel.i] = null;
    refreshHall(S.sel.h);
    toast(`Демонтировано, возврат ${fmt$(back)}`);
  },
  sign(a) {
    const o = S.offers.find((x) => x.id === Number(a)); if (!o) return;
    if (repLevel() < o.lvl) { toast(`Клиенту нужна репутация ${'★'.repeat(o.lvl)}`, 'bad'); return; }
    signOffer(o, false);
  },
  cancel(a) {
    const c = S.contracts.find((x) => x.id === Number(a)); if (!c) return;
    const fine = Math.round(c.pay * 24);
    S.money -= fine; S.today.other += fine;
    S.rep = Math.max(0, S.rep - 3);
    S.contracts = S.contracts.filter((x) => x !== c);
    log(`Контракт «${c.name}» расторгнут. Неустойка ${fmt$(fine)}`, 'warn');
  },
  reject(a) { S.offers = S.offers.filter((x) => x.id !== Number(a)); },
  hire(a) {
    const R = STAFF[a];
    if (R.max && S.staff[a] >= R.max) return;
    if (S.money < R.pay) { toast('Нужно хотя бы на первую зарплату', 'bad'); return; }
    S.staff[a]++;
    Sound.click();
    log(`Нанят: ${R.name}`);
  },
  fireStaff(a) { if (S.staff[a] > 0) { S.staff[a]--; log(`Уволен: ${STAFF[a].name}`); } },
  research(a) {
    if (S.research) return;
    const t = TECH.find((x) => x.id === a);
    if (!spend(t.price)) return;
    S.research = { id: t.id, left: Math.round(t.days * 24), total: Math.round(t.days * 24) };
    log(`Начато исследование: ${t.name}`);
  },
};
