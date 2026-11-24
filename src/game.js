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
let LIM = 5.2; // lateral limit for the floe center (set per map)
// hopping: a rope to a high anchor lifts the floe a little (much weaker than the forward pull)
const JUMP_V = 10;        // upward kick when the hook bites a high anchor (m/s) – a real jump, ~5 m
const CLIMB_V = 0.9;      // afterwards the rope only lifts you slowly (m/s) ...
const MAX_AIR = 2.2;      // ... up to this height above the ground
const MAX_SKIP = 300;     // a short cut may save this much track (m, or 50 % of the lap) and the lap still counts
const G_AIR = 9.81;
const BAR_OUT = 1.15;     // barrier band outside the track edge (m)
// ---------- glitches (bugs that stayed in as features – precise inputs only) ----------
let simT = 0;             // physics clock
// TEST ONLY: shows which glitch you just pulled off – set to false (or remove) later
const GLITCH_DEBUG = true;
const GLITCH_NAMES = { 'seil-snap': 'Seil-Snap', 'bandenreiten': 'Bandenreiten', 'raeder-trampolin': 'Räder-Trampolin', 'doppelbumper': 'Doppelbumper',
  'decken-clip': 'Decken-Clip', 'seil-zieher': 'Seil-Zieher', 'kreuzungs-verwechslung': 'Kreuzungs-Verwechslung', 'wand-clip': 'Wand-Clip' };
let glitchTimer = 0;
function glitch(name) {
  SFX.glitch(); (window.__glitch || (window.__glitch = [])).push(name);
  if (!GLITCH_DEBUG) return;
  const el = document.getElementById('glitchTag');
  el.textContent = '🐛 BUG: ' + (GLITCH_NAMES[name] || name);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(glitchTimer); glitchTimer = setTimeout(() => el.classList.remove('show'), 1800);
}
function bounceUp() {
  const g = P.y;
  const vmax = Math.sqrt(2 * G_AIR * Math.max(1, HALL.h - 4.5 - g));
  P.vy = Math.min(14, vmax); P.y = g + 0.02; P.grounded = false; P.noCeil = true; P.ride = 0;
  const fx = -Math.sin(P.wheelYaw), fz = -Math.cos(P.wheelYaw); P.vx += fx * 3; P.vz += fz * 3; capSpeed(60);
  race.exempt = true; shake = Math.max(shake, 0.6); SFX.bump(0.6);
}
function capSpeed(max) { const v = Math.hypot(P.vx, P.vz); if (v > max) { P.vx *= max / v; P.vz *= max / v; } }
// retractable wheels (hold Space): roll only along the floe's nose direction, no steering
const WHEEL_TIME = 0.28;  // seconds to extend / retract
const ROLL_FRIC = 0.16;   // rolling resistance (m/s²) – less than ice
const SIDE_GRIP = 9;      // how fast sideways sliding is killed (1/s)
const WHEEL_SPIN_DAMP = 7; // wheels stop the floe from spinning

