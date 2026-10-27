'use strict';
// ================= STATE =================
let S;
function newState() {
  const halls = HALLS.map((h, i) => ({ open: i === 0, grid: Array(h.w * h.h).fill(null), dark: false, load: 0, cap: h.kw, backup: 0 }));
  const g = halls[0].grid;
  g[1 * 5 + 1] = Object.assign(mkRack(['b1', 'b1']), { link: 2 * 5 + 1, cable: 'ok' });
  g[1 * 5 + 2] = { k: 'crac' };
  g[2 * 5 + 1] = { k: 'sw', cfg: 'ok' };
  const st = {
    v: SAVE_VERSION, day: 1, hour: 8, money: 3000, rep: 10, speed: 1, paused: false, started: false, over: false, won: false,
    halls, tech: {}, research: null, staff: { admin: 0, eng: 0, guard: 0, sales: 0, acct: 0, buyer: 0, soc: 0, neteng: 0, tech: 0 }, jobs: [],
    contracts: [], offers: [], nextId: 1, event: null, nextEvent: 44, goal: 0,
    stats: { signed: 0, done: 0, failed: 0, bestDay: 0, tenders: 0 },
    today: { inc: 0, elec: 0, sal: 0, rent: 0, other: 0 }, history: [], hourly: [],
    log: [], debtDays: 0, cur: 0, sel: null, tool: 'select', view: 'normal', tab: 'deals',
    cap: { cpu: 0, sto: 0, gpu: 0 }, dem: { cpu: 0, sto: 0, gpu: 0 }, peak: { cpu: 0, sto: 0, gpu: 0 }, served: { cpu: 1, sto: 1, gpu: 1 },
    tariff: 1, loan: 0, equity: 0, capBonus: 0, promo: 0, msg: null, nextMsg: 20, lastMsg: -1, inbox: [], autoNo: false,
    market: { cpu: 1, sto: 1, gpu: 1 }, mhist: [], trend: null, nextTrend: 96,
    tender: null, nextTender: 60, tlog: [], subs: 0,
    rivals: [{ name: 'ГигаХост', rep: 28, bought: false }, { name: 'Облако-24', rep: 42, bought: false }, { name: 'ООО «Сервер на балконе»', rep: 12, bought: false }],
    policy: { headroom: 0.25, reserve: 5000, racks: true },
    hw: { cpu: 1, sto: 1, gpu: 1 }, certs: {}, insured: false,
    designs: [], stock: {}, asm: [], netJobs: [], cfgTarget: null,
    draft: { ch: 'c1', cpu: 'p1', ncpu: 1, ram: 'r1', disk: 'd0', ndisk: 0, gpu: 'g0', ngpu: 0, qty: 1 },
    energy: { tariff: 'spot', next: 'spot', dayF: 1 }, bw: { dem: 0, cap: 10 }, sec: { pentest: 0 }, ipo: null, overReason: '', heatInc: 0,
    autoPause: true,
  };
  S = st;
  S.offers.push(genOffer(true), genOffer(), genOffer());
  return st;
}
function mkRack(s = []) { return { k: 'rack', s, broken: 0, fire: 0, temp: 24, heat: 0, cool: 0, age: 0, link: null, cable: 'none' }; }
const certOn = (id) => !!(S.certs[id] && S.certs[id].on);

const repLevel = () => clamp(1 + Math.floor(S.rep / 20), 1, 5);
const hasTech = (id) => !!S.tech[id];
function countServers() { let n = 0; S.halls.forEach((h) => h.grid.forEach((t) => { if (t && t.k === 'rack') n += t.s.length; })); return n; }
const fmt$ = (v) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2).replace('.', ',')} млн` : Math.round(a).toLocaleString('ru-RU');
  return (v < 0 ? '−$' : '$') + s;
};
const fmtN = (v) => Math.round(v).toLocaleString('ru-RU');
const clock = () => `${String(S.hour).padStart(2, '0')}:00`;
const tileName = (h, i) => `${String.fromCharCode(65 + (i % HALLS[h].w))}${Math.floor(i / HALLS[h].w) + 1}`;

function log(msg, lvl = '') {
  S.log.unshift({ t: `Д${S.day} ${clock()}`, msg, lvl });
  if (S.log.length > 60) S.log.length = 60;
  logDirty = true;
}
let toastTimer;
function toast(msg, cls = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${cls}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}
