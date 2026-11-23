// ============================================================
//  Eis-Racer – game: renderer, physics, grappling hook, laps, HUD, menus
// ============================================================
const LAPS = 3;
const STEP = 1 / 120;
// physics tuning
const PULL = 27;          // winch pull (m/s²)
const FRIC = 0.32;        // ice sliding friction (m/s²)
const DRAG = 0.0065;      // air drag (· v²) – low: ice glides
const REEL_MAX = 38;      // the winch can't reel in faster than this (m/s)
const GRAV = 9.81 * 0.9;  // slope push
const REST = 0.32;        // bounce off the barriers
const ANG_DAMP = 1.1;     // spin damping
const HOOK_RANGE = 80, HOOK_SPEED = 170, RETRACT_SPEED = 110;
const LIM = HW - FLOE_R + 0.05; // lateral limit for the floe center

// ---------- settings + records (localStorage may be unavailable) ----------
const SETTINGS = { sens: 1, vol: 0.7, fov: 80, inv: false };
const BEST = { total: null, lap: null };
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
function load(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
Object.assign(SETTINGS, load('eisracer_settings') || {});
Object.assign(BEST, load('eisracer_best') || {});

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene();
scene.background = new T.Color('#c3d0de');
scene.fog = new T.Fog('#c3d0de', 70, 210);
const hemi = new T.HemisphereLight('#ffffff', '#8d939e', 1.75);
scene.add(hemi);
const sun = new T.DirectionalLight('#fff4e4', 1.55);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
const camera = new T.PerspectiveCamera(SETTINGS.fov, 1, 0.05, 420);
camera.rotation.order = 'YXZ';
scene.add(camera);

buildWorld(scene);
const floe = buildFloe(); scene.add(floe);
const launcher = buildLauncher(); camera.add(launcher);
const LAUNCH_POS = new V3(0.27, -0.25, -0.5);
launcher.position.copy(LAUNCH_POS);
launcher.scale.setScalar(0.72);
const hookMesh = buildHookMesh(); hookMesh.visible = false; scene.add(hookMesh);
const rope = buildRope(); scene.add(rope);

// ---------- particles (ice chips / frost dust) ----------
const PART_N = 320;
const partMesh = new T.InstancedMesh(geoIco(0), new T.MeshLambertMaterial({ color: '#f4fbff', emissive: '#203040' }), PART_N);
partMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
partMesh.frustumCulled = false;
scene.add(partMesh);
const parts = [];
for (let i = 0; i < PART_N; i++) parts.push({ life: 0, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, s: 0.05, max: 1, rx: 0, ry: 0 });
let partNext = 0;
function spawnPart(x, y, z, vx, vy, vz, life, s) {
  const p = parts[partNext]; partNext = (partNext + 1) % PART_N;
  Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, s, rx: Math.random() * 6, ry: Math.random() * 6 });
}
const _pm = new T.Matrix4(), _pq = new T.Quaternion(), _pe = new T.Euler(), _ps = new V3(), _pp = new V3();
function updateParts(dt) {
  for (let i = 0; i < PART_N; i++) {
    const p = parts[i];
    if (p.life > 0) {
      p.life -= dt;
      p.vy -= 9 * dt; p.vx *= 1 - 1.5 * dt; p.vz *= 1 - 1.5 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.3; }
      p.rx += dt * 5; p.ry += dt * 4;
    }
    const k = p.life > 0 ? p.s * Math.min(1, p.life / p.max * 2.5) : 0;
    _pm.compose(_pp.set(p.x, p.y, p.z), _pq.setFromEuler(_pe.set(p.rx, p.ry, 0)), _ps.set(k, k, k));
    partMesh.setMatrixAt(i, _pm);
  }
  partMesh.instanceMatrix.needsUpdate = true;
}

