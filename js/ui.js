'use strict';
// ================= RENDER: UI =================
let logDirty = true;
let pressing = false;
const last = {};
function setHTML(id, html) { if (last[id] !== html) { $(id).innerHTML = html; last[id] = html; } }

function renderUI() {
  const m = $('#rMoney');
  m.textContent = fmt$(S.money);
  m.className = `v ${S.money < 0 ? 'neg' : ''}`;
  const p24 = S.hourly.reduce((a, b) => a + b, 0);
  const pr = $('#rProfit');
  pr.textContent = `${p24 >= 0 ? '+' : ''}${fmt$(p24)}`;
  pr.className = `v ${p24 >= 0 ? 'pos' : 'neg'}`;
  const L = repLevel();
  $('#rRep').innerHTML = `${'★'.repeat(L)}<i>${'★'.repeat(5 - L)}</i> <small class="meta">${Math.round(S.rep)}</small>`;
  $('#rDate').textContent = `День ${S.day}, ${clock()}`;
  for (const k of ['cpu', 'sto', 'gpu']) {
    const el = $(`#r${k[0].toUpperCase()}${k.slice(1)}`);
    el.textContent = `${fmtN(S.dem[k])} / ${fmtN(S.cap[k])}`;
    el.className = `v ${S.dem[k] > 0 && S.served[k] < 0.98 ? 'neg' : ''}`;
  }
  const rn = $('#rNet');
  rn.textContent = `${fmtN(S.bw.dem)} / ${fmtN(S.bw.cap)}`;
  rn.className = `v ${S.bw.dem > S.bw.cap ? 'neg' : ''}`;
  $('#bPause').setAttribute('aria-pressed', String(S.paused));
  $('#bPause').textContent = S.paused ? '▶' : 'II';
  document.querySelectorAll('[data-act="speed"]').forEach((b) => b.setAttribute('aria-pressed', String(!S.paused && Number(b.dataset.a) === S.speed)));
  $('#bSound').textContent = Sound.on ? 'Звук: вкл' : 'Звук: выкл';

  const g = GOALS[S.goal];
  setHTML('#goal', g ? `<b>Цель ${S.goal + 1}/${GOALS.length}</b><span>${g.t}</span><em>+${fmt$(g.r)}</em>` : `<b>Все цели</b><span>Вы построили империю дата-центров. Можно продолжать расти.</span>`);

  const ev = S.event;
  const evBox = $('#event');
  if (ev) {
    const E = EVENTS[ev.type];
    evBox.className = `event ${E.cls}`;
    setHTML('#event', `<strong>${E.name}</strong><span>${E.desc}</span><b class="left">ещё ${ev.left} ч</b>`);
  } else {
    evBox.className = 'event calm';
    setHTML('#event', '<strong>Всё спокойно</strong><span>Аварий нет. Самое время строиться.</span>');
  }

  // halls nav
  setHTML('#halls', HALLS.map((D, i) => {
    const H = S.halls[i];
    let sub;
    if (!H.open) sub = `${fmt$(D.price)} · ${'★'.repeat(D.lvl)}`;
    else {
      const alarm = H.grid.some((t) => t && t.k === 'rack' && (t.fire || t.temp > 40)) || H.dark;
      sub = alarm ? 'тревога' : `${H.grid.filter((t) => t && t.k === 'rack').length} стоек`;
    }
    const alarm = H.open && sub === 'тревога';
    return `<button type="button" data-act="hall" data-a="${i}" aria-pressed="${S.cur === i}" class="${H.open ? '' : 'locked'} ${alarm ? 'alarm' : ''}" title="${D.name}"><span>${D.name}</span><small>${sub}</small></button>`;
  }).join(''));

  const H = S.halls[S.cur], D = HALLS[S.cur];
  if (H.open) {
    refreshHall(S.cur);
    setHTML('#hallinfo', `${H.locked ? `<span class="over"><b class="over">ЗАШИФРОВАН · ${H.locked} ч</b></span>` : ''}<span>Мощность <b class="${H.load > H.cap * 0.9 ? 'over' : ''}">${H.load.toFixed(1)} / ${H.cap} кВт</b></span><span>Канал <b>${NET_TIERS[H.net || 0].name}</b></span><span>Резерв <b class="${H.backup < H.load ? 'over' : ''}">${H.backup} кВт</b></span><span>Воздух <b>${D.amb} °C</b></span><span>Аренда <b>${fmt$(D.rent)}/день</b></span>`);
  } else setHTML('#hallinfo', `<span>Зал ${D.w}×${D.h} клеток · ${D.kw} кВт · воздух ${D.amb} °C · аренда ${fmt$(D.rent)}/день</span>`);
  const lock = $('#lockcard');
  if (!H.open) {
    lock.hidden = false;
    const can = repLevel() >= D.lvl;
    setHTML('#lockcard', `<h3>${D.name}</h3><p>${D.w}×${D.h} клеток, ${D.kw} кВт, воздух ${D.amb} °C</p><p>Требуется репутация ${'★'.repeat(D.lvl)}${can ? '' : ' (пока не хватает)'}</p><div><button class="btn primary" type="button" data-act="openhall" data-a="${S.cur}" ${can && S.money >= D.price ? '' : 'disabled'}>Арендовать за ${fmt$(D.price)}</button></div>`);
  } else lock.hidden = true;


  // tools
  const tools = [['select', 'Выбор', 'осмотр'], ...Object.keys(BUILD).filter((k) => !BUILD[k].hidden).map((k) => [k, BUILD[k].name, `${fmt$(BUILD[k].price)} · ${BUILD[k].short}`, BUILD[k].req]), ['demolish', 'Снести', 'возврат 50%']];
  setHTML('#tools', tools.map(([k, n, s, req]) => `<button class="btn" type="button" data-act="tool" data-a="${k}" aria-pressed="${S.tool === k}" ${req && !hasTech(req) ? 'disabled title="Нужно исследование"' : ''}>${n}<small>${s}</small></button>`).join('') +
    `<span class="sep"></span><div class="seg" role="group" aria-label="Слой">${[['normal', 'Обычный'], ['heat', 'Тепло'], ['power', 'Питание']].map(([k, n]) => `<button type="button" data-act="view" data-a="${k}" aria-pressed="${S.view === k}">${n}</button>`).join('')}</div>`);

  // tabs
  const tabs = [['obj', 'Объект'], ['deals', `Контракты<sup>${S.offers.length}</sup>`], ['tender', `Тендеры${S.tender && !S.tender.bid ? '<sup>!</sup>' : ''}`], ['mail', `Почта${S.inbox.length ? `<sup>${S.inbox.length}</sup>` : ''}`],
    ['infra', 'Инфра'], ['asm', `Сборка${S.asm.length ? `<sup>${S.asm.length}</sup>` : ''}`], ['contr', 'Подрядчики'], ['staff', 'Персонал'], ['tech', 'Развитие'], ['fin', 'Финансы']];
  setHTML('#tabs', tabs.map(([k, n]) => `<button type="button" data-act="tab" data-a="${k}" aria-pressed="${S.tab === k}">${n}</button>`).join(''));
  if (!pressing) setHTML('#tab', TAB[S.tab]());

  if (logDirty) { $('#log').innerHTML = S.log.map((e) => `<li class="${e.lvl}"><time>${e.t}</time><span>${e.msg}</span></li>`).join(''); logDirty = false; }
}

