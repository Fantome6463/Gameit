'use strict';
// ================= DATA =================
const TYPES = {
  cpu: { name: 'Вычисления', unit: 'ядер', rate: 0.5 },
  sto: { name: 'Хранение', unit: 'ТБ', rate: 0.15 },
  gpu: { name: 'ИИ', unit: 'GPU', rate: 3.2 },
};
const MODELS = {
  b1: { name: 'Bronze 1U', type: 'cpu', cap: 10, heat: 3, kw: 0.4, price: 300, tier: 1 },
  b2: { name: 'Silver 2U', type: 'cpu', cap: 25, heat: 5, kw: 0.6, price: 900, tier: 2, req: 'silver' },
  b3: { name: 'Platinum 4U', type: 'cpu', cap: 60, heat: 8, kw: 1.0, price: 2500, tier: 3, req: 'platinum' },
  s1: { name: 'Дисковая полка', type: 'sto', cap: 40, heat: 2, kw: 0.3, price: 400, tier: 1 },
  s2: { name: 'All-flash массив', type: 'sto', cap: 150, heat: 3, kw: 0.5, price: 1800, tier: 2, req: 'flash' },
  g1: { name: 'GPU-узел', type: 'gpu', cap: 8, heat: 12, kw: 2.0, price: 4000, tier: 2, req: 'gpu' },
  g2: { name: 'GPU-кластер', type: 'gpu', cap: 32, heat: 22, kw: 4.0, price: 14000, tier: 3, req: 'gpu2' },
};
const RACK_SLOTS = 6;
const BUILD = {
  rack: { name: 'Стойка', price: 200, kw: 0, short: '6 серверов', desc: 'Вмещает 6 серверов любого типа.' },
  crac: { name: 'Кондиционер', price: 800, kw: 3, cool: 30, r: 1, short: '30 · R1', desc: 'Снимает 30 ед. тепла, делится между стойками в радиусе 1 клетки.' },
  chiller: { name: 'Чиллер', price: 3500, kw: 6, cool: 95, r: 2, req: 'chiller', short: '95 · R2', desc: 'Снимает 95 ед. тепла в радиусе 2 клеток.' },
  ups: { name: 'ИБП', price: 1000, kw: 0, backup: 25, short: '25 кВт', desc: 'Держит 25 кВт нагрузки зала при отключении электричества.' },
  gen: { name: 'Дизель', price: 6000, kw: 0, backup: 150, req: 'diesel', short: '150 кВт', desc: 'Генератор держит 150 кВт при отключении.' },
  trafo: { name: 'Трансформатор', price: 2500, kw: 0, power: 60, short: '+60 кВт', desc: 'Поднимает лимит мощности зала на 60 кВт.' },
  sw: { name: 'Коммутатор ToR', price: 1200, kw: 0.3, inRack: true, short: '8 портов · 1 место', desc: 'Ставится в стойку и занимает 1 место из 6. Подключает свою стойку без кабеля и ещё до 7 стоек на расстоянии до 3 клеток. На пустой клетке ставится вместе с новой стойкой. После установки его нужно настроить.' },
  sw2: { name: 'Коммутатор Spine', price: 6000, kw: 0.8, req: 'spine', inRack: true, short: '32 порта · 2 места', desc: 'Ставится в стойку и занимает 2 места из 6. Подключает свою стойку и ещё до 31 стойки на расстоянии до 6 клеток. Требует настройки.' },
  gas: { name: 'Газовая турбина', price: 12000, kw: 0, backup: 80, gas: 80, req: 'gas', short: '80 кВт', desc: 'Вырабатывает до 80 кВт по $0,30/кВт·ч, когда сеть дороже. При отключении держит 80 кВт.' },
  heatx: { name: 'Теплообменник', price: 6000, kw: 1, cool: 20, r: 2, heatx: true, req: 'heatreuse', short: 'продаёт тепло', desc: 'Снимает 20 ед. тепла в радиусе 2 и продаёт его городской котельной. На севере тепло стоит вдвое дороже.' },
  miner: { name: 'ASIC-ферма соседей', price: 0, kw: 6, hidden: true, desc: 'Чужая майнинг-ферма. Платит $30 в час, но выдаёт 40 ед. тепла и забирает охлаждение у соседних стоек.' },
};
const MINER_HEAT = 40;
const TRENDS = [
  { name: 'ИИ-бум', desc: 'Все хотят нейросети: аренда GPU дорожает.', mult: { gpu: 1.9, cpu: 1.1 }, days: 8 },
  { name: 'Стриминговые войны', desc: 'Видеосервисы скупают хранилища.', mult: { sto: 1.6 }, days: 7 },
  { name: 'Криптозима', desc: 'GPU никому не нужны, цены падают.', mult: { gpu: 0.55 }, days: 6 },
  { name: 'Ценовая война облаков', desc: 'Гиганты демпингуют: все цены вниз.', mult: { cpu: 0.75, sto: 0.75, gpu: 0.8 }, days: 5 },
  { name: 'Импортозамещение', desc: 'Госзаказчики переезжают: вычисления в цене.', mult: { cpu: 1.5 }, days: 8 },
  { name: 'Дефицит видеокарт', desc: 'GPU-серверы стоят вдвое дороже, аренда GPU ×1,4.', mult: { gpu: 1.4 }, hw: { gpu: 2 }, days: 7 },
  { name: 'Сезон распродаж', desc: 'Маркетплейсы под нагрузкой.', mult: { cpu: 1.35, sto: 1.2 }, days: 5 },
  { name: 'Дешёвые диски', desc: 'Хранилища вдвое дешевле в закупке.', mult: { sto: 0.9 }, hw: { sto: 0.5 }, days: 6 },
];
const BIDS = [0.75, 0.9, 1, 1.15];
const NET_TIERS = [
  { name: '10 Гбит/с', cap: 10, price: 0, fee: 0 },
  { name: '40 Гбит/с', cap: 40, price: 3000, fee: 60 },
  { name: '100 Гбит/с', cap: 100, price: 12000, fee: 200 },
  { name: '400 Гбит/с', cap: 400, price: 50000, fee: 700 },
  { name: '1 Тбит/с', cap: 1000, price: 200000, fee: 2500 },
];
const BW = { web: 0.15, game: 0.25, bank: 0.05, backup: 0.06, media: 0.12, ai: 0.02, render: 0.03 };
const GAS_FUEL = 0.3, FIXED_PRICE = 0.5;
// Коммутаторы стоят в стойках: slots — сколько мест из RACK_SLOTS занимают, heat — сколько тепла дают.
const SW = { sw: { ports: 8, range: 3, slots: 1, heat: 1 }, sw2: { ports: 32, range: 6, slots: 2, heat: 2 } };
const PARTS = {
  ch: {
    c1: { name: 'Корпус 1U', price: 60, sockets: 1, bays: 2, gpus: 0, kw: 0.05, heat: 0.3 },
    c2: { name: 'Корпус 2U', price: 120, sockets: 2, bays: 8, gpus: 1, kw: 0.08, heat: 0.5 },
    c4: { name: 'Корпус 4U', price: 250, sockets: 4, bays: 24, gpus: 4, kw: 0.12, heat: 0.8 },
  },
  cpu: {
    p1: { name: 'Ядро-12', cpu: 12, heat: 2.5, kw: 0.25, price: 140, tier: 1, hw: 'cpu' },
    p2: { name: 'Ядро-32', cpu: 30, heat: 4, kw: 0.4, price: 480, tier: 2, req: 'silver', hw: 'cpu' },
    p3: { name: 'Ядро-96', cpu: 75, heat: 6.5, kw: 0.7, price: 1600, tier: 3, req: 'platinum', hw: 'cpu' },
  },
  ram: {
    r1: { name: '128 ГБ', mult: 0.85, price: 40, hw: 'cpu' },
    r2: { name: '512 ГБ', mult: 1, price: 160, hw: 'cpu' },
    r3: { name: '2 ТБ', mult: 1.15, price: 600, req: 'virt', hw: 'cpu' },
  },
  disk: {
    d0: { name: 'нет' },
    d1: { name: 'HDD 8 ТБ', sto: 8, heat: 0.15, kw: 0.01, price: 45, tier: 1, hw: 'sto' },
    d2: { name: 'NVMe 16 ТБ', sto: 16, heat: 0.2, kw: 0.015, price: 260, tier: 2, req: 'flash', hw: 'sto' },
  },
  gpu: {
    g0: { name: 'нет' },
    g1: { name: 'Ускоритель A', gpu: 2, heat: 3.5, kw: 0.55, price: 800, tier: 2, req: 'gpu', hw: 'gpu' },
    g2: { name: 'Ускоритель H', gpu: 8, heat: 6, kw: 1.0, price: 3800, tier: 3, req: 'gpu2', hw: 'gpu' },
  },
};
const KITS = [
  { id: 'k1', name: 'Модуль «Старт»', desc: '2 стойки: 11 Bronze и коммутатор ToR, кондиционер.', racks: 2, model: 'b1', per: 6, cool: 'crac', sw: 'sw' },
  { id: 'k2', name: 'Модуль хранения', desc: '2 стойки: 11 дисковых полок и ToR, кондиционер.', racks: 2, model: 's1', per: 6, cool: 'crac', sw: 'sw' },
  { id: 'k3', name: 'Ряд Silver', desc: '4 стойки: 23 Silver и ToR, чиллер.', racks: 4, model: 'b2', per: 6, cool: 'chiller', sw: 'sw', req: 'silver' },
  { id: 'k4', name: 'GPU-под', desc: '3 стойки по 3 GPU-узла, ToR в первой, чиллер.', racks: 3, model: 'g1', per: 3, cool: 'chiller', sw: 'sw', req: 'gpu' },
  { id: 'k5', name: 'Ряд Platinum', desc: '6 стоек: 34 Platinum и Spine, 2 чиллера.', racks: 6, model: 'b3', per: 6, cool: 'chiller', cools: 2, sw: 'sw2', req: 'platinum' },
];
const CFG_OPTS = {
  vlan: ['10', '20', '30', '40', '50', '60'],
  mtu: ['1500', '9000'],
  uplink: ['access', 'trunk'],
  stp: ['вкл', 'выкл'],
  speed: ['10G', '25G', '100G'],
};
const CERTS = [
  { id: 'tier3', name: 'Tier III', price: 20000, desc: 'Резервирование питания. Контракты с SLA 99.9% платят на 20% больше.',
    need: 'Во всех залах резерв ИБП/дизелей не меньше нагрузки',
    ok: () => S.halls.every((H, i) => !H.open || hallStats(i).backup >= hallStats(i).load) },
  { id: 'iso', name: 'ISO 27001', price: 45000, desc: 'Информационная безопасность. Все новые контракты +10%.',
    need: 'Безопасник в штате и изучен Анти-DDoS',
    ok: () => S.staff.guard >= 1 && hasTech('antiddos') },
  { id: 'pci', name: 'PCI DSS', price: 60000, desc: 'Стандарт платёжных систем. Банки платят ×1,4 и приходят чаще.',
    need: 'Два безопасника и сертификат ISO 27001',
    ok: () => S.staff.guard >= 2 && certOn('iso') },
  { id: 'green', name: 'Зелёный ЦОД', price: 90000, desc: 'ESG-клиенты: хранение и ИИ платят +20%.',
    need: 'Солнечная станция и открытый Северный ЦОД',
    ok: () => hasTech('solar') && S.halls[4].open },
  { id: 'gov', name: 'Допуск к госзаказу', price: 200000, desc: 'В тендерах появляются госзаказы: объём ×1,5, цена ×1,5.',
    need: 'Репутация от 60 и сертификат Tier III',
    ok: () => S.rep >= 60 && certOn('tier3') },
];
const TARIFFS = [
  { name: 'Дёшево', pay: 0.8, flow: 1.7, rep: 1.3 },
  { name: 'Рынок', pay: 1, flow: 1, rep: 1 },
  { name: 'Дорого', pay: 1.3, flow: 0.55, rep: 0.8 },
];
const HALLS = [
  { name: 'Каморка под лестницей', w: 5, h: 4, kw: 15, amb: 24, price: 0, rent: 0, lvl: 1 },
  { name: 'Подвал', w: 7, h: 5, kw: 40, amb: 22, price: 8000, rent: 150, lvl: 1 },
  { name: 'Машинный зал №1', w: 9, h: 6, kw: 120, amb: 21, price: 40000, rent: 600, lvl: 2 },
  { name: 'Машинный зал №2', w: 10, h: 7, kw: 320, amb: 21, price: 160000, rent: 1800, lvl: 3 },
  { name: 'Северный ЦОД', w: 12, h: 8, kw: 900, amb: 9, price: 600000, rent: 5000, lvl: 4 },
  { name: 'Гиперскейл-кампус', w: 14, h: 9, kw: 3000, amb: 18, price: 2500000, rent: 15000, lvl: 5 },
];
const TECH = [
  { id: 'silver', name: 'Серверы Silver', price: 3000, days: 1.5, desc: 'CPU-серверы на 25 ядер.' },
  { id: 'diesel', name: 'Дизель-генераторы', price: 4000, days: 1, desc: 'Резерв 150 кВт на зал.' },
  { id: 'chiller', name: 'Чиллеры', price: 5000, days: 1.5, desc: 'Охлаждение 95 ед. в радиусе 2.' },
  { id: 'flash', name: 'All-flash хранилища', price: 6000, days: 2, desc: 'Хранилища на 150 ТБ.' },
  { id: 'virt', name: 'Виртуализация', price: 10000, days: 2, req: ['silver'], desc: '+20% мощности CPU.' },
  { id: 'antiddos', name: 'Анти-DDoS', price: 12000, days: 2, desc: 'DDoS почти не влияет на нагрузку.' },
  { id: 'fiber', name: 'Второй оптический канал', price: 15000, days: 1.5, desc: 'Экскаватор больше не страшен.' },
  { id: 'gpu', name: 'GPU-узлы', price: 18000, days: 2.5, req: ['silver'], desc: 'Открывает ИИ-контракты и GPU-серверы.' },
  { id: 'platinum', name: 'Серверы Platinum', price: 30000, days: 3, req: ['virt'], desc: 'CPU-серверы на 60 ядер.' },
  { id: 'liquid', name: 'Жидкостное охлаждение', price: 60000, days: 3, req: ['chiller', 'gpu'], desc: 'Тепло GPU-серверов −50%.' },
  { id: 'k8s', name: 'Kubernetes', price: 80000, days: 3, req: ['virt'], desc: '+25% CPU и +15% хранения.' },
  { id: 'solar', name: 'Солнечная станция', price: 100000, days: 4, desc: 'Электричество дешевле на 35%.' },
  { id: 'peering', name: 'Пиринг на точке обмена', price: 150000, days: 3, req: ['fiber'], desc: 'Новые контракты платят на 15% больше.' },
  { id: 'gpu2', name: 'GPU-кластеры', price: 250000, days: 5, req: ['liquid'], desc: 'GPU-серверы на 32 ускорителя.' },
  { id: 'cdn', name: 'Своя CDN', price: 25000, days: 2, req: ['fiber'], desc: 'Трафик сайтов, игр и видео −40%.' },
  { id: 'gas', name: 'Газовые турбины', price: 20000, days: 2, req: ['diesel'], desc: 'Своя генерация: дешевле сети в часы пик.' },
  { id: 'heatreuse', name: 'Утилизация тепла', price: 35000, days: 2.5, req: ['chiller'], desc: 'Теплообменники продают тепло серверов городу.' },
  { id: 'ngfw', name: 'Межсетевой экран NGFW', price: 15000, days: 1.5, desc: 'Защита от атак +20.' },
  { id: 'offbackup', name: 'Резервные копии вне площадки', price: 20000, days: 2, desc: 'Шифровальщик блокирует зал на 12 ч вместо 48, штрафы за утечки −50%.' },
  { id: 'zerotrust', name: 'Zero Trust', price: 120000, days: 4, req: ['ngfw'], desc: 'Защита от атак +30.' },
  { id: 'spine', name: 'Spine-коммутаторы', price: 25000, days: 2, req: ['fiber'], desc: 'Коммутаторы на 32 порта с дальностью 6 клеток.' },
  { id: 'sdn', name: 'Программно-определяемая сеть', price: 90000, days: 3, req: ['spine'], desc: 'Новые коммутаторы настраиваются сами.' },
  { id: 'aiops', name: 'AIOps', price: 500000, days: 6, req: ['k8s', 'gpu'], desc: 'Поломки −60%, админы чинят вдвое быстрее.' },
];
const STAFF = {
  admin: { name: 'Дежурный админ', pay: 200, desc: 'Сам бегает чинить сломанные серверы и тушить пожары.' },
  eng: { name: 'Инженер-климатовик', pay: 300, desc: '+8% к охлаждению во всех залах за каждого.', max: 10 },
  guard: { name: 'Безопасник', pay: 250, desc: 'Тушит пожары за час и гасит DDoS на 15% за каждого.', max: 6 },
  sales: { name: 'Менеджер продаж', pay: 350, desc: '+1 предложение и +5% к оплате новых контрактов.', max: 5 },
  neteng: { name: 'Сетевой инженер', pay: 350, desc: 'Сам прокладывает кабели к новым стойкам и без ошибок настраивает коммутаторы.', max: 6 },
  tech: { name: 'Сборщик серверов', pay: 250, desc: 'Собирает серверы из комплектующих: по серверу в час каждый.', max: 8 },
  soc: { name: 'SOC-аналитик', pay: 400, desc: 'Круглосуточный мониторинг атак: +15 к защите за каждого.', max: 4 },
  buyer: { name: 'Завхоз', pay: 500, desc: 'Сам докупает серверы (и стойки рядом с кондиционерами), чтобы мощности хватало на все контракты с запасом. Правила задаются ниже.', max: 1 },
  acct: { name: 'Аккаунт-менеджер', pay: 450, desc: 'Сам подписывает контракты, на которые хватает свободной мощности (с запасом 10%). Самые выгодные — первыми.', max: 1 },
};
const KINDS = {
  web: { type: 'cpu', label: 'Сайт', prof: 'day' },
  game: { type: 'cpu', label: 'Игровые серверы', prof: 'eve' },
  bank: { type: 'cpu', label: 'Банкинг', prof: 'day', sla: 99.9, lvl: 2 },
  backup: { type: 'sto', label: 'Бэкапы', prof: 'flat' },
  media: { type: 'sto', label: 'Видеохостинг', prof: 'eve' },
  ai: { type: 'gpu', label: 'Обучение ИИ', prof: 'flat', req: 'gpu' },
  render: { type: 'gpu', label: 'Рендер-ферма', prof: 'night', req: 'gpu' },
};
const CLIENTS = {
  web: ['Маркетплейс «Всё по 99»', 'Доставка «Быстрый Ёж»', 'Форум любителей кактусов', 'Такси «Шашечки»', 'Стартап «Убер для котов»', 'Школа «Интернет-урок»', 'Метеобюро «Облачно»'],
  game: ['Студия «Пиксельбург»', 'Шутер «Окоп-2»', 'MMO «Тридевятое царство»', 'Киберклуб «Респаун»', 'Ферма «Весёлый трактор»'],
  bank: ['Банк «Надёжный»', 'Банк «Копейка»', 'Финтех «Полкопейки»', 'Кредитный союз «Сундук»'],
  backup: ['Архив бабушкиных фото', 'Нотариус Ковалёв', 'Библиотека «Пыльная полка»', 'ИП «Всё сохраним»'],
  media: ['Онлайн-кинотеатр «Попкорн»', 'Радио «Пингвин FM»', 'Видеохостинг «Котики»', 'Сериалы «Ещё одну серию»'],
  ai: ['Нейросеть «Гена»', 'ИИ-лаборатория «Сингулярность»', 'Стартап «ChatКот»', 'Беспилотник «Ёжик в тумане»'],
  render: ['Мультстудия «Пластилин»', 'VFX «Взрыв на заднем плане»', 'Архбюро «Квадратный метр»'],
};
const AMT = {
  cpu: [[8, 20], [20, 70], [60, 220], [200, 700], [600, 2400]],
  sto: [[30, 80], [80, 250], [250, 800], [800, 2500], [2500, 8000]],
  gpu: [[3, 8], [8, 24], [20, 80], [60, 240], [200, 800]],
};
const SLA_MULT = { 95: 1, 99: 1.25, 99.9: 1.6 };
const EVENTS = {
  outage: { name: 'Отключение электричества', desc: 'Залы, где резерв ИБП и дизелей меньше нагрузки, обесточены.', h: [2, 5], cls: '' },
  heat: { name: 'Аномальная жара', desc: '+8 °C к воздуху во всех залах, кроме северного.', h: [24, 48], cls: 'mild' },
  ddos: { name: 'DDoS-атака', desc: 'Мусорный трафик забивает интернет-каналы. Помогают безопасники, Анти-DDoS и широкие каналы.', h: [4, 10], cls: '' },
  fiber: { name: 'Экскаватор перерубил оптику', desc: 'Клиенты получают только 40% сервиса.', h: [2, 4], cls: '', skip: 'fiber' },
  crypto: { name: 'Криптобум', desc: 'Новые GPU-контракты платят вдвое.', h: [48, 72], cls: 'good' },
};
const PROF = {
  day: (h) => 0.4 + 0.6 * bell(h, 14, 4.5),
  eve: (h) => 0.35 + 0.65 * bell(h, 21, 3.5),
  night: (h) => 0.35 + 0.65 * bell(h, 3, 4),
  flat: () => 1,
};
function bell(h, c, s) { let d = Math.abs(h - c); d = Math.min(d, 24 - d); return Math.exp(-(d * d) / (2 * s * s)); }