// ---------- state ----------
let state = 'menu';          // menu | countdown | race | finished
let paused = false;
const P = { x: 0, z: 0, y: 0, vx: 0, vz: 0, yaw: 0, w: 0, idx: 0, wraps: 0, tiltX: 0, tiltZ: 0, ax: 0, az: 0, wall: 0 };
const look = { yaw: 0, pitch: 0 };
const hook = { state: 'idle', pos: new V3(), target: new V3(), t: 0, dur: 0, hit: false, ropeLen: 0 };
const race = { t: 0, lapStart: 0, lapDone: 0, laps: [], cd: 0, cdStep: 4, wrongT: 0, finishT: 0 };
let holdMouse = false, holdKey = false;
const holding = () => holdMouse || holdKey;
let shake = 0, recoil = 0, menuT = 0, pulling = false, lastTick = 0;

// ---------- grapple ----------
const ray = new T.Raycaster();
const _cd = new V3(), _mz = new V3(), _tmp = new V3();
function aimHit() {
  camera.getWorldDirection(_cd);
  ray.set(camera.position, _cd);
  ray.far = HOOK_RANGE;
  const h = ray.intersectObjects(WORLD.hit, false);
  return h.length ? h[0] : null;
}
function muzzleWorld(out) { return launcher.localToWorld(out.copy(launcher.userData.muzzle)); }
function fireHook() {
  if (paused || (state !== 'race' && state !== 'countdown')) return;
  if (hook.state === 'flying' || hook.state === 'attached') return;
  const h = aimHit();
  muzzleWorld(hook.pos);
  if (h) { hook.target.copy(h.point); hook.hit = true; }
  else { camera.getWorldDirection(_cd); hook.target.copy(camera.position).addScaledVector(_cd, HOOK_RANGE); hook.hit = false; }
  hook.state = 'flying'; hook.t = 0;
  hook.dur = Math.max(0.04, hook.pos.distanceTo(hook.target) / HOOK_SPEED);
  hook.start = hook.pos.clone();
  recoil = 1;
  SFX.fire();
}
function releaseHook(auto = false) {
  if (hook.state === 'attached' || hook.state === 'flying') {
    hook.state = 'retract';
    SFX.release();
  }
}
function updateHook(dt) {
  if (hook.state === 'flying') {
    hook.t += dt;
    const k = Math.min(1, hook.t / hook.dur);
    hook.pos.lerpVectors(hook.start, hook.target, k);
    if (k >= 1) {
      if (hook.hit && holding()) {
        hook.state = 'attached';
        hook.ropeLen = Math.hypot(hook.target.x - P.x, hook.target.z - P.z);
        SFX.hit();
        for (let i = 0; i < 10; i++) spawnPart(hook.target.x, hook.target.y, hook.target.z, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5, 0.5, 0.06);
      } else {
        if (!hook.hit) SFX.miss();
        hook.state = 'retract';
      }
    }
  } else if (hook.state === 'retract') {
    muzzleWorld(_mz);
    _tmp.subVectors(_mz, hook.pos);
    const d = _tmp.length(), step = RETRACT_SPEED * dt;
    if (d <= step + 0.05) hook.state = 'idle';
    else hook.pos.addScaledVector(_tmp, step / d);
  } else if (hook.state === 'attached') {
    hook.pos.copy(hook.target);
  }
}

