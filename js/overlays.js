'use strict';
// ================= OVERLAYS =================
function showOverlay(mode) {
  const card = $('#card');
  const saved = readSave();
  if (mode === 'start') {
    card.innerHTML = `<h2>ЦОД Магнат</h2>
      <p>У вас каморка под лестницей, одна стойка и $3 000. Цель — построить гиперскейл-кампус на 3 мегаватта.</p>
      <ul>
        <li>Подписывайте контракты с клиентами: сайты, банки, игры, видео, нейросети.</li>
        <li>Ставьте стойки и серверы, следите за теплом и мощностью зала.</li>
        <li>Нанимайте админов и безопасников, исследуйте технологии, арендуйте новые залы.</li>
        <li>Стойки работают только через настроенный коммутатор: прокладывайте кабели и настраивайте сеть сами, инженерами или подрядчиками.</li>
        <li>Собирайте серверы из комплектующих или берите готовые решения.</li>
        <li>Следите за рынком, участвуйте в тендерах и поглощайте конкурентов.</li>
        <li>Рутину отдайте людям: завхоз докупает железо, аккаунт-менеджер подписывает контракты.</li>
        <li>Пожары, DDoS, отключения света и экскаваторы прилагаются. При авариях игра сама встаёт на паузу.</li>
      </ul>
      ${canLoad(saved) ? `<button class="btn primary" type="button" data-act="load">Продолжить · день ${saved.day}, ${fmt$(saved.money)}</button><button class="btn" type="button" data-act="newgame">Новая игра</button>` : `<button class="btn primary" type="button" data-act="newgame">Начать</button>`}`;
  } else if (mode === 'netcfg') {
    const tg = S.cfgTarget;
    const H = S.halls[tg.h];
    const models = [...new Set(H.grid.filter((t) => t && t.k === 'rack').flatMap((t) => t.s))].map((m) => MODELS[m].name);
    const sws = H.grid.filter(isSwitch).length;
    const sel = (k, label) => `<label for="cfg-${k}">${label}</label><select id="cfg-${k}">${CFG_OPTS[k].map((v) => `<option>${v}</option>`).join('')}</select>`;
    card.innerHTML = `<h2>Настройка коммутатора</h2>
      <p>${HALLS[tg.h].name} · ${tileName(tg.h, tg.i)}. Сверьтесь с регламентом и паспортом зала. Ошибка даст потери пакетов: −40% мощности подключённых стоек.</p>
      <ol class="rules">
        <li>VLAN = 10 × номер зала (Каморка — №1, Подвал — №2 и т. д.).</li>
        <li>MTU 9000, если в зале есть хранилища или серверы с дисками, иначе 1500.</li>
        <li>Аплинк всегда в режиме trunk.</li>
        <li>STP включать, если в зале больше одного коммутатора.</li>
        <li>Скорость портов по самому мощному железу: поколение 1 — 10G, 2 (Silver, flash, GPU-узел, Ядро-32) — 25G, 3 (Platinum, GPU-кластер, Ядро-96, Ускоритель H) — 100G.</li>
      </ol>
      <p class="facts">Паспорт: зал №${tg.h + 1} · коммутаторов: ${sws} · серверы: ${models.join(', ') || 'нет'}</p>
      <div class="cfg">${sel('vlan', 'VLAN')}${sel('mtu', 'MTU')}${sel('uplink', 'Аплинк')}${sel('stp', 'STP')}${sel('speed', 'Скорость портов')}</div>
      <button class="btn primary" type="button" data-act="cfgApply">Применить конфигурацию</button>
      <button class="btn" type="button" data-act="cfgCancel">Отмена</button>`;
  } else if (mode === 'menu') {
    card.innerHTML = `<h2>Пауза</h2><p>Игра сохраняется сама каждый игровой день.</p>
      <button class="btn primary" type="button" data-act="resume">Продолжить</button>
      <button class="btn" type="button" data-act="autopause">Автопауза при авариях: ${S.autoPause ? 'вкл' : 'выкл'}</button>
      <button class="btn" type="button" data-act="save">Сохранить сейчас</button>
      <button class="btn danger" type="button" data-act="reset">Начать заново</button>`;
  } else if (mode === 'confirm') {
    card.innerHTML = `<h2>Начать заново?</h2><p>Текущий прогресс будет удалён.</p>
      <button class="btn danger" type="button" data-act="newgame">Да, удалить и начать</button>
      <button class="btn" type="button" data-act="resume">Отмена</button>`;
  } else if (mode === 'win') {
    Sound.win();
    card.innerHTML = `<h2>Вы — гиперскейлер</h2><p>За ${S.day} дней вы прошли путь от каморки под лестницей до кампуса на 3 мегаватта. Серверов: ${countServers()}.</p>
      <button class="btn primary" type="button" data-act="keep">Играть дальше</button>`;
  } else {
    card.innerHTML = S.overReason === 'board' ? `<h2>Вас уволили</h2><p>Два квартала подряд без роста — совет директоров нашёл нового CEO. Вы продержались ${S.day} дн. и выполнили ${S.stats.done} контрактов.</p>` : `<h2>Банкротство</h2><p>Три дня в минусе — кредиторы забрали серверы. Вы продержались ${S.day} дн. и выполнили ${S.stats.done} контрактов.</p>`;
    card.innerHTML += `<button class="btn primary" type="button" data-act="newgame">Новая игра</button>`;
  }
  $('#overlay').hidden = false;
}
ACT.load = () => {
  const data = readSave();
  if (canLoad(data)) {
    try {
      restoreState(data);
      S.started = true; S.paused = false; S.sel = null;
      $('#overlay').hidden = true; afterLoad(); log('Игра загружена');
      return;
    } catch (e) { /* fall through */ }
  }
  ACT.newgame();
};

document.addEventListener('visibilitychange', () => { if (document.hidden && S && S.started) save(); });
