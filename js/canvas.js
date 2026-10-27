'use strict';
// ================= RENDER: CANVAS =================
const cv = $('#cv');
const ctx = cv.getContext('2d');
let T = 48, O = 18, hover = -1;
const COL = {
  room: '#090d11', floor: '#111820', floor2: '#0e141a', seam: '#1a232c', wall: '#33414f',
  rack: '#1a2430', rackEdge: '#3a4958', slot: '#070b0f', led: '#4fd18b', bad: '#ff5f5f', warn: '#f2b24a',
  cpu: '#4a8fd6', sto: '#a184e6', gpu: '#e8913f', crac: '#3c5163', fan: '#a9cdee', ups: '#20303a', gen: '#d9b43a', trafo: '#3a4652', bolt: '#f2d24a',
  accent: '#6cb4ff', text: '#d6e0ea', dim: '#7a8897', shirt: '#6cb4ff', skin: '#e8c4a0', guard: '#55687a',
};

function layoutCanvas() {
  const D = HALLS[S.cur];
  const box = $('#cbox');
  const avail = Math.max(240, box.clientWidth - 18);
  T = Math.floor(clamp(avail / (D.w + 0.8), 26, 96));
  O = Math.round(T * 0.4);
  const w = D.w * T + O * 2, h = D.h * T + O * 2;
  const dpr = window.devicePixelRatio || 1;
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function tempColor(t) {
  if (t < 26) return 'rgba(80,150,255,.45)';
  if (t < 32) return 'rgba(79,209,139,.45)';
  if (t < 40) return 'rgba(242,178,74,.55)';
  return 'rgba(255,95,95,.65)';
}

function draw(now, frac) {
  const hi = S.cur, D = HALLS[hi], H = S.halls[hi];
  const W = D.w * T + O * 2, Hh = D.h * T + O * 2;
  ctx.fillStyle = COL.room; ctx.fillRect(0, 0, W, Hh);
  // walls + door
  ctx.strokeStyle = COL.wall; ctx.lineWidth = 3;
  ctx.strokeRect(O / 2, O / 2, W - O, Hh - O);
  const doorY = O + (D.h / 2) * T;
  ctx.fillStyle = COL.room; ctx.fillRect(0, doorY - T * 0.45, O, T * 0.9);
  ctx.fillStyle = COL.dim; ctx.font = `600 ${Math.max(8, T * 0.18)}px JetBrains Mono, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  for (let i = 0; i < D.w * D.h; i++) {
    const x = O + (i % D.w) * T, y = O + Math.floor(i / D.w) * T;
    ctx.fillStyle = ((i % D.w) + Math.floor(i / D.w)) % 2 ? COL.floor : COL.floor2;
    ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = COL.seam; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
    if (!H.open) continue;
    const t = H.grid[i];
    if (!t) { if (i % 3 === 0) { ctx.fillStyle = COL.seam; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) ctx.fillRect(x + T * (0.3 + a * 0.2), y + T * (0.3 + b * 0.2), 1.5, 1.5); } continue; }
    drawTile(t, x, y, now, H.dark, i);
  }

  if (H.open) {
    // overlays
    if (S.view === 'heat') {
      H.grid.forEach((t, i) => {
        if (!t) return;
        const x = O + (i % D.w) * T, y = O + Math.floor(i / D.w) * T;
        const b = BUILD[t.k];
        if (b && b.cool) {
          ctx.fillStyle = 'rgba(108,180,255,.08)';
          ctx.fillRect(x - b.r * T, y - b.r * T, (b.r * 2 + 1) * T, (b.r * 2 + 1) * T);
        }
      });
      H.grid.forEach((t, i) => {
        if (!t || t.k !== 'rack') return;
        const x = O + (i % D.w) * T, y = O + Math.floor(i / D.w) * T;
        ctx.fillStyle = tempColor(t.temp); ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(9, T * 0.24)}px JetBrains Mono, monospace`;
        ctx.fillText(`${Math.round(t.temp)}°`, x + T / 2, y + T / 2);
      });
    } else if (S.view === 'power') {
      H.grid.forEach((t, i) => {
        if (!t) return;
        const x = O + (i % D.w) * T, y = O + Math.floor(i / D.w) * T;
        const kw = t.k === 'rack' ? t.s.reduce((a, m) => a + MODELS[m].kw, 0) : (BUILD[t.k].kw || 0);
        const b = BUILD[t.k];
        const label = b && b.power ? `+${b.power}` : b && b.backup ? `R${b.backup}` : kw ? kw.toFixed(1) : '';
        if (!label) return;
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x + 2, y + T * 0.32, T - 4, T * 0.36);
        ctx.fillStyle = b && (b.power || b.backup) ? COL.bolt : COL.text; ctx.font = `700 ${Math.max(9, T * 0.22)}px JetBrains Mono, monospace`;
        ctx.fillText(label, x + T / 2, y + T / 2);
      });
    }

    // cables
    H.grid.forEach((t, i) => {
      if (!t || t.k !== 'rack') return;
      const x = O + (i % D.w) * T + T / 2, y = O + Math.floor(i / D.w) * T + T / 2;
      if (t.link === null) {
        if (Math.floor(now / 500) % 2) { ctx.fillStyle = COL.bad; ctx.font = `800 ${Math.max(10, T * 0.3)}px JetBrains Mono, monospace`; ctx.fillText('!', x + T * 0.32, y - T * 0.3); }
        return;
      }
      if (t.link === undefined || t.link === i) return;
      const sx = O + (t.link % D.w) * T + T / 2, sy = O + Math.floor(t.link / D.w) * T + T / 2;
      ctx.save();
      if (t.cable === 'laying') { ctx.setLineDash([4, 4]); ctx.lineDashOffset = -now / 40; ctx.strokeStyle = 'rgba(242,178,74,.9)'; }
      else ctx.strokeStyle = 'rgba(108,180,255,.35)';
      ctx.lineWidth = Math.max(1.5, T * 0.035);
      ctx.beginPath(); ctx.moveTo(x, y + T * 0.42); ctx.lineTo(x, sy + T * 0.42); ctx.lineTo(sx, sy + T * 0.42); ctx.stroke();
      ctx.restore();
    });

    // staff
    const door = { x: O * 0.2, y: doorY };
    const jobsHere = S.jobs.filter((j) => j.h === hi);
    jobsHere.forEach((j, n) => {
      const tx = O + (j.i % D.w) * T + T * 0.5, ty = O + Math.floor(j.i / D.w) * T + T * 0.95;
      const p = clamp((j.t + frac) / j.travel, 0, 1);
      const px = door.x + (tx - door.x) * p, py = door.y + (ty - door.y) * p;
      drawPerson(px, py, now + n * 300, p < 1, COL.shirt, j.kind === 'fire');
    });
    const idle = Math.max(0, S.staff.admin - S.jobs.length);
    if (hi === 0 || jobsHere.length === 0) {
      for (let n = 0; n < Math.min(idle, 4); n++) drawPerson(O * 0.5 + 4, doorY - T * 0.5 - n * T * 0.28, now + n * 500, false, COL.shirt, false, true);
    }
    if (S.staff.guard > 0) {
      const per = 2 * (D.w + D.h) * T;
      const d = ((now / 1000) * T * 0.9) % per;
      let gx, gy;
      if (d < D.w * T) { gx = O + d; gy = O - O * 0.15; }
      else if (d < (D.w + D.h) * T) { gx = O + D.w * T + O * 0.15; gy = O + d - D.w * T; }
      else if (d < (2 * D.w + D.h) * T) { gx = O + D.w * T - (d - (D.w + D.h) * T); gy = O + D.h * T + O * 0.15; }
      else { gx = O - O * 0.15; gy = O + D.h * T - (d - (2 * D.w + D.h) * T); }
      drawPerson(gx, gy, now, true, COL.guard, false);
    }

    // hover ghost
    if (hover >= 0 && S.tool !== 'select') {
      const x = O + (hover % D.w) * T, y = O + Math.floor(hover / D.w) * T;
      const t = H.grid[hover];
      const okPlace = S.tool === 'demolish' ? !!t : !t;
      ctx.strokeStyle = okPlace ? COL.accent : COL.bad; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 2, y + 2, T - 4, T - 4); ctx.setLineDash([]);
      const b = BUILD[S.tool];
      if (b && b.cool && okPlace) { ctx.strokeStyle = 'rgba(108,180,255,.4)'; ctx.strokeRect(x - b.r * T, y - b.r * T, (b.r * 2 + 1) * T, (b.r * 2 + 1) * T); }
    }
    // selection
    if (S.sel && S.sel.h === hi) {
      const x = O + (S.sel.i % D.w) * T, y = O + Math.floor(S.sel.i / D.w) * T;
      ctx.strokeStyle = COL.accent; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
      const t = H.grid[S.sel.i]; const b = t && BUILD[t.k];
      if (b && b.cool) { ctx.strokeStyle = 'rgba(108,180,255,.35)'; ctx.setLineDash([3, 3]); ctx.strokeRect(x - b.r * T, y - b.r * T, (b.r * 2 + 1) * T, (b.r * 2 + 1) * T); ctx.setLineDash([]); }
    }
    if (H.dark) {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(O, O, D.w * T, D.h * T);
      ctx.fillStyle = COL.bad; ctx.font = `800 ${Math.max(12, T * 0.4)}px Unbounded, sans-serif`;
      if (Math.floor(now / 500) % 2) ctx.fillText(H.locked ? 'ЗАШИФРОВАН' : 'НЕТ ПИТАНИЯ', O + (D.w * T) / 2, O + (D.h * T) / 2);
    }
  }
}