// ---------- physics ----------
const _q = { i: 0, f: 0, lat: 0, h: 0, tx: 1, tz: 0, nx: 0, nz: 1, slope: 0, s: 0, k: 0 };
function physStep(dt) {
  updateHook(dt);
  pulling = false;
  if (state !== 'race' && state !== 'finished') return;
  const racing = state === 'race';
  let ax = 0, az = 0;
  let ux = 0, uz = 0, dist = 0;
  if (hook.state === 'attached') {
    const dx = hook.target.x - P.x, dz = hook.target.z - P.z;
    dist = Math.hypot(dx, dz);
    if (dist < 2.2 || dist > HOOK_RANGE * 1.25 || !racing) releaseHook(true);
    else {
      ux = dx / dist; uz = dz / dist;
      const vr = P.vx * ux + P.vz * uz; // speed toward the anchor
      const pull = PULL * clamp(dist / 6, 0.4, 1) * clamp(1 - vr / REEL_MAX, 0, 1.3);
      ax += ux * pull; az += uz * pull;
      hook.ropeLen = Math.min(hook.ropeLen, dist);
      pulling = true;
      // the pull also swings the floe's nose toward the rope
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      const side = -Math.cos(P.yaw) * ux + Math.sin(P.yaw) * uz;
      const front = fx * ux + fz * uz;
      P.w += side * (front > -0.2 ? 2.6 : 1.2) * dt;
    }
  }
  trackQuery(P.x, P.z, P.idx, 40, _q);
  ax -= GRAV * _q.slope * _q.tx; az -= GRAV * _q.slope * _q.tz;
  P.vx += ax * dt; P.vz += az * dt;
  // ice friction + air drag (more braking after the finish)
  const v = Math.hypot(P.vx, P.vz);
  if (v > 1e-4) {
    const dec = (FRIC + DRAG * v * v + (racing ? 0 : 3.5)) * dt;
    const nv = Math.max(0, v - dec);
    P.vx *= nv / v; P.vz *= nv / v;
  }
  // rope can't stretch: remove the outward speed → swing around the anchor
  if (pulling) {
    const dx = hook.target.x - P.x, dz = hook.target.z - P.z, d = Math.hypot(dx, dz);
    if (d >= hook.ropeLen - 0.01) {
      const vr = P.vx * ux + P.vz * uz;
      if (vr < 0) { P.vx -= ux * vr; P.vz -= uz * vr; }
    }
  }
  P.x += P.vx * dt; P.z += P.vz * dt;
  if (pulling) {
    const dx = hook.target.x - P.x, dz = hook.target.z - P.z, d = Math.hypot(dx, dz);
    if (d > hook.ropeLen) { P.x = hook.target.x - dx / d * hook.ropeLen; P.z = hook.target.z - dz / d * hook.ropeLen; }
  }
  // stay on the track: barriers on both sides
  trackQuery(P.x, P.z, P.idx, 40, _q);
  if (_q.i < NS * 0.25 && P.idx > NS * 0.75) P.wraps++;
  else if (_q.i > NS * 0.75 && P.idx < NS * 0.25) P.wraps--;
  P.idx = _q.i;
  P.wall = Math.max(0, P.wall - dt);
  if (Math.abs(_q.lat) > LIM) {
    const sg = Math.sign(_q.lat), nx = _q.nx * sg, nz = _q.nz * sg;
    const pen = Math.abs(_q.lat) - LIM;
    P.x -= nx * pen; P.z -= nz * pen;
    const vn = P.vx * nx + P.vz * nz;
    if (vn > 0) {
      const vtx = P.vx - nx * vn, vtz = P.vz - nz * vn;
      const keep = clamp(1 - vn * 0.03, 0.55, 0.985);
      P.vx = vtx * keep - nx * vn * REST; P.vz = vtz * keep - nz * vn * REST;
      // scraping along the wall spins the floe
      const cr = nx * vtz - nz * vtx;
      P.w += -Math.sign(cr) * Math.min(vn * 0.45, 5) + (Math.random() - 0.5) * vn * 0.1;
      if (vn > 1.5 && P.wall <= 0) impact(vn, P.x + nx * FLOE_R, P.z + nz * FLOE_R, nx, nz);
    }
  }
  P.w *= Math.exp(-ANG_DAMP * dt);
  P.yaw += P.w * dt;
  P.y = _q.h;
  // visual tilt from acceleration
  P.ax = damp(P.ax, ax, 6, dt); P.az = damp(P.az, az, 6, dt);

  if (racing) {
    race.t += dt;
    const prog = P.wraps * TLEN + _q.s;
    const done = Math.floor(prog / TLEN);
    if (done > race.lapDone) {
      race.lapDone = done;
      const lt = race.t - race.lapStart;
      race.laps.push(lt); race.lapStart = race.t;
      if (done >= LAPS) finishRace();
      else { SFX.lap(); toast(`RUNDE <b>${done + 1}/${LAPS}</b> &nbsp; ${fmt(lt)}`, 2200); }
    }
    // wrong way?
    const fwd = P.vx * _q.tx + P.vz * _q.tz;
    race.wrongT = fwd < -3 ? race.wrongT + dt : Math.max(0, race.wrongT - dt * 2);
    if (race.wrongT > 1.2 && race.wrongT - dt <= 1.2) { toast('⚠️ FALSCHE RICHTUNG!', 1800, true); SFX.wrong(); }
  }
}
function impact(vn, x, z, nx, nz) {
  P.wall = 0.25;
  const k = clamp(vn / 18, 0, 1);
  SFX.bump(k);
  shake = Math.max(shake, 0.25 + k * 0.9);
  if (k > 0.25) { const f = document.getElementById('hitfx'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 60); }
  const n = 6 + Math.round(k * 22);
  for (let i = 0; i < n; i++) spawnPart(x, P.y + 0.4 + Math.random() * 0.3, z, -nx * Math.random() * vn * 0.4 + (Math.random() - 0.5) * 3, 1 + Math.random() * 4 * (0.3 + k), -nz * Math.random() * vn * 0.4 + (Math.random() - 0.5) * 3, 0.6 + Math.random() * 0.6, 0.05 + Math.random() * 0.07);
}

