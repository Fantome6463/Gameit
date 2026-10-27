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

test('сохранение v1 с коммутатором на отдельной клетке переводится в стойку', () => {
  const g = loadGame({ seed: 3 });
  g.run('newState(); S.started = true;');
  // Так выглядел зал в версии 1: стойка B2 подключена кабелем к коммутатору на клетке B3.
  g.run(`(() => {
    const d = JSON.parse(JSON.stringify(S));
    d.v = 1;
    const g = d.halls[0].grid;
    g[6] = Object.assign(mkRack(['b1', 'b1']), { link: 11, cable: 'ok' });
    g[11] = { k: 'sw', cfg: 'ok' };
    restoreState(d);
  })()`);
  assert.equal(g.run('S.v'), g.run('SAVE_VERSION'));
  assert.equal(g.run('S.halls[0].grid[11].k'), 'rack');
  assert.equal(g.run('S.halls[0].grid[11].net.k'), 'sw');
  assert.equal(g.run('netMult(S.halls[0].grid, S.halls[0].grid[6])'), 1);
  g.run('for (let i = 0; i < 24; i++) tick();');
  assert.ok(g.run('S.cap.cpu') > 0);
});

test('коммутатор ставится в стойку и занимает в ней места', () => {
  const g = loadGame({ seed: 4 });
  g.run('newState(); S.started = true; S.money = 1e6;');
  // Стартовая стойка уже со своим коммутатором: 2 сервера + 1 место под ToR.
  assert.equal(g.run('slotsFree(S.halls[0].grid[6])'), 3);
  assert.equal(g.run('S.halls[0].grid[6].link'), 6);
  // На пустой клетке ставится новая стойка с коммутатором, своя стойка подключена сразу.
  assert.equal(g.run("place('sw', 0, 0)"), true);
  assert.equal(g.run('S.halls[0].grid[0].k'), 'rack');
  assert.equal(g.run('S.halls[0].grid[0].link'), 0);
  assert.equal(g.run('S.halls[0].grid[0].net.cfg'), 'raw');
  // Второй коммутатор в ту же стойку не встаёт, в полную стойку — тоже.
  assert.equal(g.run("place('sw', 0, 0)"), false);
  g.run("place('rack', 0, 3); S.halls[0].grid[3].s = Array(RACK_SLOTS).fill('b1');");
  assert.equal(g.run("place('sw', 0, 3)"), false);
  // В полную стойку нельзя добавить сервер, если место занято коммутатором.
  g.run("S.halls[0].grid[0].s = Array(RACK_SLOTS - 1).fill('b1'); S.sel = { h: 0, i: 0 }; ACT.addsrv('b1');");
  assert.equal(g.run('S.halls[0].grid[0].s.length'), 5);
  // Снятие коммутатора отключает стойки, которые к нему подключены.
  g.run('S.sel = { h: 0, i: 6 }; ACT.swremove();');
  assert.equal(g.run('S.halls[0].grid[6].net'), undefined);
  assert.equal(g.run('S.halls[0].grid[6].link'), null);
});

test('готовый модуль ставит коммутатор в первую стойку', () => {
  const g = loadGame({ seed: 5 });
  g.run("newState(); S.started = true; S.money = 1e6; S.halls[1].open = true;");
  assert.equal(g.run("placeKit(KITS[0], 1)"), null);
  const r = JSON.parse(g.run(`JSON.stringify(S.halls[1].grid.map((t, i) => t && t.k === 'rack' ? { i, n: t.s.length, net: !!t.net, link: t.link } : null).filter(Boolean))`));
  assert.equal(r.length, 2);
  assert.equal(r.filter((x) => x.net).length, 1);
  assert.equal(r.reduce((a, x) => a + x.n, 0), g.run('kitServers(KITS[0])'));
  const sw = r.find((x) => x.net).i;
  assert.ok(r.every((x) => x.link === sw));
});
