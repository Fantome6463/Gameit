'use strict';
// ================= LOOP =================
let acc = 0, prev = performance.now();
function frame(now) {
  const dt = Math.min(250, now - prev); prev = now;
  if (S.started && !S.paused && !S.over && $('#overlay').hidden) {
    acc += dt * S.speed;
    let n = 0, ticked = false;
    while (acc >= HOUR_MS && n < 12 && !S.over) { tick(); acc -= HOUR_MS; n++; ticked = true; }
    if (n >= 12) acc = 0;
    if (ticked) renderUI();
  }
  const frac = S.paused ? 0 : acc / HOUR_MS;
  draw(now, frac);
  requestAnimationFrame(frame);
}

function afterLoad() {
  for (const k in last) delete last[k];
  logDirty = true;
  layoutCanvas();
  renderUI();
}

function start(data) {
  if (data && data.S) { S = data.S; } else { newState(); }
  afterLoad();
  if (!S.started) showOverlay('start');
  else if (S.over) showOverlay('over');
  requestAnimationFrame(frame);
}

window.claude?.hot?.snapshot?.(() => ({ S }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