// ---------- race flow ----------
function placeAtStart() {
  const s = WORLD.start;
  Object.assign(P, { x: s.x, z: s.z, y: 0, vx: 0, vz: 0, yaw: s.yaw, w: 0, idx: s.idx, wraps: -1, ax: 0, az: 0, wall: 0 });
}
function resetRace() {
  placeAtStart();
  look.yaw = WORLD.start.yaw; look.pitch = -0.04;
  hook.state = 'idle';
  Object.assign(race, { t: 0, lapStart: 0, lapDone: 0, laps: [], cd: 3.9, cdStep: 4, wrongT: 0, finishT: 0 });
  WORLD.lights.forEach((m) => m.color.set('#3a0d0d'));
  state = 'countdown';
  setHud(true);
  hideAll();
  document.getElementById('hint').style.opacity = 1;
}
function updateCountdown(dt) {
  race.cd -= dt;
  const step = Math.ceil(race.cd);
  if (step < race.cdStep && step >= 0) {
    race.cdStep = step;
    const el = document.getElementById('count');
    el.classList.remove('hidden', 'anim', 'go'); void el.offsetWidth;
    if (step > 0 && step <= 3) {
      el.textContent = step; el.classList.add('anim'); SFX.beep(false);
      const lit = { 3: [0, 1], 2: [0, 1, 2, 3], 1: [0, 1, 2, 3, 4] }[step];
      WORLD.lights.forEach((m, i) => m.color.set(lit.includes(i) ? '#ff2a1a' : '#3a0d0d'));
    } else if (step === 0) {
      el.textContent = 'LOS!'; el.classList.add('anim', 'go'); SFX.beep(true);
      WORLD.lights.forEach((m) => m.color.set('#33ff66'));
      state = 'race';
      setTimeout(() => { if (state !== 'countdown') document.getElementById('hint').style.opacity = 0; }, 5000);
    }
  }
}
function finishRace() {
  state = 'finished';
  SFX.finish();
  const total = race.t, fastest = Math.min(...race.laps);
  let rec = [];
  if (BEST.total == null || total < BEST.total) { BEST.total = total; rec.push('NEUE BESTZEIT!'); }
  if (BEST.lap == null || fastest < BEST.lap) { BEST.lap = fastest; rec.push('NEUE BESTE RUNDE!'); }
  store('eisracer_best', BEST);
  if (rec.length) SFX.record();
  document.getElementById('resTotal').textContent = fmt(total);
  document.getElementById('resRec').textContent = rec.length ? '🏆 ' + rec.join(' · ') : 'Bestzeit: ' + fmt(BEST.total);
  document.getElementById('resLaps').innerHTML = race.laps.map((t, i) => `<li class="${t === fastest ? 'fast' : ''}"><span>Runde ${i + 1}</span>${fmt(t)}</li>`).join('');
  toast('🏁 ZIEL! &nbsp;<b>' + fmt(total) + '</b>', 1800);
  setTimeout(() => {
    if (state !== 'finished') return;
    show('result');
    if (document.pointerLockElement) document.exitPointerLock();
  }, 1900);
  updateBest();
}
const fmt = (t) => { if (t == null) return '–:––.––'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };

