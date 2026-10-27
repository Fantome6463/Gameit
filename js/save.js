'use strict';
// ================= SAVE =================
// Сохранение хранит S целиком. Если меняется форма состояния, поднимите SAVE_VERSION
// и добавьте MIGRATIONS[старая версия] — функцию, которая доводит старое сохранение до следующей версии.
// Новые поля с простыми значениями по умолчанию миграции не нужны: их подставит newState().
const SAVE_KEY = 'cod-magnat.save.v1';
const SAVE_VERSION = 2;
const MIGRATIONS = {
  // v1 → v2: коммутаторы стояли на отдельных клетках, теперь они внутри стоек.
  // Клетка с коммутатором становится стойкой с ним; подключённые стойки ссылаются на ту же клетку.
  1(d) {
    (d.halls || []).forEach((H) => H.grid.forEach((t, i) => {
      if (!t || !SW[t.k]) return;
      H.grid[i] = Object.assign(mkRack(), { net: { k: t.k, cfg: t.cfg || 'raw' }, link: i, cable: 'ok' });
    }));
  },
};

function save() {
  if (S.over) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
}
function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
}
const canLoad = (data) => !!data && typeof data.v === 'number' && data.v <= SAVE_VERSION && !data.over;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// Доводит сохранение до текущей версии и накладывает его на свежее состояние,
// чтобы поля, которых не было в старой версии, получили значения по умолчанию.
function restoreState(data) {
  data = JSON.parse(JSON.stringify(data));
  if (!data.energy) data.inbox = []; // письма из сохранений до энергетики несовместимы
  for (let v = data.v; v < SAVE_VERSION; v++) { MIGRATIONS[v](data); data.v = v + 1; }
  const base = newState();
  for (const k in data) base[k] = isObj(base[k]) && isObj(data[k]) ? Object.assign(base[k], data[k]) : data[k];
  S = base;
  S.designs.forEach(registerDesign);
  return S;
}
