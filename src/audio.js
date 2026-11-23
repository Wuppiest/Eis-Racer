// ============================================================
//  Eis-Racer – procedural sound (Web Audio, no files)
// ============================================================
const SFX = (() => {
  let ctx = null, master = null, bus = null, noiseBuf = null;
  const L = {};
  const now = () => ctx.currentTime;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = SETTINGS.vol;
    bus = ctx.createGain(); bus.gain.value = 0.9;
    bus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    makeLoops();
  }
  function setVolume(v) { if (master) master.gain.setTargetAtTime(v, now(), 0.05); }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.3, v = 0.2, a = 0.005, delay = 0, filter = 0 }) {
    if (!ctx) return;
    const t = now() + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 != null) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, a, v, dur);
    let n = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); n = f; }
    n.connect(g); g.connect(bus);
    o.start(t); o.stop(t + a + dur + 0.05);
  }
  function noise({ dur = 0.2, v = 0.2, type = 'lowpass', f0 = 800, f1 = null, q = 0.8, a = 0.005, delay = 0 }) {
    if (!ctx) return;
    const t = now() + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 != null) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, a, v, dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
  }
  // continuous loops whose gain / pitch follow the game state
  function loopNoise(type, f, q) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(bus); s.start();
    return { f: fl, g };
  }
  function makeLoops() {
    L.scrape = loopNoise('bandpass', 1400, 0.7);   // ice sliding over the floor
    L.hiss = loopNoise('highpass', 5000, 0.5);     // fine ice crystals
    L.wind = loopNoise('lowpass', 500, 0.6);       // air rushing past
    L.hall = loopNoise('lowpass', 260, 0.4);       // hall ambience
    L.hall.g.gain.value = 0.05;
    // winch motor while reeling in
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 70;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 22;
    const lg = ctx.createGain(); lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(bus); o.start(); lfo.start();
    L.winch = { o, g, lfo };
  }
  function update(speed, pulling, active) {
    if (!ctx) return;
    const t = now(), k = clamp(speed / 30, 0, 1.3);
    const on = active ? 1 : 0;
    L.scrape.g.gain.setTargetAtTime(on * (0.02 + k * 0.16), t, 0.08);
    L.scrape.f.frequency.setTargetAtTime(900 + k * 1400, t, 0.1);
    L.hiss.g.gain.setTargetAtTime(on * k * 0.05, t, 0.1);
    L.wind.g.gain.setTargetAtTime(on * k * k * 0.22, t, 0.15);
    L.wind.f.frequency.setTargetAtTime(300 + k * 900, t, 0.2);
    L.winch.g.gain.setTargetAtTime(on && pulling ? 0.07 : 0, t, 0.04);
    L.winch.o.frequency.setTargetAtTime(60 + k * 70, t, 0.1);
    L.winch.lfo.frequency.setTargetAtTime(14 + k * 30, t, 0.1);
  }
  function mute() { if (!ctx) return; for (const l of Object.values(L)) if (l.g && l !== L.hall) l.g.gain.setTargetAtTime(0, now(), 0.05); }

  return {
    init, update, mute, setVolume,
    fire() { noise({ dur: 0.18, v: 0.35, type: 'bandpass', f0: 2600, f1: 600, q: 1.2 }); tone({ type: 'square', f0: 220, f1: 880, dur: 0.12, v: 0.06, filter: 2500 }); },
    hit() { tone({ type: 'square', f0: 1300, f1: 500, dur: 0.09, v: 0.1, filter: 4000 }); tone({ type: 'triangle', f0: 2100, f1: 1900, dur: 0.25, v: 0.05 }); noise({ dur: 0.08, v: 0.25, type: 'highpass', f0: 3000 }); },
    miss() { tone({ type: 'sine', f0: 500, f1: 240, dur: 0.22, v: 0.08 }); },
    release() { noise({ dur: 0.12, v: 0.12, type: 'bandpass', f0: 1800, f1: 3500, q: 2 }); tone({ type: 'triangle', f0: 600, f1: 900, dur: 0.08, v: 0.04 }); },
    reel() { tone({ type: 'square', f0: 320, f1: 200, dur: 0.05, v: 0.04, filter: 1600 }); },
    bump(k) {
      noise({ dur: 0.25 + k * 0.2, v: 0.25 + k * 0.35, type: 'lowpass', f0: 500 + k * 400, f1: 120 });
      tone({ type: 'sine', f0: 140, f1: 55, dur: 0.25, v: 0.25 * k + 0.08 });
      if (k > 0.4) noise({ dur: 0.3, v: 0.12 * k, type: 'highpass', f0: 4000, delay: 0.02 }); // ice chips
    },
    beep(go) { tone({ type: 'square', f0: go ? 880 : 440, dur: go ? 0.6 : 0.25, v: 0.12, filter: 3000 }); },
    lap() { [660, 880, 1100].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.22, v: 0.12, delay: i * 0.09 })); },
    finish() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone({ type: i < 4 ? 'triangle' : 'square', f0: f, dur: i === 5 ? 0.8 : 0.2, v: 0.12, delay: i * 0.12, filter: 3500 })); noise({ dur: 2.2, v: 0.1, type: 'bandpass', f0: 1500, q: 0.4, a: 0.3, delay: 0.3 }); },
    record() { [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.3, v: 0.1, delay: 0.9 + i * 0.1 })); },
    click() { tone({ type: 'triangle', f0: 900, f1: 1200, dur: 0.05, v: 0.06 }); },
    wrong() { tone({ type: 'square', f0: 220, dur: 0.18, v: 0.07, filter: 1200 }); tone({ type: 'square', f0: 180, dur: 0.25, v: 0.07, filter: 1200, delay: 0.2 }); },
  };
})();