// ---------- HUD ----------
const tachoCv = document.getElementById('tachoCv'), tg = tachoCv.getContext('2d');
const cross = document.getElementById('cross'), crossDist = document.getElementById('crossDist');
let toastTimer = 0;
function toast(html, ms = 1500, warn = false) {
  const t = document.getElementById('toast');
  t.innerHTML = html; t.classList.toggle('warn', warn); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function setHud(on) { document.getElementById('hud').classList.toggle('hidden', !on); }
const MAXK = 150;
function drawTacho(kmh, lap, time) {
  const g = tg, W = 560, cx = 280, cy = 205, R0 = 182;
  g.clearRect(0, 0, W, 364);
  // dome
  g.save();
  g.beginPath(); g.arc(cx, cy, 200, 0, TAU);
  const bg = g.createRadialGradient(cx, cy - 40, 20, cx, cy, 200);
  bg.addColorStop(0, 'rgba(26,34,60,.86)'); bg.addColorStop(1, 'rgba(10,14,28,.86)');
  g.fillStyle = bg; g.fill();
  g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,.22)'; g.stroke();
  g.restore();
  const a0 = PI * 5 / 6, sweep = PI * 4 / 3;
  const ang = (v) => a0 + sweep * clamp(v / MAXK, 0, 1);
  // track arc
  g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy, R0 - 8, a0, a0 + sweep); g.lineWidth = 16; g.strokeStyle = 'rgba(255,255,255,.1)'; g.stroke();
  // value arc
  const gr = g.createLinearGradient(cx - R0, 0, cx + R0, 0);
  gr.addColorStop(0, '#4ff2ff'); gr.addColorStop(0.55, '#c9f6ff'); gr.addColorStop(0.8, '#ffe066'); gr.addColorStop(1, '#ff5a3a');
  if (kmh > 0.5) { g.beginPath(); g.arc(cx, cy, R0 - 8, a0, ang(kmh)); g.lineWidth = 16; g.strokeStyle = gr; g.shadowColor = '#4ff2ff'; g.shadowBlur = 14; g.stroke(); g.shadowBlur = 0; }
  // ticks + numbers
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let v = 0; v <= MAXK; v += 10) {
    const a = ang(v), major = v % 30 === 0;
    const r1 = R0 - 24, r2 = r1 - (major ? 18 : 9);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    g.lineWidth = major ? 5 : 3; g.lineCap = 'butt'; g.strokeStyle = v >= 120 ? '#ff7a5a' : 'rgba(255,255,255,.85)'; g.stroke();
    if (major) { g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `800 22px ${FONT}`; g.fillText(v, cx + Math.cos(a) * (r2 - 22), cy + Math.sin(a) * (r2 - 22)); }
  }
  // needle
  const a = ang(kmh);
  g.save(); g.translate(cx, cy); g.rotate(a);
  g.beginPath(); g.moveTo(-18, -7); g.lineTo(R0 - 30, -2); g.lineTo(R0 - 30, 2); g.lineTo(-18, 7); g.closePath();
  g.fillStyle = '#ff5a3a'; g.shadowColor = 'rgba(255,90,58,.8)'; g.shadowBlur = 12; g.fill();
  g.restore();
  g.beginPath(); g.arc(cx, cy, 15, 0, TAU); g.fillStyle = '#1d2230'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#ff5a3a'; g.stroke();
  // digital readout
  g.fillStyle = '#ffffff'; g.font = `900 74px ${FONT}`;
  g.fillText(Math.round(kmh), cx, cy + 68);
  g.fillStyle = '#8be9ff'; g.font = `800 19px ${FONT}`; g.fillText('KM/H', cx, cy + 108);
  // lap + time line
  g.font = `900 24px ${FONT}`;
  g.fillStyle = '#ffe066'; g.textAlign = 'right'; g.fillText(lap, cx - 12, cy + 144);
  g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.fillText(time, cx + 12, cy + 144);
}

