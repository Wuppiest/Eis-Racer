// ============================================================
//  Eis-Racer – special elements: moving obstacles, floor zones, moving hook targets
//  placed along the track: at = fraction of the lap, lat = sideways offset (m)
// ============================================================
const ELEM = { list: [], t: 0 };

function placeOn(e) {
  const i = Math.floor((((e.at || 0) % 1) + 1) % 1 * NS), s = TS[i], lat = e.lat || 0;
  return { s, i, lat, x: s.x + s.nx * lat, z: s.z + s.nz * lat, y: s.h, tx: s.tx, tz: s.tz, nx: s.nx, nz: s.nz, ry: Math.atan2(-s.tz, s.tx) };
}
// is the floe (track query q) inside a stretch of track?
function inStretch(q, el) {
  let ds = q.s - el.s0;
  if (ds > TLEN / 2) ds -= TLEN; else if (ds < -TLEN / 2) ds += TLEN;
  return Math.abs(ds) < el.len / 2 && Math.abs(q.lat - el.lat) < el.w / 2 && Math.abs(P.y - el.y) < 2;
}
// a strip of track surface (follows the curve), uv: u across, v along (in units of vScale metres)
function trackRibbon(i0, n, l0, l1, y, vScale) {
  const pos = [], uv = [], idx = [];
  for (let k = 0; k <= n; k++) {
    const s = tsAt(i0 + k);
    for (const [j, lat] of [[0, l0], [1, l1]]) { pos.push(s.x + s.nx * lat, s.h + y, s.z + s.nz * lat); uv.push(j, (k * DS) / vScale); }
  }
  for (let k = 0; k < n; k++) { const a = 2 * k; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
function zoneBase(e, root, tex, mat, vScale) {
  const p = placeOn(e), len = e.len || 12, w = Math.min(e.w || TRACK_W - 1, TRACK_W);
  const l0 = clamp(p.lat - w / 2, -HW, HW), l1 = clamp(p.lat + w / 2, -HW, HW);
  const n = Math.max(2, Math.round(len / DS));
  const m = new T.Mesh(trackRibbon(p.i - Math.round(n / 2), n, l0, l1, 0.055, vScale), mat);
  m.receiveShadow = true; root.add(m);
  return { p, s0: p.i * DS, len, w: l1 - l0, lat: (l0 + l1) / 2, y: p.y, tex, mesh: m };
}
const wrapTex = (t, rx, ry) => { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); return t; };
// dynamic (moving) meshes can be hooked: the anchor then moves with them
function dynMesh(obj, glow = false) {
  const m = new MeshAcc().addObj(obj).build(glow ? GLOWMAT : VCMAT);
  m.castShadow = !glow; m.userData.dyn = true;
  if (!glow) WORLD.dynHit.push(m);
  return m;
}

// ---------- collision helpers (floe = circle of FLOE_R) ----------
function contactPush(nx, nz, pen, ovx, ovz, rest, kick = 0) {
  P.x += nx * pen; P.z += nz * pen;
  const rvx = P.vx - ovx, rvz = P.vz - ovz, vn = rvx * nx + rvz * nz;
  if (vn >= 0) return 0;
  const j = -(1 + rest) * vn; P.vx += nx * j; P.vz += nz * j;
  // bumpers shoot you back, but only when you actually run into them
  if (kick && vn < -0.3) { const out = P.vx * nx + P.vz * nz; if (out < kick) { P.vx += nx * (kick - out); P.vz += nz * (kick - out); } }
  if (P.wheel === 0) P.w += clamp((rvx * nz - rvz * nx) * 0.12, -4, 4);
  const hit = Math.max(-vn, kick && vn < -0.3 ? kick * 0.6 : 0);
  if (hit > 1.5 && P.wall <= 0) impact(hit, P.x - nx * FLOE_R, P.z - nz * FLOE_R, -nx, -nz);
  return hit;
}
function hitCircle(cx, cz, r, ovx = 0, ovz = 0, rest = 0.4, kick = 0) {
  const dx = P.x - cx, dz = P.z - cz, d = Math.hypot(dx, dz), m = r + FLOE_R;
  if (d >= m || d < 1e-6) return 0;
  return contactPush(dx / d, dz / d, m - d, ovx, ovz, rest, kick) || 0.001;
}
function hitCapsule(ax, az, bx, bz, r, vel, rest = 0.4) {
  const sx = bx - ax, sz = bz - az, l2 = sx * sx + sz * sz;
  const f = l2 > 0 ? clamp(((P.x - ax) * sx + (P.z - az) * sz) / l2, 0, 1) : 0;
  const cx = ax + sx * f, cz = az + sz * f;
  const dx = P.x - cx, dz = P.z - cz, d = Math.hypot(dx, dz), m = r + FLOE_R;
  if (d >= m || d < 1e-6) return 0;
  const [vx, vz] = vel ? vel(cx, cz) : [0, 0];
  return contactPush(dx / d, dz / d, m - d, vx, vz, rest) || 0.001;
}
// oriented box: center, half sizes along its local x / z, rotation (ry like three.js)
function hitBox2(cx, cz, hx, hz, ry, ovx = 0, ovz = 0, rest = 0.4) {
  const ux = Math.cos(ry), uz = -Math.sin(ry), vx = Math.sin(ry), vz = Math.cos(ry);
  const dx = P.x - cx, dz = P.z - cz;
  const lu = dx * ux + dz * uz, lv = dx * vx + dz * vz;
  const qu = clamp(lu, -hx, hx), qv = clamp(lv, -hz, hz);
  let px = cx + ux * qu + vx * qv, pz = cz + uz * qu + vz * qv;
  let nx = P.x - px, nz = P.z - pz, d = Math.hypot(nx, nz);
  if (d >= FLOE_R) return 0;
  if (d < 1e-6) { // center inside the box: push out along the shallow axis
    if (hx - Math.abs(lu) < hz - Math.abs(lv)) { nx = ux * Math.sign(lu || 1); nz = uz * Math.sign(lu || 1); d = -(hx - Math.abs(lu)); }
    else { nx = vx * Math.sign(lv || 1); nz = vz * Math.sign(lv || 1); d = -(hz - Math.abs(lv)); }
    return contactPush(nx, nz, FLOE_R - d, ovx, ovz, rest) || 0.001;
  }
  return contactPush(nx / d, nz / d, FLOE_R - d, ovx, ovz, rest) || 0.001;
}

// ---------- textures ----------
let _texCache = {};
function boostTex() {
  return _texCache.boost || (_texCache.boost = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#10243a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4ff2ff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(10, 46); g.lineTo(32, 20); g.lineTo(54, 46); g.stroke();
  }));
}
function beltTex() {
  return _texCache.belt || (_texCache.belt = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#2a2d33'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a4f58'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 6);
    g.fillStyle = '#ffcc1f'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
  }));
}
function iceTex() {
  return _texCache.ice || (_texCache.ice = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#bfe9ff'); gr.addColorStop(1, '#e6f7ff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2;
    for (let k = 0; k < 14; k++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + Math.random() * 30, y + 8 + Math.random() * 12); g.stroke(); }
  }));
}
function slushTex() {
  return _texCache.slush || (_texCache.slush = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b9ab95'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 160; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.75)' : 'rgba(120,100,80,.5)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 7, 0, TAU); g.fill(); }
  }));
}