const typeTag = (t) => `<span class="tag ${t}">${TYPES[t].name}</span>`;
const capRow = (k) => {
  const c = S.cap[k], d = S.peak[k];
  const pct = c ? Math.min(100, (d / c) * 100) : d ? 100 : 0;
  const col = d > c ? 'var(--crit)' : pct > 85 ? 'var(--warn)' : 'var(--ok)';
  return `<div class="cap"><span>${TYPES[k].name}</span><div class="meter"><i style="width:${pct}%;background:${col}"></i></div><span>${fmtN(d)} / ${fmtN(c)}</span></div>`;
};

function marketHtml() {
  const spark = (k) => {
    const pts = S.mhist.map((m) => m[k]).concat([S.market[k]]);
    if (pts.length < 2) return '';
    const W = 100, H = 26;
    const path = pts.map((v, n) => `${(n / (pts.length - 1)) * W},${H - ((v - 0.4) / 2.1) * H}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="${W}" y1="${H - (0.6 / 2.1) * H}" y2="${H - (0.6 / 2.1) * H}" stroke="#26313c"/><polyline points="${path}" fill="none" stroke="#6cb4ff" stroke-width="1.5"/></svg>`;
  };
  const cell = (k) => {
    const v = S.market[k], hw = hwMult(k);
    return `<div><span class="meta">${TYPES[k].name}</span><b class="${v > 1.05 ? 'up' : v < 0.95 ? 'down' : ''}">×${v.toFixed(2).replace('.', ',')}</b>${spark(k)}<span class="meta ${hw > 1.05 ? 'warn' : hw < 0.95 ? 'ok' : ''}">железо ×${hw.toFixed(2).replace('.', ',')}</span></div>`;
  };
  const tr = S.trend ? `<p class="muted"><b class="warn">${S.trend.name}</b> — ${S.trend.desc} Ещё ${Math.ceil(S.trend.left / 24)} дн.</p>` : '<p class="muted">Рынок спокоен. Индекс умножает оплату новых контрактов. Цена железа идёт за спросом, а ваши крупные закупки её разгоняют.</p>';
  return `<h3>Рынок</h3><div class="mkt">${['cpu', 'sto', 'gpu'].map(cell).join('')}</div>${tr}`;
}
const wearText = (t) => `${Math.round((t.age || 0) / 24)} дн. · поломки ×${(1 + (t.age || 0) / 480).toFixed(1).replace('.', ',')}`;
const capsText = (M) => Object.entries(capsOf(M)).map(([k, v]) => `${fmtN(v)} ${TYPES[k].unit}`).join(' + ');
function rackNetHtml(t, hi, i) {
  if (t.link === undefined) return '';
  if (t.cable === 'laying') {
    const j = S.netJobs.find((x) => x.kind === 'cable' && x.h === hi && x.i === i);
    return `<p class="muted warn">Прокладывается кабель${j ? `: ещё ${j.left} ч (${j.by === 'manual' ? 'вы сами' : j.by === 'eng' ? 'инженер' : 'подрядчик'})` : ''}</p>`;
  }
  if (t.link !== null) {
    const sw = S.halls[hi].grid[t.link];
    const st = !isSwitch(sw) ? 'нет коммутатора' : sw.cfg === 'ok' ? 'работает' : sw.cfg === 'bad' ? 'ошибки в настройке, −40%' : 'коммутатор не настроен';
    return `<p class="muted ${sw && sw.cfg === 'ok' ? 'ok' : 'warn'}">Сеть: коммутатор ${tileName(hi, t.link)} — ${st}</p>`;
  }
  const sw = switchFor(hi, i);
  if (!sw) return '<p class="crit">Не подключена к сети: стойка не работает. Поставьте коммутатор не дальше 3 клеток (Spine — 6).</p>';
  const busy = manualBusy();
  return `<p class="crit">Не подключена к сети: стойка не работает.</p>
    <div class="btnrow"><button class="btn sm" type="button" data-act="cable" data-a="manual" ${busy || S.money < cableCost(sw.d, 'manual') ? 'disabled' : ''}>Проложить самому · ${fmt$(cableCost(sw.d, 'manual'))}, ${1 + sw.d} ч</button>
    <button class="btn sm primary" type="button" data-act="cable" data-a="contract" ${S.money < cableCost(sw.d, 'contract') ? 'disabled' : ''}>Подрядчик · ${fmt$(cableCost(sw.d, 'contract'))}, 1 ч</button></div>
    ${S.staff.neteng ? '<p class="muted">Сетевой инженер подключит её сам, когда освободится.</p>' : ''}`;
}
function switchHtml(t, hi, i, where) {
  const used = portsUsed(S.halls[hi].grid, i), spec = SW[t.k];
  const st = { raw: ['не настроен — подключённые стойки не работают', 'crit'], work: ['идёт настройка', 'warn'], bad: ['ошибки в конфигурации: −40% мощности стоек', 'crit'], ok: ['работает', 'ok'] }[t.cfg];
  const busy = t.cfg === 'work';
  return `<h3>${where}</h3><p class="ttl">${BUILD[t.k].name}</p>
    <dl class="kv"><dt>Порты</dt><dd>${used} / ${spec.ports}</dd><dt>Дальность кабеля</dt><dd>${spec.range} кл.</dd><dt>Состояние</dt><dd class="${st[1]}">${st[0]}</dd></dl>
    ${t.cfg !== 'ok' ? `<div class="btnrow"><button class="btn sm" type="button" data-act="swcfg" data-a="manual" ${busy ? 'disabled' : ''}>Настроить вручную</button><button class="btn sm primary" type="button" data-act="swcfg" data-a="contract" ${busy || S.money < 500 ? 'disabled' : ''}>Подрядчик · $500, 1 ч</button></div>
    <p class="muted">Вручную — бесплатно, но нужно свериться с регламентом сети. ${S.staff.neteng ? 'Сетевой инженер настроит сам за 3 ч.' : 'Сетевой инженер настраивает сам.'}</p>` : `<button class="btn sm" type="button" data-act="swcfg" data-a="manual">Перенастроить вручную</button>`}
    <button class="btn danger" type="button" data-act="demolish">Демонтировать · +${fmt$(refund(t))}</button>`;
}
function netPanel() {
  const H = S.halls[S.cur];
  const loose = H.grid.reduce((a, t, i) => { if (t && t.k === 'rack' && t.link === null) { const sw = switchFor(S.cur, i); if (sw) a.n++, a.cost += cableCost(sw.d, 'contract'); else a.far++; } return a; }, { n: 0, cost: 0, far: 0 });
  const raw = H.grid.filter((t) => isSwitch(t) && (t.cfg === 'raw' || t.cfg === 'bad')).length;
  const stockN = Object.values(S.stock).reduce((a, b) => a + b, 0);
  let html = '';
  if (loose.n) html += `<button class="btn" type="button" data-act="netall" data-a="cable" ${S.money < loose.cost ? 'disabled' : ''}><span>Подрядчик: проложить кабели к ${loose.n} стойкам<small>за 1 ч</small></span><span class="price">${fmt$(loose.cost)}</span></button>`;
  if (loose.far) html += `<p class="muted crit">Стоек без коммутатора в радиусе: ${loose.far}. Поставьте коммутатор рядом.</p>`;
  if (raw) html += `<button class="btn" type="button" data-act="netall" data-a="cfg" ${S.money < raw * 500 ? 'disabled' : ''}><span>Подрядчик: настроить коммутаторы (${raw})<small>за 1 ч</small></span><span class="price">${fmt$(raw * 500)}</span></button>`;
  if (stockN) html += `<button class="btn primary" type="button" data-act="stockhall"><span>Разместить склад по стойкам зала<small>собранных серверов на складе: ${stockN}</small></span><span class="price">бесплатно</span></button>`;
  return html;
}
function hallPanel() {
  const hi = S.cur, H = S.halls[hi];
  if (!H.open) return '<h3>Зал не арендован</h3><p class="muted">Арендуйте зал, чтобы строить.</p>';
  const racks = H.grid.filter((t) => t && t.k === 'rack');
  const free = racks.reduce((a, t) => a + RACK_SLOTS - t.s.length, 0);
  const broken = racks.reduce((a, t) => a + t.broken, 0);
  const models = Object.keys(MODELS).filter((k) => !MODELS[k].custom && (!MODELS[k].req || hasTech(MODELS[k].req)));
  const fill = free ? models.map((k) => `<button class="btn" type="button" data-act="fillhall" data-a="${k}" ${S.money < priceOf(k) ? 'disabled' : ''}><span>${MODELS[k].name} ${typeTag(MODELS[k].type)}<small>до ${free} шт. · по ${fmt$(priceOf(k))}</small></span><span class="price">${fmt$(priceOf(k) * free)}</span></button>`).join('') : '<p class="muted">Свободных слотов нет. Поставьте стойки.</p>';
  const ups = [];
  models.forEach((from) => models.forEach((to) => {
    if (MODELS[from].type !== MODELS[to].type || MODELS[to].cap <= MODELS[from].cap) return;
    const n = hallServerCount(hi, from);
    if (!n) return;
    const cost = priceOf(to) - sellOf(from);
    ups.push(`<button class="btn" type="button" data-act="upghall" data-a="${from}>${to}" ${S.money < cost ? 'disabled' : ''}><span>${n} × ${MODELS[from].name} → ${MODELS[to].name}<small>по ${fmt$(cost)} с учётом сдачи старых</small></span><span class="price">${fmt$(cost * n)}</span></button>`);
  }));
  const repCost = racks.reduce((a, t) => a + t.s.slice(t.s.length - t.broken).reduce((b, m) => b + 80 * MODELS[m].tier, 0), 0);
  const nSrv = racks.reduce((a, t) => a + t.s.length, 0);
  const avgAge = racks.length ? racks.reduce((a, t) => a + (t.age || 0), 0) / racks.length : 0;
  const mntCost = nSrv * 40;
  return `<h3>${HALLS[hi].name}: массовые действия</h3>
    <p class="muted">Строить можно «кистью»: выберите инструмент и протяните мышью или пальцем по клеткам. Нажмите на клетку, чтобы открыть её.</p>
    ${broken ? `<button class="btn primary" type="button" data-act="repairhall" ${S.money < repCost ? 'disabled' : ''}>Починить все сломанные (${broken}) · ${fmt$(repCost)}</button>` : ''}
    <div class="shop">${netPanel()}
    ${nSrv ? `<button class="btn" type="button" data-act="maintain" ${S.money < mntCost ? 'disabled' : ''}><span>Профилактика всего зала<small>Средний износ ${Math.round(avgAge / 24)} дн. · поломки ×${(1 + avgAge / 480).toFixed(1).replace('.', ',')} → ×1,0</small></span><span class="price">${fmt$(mntCost)}</span></button>` : ''}</div>
    <h3>Заполнить все стойки зала</h3><div class="shop">${fill}</div>
    ${ups.length ? `<h3>Модернизация</h3><div class="shop">${ups.join('')}</div>` : ''}
    <dl class="kv"><dt>Перегрев</dt><dd class="warn">от 32 °C, мощность −15%</dd><dt>Критично</dt><dd class="crit">от 40 °C, поломки ×10</dd><dt>Пожар</dt><dd class="crit">от 44 °C</dd></dl>`;
}

const TAB = {
  obj() {
    if (!S.sel) return hallPanel();
    const { h, i } = S.sel;
    const t = S.halls[h].grid[i];
    const where = `${HALLS[h].name} · клетка ${tileName(h, i)}`;
    if (!t) {
      return `<h3>${where}</h3><p class="muted">Пустая плитка фальшпола.</p><div class="shop">${Object.keys(BUILD).filter((k) => !BUILD[k].hidden).map((k) => {
        const b = BUILD[k]; const locked = b.req && !hasTech(b.req);
        return `<button class="btn" type="button" data-act="build" data-a="${k}" ${locked || S.money < b.price ? 'disabled' : ''}><span>${b.name}<small>${locked ? 'Нужно исследование' : b.desc}${b.kw ? ` Потребляет ${b.kw} кВт.` : ''}</small></span><span class="price">${fmt$(b.price)}</span></button>`;
      }).join('')}</div>`;
    }
    if (t.k === 'rack') {
      const tc = t.temp > 40 ? 'crit' : t.temp > 32 ? 'warn' : 'ok';
      const working = t.s.length - t.broken;
      const repairCost = t.s.slice(working).reduce((a, m) => a + 80 * MODELS[m].tier, 0);
      const fire = t.fire ? `<button class="btn hot" type="button" data-act="extinguish">ТУШИТЬ ПОЖАР</button>` : '';
      const slots = t.s.map((m, n) => `<div class="slot ${n >= working ? 'bad' : ''}"><span>${MODELS[m].name} · ${capsText(MODELS[m])}${n >= working ? ' · сломан' : ''}</span><button class="btn sm" type="button" data-act="sellsrv" data-a="${n}">Продать · ${fmt$(n >= working ? priceOf(m) * 0.1 : sellOf(m))}</button></div>`).join('');
      const stockBtns = Object.keys(S.stock).filter((k) => S.stock[k] > 0 && MODELS[k]).map((k) => `<button class="btn" type="button" data-act="fromstock" data-a="${k}"><span>${MODELS[k].name}<small>${capsText(MODELS[k])} · со склада, есть ${S.stock[k]}</small></span><span class="price">поставить</span></button>`).join('');
      const shop = t.s.length < RACK_SLOTS ? `<h3>Добавить сервер (${t.s.length}/${RACK_SLOTS})</h3>${stockBtns ? `<div class="shop">${stockBtns}</div>` : ''}<p class="muted">Готовые решения от вендора — ставятся сразу, но дороже сборки.</p><div class="shop">${Object.keys(MODELS).filter((k) => !MODELS[k].custom && (!MODELS[k].req || hasTech(MODELS[k].req))).map((k) => {
        const m = MODELS[k], free = RACK_SLOTS - t.s.length, pr = priceOf(k);
        return `<div class="row"><button class="btn" type="button" data-act="addsrv" data-a="${k}" ${S.money < pr ? 'disabled' : ''} style="flex:1"><span>${m.name} ${typeTag(m.type)}<small>${m.cap} ${TYPES[m.type].unit} · тепло ${m.heat} · ${m.kw} кВт</small></span><span class="price">${fmt$(pr)}</span></button>${free > 1 ? `<button class="btn sm" type="button" data-act="fillrack" data-a="${k}" ${S.money < pr ? 'disabled' : ''}>×${free}</button>` : ''}</div>`;
      }).join('')}</div>` : '<p class="muted">Стойка заполнена.</p>';
      return `<h3>${where}</h3><p class="ttl">Стойка</p>${fire}${rackNetHtml(t, h, i)}
        <dl class="kv"><dt>Износ</dt><dd class="${(t.age || 0) > 480 ? 'warn' : ''}">${wearText(t)}</dd><dt>Температура</dt><dd class="${tc}">${t.temp.toFixed(1)} °C</dd><dt>Тепло / охлаждение</dt><dd class="${t.heat > t.cool ? 'crit' : ''}">${t.heat.toFixed(0)} / ${t.cool.toFixed(0)}</dd><dt>Сломано</dt><dd class="${t.broken ? 'crit' : ''}">${t.broken}</dd></dl>
        ${t.broken ? `<button class="btn primary" type="button" data-act="repair" ${S.money < repairCost ? 'disabled' : ''}>Починить сейчас · ${fmt$(repairCost)}</button>${S.staff.admin ? '<p class="muted">Админ уже в пути, можно подождать бесплатно.</p>' : '<p class="muted">Наймите админа, и он будет чинить сам.</p>'}` : ''}
        <div class="slots">${slots || '<p class="muted">Пустая стойка.</p>'}</div>${shop}
        <button class="btn danger" type="button" data-act="demolish">Демонтировать стойку · +${fmt$(refund(t))}</button>`;
    }
    if (isSwitch(t)) return switchHtml(t, h, i, where);
    const b = BUILD[t.k];
    return `<h3>${where}</h3><p class="ttl">${b.name}</p><p class="muted">${b.desc}</p>${b.kw ? `<dl class="kv"><dt>Потребление</dt><dd>${b.kw} кВт</dd></dl>` : ''}<button class="btn danger" type="button" data-act="demolish">Демонтировать · +${fmt$(refund(t))}</button>`;
  },
  deals() {
    const L = repLevel();
    const active = S.contracts.map((c) => {
      const up = c.hrs ? (c.ok / c.hrs) * 100 : 100;
      const ok = up >= c.sla;
      return `<div class="item"><div class="row"><b>${c.name}</b><span>${c.urgent ? '<span class="tag urgent">Срочно</span> ' : ''}${c.vip ? '<span class="tag vip">VIP</span> ' : c.loyal ? `<span class="tag good">×${c.loyal + 1}</span> ` : ''}${typeTag(c.type)}</span></div>
        <div class="row meta"><span>${KINDS[c.kind].label} · ${fmtN(c.amount)} ${TYPES[c.type].unit}</span><span>${fmt$(c.pay)}/ч</span></div>
        <div class="row meta"><span class="${ok ? 'ok' : 'crit'}">аптайм ${up.toFixed(2)}% / SLA ${c.sla}%</span><span>ещё ${Math.ceil(c.left / 24)} дн.</span></div>
        <div class="row"><span></span><button class="btn sm danger" type="button" data-act="cancel" data-a="${c.id}">Расторгнуть · −${fmt$(c.pay * 24)}</button></div></div>`;
    }).join('');
    const offers = S.offers.map((o) => {
      const can = L >= o.lvl;
      return `<div class="item"><div class="row"><b>${o.name}</b><span>${o.urgent ? '<span class="tag urgent">Срочно</span> ' : ''}${o.vip ? '<span class="tag vip">VIP</span> ' : o.renew ? '<span class="tag good">Продление</span> ' : ''}${typeTag(o.type)}</span></div>
        <div class="row meta"><span>${KINDS[o.kind].label} · пик ${fmtN(o.amount)} ${TYPES[o.type].unit}</span><span>${fmt$(o.pay)}/ч</span></div>
        <div class="row meta"><span>SLA ${o.sla}% · ${o.days} дн. · ${'★'.repeat(o.lvl)}</span><span>${fmt$(o.pay * 24)}/день</span></div>
        <div class="row"><span class="meta">исчезнет через ${o.expires} ч</span><span><button class="btn sm" type="button" data-act="reject" data-a="${o.id}">Отказать</button> <button class="btn sm primary" type="button" data-act="sign" data-a="${o.id}" ${can ? '' : 'disabled'}>${can ? 'Подписать' : 'Мала репутация'}</button></span></div></div>`;
    }).join('');
    const acct = S.staff.acct ? '<p class="muted ok">Аккаунт-менеджер сам подписывает контракты, если хватает мощности.</p>' : '<p class="muted">Нет времени выбирать? Наймите аккаунт-менеджера во вкладке «Персонал» — он будет подписывать сам.</p>';
    return `<h3>Тарифы</h3><div class="seg" role="group" aria-label="Тарифы">${TARIFFS.map((t, n) => `<button type="button" data-act="tariff" data-a="${n}" aria-pressed="${S.tariff === n}">${t.name}</button>`).join('')}</div>
      <p class="muted">Дёшево — больше клиентов и репутации, но ниже оплата. Дорого — наоборот.</p>
      <div class="row"><span class="muted">${S.promo ? `Идёт реклама: ещё ${S.promo} ч` : 'Реклама: вдвое больше клиентов на двое суток'}</span><button class="btn sm" type="button" data-act="promoBuy" ${S.promo || S.money < 1000 * repLevel() ? 'disabled' : ''}>Запустить · ${fmt$(1000 * repLevel())}</button></div>${acct}
      ${marketHtml()}
      <h3>Загрузка в пик: контракты / мощность</h3>${['cpu', 'sto', 'gpu'].map(capRow).join('')}
      <p class="muted">Нагрузка клиентов меняется по часам: сайты пикуют днём, игры и видео вечером, ИИ — круглые сутки. Не хватит мощности — упадёт аптайм и репутация.</p>
      <h3>Предложения</h3><div class="list">${offers || '<p class="muted">Новых предложений пока нет. Менеджеры продаж приводят больше клиентов.</p>'}</div>
      <h3>Активные контракты (${S.contracts.length})</h3><div class="list">${active || '<p class="muted">Нет контрактов — серверы простаивают.</p>'}</div>`;
  },
  staff() {
    const total = Object.keys(STAFF).reduce((a, k) => a + STAFF[k].pay * S.staff[k], 0);
    return `<h3>Персонал · зарплаты ${fmt$(total)}/день</h3><div class="list">${Object.keys(STAFF).map((k) => {
      const R = STAFF[k];
      const busy = k === 'admin' ? ` · заняты ${S.jobs.length}` : '';
      const segBtn = (key, v, label) => `<button type="button" data-act="policy" data-a="${key}:${v}" aria-pressed="${String(S.policy[key]) === String(key === 'racks' ? v === 1 : v)}">${label}</button>`;
      const pol = k === 'buyer' ? `<div class="row"><span class="muted">Запас мощности</span><div class="seg">${[0.1, 0.25, 0.5].map((v) => segBtn('headroom', v, `${v * 100}%`)).join('')}</div></div>
        <div class="row"><span class="muted">Не тратить ниже</span><div class="seg">${[0, 5000, 25000, 100000].map((v) => segBtn('reserve', v, fmt$(v))).join('')}</div></div>
        <div class="row"><span class="muted">Ставить новые стойки</span><div class="seg">${segBtn('racks', 1, 'Да')}${segBtn('racks', 0, 'Нет')}</div></div>` : '';
      return `<div class="item"><div class="row"><b>${R.name}</b><span class="meta">${fmt$(R.pay)}/день</span></div><p class="muted">${R.desc}</p>${pol}
        <div class="row"><span class="meta">В штате: ${S.staff[k]}${R.max ? ` из ${R.max}` : ''}${busy}</span><span><button class="btn sm" type="button" data-act="fireStaff" data-a="${k}" ${S.staff[k] ? '' : 'disabled'}>Уволить</button> <button class="btn sm primary" type="button" data-act="hire" data-a="${k}" ${R.max && S.staff[k] >= R.max ? 'disabled' : ''}>Нанять</button></span></div></div>`;
    }).join('')}</div>`;
  },
  tech() {
    const r = S.research;
    const cur = r ? TECH.find((t) => t.id === r.id) : null;
    const certs = `<h3>Сертификаты</h3><div class="list">${CERTS.map((c) => {
      const st = S.certs[c.id];
      const ok = c.ok();
      const status = st ? (st.on ? '<span class="meta ok">действует</span>' : '<span class="meta crit">приостановлен</span>') : `<span class="meta">${fmt$(c.price)}</span>`;
      return `<div class="item ${st && st.on ? 'done' : ''}"><div class="row"><b>${c.name}</b>${status}</div><p class="muted">${c.desc}</p>
        <p class="muted ${ok ? 'ok' : 'warn'}">${ok ? '✓' : '✗'} ${c.need}</p>
        ${st ? '' : `<div class="row"><span></span><button class="btn sm primary" type="button" data-act="cert" data-a="${c.id}" ${ok && S.money >= c.price ? '' : 'disabled'}>Получить</button></div>`}</div>`;
    }).join('')}</div>`;
    return `<h3>Цели</h3>${TAB.goals()}` + certs + `<h3>Исследования</h3>${cur ? `<div class="item cur"><div class="row"><b>${cur.name}</b><span class="meta">ещё ${r.left} ч</span></div><div class="meter"><i style="width:${(1 - r.left / r.total) * 100}%;background:var(--accent)"></i></div></div>` : '<p class="muted">Лаборатория свободна. Выберите исследование.</p>'}
      <div class="list">${TECH.map((t) => {
        const done = hasTech(t.id);
        const reqOk = !t.req || t.req.every(hasTech);
        const reqTxt = t.req ? `Нужно: ${t.req.map((id) => TECH.find((x) => x.id === id).name).join(', ')}` : '';
        return `<div class="item ${done ? 'done' : ''}"><div class="row"><b>${t.name}</b><span class="meta">${done ? 'изучено' : `${fmt$(t.price)} · ${t.days.toString().replace('.', ',')} дн.`}</span></div><p class="muted">${t.desc}${!done && !reqOk ? ` ${reqTxt}.` : ''}</p>
          ${done ? '' : `<div class="row"><span></span><button class="btn sm primary" type="button" data-act="research" data-a="${t.id}" ${!reqOk || r || S.money < t.price ? 'disabled' : ''}>Исследовать</button></div>`}</div>`;
      }).join('')}</div>`;
  },
  fin() {
    const d = S.today;
    const hist = S.history;
    let chart = '<p class="muted">График появится после первого дня.</p>';
    if (hist.length) {
      const W = 340, Hh = 120, max = Math.max(1, ...hist.map((x) => Math.abs(x.net)));
      const bw = W / Math.max(hist.length, 10);
      const mid = Hh / 2;
      chart = `<svg class="chart" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Чистая прибыль по дням"><line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="#26313c"/>${hist.map((x, n) => {
        const hgt = (Math.abs(x.net) / max) * (mid - 4);
        return `<rect x="${n * bw + 1}" y="${x.net >= 0 ? mid - hgt : mid}" width="${bw - 2}" height="${Math.max(1, hgt)}" fill="${x.net >= 0 ? '#4fd18b' : '#ff5f5f'}"/>`;
      }).join('')}</svg>`;
    }
    const value = valuation();
    const lim = loanLimit();
    const insHtml = `<h3>Страховка</h3><p class="muted">Покрывает 80% стоимости сгоревших серверов и половину штрафов за SLA. Взнос — 0,4% стоимости оборудования в день.</p>
      <div class="row"><span class="meta">${S.insured ? 'действует' : 'нет'} · ${fmt$(insurancePremium())}/день</span><button class="btn sm ${S.insured ? '' : 'primary'}" type="button" data-act="insure">${S.insured ? 'Отменить' : 'Застраховать'}</button></div>`;
    const I = S.ipo;
    let ipoHtml;
    if (I) {
      const mn = Math.min(...I.hist), mxp = Math.max(...I.hist);
      const pts = I.hist.map((v, n) => `${(n / Math.max(1, I.hist.length - 1)) * 240},${60 - ((v - mn) / Math.max(1, mxp - mn)) * 56 - 2}`).join(' ');
      ipoHtml = `<h3>Биржа</h3><dl class="kv"><dt>Цена акции</dt><dd>${I.price.toFixed(1).replace('.', ',')}</dd><dt>План на квартал</dt><dd>${fmt$(I.target)}</dd><dt>Прибыль за квартал</dt><dd class="${I.qProfit >= I.target ? 'ok' : 'warn'}">${fmt$(I.qProfit)}</dd><dt>До конца квартала</dt><dd>${30 - (S.day - I.qStart)} дн.</dd><dt>Провалов подряд</dt><dd class="${I.misses ? 'crit' : ''}">${I.misses} из 2</dd></dl>
        <svg class="curve" viewBox="0 0 240 60" preserveAspectRatio="none" role="img" aria-label="Цена акции"><polyline points="${pts}" fill="none" stroke="#6cb4ff" stroke-width="1.5"/></svg>`;
    } else {
      const can = valuation() >= 2e6 && S.rep >= 70;
      ipoHtml = `<h3>IPO</h3><p class="muted">Выход на биржу: сразу 25% оценки компании деньгами, но 25% дохода уходит акционерам, и каждые 30 дней нужно расти на 10%. Два провала подряд — вас уволят.</p>
        <div class="row"><span class="muted ${can ? 'ok' : ''}">Нужно: оценка от $2 млн и репутация от 70</span><button class="btn sm primary" type="button" data-act="ipo" ${can ? '' : 'disabled'}>Выйти на биржу</button></div>`;
    }
    const loanHtml = ipoHtml + insHtml + `<h3>Кредит</h3><dl class="kv"><dt>Долг</dt><dd class="${S.loan ? 'warn' : ''}">${fmt$(S.loan)}</dd><dt>Проценты</dt><dd>1,2% в день · ${fmt$(S.loan * 0.012)}</dd><dt>Банк готов дать ещё</dt><dd>${fmt$(lim)}</dd><dt>Доля инвесторов</dt><dd>${Math.round(S.equity * 100)}%</dd></dl>
      <div class="row"><span>${[5000, 25000, 100000, 500000].filter((v) => v <= lim).map((v) => `<button class="btn sm" type="button" data-act="loan" data-a="${v}">Взять ${fmt$(v)}</button>`).join(' ') || '<span class="muted">Лимит исчерпан</span>'}</span></div>
      ${S.loan ? `<div class="row"><span></span><span><button class="btn sm" type="button" data-act="repay" data-a="5000" ${S.money >= Math.min(5000, S.loan) ? '' : 'disabled'}>Погасить ${fmt$(Math.min(5000, S.loan))}</button> <button class="btn sm primary" type="button" data-act="repay" data-a="all" ${S.money >= S.loan ? '' : 'disabled'}>Погасить всё</button></span></div>` : ''}`;
    return `<h3>Сегодня</h3><dl class="kv"><dt>Доход от клиентов</dt><dd class="ok">${fmt$(d.inc)}</dd><dt>Электричество</dt><dd>${fmt$(-d.elec)}</dd><dt>Покупки, штрафы, награды</dt><dd>${fmt$(-d.other)}</dd><dt>Зарплаты (в полночь)</dt><dd>${fmt$(-Object.keys(STAFF).reduce((a, k) => a + STAFF[k].pay * S.staff[k], 0))}</dd><dt>Аренда (в полночь)</dt><dd>${fmt$(-HALLS.reduce((a, h, i) => a + (S.halls[i].open ? h.rent : 0), 0))}</dd></dl>
      <h3>Чистая прибыль по дням</h3>${chart}
      <dl class="kv"><dt>Серверов</dt><dd>${countServers()}</dd><dt>Лучший день</dt><dd>${fmt$(S.stats.bestDay)}</dd><dt>Контрактов выполнено / провалено</dt><dd>${S.stats.done} / ${S.stats.failed}</dd><dt>Оценка компании</dt><dd>${fmt$(value)}</dd></dl>
      ${S.debtDays ? `<p class="crit">Счёт в минусе ${S.debtDays} дн. На 3-й день — банкротство.</p>` : ''}${loanHtml}`;
  },
  asm() {
    const d = S.draft;
    const spec = designSpec(d);
    const seg = (key, group) => `<div class="seg">${Object.entries(PARTS[group]).map(([k, pt]) => `<button type="button" data-act="draft" data-a="${key}:${k}" aria-pressed="${d[key] === k}" ${pt.req && !hasTech(pt.req) ? 'disabled title="Нужно исследование"' : ''}>${pt.name}</button>`).join('')}</div>`;
    const step = (key, max) => `<span class="stepper"><button class="btn sm" type="button" data-act="draftN" data-a="${key}:-1">−</button>${d[key]}${max !== undefined ? ` / ${max}` : ''}<button class="btn sm" type="button" data-act="draftN" data-a="${key}:1">+</button></span>`;
    const ch = PARTS.ch[d.ch];
    const ready = { cpu: 'b1', sto: 's1', gpu: 'g1' }[spec.type];
    const per = spec.cap ? spec.price / spec.cap : 0, perReady = priceOf(ready) / MODELS[ready].cap;
    const busy = manualBusy();
    const total = spec.price * d.qty;
    const queue = S.asm.map((j) => `<div class="row meta"><span>${j.n} × ${MODELS[j.mid].name}</span><span>${j.by === 'manual' ? `вы сами, ${j.left} ч на штуку` : j.by === 'tech' ? 'сборщики' : `подрядчик, ${j.left} ч`}</span></div>`).join('');
    const stock = Object.keys(S.stock).filter((k) => S.stock[k] > 0 && MODELS[k]).map((k) => `<div class="row meta"><span>${MODELS[k].name} · ${capsText(MODELS[k])}</span><span>${S.stock[k]} шт.</span></div>`).join('');
    return `<p class="muted">Соберите сервер из комплектующих: дешевле готовых решений и можно совмещать вычисления, диски и GPU в одной машине. Цены деталей идут за рынком железа.</p>
      <div class="part"><b>Корпус</b>${seg('ch', 'ch')}</div>
      <div class="part"><div class="row"><b>Процессоры</b>${step('ncpu', ch.sockets)}</div>${seg('cpu', 'cpu')}</div>
      <div class="part"><b>Память</b>${seg('ram', 'ram')}</div>
      <div class="part"><div class="row"><b>Диски</b>${step('ndisk', ch.bays)}</div>${seg('disk', 'disk')}</div>
      <div class="part"><div class="row"><b>Ускорители</b>${step('ngpu', ch.gpus)}</div>${seg('gpu', 'gpu')}</div>
      <dl class="kv"><dt>Мощность</dt><dd>${Object.keys(spec.caps).length ? capsText(spec) : '—'}</dd><dt>Тепло / питание</dt><dd>${spec.heat} · ${spec.kw} кВт</dd><dt>Цена деталей</dt><dd>${fmt$(spec.price)}</dd><dt>За единицу ${TYPES[spec.type].unit}</dt><dd class="${per && per < perReady ? 'ok' : 'warn'}">${fmt$(per)} (готовое: ${fmt$(perReady)})</dd></dl>
      ${spec.errs.length ? `<p class="crit">${spec.errs.join('; ')}</p>` : ''}
      <div class="row"><b>Количество</b>${step('qty')}</div>
      <div class="shop">
        <button class="btn" type="button" data-act="assemble" data-a="manual" ${busy || spec.errs.length || S.money < total ? 'disabled' : ''}><span>Собрать самому<small>${busy ? 'вы заняты другой ручной работой' : `по 2 ч на сервер, без наценки`}</small></span><span class="price">${fmt$(total)}</span></button>
        <button class="btn" type="button" data-act="assemble" data-a="tech" ${!S.staff.tech || spec.errs.length || S.money < total ? 'disabled' : ''}><span>Отдать сборщикам<small>${S.staff.tech ? `${S.staff.tech} чел., по серверу в час каждый` : 'наймите сборщиков в «Персонале»'}</small></span><span class="price">${fmt$(total)}</span></button>
        <button class="btn" type="button" data-act="assemble" data-a="contract" ${spec.errs.length || S.money < total * 1.2 ? 'disabled' : ''}><span>Подрядчик<small>вся партия за 2 ч, наценка 20%</small></span><span class="price">${fmt$(total * 1.2)}</span></button>
      </div>
      <h3>Очередь сборки</h3>${queue || '<p class="muted">Пусто.</p>'}
      <h3>Склад</h3>${stock || '<p class="muted">Пусто. Собранные серверы ставятся в стойки кнопкой «со склада» или массово из панели зала.</p>'}`;
  },
  contr() {
    const jobs = S.netJobs.filter((j) => j.by === 'contract').length + S.asm.filter((j) => j.by === 'contract').length;
    const kits = KITS.map((k) => {
      const locked = (k.req && !hasTech(k.req)) || (BUILD[k.cool].req && !hasTech(BUILD[k.cool].req)) || (BUILD[k.sw].req && !hasTech(BUILD[k.sw].req));
      const pr = kitPrice(k);
      return `<button class="btn" type="button" data-act="kit" data-a="${k.id}" ${locked || S.money < pr || !S.halls[S.cur].open ? 'disabled' : ''}><span>${k.name}<small>${locked ? 'нужны исследования' : k.desc}</small></span><span class="price">${fmt$(pr)}</span></button>`;
    }).join('');
    return `<p class="muted">Подрядчики делают быстро, но дорого. Сейчас у них заказов: ${jobs}.</p>
      <h3>Готовые решения под ключ</h3><p class="muted">Монтаж в текущем зале «${HALLS[S.cur].name}»: стойки с серверами, охлаждение и коммутатор — подключено и настроено. Наценка 25% + $1 500 за работу.</p>
      <div class="shop">${kits}</div>
      <h3>Сеть в зале</h3><div class="shop">${netPanel() || '<p class="muted">Все стойки подключены, коммутаторы настроены.</p>'}</div>
      <h3>Прайс</h3><dl class="kv"><dt>Кабель к стойке</dt><dd>$150 + $40 за клетку, 1 ч</dd><dt>Настройка коммутатора</dt><dd>$500, 1 ч</dd><dt>Сборка партии серверов</dt><dd>+20% к деталям, 2 ч</dd></dl>`;
  },
  infra() {
    const pts = Array.from({ length: 24 }, (_, h) => spotPrice(h) * (hasTech('solar') ? 0.65 : 1));
    const mx = Math.max(...pts, FIXED_PRICE, GAS_FUEL) * 1.1;
    const W = 240, Hh = 70, bw = W / 24;
    const y = (v) => Hh - (v / mx) * Hh;
    const curve = `<svg class="curve" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Цена электричества по часам">${pts.map((v, h) => `<rect x="${h * bw + 0.5}" y="${y(v)}" width="${bw - 1}" height="${Hh - y(v)}" fill="${h === S.hour ? '#6cb4ff' : '#2b3a48'}"/>`).join('')}<line x1="0" x2="${W}" y1="${y(GAS_FUEL)}" y2="${y(GAS_FUEL)}" stroke="#f2b24a" stroke-dasharray="3 3"/><line x1="0" x2="${W}" y1="${y(FIXED_PRICE)}" y2="${y(FIXED_PRICE)}" stroke="#a184e6" stroke-dasharray="3 3"/></svg>`;
    const gasNow = S.halls.reduce((a, H) => a + (H.open ? H.gasUsed || 0 : 0), 0);
    const energy = `<h3>Энергия</h3>
      <dl class="kv"><dt>Цена сейчас</dt><dd>$${elecPrice().toFixed(2).replace('.', ',')}/кВт·ч</dd><dt>Своя генерация сейчас</dt><dd>${gasNow.toFixed(0)} кВт</dd><dt>Продажа тепла</dt><dd class="ok">${fmt$(S.heatInc)}/ч</dd></dl>
      ${curve}<p class="muted">Столбики — биржевая цена по часам сегодня. Жёлтая линия — себестоимость газовой турбины, фиолетовая — фиксированный тариф.</p>
      <div class="row"><span class="muted">Тариф с завтра</span><div class="seg"><button type="button" data-act="tariffE" data-a="spot" aria-pressed="${S.energy.next === 'spot'}">Биржа</button><button type="button" data-act="tariffE" data-a="fixed" aria-pressed="${S.energy.next === 'fixed'}">Фикс $0,50</button></div></div>`;
    const nets = S.halls.map((H, i) => {
      if (!H.open) return '';
      const cur = NET_TIERS[H.net || 0], nx = NET_TIERS[(H.net || 0) + 1];
      return `<div class="row"><span>${HALLS[i].name}: <b>${cur.name}</b>${cur.fee ? ` <span class="meta">· ${fmt$(cur.fee)}/день</span>` : ''}</span>${nx ? `<button class="btn sm" type="button" data-act="netup" data-a="${i}" ${S.money < nx.price ? 'disabled' : ''}>До ${nx.name} · ${fmt$(nx.price)}</button>` : '<span class="meta ok">максимум</span>'}</div>`;
    }).join('');
    const bwPct = S.bw.cap ? Math.min(100, (S.bw.dem / S.bw.cap) * 100) : 100;
    const network = `<h3>Сеть</h3><div class="cap"><span>Трафик</span><div class="meter"><i style="width:${bwPct}%;background:${S.bw.dem > S.bw.cap ? 'var(--crit)' : bwPct > 85 ? 'var(--warn)' : 'var(--ok)'}"></i></div><span>${fmtN(S.bw.dem)} / ${fmtN(S.bw.cap)}</span></div>
      <p class="muted">Каналы всех залов складываются. Не хватит канала — все клиенты получат меньше сервиса. Больше всего трафика едят видео и игры.</p>${nets}`;
    const th = threat(), df = defense();
    const security = `<h3>Безопасность</h3>
      <div class="cap"><span>Угроза</span><div class="meter"><i style="width:${th}%;background:var(--crit)"></i></div><span>${Math.round(th)}</span></div>
      <div class="cap"><span>Защита</span><div class="meter"><i style="width:${df}%;background:var(--ok)"></i></div><span>${Math.round(df)}</span></div>
      <p class="muted">Угроза растёт с выручкой и известностью. Шанс атаки сегодня: ${Math.round(attackChance() * 100)}%. Защиту дают безопасники, SOC-аналитики, NGFW, Zero Trust и пентесты.</p>
      <div class="row"><span class="muted">${S.sec.pentest > 0 ? `Пентест действует ещё ${Math.ceil(S.sec.pentest / 24)} дн.` : 'Пентест: +20 к защите на неделю'}</span><button class="btn sm" type="button" data-act="pentest" ${S.sec.pentest > 0 || S.money < 2000 * repLevel() ? 'disabled' : ''}>Заказать · ${fmt$(2000 * repLevel())}</button></div>`;
    return energy + network + security;
  },
  tender() {
    const T = S.tender;
    let cur = '<p class="muted">Сейчас тендеров нет. Новый объявят через несколько дней.</p>';
    if (T) {
      cur = `<div class="item cur"><div class="row"><b>${T.name}</b><span>${T.gov ? '<span class="tag urgent">Госзаказ</span> ' : ''}${typeTag(T.type)}</span></div>
        <div class="row meta"><span>${KINDS[T.kind].label} · ${fmtN(T.amount)} ${TYPES[T.type].unit} · SLA ${T.sla}%</span><span>${T.days} дн.</span></div>
        <div class="row meta"><span>Базовая цена ${fmt$(T.base)}/ч</span><span>итоги через ${T.left} ч</span></div>
        <p class="muted">Чем ниже ставка и выше репутация, тем больше шанс. Выиграли — контракт ваш сразу, мощности нужно иметь заранее.</p>
        <div class="bids">${BIDS.map((b) => `<button class="btn" type="button" data-act="bid" data-a="${b}" aria-pressed="${T.bid === b}">${Math.round(b * 100)}%<small>${fmt$(T.base * b)}/ч</small></button>`).join('')}</div>
        ${T.bid ? '<button class="btn sm" type="button" data-act="bid" data-a="off">Отозвать заявку</button>' : ''}</div>`;
    }
    const rivals = S.rivals.map((r, n) => r.bought
      ? `<div class="item done"><div class="row"><b>${r.name}</b><span class="meta ok">ваша компания</span></div></div>`
      : `<div class="item"><div class="row"><b>${r.name}</b><span class="meta">репутация ${Math.round(r.rep)}</span></div><div class="meter"><i style="width:${r.rep}%;background:var(--warn)"></i></div>
        <div class="row"><span class="muted">После покупки: +${fmt$(rivalPrice(r) / 600)}/ч и меньше соперников</span><button class="btn sm primary" type="button" data-act="buyrival" data-a="${n}" ${S.money < rivalPrice(r) ? 'disabled' : ''}>Купить · ${fmt$(rivalPrice(r))}</button></div></div>`).join('');
    const hist = S.tlog.map((x) => `<div class="row meta"><span>${x.name}</span><span class="${x.me ? 'ok' : ''}">${x.winner}</span></div>`).join('');
    return `<h3>Текущий тендер</h3>${cur}<h3>Конкуренты · ваша репутация ${Math.round(S.rep)}</h3><div class="list">${rivals}</div>${hist ? `<h3>Последние тендеры</h3>${hist}` : ''}${S.subs ? `<p class="muted">Доход дочерних компаний: ${fmt$(S.subs)}/ч</p>` : ''}`;
  },
  mail() {
    const list = S.inbox.map((m) => {
      const M = MSGS[m.i];
      return `<div class="item"><div class="row"><b>${M.from}</b><span class="meta">ответить за ${m.left} ч</span></div><p>${M.text(m.data)}</p>
        <div class="btnrow"><button class="btn sm primary" type="button" data-act="mailans" data-a="${m.id}:yes">${M.yes[0]}</button><button class="btn sm" type="button" data-act="mailans" data-a="${m.id}:no">${M.no[0]}</button></div></div>`;
    }).join('');
    return `<div class="row"><h3>Входящие</h3><button class="btn sm" type="button" data-act="autono">${S.autoNo ? 'Автоотказ: вкл' : 'Автоотказ: выкл'}</button></div>
      <div class="list">${list || '<p class="muted">Писем нет. Если не ответить вовремя, выбирается безопасный вариант.</p>'}</div>`;
  },
  goals() {
    return `<div class="list">${GOALS.map((g, n) => `<div class="item ${n < S.goal ? 'done' : n === S.goal ? 'cur' : ''}"><div class="row"><span>${n < S.goal ? '✓ ' : ''}${g.t}</span><span class="meta">+${fmt$(g.r)}</span></div></div>`).join('')}</div>`;
  },
};
