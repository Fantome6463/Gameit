'use strict';
// ================= INPUT =================
document.addEventListener('pointerdown', (e) => { if (e.target.closest('#tab')) pressing = true; });
const release = () => setTimeout(() => { pressing = false; }, 0);
document.addEventListener('pointerup', release);
document.addEventListener('pointercancel', release);
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  Sound.init();
  const f = ACT[b.dataset.act];
  if (!f) return;
  if (!['speed', 'pause', 'tab', 'view', 'tool', 'hall'].includes(b.dataset.act)) Sound.click();
  f(b.dataset.a);
  renderUI();
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (e.code === 'Space' && S.started && e.target === document.body) { e.preventDefault(); S.paused = !S.paused; renderUI(); }
  if (e.key === 'Escape') { S.tool = 'select'; S.sel = null; renderUI(); }
  const keys = { 1: 'rack', 2: 'crac', 3: 'chiller', 4: 'ups', 5: 'gen', 6: 'trafo', 7: 'sw' };
  if (keys[e.key] && S.started) { const k = keys[e.key]; if (!BUILD[k].req || hasTech(BUILD[k].req)) { S.tool = k; renderUI(); } }
});
window.addEventListener('resize', () => layoutCanvas());
