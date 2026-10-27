// Тесты симуляции без браузера. Запуск: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './harness.mjs';
import { BOT } from './bot.mjs';

function play(seed, days, bot = true) {
  const g = loadGame({ seed });
  g.run(BOT);
  g.run('newState(); S.started = true;');
  g.run(`for (let i = 0; i < ${days * 24} && !S.over; i++) { ${bot ? 'botHour();' : ''} tick(); }`);
  return g;
}

function checkInvariants(g) {
  const bad = JSON.parse(g.run(`JSON.stringify((() => {
    const out = [];
    if (!Number.isFinite(S.money)) out.push('money ' + S.money);
    if (!(S.rep >= 0 && S.rep <= 100)) out.push('rep ' + S.rep);
    S.halls.forEach((H, hi) => H.grid.forEach((t, i) => {
      if (!t) return;
      if (t.k === 'rack' && t.s.length > RACK_SLOTS) out.push('rack overflow ' + tileName(hi, i));
      if (t.k === 'rack' && !Number.isFinite(t.temp)) out.push('temp ' + tileName(hi, i));
    }));
    for (const k in S.cap) if (!Number.isFinite(S.cap[k])) out.push('cap ' + k);
    return out;
  })())`));
  assert.deepEqual(bad, []);
}

test('без действий игрока 20 дней проходят без ошибок', () => {
  for (const seed of [1, 2, 3]) checkInvariants(play(seed, 20, false));
});

test('бот играет 40 дней без ошибок и нарушений инвариантов', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = play(seed, 40);
    checkInvariants(g);
    assert.ok(g.run('S.stats.signed') > 0, 'бот подписал хотя бы один контракт');
  }
});

test('сохранение и загрузка возвращают то же состояние', () => {
  const g = play(7, 10);
  g.run('save();');
  const before = g.run('JSON.stringify(S)');
  g.run('restoreState(readSave());');
  assert.equal(g.run('JSON.stringify(S)'), before);
  g.run('for (let i = 0; i < 48; i++) tick();');
  checkInvariants(g);
});

test('старое сохранение без новых полей загружается и играется', () => {
  const g = play(9, 3);
  g.run(`(() => {
    const d = JSON.parse(JSON.stringify(S));
    ['energy', 'certs', 'hw', 'policy', 'sec', 'bw', 'designs', 'asm', 'netJobs', 'stock', 'draft'].forEach((k) => delete d[k]);
    delete d.stats.tenders; delete d.staff.neteng; delete d.staff.tech;
    restoreState(d);
  })()`);
  assert.equal(g.run('S.staff.neteng'), 0);
  assert.equal(g.run('S.energy.tariff'), 'spot');
  g.run('for (let i = 0; i < 72; i++) tick();');
  checkInvariants(g);
});

test('сохранение из более новой версии игры не загружается', () => {
  const g = loadGame();
  assert.equal(g.run('canLoad({ v: SAVE_VERSION + 1, day: 3 })'), false);
  assert.equal(g.run('canLoad({ v: SAVE_VERSION, day: 3 })'), true);
  assert.equal(g.run('canLoad({ v: SAVE_VERSION, day: 3, over: true })'), false);
});