function drawPerson(x, y, now, walking, shirt, hurry, sitting) {
  const s = T * 0.17;
  const bob = walking ? Math.sin(now / (hurry ? 70 : 110)) * s * 0.25 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.1, s * 0.9, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.ellipse(x, y - s * 1.0 + bob, s * 0.75, s * (sitting ? 0.8 : 1.0), 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COL.skin;
  ctx.beginPath(); ctx.arc(x, y - s * 2.1 + bob, s * 0.55, 0, Math.PI * 2); ctx.fill();
  if (hurry) { ctx.fillStyle = COL.bad; ctx.fillRect(x + s * 0.6, y - s * 1.5 + bob, s * 0.5, s * 0.9); }
}

// Коммутатор в верхних местах стойки: корпус, ряд портов (горят занятые), рамка мигает, пока он не настроен.
function drawRackSwitch(t, x, y, w, h, now, dark, i) {
  const spec = SW[t.net.k], cfg = t.net.cfg;
  ctx.fillStyle = '#1b2733'; ctx.fillRect(x, y + 0.5, w, h - 1);
  const col = cfg === 'ok' ? null : cfg === 'bad' ? COL.bad : cfg === 'work' ? COL.accent : COL.warn;
  ctx.strokeStyle = col && Math.floor(now / 400) % 2 ? col : '#3a4958'; ctx.lineWidth = col ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 1, w - 1, h - 2);
  const rows = spec.slots, per = 8, used = portsUsed(S.halls[S.cur].grid, i);
  const pw = (w - 4) / per, ph = Math.max(2, (h - 4) / rows - 2);
  for (let k = 0; k < per * rows; k++) {
    const on = k < Math.ceil((used / spec.ports) * per * rows);
    ctx.fillStyle = dark ? '#111' : on ? (Math.sin(now / 80 + k) > -0.4 ? COL.led : '#16402b') : '#0b1015';
    ctx.fillRect(x + 2 + (k % per) * pw, y + 2 + Math.floor(k / per) * (ph + 2), Math.max(2, pw - 2), ph);
  }
}
function drawTile(t, x, y, now, dark, i) {
  const p = T * 0.1;
  if (t.k === 'rack') {
    ctx.fillStyle = COL.rack; ctx.fillRect(x + p, y + p, T - 2 * p, T - 2 * p);
    ctx.strokeStyle = t.temp > 40 ? COL.bad : t.temp > 32 ? COL.warn : COL.rackEdge;
    ctx.lineWidth = t.temp > 32 ? 2 : 1;
    ctx.strokeRect(x + p + 0.5, y + p + 0.5, T - 2 * p - 1, T - 2 * p - 1);
    const sh = (T - 2 * p - 4) / RACK_SLOTS;
    const working = t.s.length - t.broken;
    const top = t.net ? SW[t.net.k].slots : 0;
    if (t.net) drawRackSwitch(t, x + p + 2, y + p + 2, T - 2 * p - 4, sh * top, now, dark, i);
    for (let n = top; n < RACK_SLOTS; n++) {
      const sy = y + p + 2 + n * sh;
      ctx.fillStyle = COL.slot; ctx.fillRect(x + p + 2, sy + 0.5, T - 2 * p - 4, sh - 1);
      const m = t.s[n - top];
      if (!m) continue;
      const M = MODELS[m];
      ctx.fillStyle = COL[M.type]; ctx.globalAlpha = dark ? 0.3 : 0.85;
      ctx.fillRect(x + p + 3, sy + 1, (T - 2 * p - 6) * 0.62, sh - 2);
      ctx.globalAlpha = 1;
      let led = COL.led, on = true;
      if (dark) on = false;
      else if (n - top >= working) { led = COL.bad; on = Math.floor(now / 300) % 2 === 0; }
      else on = Math.sin(now / (60 + ((i * 7 + n * 13) % 50)) + n) > -0.3;
      if (on) { ctx.fillStyle = led; ctx.fillRect(x + T - p - 3 - sh * 0.5, sy + sh * 0.25, Math.max(2, sh * 0.4), Math.max(2, sh * 0.5)); }
    }
    if (t.fire) {
      for (let f = 0; f < 5; f++) {
        const fx = x + T * (0.2 + f * 0.15), fl = T * (0.35 + 0.25 * Math.abs(Math.sin(now / 90 + f * 1.7)));
        ctx.fillStyle = f % 2 ? '#ffb02e' : '#ff5a2a';
        ctx.beginPath(); ctx.moveTo(fx - T * 0.09, y + T * 0.9); ctx.lineTo(fx, y + T * 0.9 - fl); ctx.lineTo(fx + T * 0.09, y + T * 0.9); ctx.fill();
      }
    }
    return;
  }
  const b = BUILD[t.k];
  if (t.k === 'crac' || t.k === 'chiller') {
    const big = t.k === 'chiller';
    ctx.fillStyle = big ? '#2e4a5e' : COL.crac; ctx.fillRect(x + p, y + p, T - 2 * p, T - 2 * p);
    ctx.strokeStyle = '#5f7d96'; ctx.lineWidth = 1; ctx.strokeRect(x + p + 0.5, y + p + 0.5, T - 2 * p - 1, T - 2 * p - 1);
    const fans = big ? [[0.33, 0.5], [0.67, 0.5]] : [[0.5, 0.5]];
    fans.forEach(([fx, fy]) => {
      const cx = x + T * fx, cy = y + T * fy, r = T * (big ? 0.15 : 0.27);
      ctx.fillStyle = '#16212b'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      const ang = dark ? 0 : now / 80;
      ctx.strokeStyle = COL.fan; ctx.lineWidth = Math.max(1.5, T * 0.04);
      for (let k = 0; k < 3; k++) {
        const a = ang + (k * Math.PI * 2) / 3;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); ctx.stroke();
      }
    });
    return;
  }
  if (t.k === 'ups') {
    ctx.fillStyle = COL.ups; ctx.fillRect(x + p, y + p, T - 2 * p, T - 2 * p);
    const ev = S.event && S.event.type === 'outage';
    const lvl = ev ? 0.3 + 0.7 * ((Math.sin(now / 400) + 1) / 2) : 1;
    for (let n = 0; n < 4; n++) {
      ctx.fillStyle = n < Math.ceil(lvl * 4) ? (ev ? COL.warn : COL.led) : '#132028';
      ctx.fillRect(x + T * 0.3, y + T * (0.68 - n * 0.13), T * 0.4, T * 0.09);
    }
    return;
  }
  if (t.k === 'gen') {
    ctx.fillStyle = '#222'; ctx.fillRect(x + p, y + p, T - 2 * p, T - 2 * p);
    ctx.save(); ctx.beginPath(); ctx.rect(x + p, y + p, T - 2 * p, T * 0.2); ctx.clip();
    for (let k = -2; k < 8; k++) { ctx.fillStyle = k % 2 ? COL.gen : '#222'; ctx.beginPath(); ctx.moveTo(x + k * T * 0.15, y + p); ctx.lineTo(x + (k + 1) * T * 0.15, y + p); ctx.lineTo(x + k * T * 0.15, y + p + T * 0.2); ctx.lineTo(x + (k - 1) * T * 0.15, y + p + T * 0.2); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = COL.gen; ctx.font = `800 ${Math.max(8, T * 0.2)}px JetBrains Mono, monospace`;
    ctx.fillText('DG', x + T / 2, y + T * 0.6);
    return;
  }
  if (t.k === 'trafo') {
    ctx.fillStyle = COL.trafo; ctx.fillRect(x + p, y + p, T - 2 * p, T - 2 * p);
    ctx.fillStyle = COL.bolt;
    ctx.beginPath();
    ctx.moveTo(x + T * 0.55, y + T * 0.2); ctx.lineTo(x + T * 0.32, y + T * 0.55); ctx.lineTo(x + T * 0.5, y + T * 0.55);
    ctx.lineTo(x + T * 0.42, y + T * 0.82); ctx.lineTo(x + T * 0.68, y + T * 0.44); ctx.lineTo(x + T * 0.5, y + T * 0.44); ctx.closePath(); ctx.fill();
    return;
  }
  if (t.k === 'gas') {
    ctx.fillStyle = '#4a545e'; ctx.fillRect(x + p, y + p, T - 2 * p, T - 2 * p);
    const fl = 0.8 + 0.2 * Math.sin(now / 120);
    ctx.fillStyle = dark ? '#555' : '#4fb3ff';
    ctx.beginPath(); ctx.moveTo(x + T * 0.5, y + T * (0.78 - 0.45 * fl)); ctx.quadraticCurveTo(x + T * 0.75, y + T * 0.6, x + T * 0.5, y + T * 0.78); ctx.quadraticCurveTo(x + T * 0.25, y + T * 0.6, x + T * 0.5, y + T * (0.78 - 0.45 * fl)); ctx.fill();
    return;
  }
  if (t.k === 'heatx') {
    ctx.fillStyle = '#3d2c26'; ctx.fillRect(x + p, y + p, T - 2 * p, T - 2 * p);
    ctx.strokeStyle = '#ff9a5a'; ctx.lineWidth = Math.max(1.5, T * 0.04);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let s2 = 0; s2 <= 8; s2++) { const px = x + T * (0.22 + s2 * 0.07), py = y + T * (0.32 + k * 0.18) + Math.sin(s2 + now / 300) * T * 0.04; if (s2) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
    }
    return;
  }
  ctx.fillStyle = COL.dim; ctx.fillText(b.name[0], x + T / 2, y + T / 2);
}