// ---------- menus ----------
const $ = (id) => document.getElementById(id);
function hideAll() { for (const id of ['menu', 'pause', 'result']) $(id).classList.add('hidden'); $('lockMsg').classList.add('hidden'); }
function show(id) { hideAll(); $(id).classList.remove('hidden'); }
function updateBest() { $('bestTotal').textContent = fmt(BEST.total); $('bestLap').textContent = fmt(BEST.lap); }
updateBest();
function lock() {
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => $('lockMsg').classList.remove('hidden')); }
  catch (e) { /* ignore */ }
}
function startRace() { SFX.init(); SFX.click(); paused = false; resetRace(); lock(); }
function pauseGame() {
  if (paused || (state !== 'race' && state !== 'countdown')) return;
  paused = true; holdMouse = holdKey = false;
  SFX.mute();
  openSettings(true);
}
function resumeGame() { SFX.click(); paused = false; hideAll(); lock(); }
function toMenu() {
  SFX.click(); paused = false; state = 'menu'; setHud(false); hook.state = 'idle';
  placeAtStart(); show('menu'); updateBest(); SFX.mute();
  if (document.pointerLockElement) document.exitPointerLock();
}
let settingsFromMenu = false;
function openSettings(inGame) {
  settingsFromMenu = !inGame;
  $('sSens').value = SETTINGS.sens; $('sVol').value = SETTINGS.vol; $('sFov').value = SETTINGS.fov; $('sInv').checked = SETTINGS.inv;
  $('bResume').textContent = inGame ? '▶ Weiter' : '← Zurück';
  document.querySelector('#pause h2').textContent = inGame ? 'Pause' : 'Einstellungen';
  document.querySelector('#pause .row2').classList.toggle('hidden', !inGame);
  show('pause');
}
$('bStart').onclick = startRace;
$('bOpts').onclick = () => { SFX.init(); SFX.click(); openSettings(false); };
$('bResume').onclick = () => { if (settingsFromMenu) { SFX.click(); show('menu'); } else resumeGame(); };
$('bRestart').onclick = startRace;
$('bMenu').onclick = toMenu;
$('bAgain').onclick = startRace;
$('bMenu2').onclick = toMenu;
$('lockMsg').onclick = () => { $('lockMsg').classList.add('hidden'); lock(); };
const saveSettings = () => store('eisracer_settings', SETTINGS);
$('sSens').oninput = (e) => { SETTINGS.sens = +e.target.value; saveSettings(); };
$('sVol').oninput = (e) => { SETTINGS.vol = +e.target.value; SFX.setVolume(SETTINGS.vol); saveSettings(); };
$('sFov').oninput = (e) => { SETTINGS.fov = +e.target.value; saveSettings(); };
$('sInv').onchange = (e) => { SETTINGS.inv = e.target.checked; saveSettings(); };

