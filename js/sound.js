'use strict';
// ================= SOUND =================
const Sound = {
  ctx: null, on: true,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } } },
  beep(f, d = 0.08, type = 'square', vol = 0.035, slide = 0, delay = 0) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.02);
  },
  click() { this.beep(1200, 0.025, 'square', 0.02); },
  build() { this.beep(300, 0.06, 'square', 0.04); this.beep(450, 0.08, 'square', 0.04, 0, 0.06); },
  coin() { this.beep(880, 0.06, 'square', 0.03); this.beep(1320, 0.1, 'square', 0.03, 0, 0.07); },
  alarm() { this.beep(1040, 0.12, 'square', 0.035); this.beep(760, 0.12, 'square', 0.035, 0, 0.15); },
  bad() { this.beep(330, 0.15, 'triangle', 0.06); this.beep(220, 0.25, 'triangle', 0.06, 0, 0.16); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.beep(f, 0.18, 'square', 0.035, 0, i * 0.12)); },
  crash() { this.beep(240, 0.45, 'sawtooth', 0.06, -190); },
};
