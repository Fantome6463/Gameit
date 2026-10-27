// Браузерный смоук-тест: открывает игру, начинает новую партию, прогоняет игровые часы и проверяет, что нет ошибок.
// Запуск: node tests/smoke.mjs [путь к html]
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const file = path.resolve(process.argv[2] || new URL('../index.html', import.meta.url).pathname);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(file).href);
await page.click('[data-act="newgame"]');
await page.waitForTimeout(300);
// Ускоряем время, чтобы прошло несколько игровых часов.
await page.click('[data-act="speed"][data-a="5"]');
await page.waitForTimeout(4000);
const tabs = await page.$$eval('#tabs [data-act]', (els) => els.length);
for (let i = 0; i < tabs; i++) { await page.locator('#tabs [data-act]').nth(i).click(); await page.waitForTimeout(50); }
const date = await page.textContent('#rDate');
await page.screenshot({ path: process.env.SHOT || '/dev/null' }).catch(() => {});
await browser.close();
console.log('Дата в игре:', date);
if (errors.length) { console.error('Ошибки:\n' + errors.join('\n')); process.exit(1); }
console.log('OK');
