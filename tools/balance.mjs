// Прогон баланса: бот играет N партий по D дней, печатает медиану денег, серверов и репутации по дням.
// Запуск: node tools/balance.mjs [партий=20] [дней=60]
import { loadGame } from '../tests/harness.mjs';
import { BOT } from '../tests/bot.mjs';

const runs = Number(process.argv[2] || 20), days = Number(process.argv[3] || 60);
const rows = Array.from({ length: days }, () => []);
const ends = [];
for (let seed = 1; seed <= runs; seed++) {
  const g = loadGame({ seed });
  g.run(BOT);
  g.run('newState(); S.started = true;');
  for (let d = 0; d < days; d++) {
    const snap = JSON.parse(g.run(`for (let i = 0; i < 24 && !S.over; i++) { botHour(); tick(); }
      JSON.stringify({ money: S.money, srv: countServers(), rep: S.rep, contracts: S.contracts.length, over: S.over })`));
    rows[d].push(snap);
  }
  ends.push(g.run('S.over ? `день ${S.day}: ${S.overReason || "банкротство"}` : "жив"'));
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log('день   деньги(мед)  серверы  реп  контракты  выбыло');
rows.forEach((r, d) => {
  if (d % 5 !== 4 && d !== 0) return;
  const alive = r.filter((x) => !x.over);
  const f = (k) => (alive.length ? Math.round(med(alive.map((x) => x[k]))) : '-');
  console.log(String(d + 1).padStart(4), String(f('money')).padStart(12), String(f('srv')).padStart(8), String(f('rep')).padStart(4), String(f('contracts')).padStart(10), String(r.length - alive.length).padStart(7));
});
console.log('Итоги:', ends.join('; '));