// ---------- element types ----------
const ETYPES = {
  // glowing chevrons: strong push along the track
  boost(e, root) {
    const tex = boostTex().clone(); tex.needsUpdate = true;
    const el = zoneBase(e, root, wrapTex(tex, 3, 1), null, 2);
    el.mesh.material = new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide, fog: false });
    el.power = e.power || 32;
    el.zone = (q, Z) => { if (inStretch(q, el)) { Z.ax += q.tx * el.power; Z.az += q.tz * el.power; if (!el.inside) { el.inside = true; SFX.boost(); } } else el.inside = false; };
    el.update = (t, dt) => { tex.offset.y -= dt * 2.5; };
    return el;
  },
  // brown snow: brakes hard
  slush(e, root) {
    const el = zoneBase(e, root, null, new T.MeshLambertMaterial({ map: wrapTex(slushTex(), 1, 1), side: T.DoubleSide }), 6);
    const o = new Obj();
    for (let k = 0; k < el.len * 1.2; k++) {
      const s = tsAt(el.p.i + Math.round(R(-el.len / 2, el.len / 2) / DS)), lat = el.lat + R(-el.w / 2 + 0.5, el.w / 2 - 0.5);
      o.ico(R(0.25, 0.55), s.x + s.nx * lat, s.h + 0.06, s.z + s.nz * lat, rng() < 0.6 ? C('#f4f1ea') : C('#a8977c'), { sy: 0.35, d: 0, jit: 0.05 });
    }
    root.add(meshOf(o));
    el.zone = (q, Z) => { if (inStretch(q, el)) Z.fricAdd += 5.5; };
    return el;
  },
  // polished blank ice: almost no friction at all
  superice(e, root) {
    const el = zoneBase(e, root, null, new T.MeshLambertMaterial({ map: wrapTex(iceTex(), 1, 1), emissive: '#2a4a60', side: T.DoubleSide }), 8);
    el.zone = (q, Z) => { if (inStretch(q, el)) Z.fric *= 0.04; };
    return el;
  },
  // conveyor belt: drags you along its direction
  conveyor(e, root) {
    const tex = beltTex().clone(); tex.needsUpdate = true;
    const dirName = e.dir || 'fwd', sideways = dirName === 'left' || dirName === 'right';
    const el = zoneBase(e, root, wrapTex(tex, 1, 1), new T.MeshLambertMaterial({ map: tex, side: T.DoubleSide }), 2);
    if (sideways) { tex.rotation = PI / 2; }
    el.speed = e.speed || 12;
    el.sign = dirName === 'back' || dirName === 'left' ? -1 : 1;
    // rollers at both ends
    const o = new Obj();
    for (const end of [-1, 1]) {
      const s = tsAt(el.p.i + end * Math.round(el.len / 2 / DS));
      const a = tp(s, el.lat - el.w / 2, 0), b = tp(s, el.lat + el.w / 2, 0);
      segBox(o, a.x, a.z, b.x, b.z, s.h + 0.08, 0.35, 0.12, C('#ffcc1f'));
    }
    root.add(meshOf(o));
    el.zone = (q, Z) => {
      if (!inStretch(q, el)) return;
      const dx = sideways ? q.nx * el.sign : q.tx * el.sign, dz = sideways ? q.nz * el.sign : q.tz * el.sign;
      const vd = P.vx * dx + P.vz * dz, a = clamp(3.5 * (el.speed - vd), -25, 25);
      Z.ax += dx * a; Z.az += dz * a;
    };
    el.update = (t, dt) => { if (sideways) tex.offset.x += dt * el.speed / 2 * el.sign; else tex.offset.y -= dt * el.speed / 2 * el.sign; };
    return el;
  },
  // turning disc in the floor: carries and spins you
  turntable(e, root) {
    const p = placeOn(e), r = e.r || HW - 0.6, w = e.w || 1.1;
    const disc = new T.Group(); disc.position.set(p.x, p.y, p.z); root.add(disc);
    const da = new MeshAcc();
    for (let k = 0; k < 24; k++) {
      const a0 = (k / 24) * TAU, a1 = ((k + 1) / 24) * TAU, col = k & 1 ? C('#ffcc1f') : C('#2a2f3a');
      da.tri(new V3(0, 0.07, 0), new V3(Math.cos(a0) * r, 0.07, Math.sin(a0) * r), new V3(Math.cos(a1) * r, 0.07, Math.sin(a1) * r), col, 0, UP);
    }
    const ring = new Obj(); ring.torus(r, 0.04, 0, 0.07, 0, C('#e8322b'), { rx: PI / 2, seg: 32 });
    da.addObj(ring);
    const dm = da.build(VCMAT); dm.receiveShadow = true; disc.add(dm);
    const hub = new Obj(); hub.cyl(0.6, 0.12, 0, 0.1, 0, C('#e8322b'), { seg: 12 }); disc.add(meshOf(hub));
    const el = { p, x: p.x, z: p.z, y: p.y, r, w };
    el.zone = (q, Z) => {
      const dx = P.x - el.x, dz = P.z - el.z;
      if (dx * dx + dz * dz > r * r || Math.abs(P.y - el.y) > 2) return;
      const vsx = w * dz, vsz = -w * dx; // surface speed of the disc
      Z.ax += 3.2 * (vsx - P.vx); Z.az += 3.2 * (vsz - P.vz); Z.spin = w;
    };
    el.update = (t) => { disc.rotation.y = w * t; };
    return el;
  },
  // big fan beside the track: side wind
  fan(e, root) {
    const side = e.side || 1, p = placeOn({ at: e.at, lat: side * (HW + 3.5) }), len = e.len || 26;
    const g = new T.Group(); g.position.set(p.x, p.y + 3.2, p.z); g.rotation.y = Math.atan2(p.nx * side, p.nz * side); root.add(g);
    const o = new Obj();
    o.torus(2.7, 0.12, 0, 0, 0, C('#2c3a5c'), { seg: 20 }); o.cyl(2.75, 0.8, 0, 0, 0.1, C('#3a4150'), { rx: PI / 2, seg: 20 });
    for (const sx of [-1.5, 1.5]) o.box(0.35, 3.2, 0.35, sx, -1.6 - 1.4, 0.3, C('#2c3a5c'));
    o.box(4, 0.3, 1.4, 0, -4.4, 0.3, C('#ffcc1f'));
    for (let k = 0; k < 6; k++) o.bar(new V3(Math.cos(k / 6 * TAU) * 2.7, Math.sin(k / 6 * TAU) * 2.7, -0.45), new V3(0, 0, -0.45), 0.06, C('#b3bdc9'));
    g.add(meshOf(o));
    hitBox(5.6, 6, 1.6, p.x, p.y + 2.5, p.z, g.rotation.y);
    const rotor = new T.Group(); rotor.position.z = 0.1; g.add(rotor);
    const ro = new Obj();
    for (let k = 0; k < 5; k++) ro.box(0.7, 2.4, 0.08, Math.cos(k / 5 * TAU + PI / 2) * 1.25, Math.sin(k / 5 * TAU + PI / 2) * 1.25, 0, C('#e8edf2'), { rz: k / 5 * TAU, ry: 0.4 });
    ro.cyl(0.45, 0.5, 0, 0, 0, C('#e8322b'), { rx: PI / 2, seg: 10 });
    rotor.add(meshOf(ro));
    const el = { p: placeOn({ at: e.at, lat: 0 }), s0: p.i * DS, len, w: TRACK_W + 2, lat: 0, y: p.y, side, force: e.force || 15, nx: p.nx, nz: p.nz };
    el.zone = (q, Z) => { if (inStretch(q, el)) { Z.ax -= q.nx * side * el.force; Z.az -= q.nz * side * el.force; } };
    el.update = (t, dt) => {
      rotor.rotation.z = t * 9;
      if (typeof spawnPart === 'function' && rng() < 0.5) {
        const s = tsAt(p.i + Math.round(R(-len / 2, len / 2) / DS)), lat = side * HW;
        spawnPart(s.x + s.nx * lat, s.h + R(0.3, 2), s.z + s.nz * lat, -s.nx * side * 18, 0.6, -s.nz * side * 18, 0.7, 0.035);
      }
    };
    return el;
  },
  // rotating arm(s) on a post in the track
  arm(e, root) {
    const p = placeOn(e), L = e.len || HW - 0.4, n = e.arms || 1, w = e.w || 1.1, hy = 0.75;
    const post = new Obj();
    post.cyl(0.5, 1.6, p.x, p.y + 0.8, p.z, C('#1d2029'), { seg: 10 });
    for (let k = 0; k < 3; k++) post.cyl(0.52, 0.2, p.x, p.y + 0.3 + k * 0.45, p.z, C('#ffcc1f'), { seg: 10 });
    root.add(meshOf(post)); hitBox(1, 1.6, 1, p.x, p.y + 0.8, p.z);
    const g = new T.Group(); g.position.set(p.x, p.y + hy, p.z); root.add(g);
    const o = new Obj(), gl = new Obj();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU, ca = Math.cos(a), sa = -Math.sin(a);
      for (let u = 0.6; u < L; u += 0.8) o.box(0.8, 0.5, 0.55, ca * (u + 0.4), 0, sa * (u + 0.4), ((u / 0.8) | 0) & 1 ? C('#e8322b') : C('#f3f4f6'), { ry: a });
      gl.sph(0.2, ca * L, 0.35, sa * L, C('#ffcc1f'), { seg: 6 });
    }
    o.cyl(0.75, 0.7, 0, 0.05, 0, C('#2c3a5c'), { seg: 12 });
    g.add(dynMesh(o)); g.add(dynMesh(gl, true));
    const el = { p, x: p.x, z: p.z, y: p.y, L, n, w, ang: 0 };
    el.update = (t) => { el.ang = w * t; g.rotation.y = el.ang; g.updateMatrixWorld(true); };
    const vel = (cx, cz) => [w * (cz - el.z), -w * (cx - el.x)];
    el.collide = () => {
      if (Math.abs(P.y - el.y) > 2) return;
      hitCircle(el.x, el.z, 0.55);
      for (let k = 0; k < n; k++) {
        const a = el.ang + (k / n) * TAU, tx = el.x + Math.cos(a) * L, tz = el.z - Math.sin(a) * L;
        hitCapsule(el.x, el.z, tx, tz, 0.32, vel, 0.5);
      }
    };
    return el;
  },
  // barrier gate: closes the track every few seconds
  gate(e, root) {
    const side = e.side || 1, p = placeOn({ at: e.at, lat: side * (HW + 0.5) }), period = e.period || 5, ph = e.phase || 0;
    const L = TRACK_W + 0.2;
    const ax = -p.nx * side, az = -p.nz * side; // across the track
    const po = new Obj();
    po.box(0.6, 1.3, 0.6, p.x, p.y + 0.65, p.z, C('#e8edf2')); po.box(0.64, 0.25, 0.64, p.x, p.y + 1.0, p.z, C('#e8322b'));
    root.add(meshOf(po)); hitBox(0.7, 1.4, 0.7, p.x, p.y + 0.7, p.z);
    const lamp = new T.Mesh(geoSph(8), new T.MeshBasicMaterial({ color: '#ff2a1a' })); lamp.scale.setScalar(0.18); lamp.position.set(p.x, p.y + 1.45, p.z); root.add(lamp);
    const g = new T.Group(); g.position.set(p.x, p.y + 1.05, p.z); g.rotation.y = Math.atan2(-az, ax); root.add(g);
    const lift = new T.Group(); g.add(lift);
    const o = new Obj();
    for (let u = 0.3; u < L; u += 0.7) o.box(0.7, 0.16, 0.16, u + 0.35, 0, 0, ((u / 0.7) | 0) & 1 ? C('#e8322b') : C('#f3f4f6'));
    o.box(0.4, 0.3, 0.3, -0.25, 0, 0, C('#3a404c'));
    lift.add(dynMesh(o));
    const el = { p, y: p.y, theta: 0 };
    el.update = (t) => {
      const f = ((t / period + ph) % 1 + 1) % 1;
      const k = f < 0.35 ? 0 : f < 0.47 ? smooth((f - 0.35) / 0.12) : f < 0.86 ? 1 : 1 - smooth((f - 0.86) / 0.14);
      el.theta = k * PI * 0.47;
      lift.rotation.z = el.theta;
      lamp.material.color.set(k < 0.5 ? '#ff2a1a' : '#33ff66');
      g.updateMatrixWorld(true);
    };
    el.collide = () => {
      if (el.theta > 0.5 || Math.abs(P.y - el.y) > 2) return;
      hitCapsule(p.x, p.z, p.x + ax * L, p.z + az * L, 0.25, null, 0.3);
    };
    return el;
  },
  // block sliding across the track (pallet, press, car ...)
  slider(e, root) {
    const p = placeOn(e), amp = e.amp != null ? e.amp : HW - 2, period = e.period || 3.6, ph = e.phase || 0;
    const bw = e.bw || 2.6, bd = e.bd || 2.0, style = e.style || 'press';
    const g = new T.Group(); root.add(g);
    const o = new Obj();
    if (style === 'pallet') {
      o.box(bw, 0.2, bd, 0, 0.1, 0, C('#b98a52'));
      for (const [dx, dz, h] of [[-0.6, -0.45, 1.1], [0.6, -0.45, 0.9], [-0.6, 0.45, 0.8], [0.6, 0.45, 1.2]]) o.box(bw / 2 - 0.1, h, bd / 2 - 0.1, dx, 0.2 + h / 2, dz, rcol(['#e8ddc9', '#d9c7a5', '#cfe3f2']), { jit: 0.05 });
    } else if (style === 'car') {
      o.put(carObj(C('#e8322b')), 0, 0, 0, PI / 2);
    } else if (style === 'mat') {
      o.box(bw, 1.2, bd, 0, 0.6, 0, C('#2a6fdb'), { jit: 0.03 }); o.box(bw + 0.02, 0.08, bd + 0.02, 0, 1.16, 0, PAL.white);
    } else {
      o.box(bw, 1.3, bd, 0, 0.65, 0, C('#ffcc1f'), { jit: 0.03 });
      for (let k = -2; k <= 2; k++) o.box(0.3, 1.32, bd + 0.02, k * 0.55, 0.65, 0, C('#1d2029'), { rz: 0.6 });
      o.box(bw + 0.2, 0.25, bd + 0.2, 0, 1.4, 0, C('#2c3a5c'));
    }
    g.add(dynMesh(o));
    const ry = p.ry; // block's local x along the track
    g.rotation.y = ry;
    const el = { p, y: p.y, lat: 0, vlat: 0 };
    el.update = (t) => {
      const a = (TAU * t) / period + ph * TAU;
      el.lat = p.lat + amp * Math.sin(a); el.vlat = amp * Math.cos(a) * TAU / period;
      g.position.set(p.s.x + p.nx * el.lat, p.y, p.s.z + p.nz * el.lat);
      g.updateMatrixWorld(true);
    };
    el.collide = () => {
      if (Math.abs(P.y - el.y) > 2) return;
      const hx = (style === 'car' ? 2.1 : bw / 2), hz = (style === 'car' ? 0.95 : bd / 2);
      hitBox2(g.position.x, g.position.z, hx, hz, ry, p.nx * el.vlat, p.nz * el.vlat, 0.4);
    };
    return el;
  },
  // pinball bumper / medicine ball: shoots you back
  bumper(e, root) {
    const p = placeOn(e), r = e.r || 0.95, style = e.style || 'neon';
    const g = new T.Group(); g.position.set(p.x, p.y, p.z); root.add(g);
    const o = new Obj(), gl = new Obj();
    if (style === 'ball') {
      o.sph(r, 0, r, 0, C(e.color || '#a5714a'), { seg: 12, jit: 0.04 });
      o.torus(r * 0.98, 0.05, 0, r, 0, C('#1d2029'), { rx: PI / 2, seg: 16 });
    } else {
      o.cyl(r, 0.9, 0, 0.45, 0, C('#1d2029'), { seg: 16 });
      o.cyl(r * 0.8, 0.12, 0, 0.96, 0, C('#f3f4f6'), { seg: 16 });
      gl.torus(r, 0.12, 0, 0.75, 0, C(e.color || '#ff3bd4'), { rx: PI / 2, seg: 16 });
      gl.sph(0.25, 0, 1.08, 0, C('#ffcc1f'), { seg: 8 });
    }
    const body = meshOf(o); g.add(body); if (gl.parts.length) g.add(meshOf(gl, true));
    hitBox(r * 2, 1.4, r * 2, p.x, p.y + 0.7, p.z);
    const el = { p, x: p.x, z: p.z, y: p.y, r, flash: 0 };
    el.update = (t, dt) => { el.flash = Math.max(0, el.flash - dt * 4); const s = 1 + el.flash * 0.18; g.scale.set(s, 1 + el.flash * 0.08, s); };
    el.collide = () => {
      if (Math.abs(P.y - el.y) > 2) return;
      if (hitCircle(el.x, el.z, r, 0, 0, 0.9, e.kick || 14) && el.flash < 0.5) { el.flash = 1; SFX.bumper(); }
    };
    return el;
  },
  // pinball flipper at the track edge: whacks you forward
  flipper(e, root) {
    const side = e.side || 1, p = placeOn({ at: e.at, lat: side * (HW - 0.9) }), L = e.len || 5.2, period = e.period || 2.6, ph = e.phase || 0;
    const base = Math.atan2(p.tz, p.tx); // angle of the track direction (math angle in x/z)
    const g = new T.Group(); g.position.set(p.x, p.y + 0.5, p.z); root.add(g);
    const o = new Obj();
    for (let u = 0; u < L; u += 0.5) { const r = lerp(0.55, 0.25, u / L); o.box(0.55, 0.6, r * 2, u + 0.25, 0, 0, C(e.color || '#ffcc1f')); }
    o.cyl(0.55, 0.7, 0, 0, 0, C('#e8322b'), { seg: 12 });
    g.add(dynMesh(o));
    const pin = new Obj(); pin.cyl(0.3, 1.1, p.x, p.y + 0.55, p.z, C('#1d2029'), { seg: 8 }); root.add(meshOf(pin));
    const el = { p, y: p.y, theta: 0.3, omega: 0 };
    el.update = (t, dt) => {
      const f = ((t / period + ph) % 1 + 1) % 1;
      const k = f < 0.08 ? smooth(f / 0.08) : f < 0.2 ? 1 : f < 0.5 ? 1 - smooth((f - 0.2) / 0.3) : 0;
      const th = lerp(0.3, 1.45, k);
      el.omega = dt > 0 ? (th - el.theta) / dt : 0; el.theta = th;
      // swing toward the middle of the track (= -side · normal)
      const ang = base - side * th;
      el.ang = ang;
      g.rotation.y = -ang;
      g.updateMatrixWorld(true);
    };
    el.collide = () => {
      if (Math.abs(P.y - el.y) > 2) return;
      const tx = p.x + Math.cos(el.ang) * L, tz = p.z + Math.sin(el.ang) * L;
      const w = -side * el.omega; // d(ang)/dt
      const vel = (cx, cz) => [-w * (cz - p.z), w * (cx - p.x)];
      if (hitCapsule(p.x, p.z, tx, tz, 0.45, vel, 0.6) > 6) SFX.bumper();
    };
    return el;
  },
  // wrecking ball swinging across the track
  pendulum(e, root) {
    const p = placeOn(e), L = e.len || 7, top = L + 1.1, period = e.period || 3.4, ph = e.phase || 0;
    const thMax = Math.asin(clamp((HW - 1.2) / L, 0, 0.95));
    const fr = new Obj();
    const a = tp(p.s, -(HW + 1.2), p.y), b = tp(p.s, HW + 1.2, p.y);
    for (const q of [a, b]) { fr.box(0.6, top + 0.4, 0.6, q.x, p.y + (top + 0.4) / 2, q.z, C('#ffcc1f'), { ry: p.ry }); hitBox(0.7, top + 0.4, 0.7, q.x, p.y + top / 2, q.z, p.ry); }
    segBox(fr, a.x, a.z, b.x, b.z, p.y + top + 0.2, 0.7, 0.6, C('#2c3a5c'), { ext: 0.6 });
    hitSeg(a.x, a.z, b.x, b.z, p.y + top + 0.2, 0.8, 0.7);
    root.add(meshOf(fr));
    const pivot = new T.Group(); pivot.position.set(p.x, p.y + top, p.z); pivot.rotation.y = p.ry; root.add(pivot);
    const swing = new T.Group(); pivot.add(swing);
    const o = new Obj();
    o.box(0.08, L, 0.08, 0, -L / 2, 0, C('#3a404c'));
    o.ico(1.0, 0, -L, 0, C('#2a2f3a'), { d: 1, jit: 0.08 });
    o.cyl(0.25, 0.3, 0, -L + 1.05, 0, C('#ffcc1f'), { seg: 6 });
    swing.add(dynMesh(o));
    const el = { p, y: p.y, th: 0, w: 0 };
    el.update = (t) => {
      const a2 = (TAU * t) / period + ph * TAU;
      el.th = thMax * Math.sin(a2); el.w = thMax * Math.cos(a2) * TAU / period;
      swing.rotation.x = -el.th; // positive = toward +normal (track right)
      pivot.updateMatrixWorld(true);
    };
    el.collide = () => {
      const lat = L * Math.sin(el.th), by = top - L * Math.cos(el.th);
      if (by > 2.3 || Math.abs(P.y - el.y) > 2.5) return;
      const v = L * Math.cos(el.th) * el.w;
      if (hitCircle(p.x + p.nx * lat, p.z + p.nz * lat, 1.0, p.nx * v, p.nz * v, 0.5) > 3) SFX.bumper();
    };
    return el;
  },
  // overhead crane: a moving hook target
  crane(e, root) {
    const p = placeOn(e), len = e.len || 40, H = HALL.h - 1.5, period = e.period || 9;
    const n = Math.round(len / 2 / DS);
    const s0 = tsAt(p.i - n), s1 = tsAt(p.i + n);
    const rail = new Obj();
    segBox(rail, s0.x, s0.z, s1.x, s1.z, H, 0.5, 0.6, C('#ffcc1f'), { ext: 2 });
    for (let k = 0; k < 2; k++) { const q = k ? s1 : s0; rail.box(0.2, HALL.h - H, 0.2, q.x, (H + HALL.h) / 2, q.z, C('#3a404c')); }
    root.add(meshOf(rail));
    hitSeg(s0.x, s0.z, s1.x, s1.z, H, 0.6, 0.7);
    const trolley = new T.Group(); root.add(trolley);
    const o = new Obj(), gl = new Obj(), drop = H - 7;
    o.box(1.4, 0.8, 1.2, 0, -0.6, 0, C('#2c3a5c'));
    o.box(0.05, drop, 0.05, -0.2, -1 - drop / 2, 0, C('#1d2029')); o.box(0.05, drop, 0.05, 0.2, -1 - drop / 2, 0, C('#1d2029'));
    o.box(1.0, 0.7, 0.8, 0, -1.3 - drop, 0, C('#ffcc1f'));
    gl.torus(0.6, 0.18, 0, -2.3 - drop, 0, C('#4ff2ff'), { seg: 12 });
    trolley.add(dynMesh(o)); trolley.add(dynMesh(gl, true));
    // the glow ring is also hookable (bigger target)
    const ringHit = new Obj(); ringHit.box(1.6, 1.6, 1.6, 0, -2.3 - drop, 0, C('#ffffff'));
    const rh = dynMesh(ringHit); rh.visible = false; trolley.add(rh);
    const el = { p };
    el.update = (t) => {
      const u = 0.5 + 0.5 * Math.sin((TAU * t) / period);
      trolley.position.set(lerp(s0.x, s1.x, u), H, lerp(s0.z, s1.z, u));
      trolley.updateMatrixWorld(true);
    };
    return el;
  },
};

function buildElements(def, root) {
  ELEM.list = []; ELEM.t = 0;
  rng = mulberry32(99 + def.id.length);
  for (const e of def.elements || []) { const f = ETYPES[e.type]; if (f) { const el = f(e, root); el.type = e.type; ELEM.list.push(el); } }
  updateElements(0);
}
function updateElements(dt) {
  ELEM.t += dt;
  for (const el of ELEM.list) if (el.update) el.update(ELEM.t, dt);
}
// floor zones: add forces / change friction (Z = { ax, az, fric, fricAdd, spin })
function elementZones(q, Z) { for (const el of ELEM.list) if (el.zone) el.zone(q, Z); }
function elementCollide() { for (const el of ELEM.list) if (el.collide) el.collide(); }