// ---------- input ----------
const playing = () => !paused && (state === 'race' || state === 'countdown');
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && playing()) pauseGame();
  if (document.pointerLockElement) $('lockMsg').classList.add('hidden');
});
document.addEventListener('mousemove', (e) => {
  if (!playing() || !document.pointerLockElement) return;
  const k = 0.0022 * SETTINGS.sens;
  look.yaw -= e.movementX * k;
  look.pitch = clamp(look.pitch - e.movementY * k * (SETTINGS.inv ? -1 : 1), -1.45, 1.45);
});
canvas.addEventListener('mousedown', (e) => {
  if (!playing()) return;
  if (!document.pointerLockElement) { lock(); return; }
  if (e.button === 0) { holdMouse = true; fireHook(); }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0 && holdMouse) { holdMouse = false; if (!holding()) releaseHook(); }
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && !e.repeat) { if (playing()) { holdKey = true; fireHook(); } }
  else if (e.code === 'KeyR' && !e.repeat && (state === 'race' || state === 'countdown' || state === 'finished') && !paused) startRace();
  else if (e.code === 'KeyP' && !e.repeat) { if (paused && !settingsFromMenu) resumeGame(); else pauseGame(); }
  else if (e.code === 'Escape' && paused && !settingsFromMenu && !document.pointerLockElement) { /* stays paused until clicked */ }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'KeyE' && holdKey) { holdKey = false; if (!holding()) releaseHook(); }
});
window.addEventListener('blur', () => { holdMouse = holdKey = false; if (hook.state === 'attached') releaseHook(); });
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- per-frame visuals ----------
const _lq = new T.Quaternion(), _lv = new V3(), _lz = new V3(0, 0, -1);
let aimT = 0, aimInfo = null, tickT = 0;
function updateVisuals(dt, now) {
  const speed = Math.hypot(P.vx, P.vz);
  // floe
  trackQuery(P.x, P.z, P.idx, 40, _q);
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  const slopeF = _q.slope * (fx * _q.tx + fz * _q.tz), slopeS = _q.slope * (-fz * _q.tx + fx * _q.tz);
  // lean against acceleration (local frame)
  const aF = P.ax * fx + P.az * fz, aS = P.ax * -fz + P.az * fx;
  P.tiltX = damp(P.tiltX, Math.atan(slopeF) - aF * 0.004, 8, dt);
  P.tiltZ = damp(P.tiltZ, -Math.atan(slopeS) + aS * 0.006, 8, dt);
  floe.position.set(P.x, P.y + 0.03, P.z);
  floe.rotation.set(P.tiltX, P.yaw, P.tiltZ, 'YXZ');
  // camera
  const inGame = state !== 'menu';
  shake = Math.max(0, shake - dt * 2.2);
  if (inGame) {
    const bob = Math.sin(now * 0.011) * Math.min(speed, 30) * 0.0012;
    camera.position.set(P.x, P.y + FLOE_TOP + 1.02 + bob, P.z);
    if (shake > 0) camera.position.add(_lv.set((Math.random() - 0.5) * shake * 0.12, (Math.random() - 0.5) * shake * 0.12, (Math.random() - 0.5) * shake * 0.12));
    // slight roll when the floe is pushed sideways
    const sx = -Math.cos(look.yaw), sz = Math.sin(look.yaw);
    const latA = P.ax * sx + P.az * sz;
    camera.rotation.set(look.pitch, look.yaw, damp(camera.rotation.z, clamp(-latA * 0.004, -0.08, 0.08), 5, dt));
    const fov = SETTINGS.fov + clamp((speed - 8) * 0.45, 0, 18);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix(); }
    launcher.visible = true;
  } else {
    // menu fly-through along the track
    menuT += dt;
    const s = (90 + menuT * 11) % TLEN, i = Math.floor(s / DS);
    const a = tsAt(i), b = tsAt(i + 40);
    camera.position.set(a.x + a.nx * 3, 8 + a.h * 0.4 + Math.sin(menuT * 0.3) * 1.2, a.z + a.nz * 3);
    camera.lookAt(b.x, b.h + 1.5, b.z);
    if (Math.abs(camera.fov - 70) > 0.1) { camera.fov = 70; camera.updateProjectionMatrix(); }
    launcher.visible = false;
  }
  camera.updateMatrixWorld();
  // shadow camera follows
  sun.position.set(camera.position.x + 22, 70, camera.position.z + 14);
  sun.target.position.set(camera.position.x, 0, camera.position.z);
  sun.target.updateMatrixWorld();

  // launcher: recoil + aim toward the hook while it's out
  recoil = Math.max(0, recoil - dt * 6);
  launcher.position.set(LAUNCH_POS.x, LAUNCH_POS.y + Math.sin(now * 0.006) * 0.004, LAUNCH_POS.z + recoil * 0.09);
  if (hook.state !== 'idle') { camera.worldToLocal(_lv.copy(hook.pos)).sub(launcher.position).normalize(); if (_lv.z > -0.2) _lv.z = -0.2; _lv.normalize(); }
  else _lv.set(-0.3, 0.27, -12).normalize();
  _lq.setFromUnitVectors(_lz, _lv);
  launcher.quaternion.slerp(_lq, 1 - Math.exp(-14 * dt));
  launcher.rotateX(recoil * 0.25);
  launcher.userData.loaded.visible = hook.state === 'idle';
  // hook + rope
  hookMesh.visible = hook.state !== 'idle';
  if (hookMesh.visible) {
    muzzleWorld(_mz);
    hookMesh.position.copy(hook.pos);
    _lv.subVectors(hook.pos, _mz);
    if (_lv.lengthSq() > 1e-4) hookMesh.quaternion.setFromUnitVectors(_lz, _lv.normalize());
    setRope(rope, _mz, hook.pos, hook.state === 'attached' ? 0.03 : 0.022);
  } else rope.visible = false;

  // particles: frost dust while sliding fast
  if (state !== 'menu' && speed > 9) {
    const n = speed > 22 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU;
      spawnPart(P.x + Math.cos(a) * FLOE_R * 0.9, P.y + 0.08, P.z + Math.sin(a) * FLOE_R * 0.9, -P.vx * 0.15 + (Math.random() - 0.5), 0.6 + Math.random(), -P.vz * 0.15 + (Math.random() - 0.5), 0.5, 0.03 + Math.random() * 0.03);
    }
  }
  updateParts(dt);

  // flags
  const wave = (f, amp, t) => {
    const p = f.mesh.geometry.attributes.position, a = p.array, b = f.base;
    for (let i = 0; i < a.length; i += 3) { const u = (b[i] - b[0]) / 1.8; a[i + 2] = b[i + 2] + Math.sin(t * 5 + u * 7 + (f.ph || 0)) * amp * u; }
    p.needsUpdate = true;
  };
  const t = now / 1000;
  for (const f of WORLD.flags) wave(f, 0.16, t);

  // HUD
  if (inGame) {
    aimT -= dt;
    if (aimT <= 0 && hook.state !== 'attached') { aimT = 1 / 30; aimInfo = aimHit(); }
    const ok = !!aimInfo && hook.state !== 'attached';
    cross.classList.toggle('ok', ok);
    cross.classList.toggle('hooked', hook.state === 'attached');
    crossDist.classList.toggle('show', ok);
    if (ok) crossDist.textContent = Math.round(aimInfo.distance) + ' m';
    const lap = state === 'countdown' ? 1 : Math.min(LAPS, race.lapDone + 1);
    drawTacho(speed * 3.6, `RUNDE ${lap}/${LAPS}`, fmt(race.t));
    $('speedfx').style.opacity = clamp((speed - 16) / 22, 0, 0.75);
    // reel clicks while pulling
    if (pulling) { tickT -= dt * (0.6 + speed * 0.06); if (tickT <= 0) { tickT = 0.12; SFX.reel(); } }
  }
  SFX.update(speed, pulling && !paused, inGame && !paused);
}

// ---------- loop ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
placeAtStart();
let last = performance.now(), accT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused) {
    if (state === 'countdown') updateCountdown(dt);
    accT += dt;
    while (accT >= STEP) { physStep(STEP); accT -= STEP; }
  }
  updateVisuals(paused ? 0 : dt, now);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// small debug / test handle
window.__eis = { P, hook, race, look, get state() { return state; }, fire: () => { holdKey = true; fireHook(); }, release: () => { holdKey = false; releaseHook(); }, start: startRace, aimHit, WORLD, TS, TLEN, renderer, step: (n) => { for (let i = 0; i < n; i++) physStep(STEP); }, skipCount: () => { race.cd = 0.001; race.cdStep = 1; } };