function tileAt(e) {
  const D = HALLS[S.cur];
  const r = cv.getBoundingClientRect();
  const sx = (e.clientX - r.left) * (cv.clientWidth / r.width);
  const sy = (e.clientY - r.top) * (cv.clientHeight / r.height);
  const tx = Math.floor((sx - O) / T), ty = Math.floor((sy - O) / T);
  if (tx < 0 || ty < 0 || tx >= D.w || ty >= D.h) return -1;
  return ty * D.w + tx;
}
let painting = false, lastPaint = -1;
function paintAt(i) {
  if (i < 0 || i === lastPaint || !S.started || S.over) return;
  lastPaint = i;
  const H = S.halls[S.cur];
  if (!H.open) return;
  const t = H.grid[i];
  if (S.tool === 'demolish') { if (t) { S.sel = { h: S.cur, i }; ACT.demolish(); S.sel = null; } }
  else if (!t || (BUILD[S.tool] && BUILD[S.tool].inRack && t.k === 'rack' && !t.net)) place(S.tool, S.cur, i);
  renderUI();
}
const stopPaint = () => { painting = false; lastPaint = -1; };
cv.addEventListener('pointerdown', (e) => {
  if (S.tool === 'select' || e.button !== 0) return;
  const i = tileAt(e);
  if (i < 0) return;
  Sound.init();
  painting = true;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  paintAt(i);
});
cv.addEventListener('pointermove', (e) => { hover = tileAt(e); if (painting) paintAt(hover); });
cv.addEventListener('pointerup', stopPaint);
cv.addEventListener('pointercancel', stopPaint);
cv.addEventListener('pointerleave', () => { hover = -1; });
cv.addEventListener('click', (e) => { if (S.tool !== 'select') return; const i = tileAt(e); if (i >= 0) tileClick(i); });
function tileClick(i) {
  if (!S.started || S.over) return;
  const H = S.halls[S.cur];
  if (!H.open) return;
  Sound.init();
  const t = H.grid[i];
  if (t && t.fire) { t.fire = 0; Sound.coin(); log(`Пожар в ${tileName(S.cur, i)} потушен`, 'good'); renderUI(); return; }
  if (S.tool === 'select') { S.sel = { h: S.cur, i }; S.tab = 'obj'; Sound.click(); }
  else if (S.tool === 'demolish') {
    if (t) { S.sel = { h: S.cur, i }; ACT.demolish(); }
  } else if (!t) {
    place(S.tool, S.cur, i);
    S.sel = { h: S.cur, i };
    if (S.tool === 'rack') S.tab = 'obj';
  } else { S.sel = { h: S.cur, i }; S.tab = 'obj'; }
  renderUI();
}