// ---------- settings + records (localStorage may be unavailable) ----------
const SETTINGS = { sens: 1, vol: 0.7, fov: 80, inv: false };
const BESTS = {};             // per map id: { total, lap }
let BEST = { total: null, lap: null }; // current map's record
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
function load(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
Object.assign(SETTINGS, load('eisracer_settings') || {});
Object.assign(BESTS, load('eisracer_best2') || {});
{ const old = load('eisracer_best'); if (old && old.total != null && !BESTS.arena) BESTS.arena = old; }

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

// ---------- maps ----------
let mapIdx = clamp(+(load('eisracer_map') || 0), 0, MAPS.length - 1);
let MAP = MAPS[mapIdx], ICE = 1;
function loadMap(i) {
  mapIdx = i; MAP = MAPS[i]; store('eisracer_map', i);
  setupTrack(MAP);
  buildWorld(MAP, scene);
  LIM = HW - FLOE_R + 0.05;
  const th = MAP.theme || {};
  ICE = th.ice || 1;
  scene.background.set(th.bg || '#c3d0de');
  scene.fog.color.set(th.fog || '#c3d0de'); scene.fog.near = th.fogNear || 70; scene.fog.far = th.fogFar || 210;
  hemi.color.set(th.hemiSky || '#ffffff'); hemi.groundColor.set(th.hemiGround || '#8d939e'); hemi.intensity = th.hemi || 1.75;
  sun.color.set(th.sunCol || '#fff4e4'); sun.intensity = th.sun || 1.55;
  BEST = BESTS[MAP.id] || (BESTS[MAP.id] = { total: null, lap: null });
  camera.far = Math.max(420, (HALL.x1 - HALL.x0) * 2); camera.updateProjectionMatrix();
  hook.state = 'idle'; hook.obj = null;
  placeAtStart();
  menuT = 0;
}
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
const P = { ride: 0, noCeil: false, clipUntil: -9, wheelDownT: -9, wheelPressT: -9, bumpT: -9, yPrev: 0, vy: 0, grounded: true, off: false, wheel: 0, wheelSpin: 0, wheelYaw: 0, x: 0, z: 0, y: 0, vx: 0, vz: 0, yaw: 0, w: 0, idx: 0, wraps: 0, tiltX: 0, tiltZ: 0, ax: 0, az: 0, wall: 0 };
const look = { yaw: 0, pitch: 0 };
const hook = { state: 'idle', pos: new V3(), target: new V3(), t: 0, dur: 0, hit: false, ropeLen: 0 };
const race = { t: 0, lapStart: 0, lapDone: 0, laps: [], cd: 0, cdStep: 4, wrongT: 0, finishT: 0 };
let holdMouse = false, holdKey = false, holdTouch = false, holdSpace = false, holdWheelTouch = false;
let holdAdmin = false; // TEST ONLY: admin scripts can hold the wheels out
const wheelsWanted = () => holdSpace || holdWheelTouch || holdAdmin;
// on every press the wheels turn to where you are looking right now
function aimWheels() { if (!wheelsWanted()) P.wheelYaw = look.yaw; }
const holding = () => holdMouse || holdKey || holdTouch;
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
function fireHook(forced = null) { // forced: a point to shoot at (admin test scripts)
  if (paused || (state !== 'race' && state !== 'countdown')) return;
  if (hook.state === 'flying' || hook.state === 'attached') return;
  const h = forced ? { point: forced.clone(), object: { userData: {} } } : aimHit();
  muzzleWorld(hook.pos);
  hook.snapPending = hook.snapT != null && simT - hook.snapT <= 0.12;
  // glitch B "Seil-Zieher": head bumped the bridge while hooked onto it, re-fire right after → pulled through the deck
  if (simT - P.bumpT < 0.35 && state === 'race') { P.bumpT = -9; P.noCeil = true; P.vy = Math.max(P.vy, 9); P.grounded = false; P.ride = 0; race.exempt = true; glitch('seil-zieher'); }
  hook.obj = null;
  // glitch 5 "Räder-Trampolin": wheels still extending + hook shot steeply down at the floor right below you
  hook.slamArmed = !!h && state === 'race' && wheelsWanted() && P.wheel > 0 && P.wheel < 1 &&
    h.point.y < P.y + 0.5 && Math.hypot(h.point.x - P.x, h.point.z - P.z) < 4.5;
  if (h) {
    hook.target.copy(h.point); hook.hit = true;
    if (h.object.userData.dyn) { hook.obj = h.object; hook.local = h.object.worldToLocal(h.point.clone()); }
  }
  else { camera.getWorldDirection(_cd); hook.target.copy(camera.position).addScaledVector(_cd, HOOK_RANGE); hook.hit = false; }
  hook.state = 'flying'; hook.t = 0;
  hook.dur = Math.max(0.04, hook.pos.distanceTo(hook.target) / HOOK_SPEED);
  hook.start = hook.pos.clone();
  recoil = 1;
  SFX.fire();
}
function releaseHook(auto = false) {
  // glitch 1 "Seil-Snap": letting go of a taut rope arms a short re-fire window
  if (!auto && hook.state === 'attached' && Math.hypot(hook.target.x - P.x, hook.target.z - P.z) >= hook.ropeLen - 0.8) hook.snapT = simT;
  if (hook.state === 'attached' || hook.state === 'flying') {
    hook.state = 'retract';
    SFX.release();
  }
}
function updateHook(dt) {
  // anchored on a moving element: the anchor point travels with it
  if (hook.obj && (hook.state === 'flying' || hook.state === 'attached')) hook.target.copy(hook.local).applyMatrix4(hook.obj.matrixWorld);
  if (hook.state === 'flying') {
    hook.t += dt;
    const k = Math.min(1, hook.t / hook.dur);
    hook.pos.lerpVectors(hook.start, hook.target, k);
    if (k >= 1) {
      if (hook.hit && holding()) {
        hook.state = 'attached'; hook.fresh = true; hook.attachT = simT;
        if (hook.slamArmed) { // yanked into the floor → bounce
          hook.slamArmed = false; hook.fresh = false;
          if (P.grounded) bounceUp(); else { P.vy = -18; P.slam = true; }
          hook.state = 'retract'; glitch('raeder-trampolin');
        }
        hook.ropeLen = Math.hypot(hook.target.x - P.x, hook.target.z - P.z);
        if (hook.snapPending && hook.ropeLen > 0.5) { // Seil-Snap: the new rope snaps tight → kick toward the anchor
          hook.snapPending = false;
          hook.chain = simT - (hook.lastSnap || -9) < 1.5 ? (hook.chain || 0) + 1 : 0; hook.lastSnap = simT;
          const b = 7 / (1 + 0.6 * hook.chain);
          P.vx += (hook.target.x - P.x) / hook.ropeLen * b; P.vz += (hook.target.z - P.z) / hook.ropeLen * b;
          capSpeed(60); glitch('seil-snap');
        }
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
const _Z = { ax: 0, az: 0, fric: 1, fricAdd: 0, spin: null };
function physStep(dt) {
  simT += dt;
  if (ADMIN.jobs.length && state === 'race') adminTick();
  if (DEMO.active) demoTick(dt);
  P.yPrev = P.y;
  if (!paused) updateElements(dt);
  updateHook(dt);
  pulling = false;
  // wheel arms move even during the countdown
  const wTarget = wheelsWanted() && state !== 'menu' ? 1 : 0;
  const wPrev = P.wheel;
  P.wheel = clamp(P.wheel + (wTarget ? 1 : -1) * dt / WHEEL_TIME, 0, 1);
  if (wPrev < 1 && P.wheel === 1) { SFX.wheelsDown(); P.wheelDownT = simT; }
  if (wTarget !== P.wTgt) { P.wTgt = wTarget; if (state !== 'menu') SFX.wheelsUp(); }
  if (state !== 'race' && state !== 'finished') return;
  const racing = state === 'race';
  let ax = 0, az = 0, upF = 0;
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
      // anchor above you (ceiling, trusses ...): a bit of lift
      // 0 = anchor too low / too far away, 1 = steeply above you
      const dy = hook.target.y - (P.y + FLOE_TOP + 0.9);
      if (dy > 0) upF = clamp((dy / Math.hypot(dist, dy) - 0.25) / 0.35, 0, 1);
      if (hook.fresh) { // the moment the hook bites: a quick hop
        hook.fresh = false;
        if (upF > 0 && (P.grounded || P.ride)) { P.ride = 0; P.vy = Math.max(P.vy, JUMP_V * (0.35 + 0.65 * upF)); P.grounded = false; SFX.jump(); }
      }
      hook.ropeLen = Math.min(hook.ropeLen, dist);
      pulling = true;
      // the pull also swings the floe's nose toward the rope
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      const side = -Math.cos(P.yaw) * ux + Math.sin(P.yaw) * uz;
      const front = fx * ux + fz * uz;
      if (P.wheel === 0) P.w += side * (front > -0.2 ? 2.6 : 1.2) * dt;
    }
  }
  trackQuery(P.x, P.z, P.idx, 40, _q);
  if (P.grounded && !P.off) { ax -= GRAV * _q.slope * _q.tx; az -= GRAV * _q.slope * _q.tz; }
  // floor zones: boost, belts, turntables, wind, slush, blank ice
  const Z = _Z; Z.ax = 0; Z.az = 0; Z.fric = 1; Z.fricAdd = 0; Z.spin = null;
  elementZones(_q, Z);
  ax += Z.ax; az += Z.az;
  if (Z.spin != null && P.wheel === 0) P.w += (Z.spin - P.w) * 2.5 * dt;
  P.vx += ax * dt; P.vz += az * dt;
  // ice friction + air drag (more braking after the finish)
  const v = Math.hypot(P.vx, P.vz);
  if (v > 1e-4) {
    const ground = P.ride ? 0.05 : P.grounded ? (P.wheel === 1 ? ROLL_FRIC : FRIC * ICE) * Z.fric + Z.fricAdd + (racing ? 0 : 3.5) : 0; // no friction in the air
    const dec = (ground + DRAG * v * v) * dt;
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
  // moving obstacles, bumpers ... (you can hop over them)
  if (P.y - _q.h < 1.3) elementCollide();
  // which piece of track are we over? (after a hop it can be a different one)
  trackQuery(P.x, P.z, P.idx, 40, _q);
  if (Math.abs(_q.lat) > HW + 3) {
    const g = nearestPiece(P.x, P.z, P.y);
    if (g >= 0 && g !== _q.i) trackQuery(P.x, P.z, g, 40, _q);
  }
  lapLogic(P.idx, _q.i);
  P.idx = _q.i;
  P.wall = Math.max(0, P.wall - dt);
  // vertical: ground under the floe = deck / track, or the hall floor beside it
  const alat = Math.abs(_q.lat);
  const groundY = alat <= HW + 0.7 ? _q.h : 0;
  let ay = -G_AIR;
  if (pulling && upF > 0) {
    // hanging on a high anchor: climb slowly to MAX_AIR (a weak anchor only slows the fall)
    const tv = Math.min(lerp(-1.2, CLIMB_V, upF), (MAX_AIR - (P.y - groundY)) * 2.5);
    if (P.vy <= tv) ay = clamp((tv - P.vy) * 8, -G_AIR, 25);
  }
  // under a bridge: the deck above is a ceiling (head bump)
  const ceilS = alat <= HW + 1.5 ? TS[_q.i].ceil : null;
  const barTop = (WORLD.barH || 0.95) + 0.05, OUT = HW + BAR_OUT + FLOE_R;
  if (P.ride) {
    // glitch 2 "Bandenreiten": glued onto the barrier top, steering itself through the curves
    const sp = Math.hypot(P.vx, P.vz), side = P.ride;
    if (!TS[_q.i][side < 0 ? 'barL' : 'barR'] || _q.h > 0.3 || sp < 5 || P.vy > 0.5) { P.ride = 0; P.grounded = false; }
    else {
      const cx = P.x - _q.nx * _q.lat, cz = P.z - _q.nz * _q.lat, rl = side * (HW + 0.55);
      P.x = cx + _q.nx * rl; P.z = cz + _q.nz * rl;
      const sg = Math.sign(P.vx * _q.tx + P.vz * _q.tz) || 1;
      P.vx = _q.tx * sp * sg; P.vz = _q.tz * sp * sg;
      P.y = _q.h + barTop + 0.02; P.vy = 0; P.grounded = true;
    }
  }
  if (P.ride) { /* handled above */ }
  else if (P.grounded && ay <= 0) { P.vy = 0; P.y = groundY; }
  else {
    P.vy += ay * dt;
    P.y += P.vy * dt;
    // glitch 2 entry: coming down exactly onto the top edge of a ground barrier
    const rel = P.y - _q.h, relPrev = P.yPrev - _q.h, side = Math.sign(_q.lat);
    if (racing && P.vy < 0 && _q.h < 0.3 && relPrev >= barTop - 0.05 && rel < barTop + 0.05 && rel > barTop - 0.4 &&
        alat > HW + 0.05 && alat < HW + 1.05 && TS[_q.i][side < 0 ? 'barL' : 'barR'] && Math.hypot(P.vx, P.vz) > 8) {
      P.ride = side; P.y = _q.h + barTop + 0.02; P.vy = 0; P.grounded = true; glitch('bandenreiten');
    } else if (P.y <= groundY) {
      // glitch 5 "Räder-Trampolin": slammed into the floor by the hook → bounce up high (even through bridges)
      if (P.slam && racing) { P.slam = false; P.y = groundY; bounceUp(); }
      else {
        if (!P.grounded && P.vy < -2.5) land(-P.vy);
        P.y = groundY; P.vy = 0; P.grounded = true; P.noCeil = false;
      }
    } else P.grounded = false;
    if (ceilS && !P.noCeil) {
      const top = ceilS - 0.8 - 2.1;
      if (P.y > top && P.vy > 0) {
        // glitch A "Decken-Clip": hitting the deck fast near the start / end of the bridge slips you through it
        if (P.vy > 2.5 && (!tsAt(_q.i - 16).under || !tsAt(_q.i + 16).under) && racing) { P.noCeil = true; P.vy = Math.max(P.vy, 8); race.exempt = true; glitch('decken-clip'); }
        else {
          // head bump; hooked onto the bridge itself? → arms glitch B for a moment
          if (pulling && hook.target.y > ceilS - 3.5 && hook.target.y < ceilS + 3) P.bumpT = simT;
          P.y = top; if (P.vy > 3) land(P.vy * 0.5); P.vy = -1;
        }
      } else if (P.y > top) P.y = top;
    }
    // through a deck from below: now we belong to the bridge
    if (P.noCeil && ceilS && P.y > ceilS + 0.15) {
      const g = deckPiece(P.x, P.z, ceilS);
      if (g >= 0) { trackQuery(P.x, P.z, g, 40, _q); race.glitchStep = true; lapLogic(P.idx, _q.i); race.glitchStep = false; P.idx = _q.i; }
    }
  }
  // barriers: only if we are not above them; from inside (on the track) or from outside (infield)
  if (P.y - _q.h < barTop && alat > LIM && alat < OUT && simT > P.clipUntil && !P.ride) {
    const inside = !P.off;
    const sg = Math.sign(_q.lat) * (inside ? 1 : -1), nx = _q.nx * sg, nz = _q.nz * sg; // n points into the barrier
    const pen = inside ? alat - LIM : OUT - alat;
    const vn0 = P.vx * nx + P.vz * nz, sp0 = Math.hypot(P.vx, P.vz), relY = P.y - _q.h;
    // glitch E "Wand-Clip": fast and diagonal (20–70°) into the wall + wheel tap within 0.15 s of the impact → you slip through
    const clipOk = inside && racing && sp0 > 12.5 && vn0 / sp0 > 0.34 && vn0 / sp0 < 0.94 && vn0 > 0;
    if (clipOk && simT - P.wheelPressT < 0.15) {
      P.clipUntil = simT + 0.45; race.exempt = true; glitch('wand-clip');
    } else {
    if (clipOk && P.wall <= 0) P.lastWall = { t: simT, vx: P.vx, vz: P.vz, x: P.x, z: P.z }; // tap right after the bump still counts
    P.x -= nx * pen; P.z -= nz * pen;
    const vn = P.vx * nx + P.vz * nz;
    if (vn > 0) {
      const vtx = P.vx - nx * vn, vtz = P.vz - nz * vn;
      const keep = clamp(1 - vn * 0.03, 0.55, 0.985);
      P.vx = vtx * keep - nx * vn * REST; P.vz = vtz * keep - nz * vn * REST;
      // scraping along the wall spins the floe
      const cr = nx * vtz - nz * vtx;
      if (P.wheel === 0) P.w += -Math.sign(cr) * Math.min(vn * 0.45, 5) + (Math.random() - 0.5) * vn * 0.1;
      if (vn > 1.5 && P.wall <= 0) impact(vn, P.x + nx * FLOE_R, P.z + nz * FLOE_R, nx, nz);
    }
    }
  }
  // wheels on the floor: only the nose direction keeps its speed
  if (P.wheel > 0) P.w = 0; // wheels out: the floe can't spin, so the wheels keep their direction
  if (P.wheel === 1 && P.grounded) {
    const fx = -Math.sin(P.wheelYaw), fz = -Math.cos(P.wheelYaw);
    const vf = P.vx * fx + P.vz * fz, vl = P.vx * -fz + P.vz * fx;
    const vl2 = vl * Math.exp(-SIDE_GRIP * dt);
    P.vx = fx * vf - fz * vl2; P.vz = fz * vf + fx * vl2;
    P.w *= Math.exp(-WHEEL_SPIN_DAMP * dt);
    P.wheelSpin += vf / WHEEL_R * dt;
    P.skid = Math.abs(vl);
  } else P.skid = 0;
  P.off = P.ride ? false : Math.abs(_q.lat) > (LIM + OUT) / 2;
  // hall walls
  const hm = FLOE_R + 0.6;
  if (P.x < HALL.x0 + hm) { P.x = HALL.x0 + hm; if (P.vx < 0) P.vx *= -0.3; }
  if (P.x > HALL.x1 - hm) { P.x = HALL.x1 - hm; if (P.vx > 0) P.vx *= -0.3; }
  if (P.z < HALL.z0 + hm) { P.z = HALL.z0 + hm; if (P.vz < 0) P.vz *= -0.3; }
  if (P.z > HALL.z1 - hm) { P.z = HALL.z1 - hm; if (P.vz > 0) P.vz *= -0.3; }
  P.w *= Math.exp(-ANG_DAMP * dt);
  P.yaw += P.w * dt;
  // visual tilt from acceleration
  P.ax = damp(P.ax, ax, 6, dt); P.az = damp(P.az, az, 6, dt);

  if (racing) {
    race.t += dt;
    // wrong way?
    const fwd = P.vx * _q.tx + P.vz * _q.tz;
    race.wrongT = fwd < -3 ? race.wrongT + dt : Math.max(0, race.wrongT - dt * 2);
    if (race.wrongT > 1.2 && race.wrongT - dt <= 1.2) { toast('⚠️ FALSCHE RICHTUNG!', 1800, true); SFX.wrong(); }
  }
}
// laps: crossing the line only counts if every quarter of the lap was visited (small corner cuts are fine)
function lapLogic(prev, cur) {
  if (state !== 'race') return;
  // short cuts: from take-off to landing, compare the track you skipped with the way you actually flew
  const onTrack = P.grounded && !P.off;
  if (!onTrack) {
    if (race.ep == null) { race.ep = prev; race.flown = 0; }
    race.flown += Math.hypot(P.vx, P.vz) * STEP;
  } else if (race.ep != null) { checkCut(cur); race.ep = null; }
  if (cur < NS * 0.25 && prev > NS * 0.75) {           // forward over the line
    if (race.ep != null) { checkCut(cur); race.ep = cur; race.flown = 0; } // crossed the line mid-air
    if (race.backs > 0) { race.backs--; return; }
    if (!race.started) { race.started = true; race.skip = 0; return; }
    const tooBig = race.skip > Math.max(MAX_SKIP, TLEN * 0.5);
    race.skip = 0;
    if (tooBig) { SFX.wrong(); return; }
    const done = ++race.lapDone, lt = race.t - race.lapStart;
    race.laps.push(lt); race.lapStart = race.t;
    if (done >= LAPS) finishRace();
    else { SFX.lap(); toast(`RUNDE <b>${done + 1}/${LAPS}</b> &nbsp; ${fmt(lt)}`, 2200); }
  } else if (cur > NS * 0.75 && prev < NS * 0.25 && race.ep == null && !race.glitchStep) race.backs++; // backwards over the line (not by a jump)
}
function checkCut(cur) {
  if (race.exempt) { race.exempt = false; return; } // a glitch skip is a feature, not a short cut
  // landing a little behind = backwards; anything else counts as a jump forward (even across the whole hall)
  let d = cur - race.ep; if (d < -NS * 0.15) d += NS; else if (d > NS * 0.85) d -= NS;
  const saved = d * DS - race.flown;
  if (saved > race.skip) race.skip = saved;
  if (saved > Math.max(MAX_SKIP, TLEN * 0.5)) toast('✂️ ABKÜRZUNG ZU GROSS – diese Runde zählt nicht!', 2400, true);
}
// the bridge deck right above / around us (after slipping through it)
function deckPiece(x, z, h) {
  let best = 1e18, bi = -1;
  for (let i = 0; i < NS; i++) {
    const s = TS[i];
    if (Math.abs(s.h - h) > 0.6) continue;
    const dx = x - s.x, dz = z - s.z, dd = dx * dx + dz * dz;
    if (dd < best) { best = dd; bi = i; }
  }
  return best < (HW + 1.5) * (HW + 1.5) ? bi : -1;
}
// glitch C "Kreuzungs-Verwechslung": a quick wheel tap where another piece is close → the game puts you on it
// Wand-Clip, late version: wheels tapped just after a diagonal wall hit → undo the bounce and slip through
function tryLateWallClip() {
  const w = P.lastWall;
  if (!w || simT - w.t > 0.15 || state !== 'race') return false;
  P.lastWall = null;
  P.vx = w.vx; P.vz = w.vz; P.x = w.x; P.z = w.z;
  P.clipUntil = simT + 0.45; race.exempt = true; glitch('wand-clip');
  return true;
}
function tryCrossSwap() {
  if (state !== 'race' || P.ride) return;
  const a = TS[P.idx], j = a.alt;
  if (j == null || j < 0) return;
  let d = j - P.idx; if (d < 0) d += NS;
  if (d <= 0 || d > NS * 0.7) return; // only forward
  const b = TS[j];
  if (Math.hypot(P.x - b.x, P.z - b.z) > TRACK_W + 5 || Math.abs(P.y - b.h) > 2.5) return;
  trackQuery(P.x, P.z, j, 40, _q);
  if (Math.abs(_q.lat) > LIM - 0.3) { const m = Math.abs(_q.lat) - (LIM - 0.3), sg = Math.sign(_q.lat); P.x -= _q.nx * sg * m; P.z -= _q.nz * sg * m; trackQuery(P.x, P.z, j, 40, _q); }
  const sp = Math.max(Math.hypot(P.vx, P.vz), 6);
  P.vx = _q.tx * sp; P.vz = _q.tz * sp; P.off = false;
  race.glitchStep = true; lapLogic(P.idx, _q.i); race.glitchStep = false;
  P.idx = _q.i; race.ep = null;
  glitch('kreuzungs-verwechslung');
}
// ============================================================
// TEST ONLY: admin menu – shows each glitch at the nearest place where it works
// ============================================================
const ADMIN = { jobs: [] };
function adminLater(delay, fn) { ADMIN.jobs.push({ at: simT + delay, fn }); }
function adminWatch(fn, timeout = 4) { ADMIN.jobs.push({ watch: fn, until: simT + timeout }); }
function adminTick() {
  const jobs = ADMIN.jobs; ADMIN.jobs = []; // jobs added while running land in the new list
  for (const j of jobs) {
    if (j.watch) { if (!j.watch() && simT < j.until) ADMIN.jobs.push(j); }
    else if (simT >= j.at) j.fn(); else ADMIN.jobs.push(j);
  }
}
// nearest sample (along the lap, both directions) that fits
function adminFind(test) {
  for (let d = 0; d < NS / 2; d++) {
    for (const i of [tsAt(P.idx + d).i, tsAt(P.idx - d).i]) if (test(TS[i], i)) return i;
  }
  return -1;
}
function adminPlace(i, lat, yRel, speed, dirYaw = null) {
  const s = tsAt(i), yaw = dirYaw == null ? Math.atan2(-s.tx, -s.tz) : dirYaw;
  hook.state = 'idle'; hook.obj = null; hook.fresh = false; holdKey = false; holdMouse = false; holdAdmin = false;
  Object.assign(P, { x: s.x + s.nx * lat, z: s.z + s.nz * lat, y: s.h + yRel, vy: 0, vx: -Math.sin(yaw) * speed, vz: -Math.cos(yaw) * speed,
    w: 0, yaw, idx: s.i, grounded: yRel <= 0.001, off: false, ride: 0, noCeil: false, clipUntil: -9, bumpT: -9, wheel: 0, wTgt: 0 });
  race.ep = null; race.admin = true;
  look.yaw = Math.atan2(-s.tx, -s.tz); look.pitch = -0.12;
}
function adminAttach(point, fresh = false) {
  hook.obj = null; hook.state = 'attached'; hook.fresh = fresh; hook.attachT = simT; hook.hit = true;
  hook.target.copy(point); hook.pos.copy(point); hook.ropeLen = Math.hypot(point.x - P.x, point.z - P.z); holdKey = true;
}
const groundBar = (s) => s.h < 0.3 && (s.barL || s.barR);
const barSide = (s) => (s.barR && (!s.barL || s.k >= 0) ? 1 : -1);
// ---------- demos: lead-up + every input visible, in slow motion ----------
const DEMO = { active: false, scale: 0.4, steps: [], cur: 0, t0: 0, stepT: 0, aim: null, lastInput: -9, keys: {} };
const fmtS = (t) => t.toFixed(2).replace('.', ',') + ' s';
function demoLog(txt, input = false) {
  const el = document.getElementById('dLog'), t = simT - DEMO.t0;
  let extra = '';
  if (input) { if (DEMO.lastInput > -9) extra = ` <i>(${fmtS(simT - DEMO.lastInput)} danach)</i>`; DEMO.lastInput = simT; }
  const row = document.createElement('div'); row.className = input ? 'in' : 'note';
  row.innerHTML = `<b>+${fmtS(t)}</b> ${txt}${extra}`;
  el.appendChild(row); while (el.children.length > 9) el.removeChild(el.firstChild);
}
function demoKey(k, on) { DEMO.keys[k] = on; const el = document.getElementById(k === 'hook' ? 'kHook' : k === 'wheel' ? 'kWheel' : 'kAim'); if (el) el.classList.toggle('on', on); }
// direction from the camera to a point → look yaw / pitch
function lookAtAngles(pt) {
  const ex = P.x, ey = P.y + FLOE_TOP + 1.02, ez = P.z, dx = pt.x - ex, dy = pt.y - ey, dz = pt.z - ez;
  return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))];
}
// step builders
const D = {
  wait: (sec, note) => ({ wait: sec, note }),
  until: (fn, note, timeout = 6) => ({ until: fn, note, timeout }),
  aim: (pt, note = 'Zielen (Kamera schwenkt)') => ({ run() { DEMO.aim = { pt: typeof pt === 'function' ? (DEMO.pt = pt()) : (DEMO.pt = pt), t: 0, dur: 0.16, from: [look.yaw, look.pitch] }; demoKey('aim', true); }, note, input: true }),
  hook: (pt, note = 'E / Linksklick drücken – Haken schießen') => ({ run() { holdKey = true; fireHook(typeof pt === 'function' ? DEMO.pt : pt); demoKey('hook', true); }, note, input: true }),
  hookUp: (note = 'E / Linksklick loslassen') => ({ run() { holdKey = false; if (!holding()) releaseHook(); demoKey('hook', false); }, note, input: true }),
  wheels: (note = 'Leertaste drücken') => ({ run() { wheelsPress(); demoKey('wheel', true); }, note, input: true }),
  wheelsUp: (note = 'Leertaste loslassen') => ({ run() { wheelsRelease(); demoKey('wheel', false); }, note, input: true }),
  note: (note) => ({ run() {}, note }),
  fn: (f) => ({ run: f }),
};
function demoStart(title, steps) {
  ADMIN.jobs = [];
  Object.assign(DEMO, { active: true, steps, cur: 0, t0: simT, stepT: simT, aim: null, lastInput: -9 });
  document.getElementById('dTitle').textContent = '🛠 DEMO: ' + title;
  document.getElementById('dLog').innerHTML = '';
  for (const k of ['hook', 'wheel', 'aim']) demoKey(k, false);
  document.getElementById('demoBox').classList.remove('hidden', 'fade');
}
function demoStop() {
  if (!DEMO.active) return;
  DEMO.active = false; DEMO.aim = null;
  holdKey = false; holdSpace = false; holdAdmin = false;
  for (const k of ['hook', 'wheel', 'aim']) demoKey(k, false);
  document.getElementById('demoBox').classList.add('fade');
}
function demoTick(dt) {
  // smooth aim flick (follows moving targets)
  if (DEMO.aim) {
    const a = DEMO.aim; a.t += dt;
    const [ty, tp] = lookAtAngles(a.pt), k = smooth(Math.min(1, a.t / a.dur));
    look.yaw = a.from[0] + angDiff(a.from[0], ty) * k; look.pitch = lerp(a.from[1], tp, k);
    if (a.t >= a.dur + 0.25) { DEMO.aim = null; demoKey('aim', false); }
  }
  for (let guard = 0; guard < 8 && DEMO.active; guard++) {
    const st = DEMO.steps[DEMO.cur];
    if (!st) { if (simT - DEMO.stepT > 2.5) demoStop(); return; }
    if (st.wait != null && simT - DEMO.stepT < st.wait) return;
    if (st.until && !st.until() && simT - DEMO.stepT < st.timeout) return;
    if (st.run) st.run();
    if (st.note) demoLog(st.note, !!st.input);
    DEMO.cur++; DEMO.stepT = simT;
  }
}
const noElemNear = (i, n = 60) => ELEM.list.every((el) => { if (!el.p) return true; let d = Math.abs(el.p.i - i); d = Math.min(d, NS - d); return d > n; });
const groundStraight = (s) => groundBar(s) && groundBar(tsAt(s.i + 30)) && groundBar(tsAt(s.i - 30)) && Math.abs(s.k) < 1 / 40 && !s.under && !tsAt(s.i + 30).under && !tsAt(s.i - 30).under;
const timeToLand = () => { const h = Math.max(0, P.y - _q.h); return (P.vy + Math.sqrt(P.vy * P.vy + 2 * G_AIR * h)) / G_AIR; };
const ceilPt = (s, lat = 0, ahead = 0) => new V3(s.x + s.nx * lat + s.tx * ahead, HALL.h, s.z + s.nz * lat + s.tz * ahead);
const ADMIN_RUN = {
  'seil-snap'() {
    const i = P.idx; adminPlace(i, 0, 0, 9);
    let A = null; const pickA = () => { const a = tsAt(P.idx + 110); return (A = new V3(a.x, a.h + 0.2, a.z)); };
    const At = () => A;
    return ['Seil-Snap', [
      D.note('Anlauf'), D.wait(0.5), D.aim(pickA, 'Ziel weit vorne auf dem Boden anvisieren'), D.wait(0.3),
      D.hook(At), D.until(() => hook.state === 'attached', 'Haken greift', 1.5), D.wait(0.5, 'Seil zieht – Seil ist straff'),
      D.hookUp('E loslassen …'), D.wait(0.07), D.hook(At, '… und sofort wieder E (max. 0,12 s)'),
      D.wait(1.2, 'Schub! (Glitch-Geräusch)'), D.hookUp(),
    ]];
  },
  'bandenreiten'() {
    // the same barrier must run without a gap from the take-off to well past the landing
    const sideOk = (i, key) => { for (let k = -40; k <= 110; k += 4) { const t = tsAt(i + k); if (!t[key] || t.h > 0.3 || t.under) return false; } return true; };
    let i = -1, side = 1;
    for (const n of [90, 45, 20]) {
      i = adminFind((s) => Math.abs(s.k) < 1 / 40 && (sideOk(s.i, 'barR') || sideOk(s.i, 'barL')) && noElemNear(s.i, n));
      if (i >= 0) break;
    }
    if (i < 0) return false;
    side = sideOk(i, 'barR') ? 1 : -1;
    const st = tsAt(i - 40);
    adminPlace(st.i, side * (LIM - 0.6), 0, 13);
    const C = () => ceilPt(tsAt(P.idx + 30), side * (HW + 0.55));
    let assist = false;
    return ['Bandenreiten', [
      D.note('Anlauf, etwas zur Seite der Bande'), D.wait(0.5), D.aim(C, 'Decke über der Bande anvisieren'), D.wait(0.25),
      D.hook(C, 'E drücken – Haken an die Decke → Sprung'), D.until(() => hook.state === 'attached', 'Haken greift', 1.5),
      D.until(() => (P.y - _q.h > 2.5 && P.vy < 2) || hook.state !== 'attached', 'hochziehen lassen'),
      D.hookUp('über der Bande: E loslassen'),
      D.fn(() => { assist = true; }),
      D.until(() => { // demo help: steer the flight so it comes down exactly on the barrier top
        const relTop = (WORLD.barH || 0.95) + 0.05, h = P.y - _q.h - relTop;
        if (assist && !P.ride && !P.grounded && P.vy < 0 && h > 0.05) {
          const tl = (P.vy + Math.sqrt(P.vy * P.vy + 2 * G_AIR * h)) / G_AIR;
          const want = clamp((side * (HW + 0.55) - _q.lat) / Math.max(0.12, tl), -10, 10);
          const fwd = Math.max(11, P.vx * _q.tx + P.vz * _q.tz); // keep enough speed for the trick (demo help)
          P.vx = _q.tx * fwd + _q.nx * want; P.vz = _q.tz * fwd + _q.nz * want;
        }
        return P.ride !== 0 || P.grounded;
      }, 'genau auf der Bandenkante landen'),
      D.wait(2.5, 'du rutschst auf der Bande und lenkst automatisch mit'),
    ]];
  },
  'raeder-trampolin'() {
    let i = adminFind((s) => s.h < 0.3 && !s.under && noElemNear(s.i, 50));
    if (i < 0) i = P.idx;
    adminPlace(i, 0, 0, 10);
    const F = () => { const t = tsAt(P.idx + 4); return new V3(t.x, t.h, t.z); }; // floor right in front
    const Fnow = () => (DEMO.pt = F());
    return ['Räder-Trampolin', [
      D.note('Anlauf'), D.wait(0.5), D.aim(F, 'steil nach unten auf den Boden vor dir zielen'), D.wait(0.2),
      D.wheels('Leertaste drücken – Räder fahren aus (0,28 s)'), D.wait(0.1),
      D.fn(Fnow), D.hook(F, 'während sie ausfahren: E – Haken in den Boden'),
      D.until(() => P.vy > 5, 'reißt dich in den Boden → Abprall!', 1.5),
      D.hookUp(), D.wheelsUp(), D.wait(2, 'Flug (geht auch durch Brücken)'),
    ]];
  },
  'doppelbumper'() {
    let best = null, bd = 1e9;
    for (const el of ELEM.list) if (el.type === 'bumper') { let d = Math.abs(el.p.i - P.idx); d = Math.min(d, NS - d); if (d < bd) { bd = d; best = el; } }
    if (!best) return false;
    const st = tsAt(best.p.i - 26), sx = st.x + st.nx * best.p.lat, sz = st.z + st.nz * best.p.lat;
    adminPlace(st.i, best.p.lat, 0, 11, Math.atan2(-(best.x - sx), -(best.z - sz)));
    const B = new V3(best.x, best.y + 0.8, best.z);
    return ['Doppelbumper', [
      D.note('Anlauf direkt auf den Bumper zu'),
      D.until(() => Math.hypot(P.x - B.x, P.z - B.z) < 7, 'näher kommen …'),
      D.aim(B, 'kurz vorher: Bumper anvisieren'), D.wait(0.08), D.hook(B, 'E drücken – Bumper anhaken (max. 0,6 s vor dem Aufprall)'), D.until(() => hook.state === 'attached', 'Haken greift', 1),
      D.until(() => hook.state !== 'attached' || P.wall > 0, 'Aufprall → doppelter Kick!', 2), D.hookUp(), D.wait(1.5),
    ]];
  },
  'decken-clip'() {
    let i = adminFind((s, k) => s.under && s.h < 0.1 && !tsAt(k - 1).under && noElemNear(k, 50));
    if (i < 0) i = adminFind((s, k) => s.under && s.h < 0.1 && !tsAt(k - 1).under);
    if (i < 0) return false;
    adminPlace(i - 40, 0, 0, 8);
    const z = TS[(i + 6) % NS], A = new V3(z.x, z.ceil - 0.9, z.z);
    return ['Decken-Clip', [
      D.note('Anlauf unter die Brücke'),
      D.until(() => Math.hypot(P.x - A.x, P.z - A.z) < 4.6, 'bis kurz vor den Brückenanfang'),
      D.aim(A, 'Unterseite am Brückenanfang anvisieren (steil)'), D.wait(0.06), D.hook(A, 'E drücken – Sprung gegen die Unterseite'), D.until(() => hook.state === 'attached', 'Haken greift', 1.5),
      D.until(() => P.noCeil, 'mit Schwung an den Rand → durch!', 2), D.hookUp(), D.wait(2, 'oben auf der Brücke'),
    ]];
  },
  'seil-zieher'() {
    let i = adminFind((s, k) => s.under && s.h < 0.1 && tsAt(k - 24).under && tsAt(k + 24).under && noElemNear(k, 50));
    if (i < 0) i = adminFind((s, k) => s.under && s.h < 0.1 && tsAt(k - 24).under && tsAt(k + 24).under);
    if (i < 0) return false;
    adminPlace(i - 3, 0, 0, 0);
    const s = TS[i], A = new V3(s.x + s.tx * 3, s.ceil - 0.9, s.z + s.tz * 3);
    const t0 = simT;
    return ['Seil-Zieher', [
      D.note('Anlauf unter die Brückenmitte'),
      D.until(() => Math.hypot(P.x - A.x, P.z - A.z) < (A.y - P.y - 1.3) * 1.15, 'bis die Unterseite steil über dir ist'),
      D.aim(A, 'Unterseite steil über dir anvisieren'), D.wait(0.06), D.hook(A, 'E drücken – Sprung'), D.until(() => hook.state === 'attached', 'Haken greift', 1.5),
      D.until(() => P.bumpT > t0, 'Kopf stößt an die Brücke', 2),
      D.wait(0.1), D.hookUp('E loslassen …'), D.wait(0.05), D.hook(A, '… und sofort neu schießen (max. 0,35 s nach dem Anstoßen)'),
      D.wait(1.2, 'durchgezogen!'), D.hookUp(), D.wait(1.5),
    ]];
  },
  'kreuzungs-verwechslung'() {
    const i = adminFind((s) => {
      if (s.alt == null || s.alt < 0) return false;
      let d = s.alt - s.i; if (d < 0) d += NS;
      const b = TS[s.alt];
      const dd = Math.hypot(s.x - b.x, s.z - b.z), sg = Math.sign((b.x - s.x) * s.nx + (b.z - s.z) * s.nz) || 1, lat = dd < HW ? 0 : sg * (LIM - 0.4);
      return d > 0 && d <= NS * 0.7 && Math.hypot(s.x + s.nx * lat - b.x, s.z + s.nz * lat - b.z) <= TRACK_W + 4.5 && Math.abs(s.h - b.h) < 2;
    });
    if (i < 0) return false;
    const s = TS[i], b = TS[s.alt], sg = Math.sign((b.x - s.x) * s.nx + (b.z - s.z) * s.nz) || 1;
    const lat = Math.hypot(s.x - b.x, s.z - b.z) < HW ? 0 : sg * (LIM - 0.4);
    const st = tsAt(i - 16);
    adminPlace(st.i, lat, 0, 10);
    const near = () => { let d = Math.abs(P.idx - i); d = Math.min(d, NS - d); return d <= 2; };
    return ['Kreuzungs-Verwechslung', [
      D.note(lat ? 'Anlauf am Rand, nah am anderen Streckenteil' : 'Anlauf auf die Kreuzung'),
      D.until(near, 'genau an der Stelle …'), D.wheels('Leertaste antippen …'), D.wait(0.08), D.wheelsUp('… und sofort loslassen (max. 0,3 s)'),
      D.wait(2, 'du bist jetzt auf dem anderen Streckenteil'),
    ]];
  },
  'wand-clip'() {
    let i = -1;
    for (const n of [70, 35, 15]) { i = adminFind((s) => groundStraight(s) && noElemNear(s.i, n)); if (i >= 0) break; }
    if (i < 0) return false;
    const s = tsAt(i - 10), side = TS[i].barR ? 1 : -1;
    adminPlace(s.i, -side * (LIM - 0.5), 0, 0);
    const w = tp(TS[i], side * (LIM + 0.5), 0), dx = w.x - P.x, dz = w.z - P.z, dl = Math.hypot(dx, dz); // aim straight at a point of the wall
    P.vx = dx / dl * 16; P.vz = dz / dl * 16;
    look.yaw = Math.atan2(-P.vx, -P.vz);
    return ['Wand-Clip', [
      D.note('schräg (45°) mit 58 km/h auf die Bande zu'),
      D.until(() => P.wall > 0 || P.clipUntil > simT, 'Aufprall …'),
      D.wheels('direkt danach Leertaste antippen (bis 0,15 s vor oder nach dem Aufprall)'), D.wait(0.08), D.wheelsUp(),
      D.wait(2, 'durch die Bande gerutscht'),
    ]];
  },
};
function adminRun(name) {
  if (state === 'countdown') { race.cd = 0.001; race.cdStep = 1; updateCountdown(0.01); }
  if (state !== 'race') return;
  ADMIN.jobs = []; demoStop();
  const r = ADMIN_RUN[name]();
  if (!r) { toast('🛠 Auf dieser Strecke gibt es dafür keine Stelle', 2200, true); return; }
  demoStart(r[0], r[1]);
}
// nearest piece of track below the floe (after hopping across the infield)
function nearestPiece(x, z, y) {
  let best = 1e18, bi = -1;
  for (let i = 0; i < NS; i += 2) {
    const s = TS[i];
    if (s.h > y + 0.5) continue;
    const dx = x - s.x, dz = z - s.z, dd = dx * dx + dz * dz;
    if (dd < best) { best = dd; bi = i; }
  }
  return bi;
}
function land(v) {
  const k = clamp(v / 9, 0, 1);
  SFX.bump(k * 0.7);
  shake = Math.max(shake, 0.2 + k * 0.7);
  for (let i = 0; i < 6 + k * 16; i++) { const a = Math.random() * TAU; spawnPart(P.x + Math.cos(a) * FLOE_R, P.y + 0.1, P.z + Math.sin(a) * FLOE_R, Math.cos(a) * 3, 1 + Math.random() * 2, Math.sin(a) * 3, 0.6, 0.05); }
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
  Object.assign(P, { x: s.x, z: s.z, y: 0, vx: 0, vz: 0, yaw: s.yaw, w: 0, idx: s.idx, wraps: -1, ax: 0, az: 0, wall: 0, wheel: 0, wheelSpin: 0, skid: 0, vy: 0, grounded: true, off: false, slam: false, ride: 0, noCeil: false, clipUntil: -9, wheelDownT: -9, bumpT: -9 });
}
function resetRace() {
  placeAtStart();
  look.yaw = WORLD.start.yaw; look.pitch = -0.04;
  hook.state = 'idle';
  ELEM.t = 0;
  ADMIN.jobs = []; holdAdmin = false;
  Object.assign(race, { admin: false, exempt: false, glitchStep: false, skip: 0, ep: null, flown: 0, started: false, backs: 0, t: 0, lapStart: 0, lapDone: 0, laps: [], cd: 3.9, cdStep: 4, wrongT: 0, finishT: 0 });
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
  if (race.admin) rec.push('(Admin benutzt – nicht gespeichert)');
  else if (BEST.total == null || total < BEST.total) { BEST.total = total; rec.push('NEUE BESTZEIT!'); }
  if (!race.admin && (BEST.lap == null || fastest < BEST.lap)) { BEST.lap = fastest; rec.push('NEUE BESTE RUNDE!'); }
  store('eisracer_best2', BESTS);
  if (rec.length && !race.admin) SFX.record();
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
const cross = document.getElementById('cross'), crossDist = document.getElementById('crossDist');
let toastTimer = 0;
function toast(html, ms = 1500, warn = false) {
  const t = document.getElementById('toast');
  t.innerHTML = html; t.classList.toggle('warn', warn); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function setHud(on) { document.getElementById('hud').classList.toggle('hidden', !on); }
const spdEl = document.getElementById('spd'), lapEl = document.getElementById('lapTxt'), timeEl = document.getElementById('timeTxt');
let hudSpd = -1, hudLap = '', hudTime = '';
function drawSpeed(kmh, lap, time) {
  const v = Math.round(kmh);
  if (v !== hudSpd) { hudSpd = v; spdEl.textContent = v; }
  if (lap !== hudLap) { hudLap = lap; lapEl.textContent = lap; }
  if (time !== hudTime) { hudTime = time; timeEl.textContent = time; }
}

// ---------- menus ----------
const $ = (id) => document.getElementById(id);
function hideAll() { for (const id of ['menu', 'pause', 'result', 'maps', 'loading']) $(id).classList.add('hidden'); $('lockMsg').classList.add('hidden'); }
function show(id) { hideAll(); $(id).classList.remove('hidden'); }
function updateBest() {
  $('bestTotal').textContent = fmt(BEST.total); $('bestLap').textContent = fmt(BEST.lap);
  $('curMap').textContent = MAP.icon + ' ' + MAP.name;
}
// ---------- map selection ----------
function miniMap(def, w, h) {
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
  const g = c.getContext('2d');
  const pts = new T.CatmullRomCurve3(def.cp.map((p) => new V3(p[0], p[2] || 0, p[1])), true, 'centripetal').getSpacedPoints(220);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const sc = Math.min((c.width - 36) / (x1 - x0), (c.height - 36) / (z1 - z0));
  const ox = (c.width - (x1 - x0) * sc) / 2, oz = (c.height - (z1 - z0) * sc) / 2;
  const X = (p) => ox + (p.x - x0) * sc, Y = (p) => oz + (p.z - z0) * sc;
  g.lineJoin = g.lineCap = 'round';
  const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p), Y(p)) : g.moveTo(X(p), Y(p)))); g.closePath(); };
  path(); g.lineWidth = 16; g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
  path(); g.lineWidth = 10; g.strokeStyle = '#e8f6ff'; g.stroke();
  // elevated parts in yellow
  g.lineWidth = 10; g.strokeStyle = '#ffcc1f';
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (a.y > 2 && b.y > 2) { g.beginPath(); g.moveTo(X(a), Y(a)); g.lineTo(X(b), Y(b)); g.stroke(); } }
  g.fillStyle = '#4ff26a'; g.beginPath(); g.arc(X(pts[0]), Y(pts[0]), 9, 0, TAU); g.fill();
  return c;
}
let mapsBuilt = false;
function openMaps() {
  SFX.init(); SFX.click();
  if (!mapsBuilt) {
    mapsBuilt = true;
    const grid = $('mapGrid');
    MAPS.forEach((m, i) => {
      const b = document.createElement('button'); b.className = 'mapCard'; b.dataset.i = i;
      const th = m.theme || {}, pal = th.pal || {};
      b.style.setProperty('--c1', pal.wallUp || '#6f92b8'); b.style.setProperty('--c2', pal.floor1 || '#a7aeb6');
      const mm = miniMap(m, 150, 86); mm.className = 'mm';
      b.innerHTML = `<div class="num">${i + 1}</div><div class="ttl"><span>${m.icon}</span>${m.name}</div><div class="sub">${m.sub}</div><div class="bt"></div>`;
      b.insertBefore(mm, b.children[1]);
      b.onclick = () => chooseMap(i);
      grid.appendChild(b);
    });
  }
  document.querySelectorAll('.mapCard').forEach((b) => {
    const m = MAPS[+b.dataset.i], bt = BESTS[m.id];
    b.querySelector('.bt').innerHTML = bt && bt.total != null ? '🏆 ' + fmt(bt.total) : '<i>noch keine Zeit</i>';
    b.classList.toggle('cur', +b.dataset.i === mapIdx);
  });
  paused = false;
  if (state === 'race' || state === 'countdown') { state = 'menu'; setHud(false); }
  show('maps');
}
function chooseMap(i) {
  SFX.click(); lock();
  if (i === mapIdx && WORLD.group) { startRace(); return; }
  show('loading');
  $('loadName').textContent = MAPS[i].icon + ' ' + MAPS[i].name;
  requestAnimationFrame(() => requestAnimationFrame(() => { loadMap(i); updateBest(); startRace(); }));
}
updateBest();
let touchMode = false;
function setTouch(on) { touchMode = on; document.body.classList.toggle('touch', on); }
function lock() {
  if (touchMode) return;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => $('lockMsg').classList.remove('hidden')); }
  catch (e) { /* ignore */ }
}
function startRace() { SFX.init(); SFX.click(); paused = false; resetRace(); lock(); }
function wheelsPress() { aimWheels(); holdSpace = true; P.wheelPressT = simT; tryLateWallClip(); }
function wheelsRelease() { if (holdSpace && simT - P.wheelPressT < 0.3) tryCrossSwap(); holdSpace = false; }
function pauseGame() {
  demoStop();
  if (paused || (state !== 'race' && state !== 'countdown')) return;
  paused = true; holdMouse = holdKey = holdTouch = holdSpace = holdWheelTouch = false; $('tHook').classList.remove('on'); $('tWheels').classList.remove('on');
  SFX.mute();
  openSettings(true);
}
function resumeGame() { SFX.click(); paused = false; hideAll(); lock(); }
// TEST ONLY: admin buttons in the pause menu
{
  const grid = document.getElementById('adminGrid');
  for (const [id, label] of Object.entries(GLITCH_NAMES)) {
    const b = document.createElement('button'); b.textContent = label;
    b.onclick = () => { resumeGame(); adminRun(id); };
    grid.appendChild(b);
  }
}
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
  $('bMenu').classList.toggle('hidden', !inGame);
  $('adminBox').classList.toggle('hidden', !inGame || !GLITCH_DEBUG);
  show('pause');
}
$('bStart').onclick = openMaps;
$('bQuick').onclick = startRace;
$('bMaps').onclick = openMaps;
$('bMapsBack').onclick = () => { SFX.click(); show('menu'); updateBest(); };
$('bNext').onclick = () => chooseMap((mapIdx + 1) % MAPS.length);
$('bPauseMaps').onclick = () => { if (document.pointerLockElement) document.exitPointerLock(); openMaps(); };
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
  if (DEMO.active) return;
  if (!playing() || !document.pointerLockElement) return;
  const k = 0.0022 * SETTINGS.sens;
  look.yaw -= e.movementX * k;
  look.pitch = clamp(look.pitch - e.movementY * k * (SETTINGS.inv ? -1 : 1), -1.45, 1.45);
});
canvas.addEventListener('mousedown', (e) => {
  if (DEMO.active) return;
  if (!playing()) return;
  if (!document.pointerLockElement) { lock(); return; }
  if (e.button === 0) { holdMouse = true; fireHook(); }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0 && holdMouse) { holdMouse = false; if (!holding()) releaseHook(); }
});
document.addEventListener('keydown', (e) => {
  if (touchMode) setTouch(false);
  if (DEMO.active && e.code !== 'Escape' && e.code !== 'KeyP') { e.preventDefault(); return; }
  if (e.code === 'Space') { e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); if (!e.repeat && playing()) wheelsPress(); return; }
  if (e.code === 'KeyE' && !e.repeat) { if (playing()) { holdKey = true; fireHook(); } }
  else if (e.code === 'KeyR' && !e.repeat && (state === 'race' || state === 'countdown' || state === 'finished') && !paused) startRace();
  else if (e.code === 'KeyP' && !e.repeat) { if (paused && !settingsFromMenu) resumeGame(); else pauseGame(); }
  else if (e.code === 'Escape' && paused && !settingsFromMenu && !document.pointerLockElement) { /* stays paused until clicked */ }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'KeyE' && holdKey) { holdKey = false; if (!holding()) releaseHook(); }
  if (DEMO.active) return;
  if (e.code === 'Space') { e.preventDefault(); wheelsRelease(); }
});
window.addEventListener('blur', () => { holdMouse = holdKey = holdTouch = holdSpace = holdWheelTouch = false; if (hook.state === 'attached') releaseHook(); });
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- touch (iPad): swipe anywhere to look, hold the HAKEN button to grapple ----------
let lookTouch = null; // { id, x, y }
window.addEventListener('touchstart', () => { if (!touchMode) setTouch(true); }, { capture: true, passive: true });
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (lookTouch) return;
  const t = e.changedTouches[0];
  lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!lookTouch) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== lookTouch.id) continue;
    const dx = t.clientX - lookTouch.x, dy = t.clientY - lookTouch.y;
    lookTouch.x = t.clientX; lookTouch.y = t.clientY;
    if (!playing()) continue;
    const k = 0.0045 * SETTINGS.sens;
    look.yaw -= dx * k;
    look.pitch = clamp(look.pitch - dy * k * (SETTINGS.inv ? -1 : 1), -1.45, 1.45);
  }
}, { passive: false });
const endLook = (e) => { if (lookTouch) for (const t of e.changedTouches) if (t.identifier === lookTouch.id) lookTouch = null; };
canvas.addEventListener('touchend', endLook);
canvas.addEventListener('touchcancel', endLook);
// the hook button also works as a look pad: drag while holding to keep aiming
let hookTouch = null;
$('tHook').addEventListener('touchstart', (e) => {
  if (DEMO.active) { e.preventDefault(); return; }
  e.preventDefault();
  const t = e.changedTouches[0];
  hookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
  if (!playing()) return;
  holdTouch = true; $('tHook').classList.add('on');
  fireHook();
}, { passive: false });
$('tHook').addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!hookTouch || !playing()) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== hookTouch.id) continue;
    const k = 0.0045 * SETTINGS.sens;
    look.yaw -= (t.clientX - hookTouch.x) * k;
    look.pitch = clamp(look.pitch - (t.clientY - hookTouch.y) * k * (SETTINGS.inv ? -1 : 1), -1.45, 1.45);
    hookTouch.x = t.clientX; hookTouch.y = t.clientY;
  }
}, { passive: false });
const endHook = (e) => {
  e.preventDefault();
  hookTouch = null;
  $('tHook').classList.remove('on');
  if (holdTouch) { holdTouch = false; if (!holding()) releaseHook(); }
};
$('tHook').addEventListener('touchend', endHook, { passive: false });
$('tHook').addEventListener('touchcancel', endHook, { passive: false });
const wheelsBtn = $('tWheels');
wheelsBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (!playing() || DEMO.active) return; aimWheels(); holdWheelTouch = true; P.wheelPressT = simT; tryLateWallClip(); wheelsBtn.classList.add('on'); }, { passive: false });
const endWheels = (e) => { e.preventDefault(); if (holdWheelTouch && simT - P.wheelPressT < 0.3) tryCrossSwap(); holdWheelTouch = false; wheelsBtn.classList.remove('on'); };
wheelsBtn.addEventListener('touchend', endWheels, { passive: false });
wheelsBtn.addEventListener('touchcancel', endWheels, { passive: false });
$('tPause').addEventListener('touchstart', (e) => { e.preventDefault(); pauseGame(); }, { passive: false });
$('tPause').addEventListener('click', () => pauseGame());

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
  const lift = WHEEL_LIFT * clamp((P.wheel - 0.55) / 0.45, 0, 1) ** 0.7;
  P.lift = damp(P.lift || 0, lift, 18, dt);
  floe.position.set(P.x, P.y + 0.03 + P.lift, P.z);
  setWheels(floe.userData.wheels, P.wheel, P.wheelSpin, P.wheelYaw - P.yaw);
  floe.rotation.set(P.tiltX, P.yaw, P.tiltZ, 'YXZ');
  // camera
  const inGame = state !== 'menu';
  shake = Math.max(0, shake - dt * 2.2);
  if (inGame) {
    const bob = Math.sin(now * 0.011) * Math.min(speed, 30) * 0.0012;
    camera.position.set(P.x, P.y + FLOE_TOP + 1.02 + bob + (P.lift || 0), P.z);
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
  if (state !== 'menu' && speed > 9 && P.wheel < 1) {
    const n = speed > 22 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU;
      spawnPart(P.x + Math.cos(a) * FLOE_R * 0.9, P.y + 0.08, P.z + Math.sin(a) * FLOE_R * 0.9, -P.vx * 0.15 + (Math.random() - 0.5), 0.6 + Math.random(), -P.vz * 0.15 + (Math.random() - 0.5), 0.5, 0.03 + Math.random() * 0.03);
    }
  }
  updateParts(dt);

  // rotating decoration (ferris wheel, carousel, fans ...)
  for (const sp of WORLD.spin) sp.obj.rotation[sp.axis] += sp.speed * dt;
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
    if (touchMode) $('tHook').classList.toggle('ok', ok);
    if (ok) crossDist.textContent = Math.round(aimInfo.distance) + ' m';
    const lap = state === 'countdown' ? 1 : Math.min(LAPS, race.lapDone + 1);
    drawSpeed(speed * 3.6, `RUNDE ${lap}/${LAPS}`, fmt(race.t));
    $('speedfx').style.opacity = clamp((speed - 16) / 22, 0, 0.75);
    // reel clicks while pulling
    if (pulling) { tickT -= dt * (0.6 + speed * 0.06); if (tickT <= 0) { tickT = 0.12; SFX.reel(); } }
  }
  SFX.update(speed, pulling && !paused, inGame && !paused, P.wheel === 1, P.skid || 0);
}

// ---------- loop ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
loadMap(mapIdx);
let last = performance.now(), accT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused) {
    if (state === 'countdown') updateCountdown(dt);
    accT += dt * (DEMO.active ? DEMO.scale : 1);
    while (accT >= STEP) { physStep(STEP); accT -= STEP; }
  }
  updateVisuals(paused ? 0 : dt, now);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// small debug / test handle
window.__eis = { P, hook, race, look, get state() { return state; }, fire: () => { holdKey = true; fireHook(); }, release: () => { holdKey = false; releaseHook(); }, start: startRace, aimHit, WORLD, get TS() { return TS; }, get TLEN() { return TLEN; }, renderer, step: (n) => { for (let i = 0; i < n; i++) physStep(STEP); }, skipCount: () => { race.cd = 0.001; race.cdStep = 1; } };
