// Загружает симуляцию игры в Node без браузера: те же файлы js/, что и на странице,
// только вместо DOM, звука и отрисовки подставлены заглушки.
import fs from 'node:fs';
import vm from 'node:vm';

const SIM_FILES = [
  'core', 'data', 'state', 'save', 'sound', 'contracts',
  'sim-network', 'sim-assembly', 'sim-tick', 'sim-debt', 'sim-load', 'sim-mail', 'sim-economy', 'sim-procurement', 'actions',
];

// Элемент-пустышка: любое свойство и любой вызов допустимы и ничего не делают.
function dummy() {
  const fn = function () {};
  return new Proxy(fn, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'value' ? '' : dummy()),
    set: () => true,
    apply: () => dummy(),
  });
}

export function loadGame({ seed } = {}) {
  const storage = new Map();
  const ctx = {
    console,
    document: { querySelector: () => dummy(), querySelectorAll: () => [] },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    setTimeout: () => 0, clearTimeout: () => {},
  };
  ctx.window = ctx;
  if (seed !== undefined) ctx.Math = seededMath(seed);
  vm.createContext(ctx);
  // Заглушки интерфейса, который живёт в ui.js, canvas.js и overlays.js.
  vm.runInContext(`
    let logDirty = false;
    const overlays = [];
    function showOverlay(mode) { overlays.push(mode); }
    function renderUI() {} function layoutCanvas() {} function afterLoad() {} function draw() {}
  `, ctx);
  const dir = new URL('../js/', import.meta.url);
  for (const f of SIM_FILES) {
    const file = new URL(`${f}.js`, dir);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file.pathname });
  }
  // Глобальные const/let страницы видны только изнутри контекста.
  const run = (code) => vm.runInContext(code, ctx);
  return { ctx, run, storage };
}

// Math с детерминированным Math.random (mulberry32), чтобы прогоны повторялись.
function seededMath(seed) {
  let a = seed >>> 0;
  const m = Object.create(Math);
  m.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return m;
}