const GOALS = [
  { t: 'Подпишите первый контракт во вкладке «Контракты»', ok: () => S.stats.signed >= 1, r: 500 },
  { t: 'Установите 6 серверов', ok: () => countServers() >= 6, r: 800 },
  { t: 'Наймите дежурного админа', ok: () => S.staff.admin >= 1, r: 600 },
  { t: 'Выполните 3 контракта без нарушения SLA', ok: () => S.stats.done >= 3, r: 2000 },
  { t: 'Арендуйте Подвал', ok: () => S.halls[1].open, r: 3000 },
  { t: 'Изучите любую технологию', ok: () => Object.keys(S.tech).length >= 1, r: 2000 },
  { t: 'Поднимите репутацию до ★★★', ok: () => repLevel() >= 3, r: 6000 },
  { t: 'Изучите GPU-узлы и возьмите ИИ-контракт', ok: () => S.contracts.some((c) => c.type === 'gpu'), r: 12000 },
  { t: 'Арендуйте Машинный зал №1', ok: () => S.halls[2].open, r: 15000 },
  { t: 'Выиграйте тендер у конкурентов', ok: () => S.stats.tenders >= 1, r: 20000 },
  { t: 'Держите 60 серверов', ok: () => countServers() >= 60, r: 30000 },
  { t: 'Заработайте $25 000 чистыми за день', ok: () => S.stats.bestDay >= 25000, r: 50000 },
  { t: 'Арендуйте Машинный зал №2', ok: () => S.halls[3].open, r: 80000 },
  { t: 'Поглотите конкурента', ok: () => S.rivals.some((r) => r.bought), r: 100000 },
  { t: 'Поднимите репутацию до ★★★★★', ok: () => repLevel() >= 5, r: 150000 },
  { t: 'Откройте Северный ЦОД', ok: () => S.halls[4].open, r: 300000 },
  { t: 'Выйдите на биржу (IPO)', ok: () => !!S.ipo, r: 500000 },
  { t: 'Постройте Гиперскейл-кампус', ok: () => S.halls[5].open, r: 1000000, win: true },
  { t: 'Держите 500 серверов', ok: () => countServers() >= 500, r: 2000000 },
];
