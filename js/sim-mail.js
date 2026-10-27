'use strict';
const URGENT_KIND = { cpu: 'web', sto: 'backup', gpu: 'ai' };
const RANSOM = 0;

const MSGS = [
  {
    from: 'Вымогатели «ByteBandits»',
    special: true,
    def: 'no',
    cond: () => false,
    text: (d) => `Ваш зал «${HALLS[d.hi].name}» зашифрован. Переведите ${fmt$(d.sum)} в биткоинах — и ключ ваш. Иначе ждите восстановления.`,
    yes: ['Заплатить выкуп', (d) => {
      if (!spend(d.sum)) return;
      if (Math.random() < 0.8) { S.halls[d.hi].locked = 1; log('Ключ получен, зал расшифровывается', 'warn'); }
      else log('Вымогатели взяли деньги и пропали. Зал всё ещё заблокирован', 'crit');
      S.rep = Math.max(0, S.rep - 2);
    }],
    no: ['Восстанавливаться самим', () => log('Восстанавливаемся из бэкапов без выкупа')],
  },
  {
    from: 'Маркетинг',
    text: () => 'Запустим рекламу у блогеров за $1 500? Двое суток клиентов будет в разы больше.',
    cond: () => S.money >= 1500 && !S.promo,
    yes: ['Запускаем', () => { if (!spend(1500)) return; S.promo = 48; log('Реклама запущена: двое суток клиентов больше', 'good'); }],
    no: ['Не сейчас', () => log('Маркетинг грустно закрыл презентацию')],
  },
  {
    from: 'Венчурный фонд «Ракета»',
    init: () => ({ sum: Math.round(Math.max(15000, valuation() * 0.15) / 1000) * 1000 }),
    text: (d) => `Дадим ${fmt$(d.sum)} за 10% компании. Взамен 10% дохода от клиентов навсегда уходит нам.`,
    cond: () => S.equity < 0.3 && S.day >= 4,
    yes: ['Берём деньги', (d) => {
      S.money += d.sum; S.today.other -= d.sum;
      S.equity = Math.round((S.equity + 0.1) * 100) / 100;
      log(`Фонд вложил ${fmt$(d.sum)}. Доля инвесторов: ${Math.round(S.equity * 100)}%`, 'good');
      Sound.coin();
    }],
    no: ['Сами справимся', () => log('Фонд пообещал вернуться')],
  },
  {
    from: 'Стажёр Петя',
    text: () => 'Дай root на прод, я только посмотрю! Честно-честно.',
    cond: () => allRacks((t) => t.s.length > 0).length > 0,
    yes: ['Дать root', () => {
      if (Math.random() < 0.5) {
        S.capBonus = Math.round((S.capBonus + 0.1) * 100) / 100;
        log('Петя настроил кэширование: вычисления +10% навсегда', 'good');
        Sound.win();
      } else {
        const r = pick(allRacks((t) => t.s.length > 0));
        r.t.broken = r.t.s.length; r.t.lastBroken = r.t.broken;
        log(`Петя запустил rm -rf / в стойке ${tileName(r.hi, r.i)}. Вся стойка легла`, 'crit');
        Sound.crash();
      }
    }],
    no: ['Не дам', () => log('Петя ушёл пить чай')],
  },
  {
    from: 'Бухгалтерия',
    text: () => 'У нас не печатает принтер, это же к вам? Главбух обещала премию $400.',
    yes: ['Пойти чинить', () => {
      S.money += 400; S.today.other -= 400;
      const rs = allRacks((t) => t.s.length > t.broken);
      for (let n = 0; n < 2 && rs.length; n++) { const r = rs.splice(randi(0, rs.length - 1), 1)[0]; r.t.broken++; }
      log('Принтер ожил, премия +$400. Но пока вас не было, в зале что-то сломалось', 'warn');
    }],
    no: ['Это не к нам', () => log('Бухгалтерия пишет на вас служебку')],
  },
  {
    from: 'Поставщик «Б/у-Сервер»',
    text: () => 'Шесть б/у серверов Silver за $2 000 вместо $5 400. Каждый второй может оказаться битым.',
    cond: () => freeSlots() >= 6 && S.money >= 2000,
    yes: ['Беру партию', () => {
      if (freeSlots() < 6 || !spend(2000)) return;
      let left = 6, bad = 0;
      allRacks((t) => slotsFree(t) > 0).forEach(({ t }) => {
        while (left > 0 && slotsFree(t) > 0) {
          if (Math.random() < 0.45) { t.s.push('b2'); t.broken++; t.lastBroken = t.broken; bad++; }
          else t.s.splice(t.s.length - t.broken, 0, 'b2');
          left--;
        }
      });
      S.halls.forEach((H, hi) => { if (H.open) refreshHall(hi); });
      log(`Партия б/у установлена: 6 серверов Silver, битых ${bad}`, bad > 3 ? 'warn' : 'good');
    }],
    no: ['Не надо', () => log('Поставщик обещал перезвонить')],
  },
  {
    from: 'Охрана',
    text: () => 'На проходной курьер с кондиционером, говорит, вы заказывали. Пустить?',
    cond: () => emptyTiles().length > 0,
    yes: ['Пустить', () => {
      const e = emptyTiles();
      if (Math.random() < 0.65 && e.length) {
        const [hi, i] = pick(e);
        S.halls[hi].grid[i] = { k: 'crac' };
        refreshHall(hi);
        log(`Бесплатный кондиционер встал в ${HALLS[hi].name}, ${tileName(hi, i)}. Кто-то ошибся адресом`, 'good');
        Sound.coin();
      } else {
        S.money -= 1500; S.today.other += 1500;
        log('Это был мошенник: со счёта списали $1 500', 'crit');
        Sound.bad();
      }
    }],
    no: ['Гнать', () => log('Курьер ушёл, ругаясь')],
  },
  {
    from: 'Соседи-майнеры',
    text: () => 'Сдайте угол под нашу ASIC-ферму: $30 в час. Греется, правда, как печка, и ест 6 кВт.',
    cond: () => !hasMiner() && !!minerSpot(),
    yes: ['Сдать угол', () => {
      const sp = minerSpot();
      if (!sp) return;
      S.halls[sp[0]].grid[sp[1]] = { k: 'miner', temp: 30, heat: 0, cool: 0, fire: 0 };
      refreshHall(sp[0]);
      log(`ASIC-ферма заехала: ${HALLS[sp[0]].name}, ${tileName(sp[0], sp[1])}. Следите за теплом`, 'warn');
    }],
    no: ['Нет', () => log('Майнеры ушли к конкурентам')],
  },
  {
    from: 'Пожарная инспекция',
    def: 'yes',
    text: () => 'Внеплановая проверка. Проходим честно или «решим вопрос» за $500?',
    yes: ['Честно', () => {
      const hot = allRacks((t) => t.temp > 40 || t.fire).length > 0;
      const noUps = S.halls.some((H) => H.open && !H.grid.some((t) => t && (t.k === 'ups' || t.k === 'gen')));
      if (hot || noUps) {
        S.money -= 3000; S.today.other += 3000; S.rep = Math.max(0, S.rep - 3);
        log(`Инспекция нашла нарушения (${hot ? 'перегрев' : 'нет ИБП в зале'}): штраф $3 000`, 'crit');
        Sound.bad();
      } else {
        S.rep = Math.min(100, S.rep + 5);
        log('Инспекция довольна. Репутация +5', 'good');
        Sound.coin();
      }
    }],
    no: ['«Решить вопрос»', () => {
      S.money -= 500; S.today.other += 500;
      if (Math.random() < 0.3) { S.rep = Math.max(0, S.rep - 10); log('Скандал: про взятку написали в новостях. Репутация −10', 'crit'); Sound.bad(); }
      else log('Вопрос решён. Осадочек остался');
    }],
  },
  {
    from: 'Срочный клиент',
    init: () => {
      const type = pick(['cpu', 'sto'].concat(hasTech('gpu') ? ['gpu'] : []));
      const amt = Math.max(5, Math.round(Math.max(S.cap[type] - S.peak[type], 0) * rand(0.5, 1.3) + AMT[type][0][0]));
      return { type, amt, pay: Math.round(amt * TYPES[type].rate * 3 * 10) / 10, name: pick(CLIENTS[URGENT_KIND[type]]) };
    },
    text: (d) => `${d.name}: у нас всё горит! Нужно ${fmtN(d.amt)} ${TYPES[d.type].unit} на сутки, платим втрое — ${fmt$(d.pay)} в час.`,
    yes: ['Берём', (d) => {
      S.contracts.push({ id: S.nextId++, name: d.name, kind: URGENT_KIND[d.type], type: d.type, amount: d.amt, sla: 95, lvl: 1, urgent: true, pay: d.pay, days: 1, left: 24, ok: 0, hrs: 0 });
      S.stats.signed++;
      log(`Срочный контракт: «${d.name}», ${fmtN(d.amt)} ${TYPES[d.type].unit} на сутки`, 'good');
    }],
    no: ['Не потянем', () => log('Срочный клиент ушёл искать другой ЦОД')],
  },
];

function signOffer(o, auto) {
  S.offers = S.offers.filter((x) => x !== o);
  S.contracts.push({ ...o, left: o.days * 24, ok: 0, hrs: 0 });
  S.stats.signed++;
  log(`${auto ? 'Менеджер подписал' : 'Подписан'} контракт: «${o.name}», ${fmtN(o.amount)} ${TYPES[o.type].unit}`, 'good');
  Sound.coin();
}
function autoSign() {
  const L = repLevel();
  // Подписывает, пока пик по договорам (с учётом суточных профилей) влезает в мощность × уровень продаж с запасом 10%.
  S.offers.filter((o) => o.lvl <= L).sort((a, b) => b.pay / b.amount - a.pay / a.amount).forEach((o) => {
    if (planPeak(o.type, o) * 1.1 <= S.cap[o.type] * oversell()) signOffer(o, true);
  });
}
