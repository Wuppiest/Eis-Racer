// ============================================================
//  Eis-Racer – decoration sets for the different halls
//  every set: (D = shadow-casting acc, G = self-lit acc, root = scene group, theme)
//  rotating parts go into WORLD.spin and are animated by the game loop
// ============================================================
function meshOf(o, glow = false) { const m = new MeshAcc().addObj(o).build(glow ? GLOWMAT : VCMAT); m.castShadow = !glow; m.receiveShadow = !glow; return m; }
function spinner(root, obj, x, y, z, axis, speed, glowObj = null, ry = 0) {
  const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  const inner = new T.Group(); g.add(inner);
  inner.add(meshOf(obj)); if (glowObj) inner.add(meshOf(glowObj, true));
  root.add(g);
  WORLD.spin.push({ obj: inner, axis, speed });
  return g;
}
const rcol = (arr) => C(pick(arr));

// a simple low-poly car (parking garage, hangar)
function carObj(col) {
  const o = new Obj(), glass = C('#9fc4dc'), dark = C('#1d2029');
  o.box(1.8, 0.55, 4.1, 0, 0.55, 0, col, { jit: 0.02 });
  o.box(1.6, 0.5, 2.1, 0, 1.08, 0.2, col);
  o.box(1.62, 0.36, 1.9, 0, 1.08, 0.2, glass);
  o.box(1.7, 0.18, 0.1, 0, 0.6, -2.06, C('#d9d9d9'));
  for (const sx of [-0.6, 0.6]) { o.box(0.35, 0.16, 0.05, sx, 0.72, -2.06, C('#fff6c8')); o.box(0.35, 0.14, 0.05, sx, 0.72, 2.06, C('#e8322b')); }
  for (const [x, z] of [[-0.85, -1.3], [0.85, -1.3], [-0.85, 1.3], [0.85, 1.3]]) o.cyl(0.34, 0.24, x, 0.34, z, dark, { rz: PI / 2, seg: 10 });
  return o;
}
function crate(o, x, y, z, s, col) { o.box(s, s, s, x, y + s / 2, z, col, { jit: 0.05 }); o.box(s * 1.02, s * 0.12, s * 1.02, x, y + s * 0.5, z, C('#6b4a2a')); }

const DECOR = {
  arena: (D, G, root, theme) => decorArena(D, G, root, theme),

  // ---------------------------------------------------------------- neon night
  night(D, G, root) {
    const neon = WORLD.theme.neon.map(C);
    scatter(14, 0.8, (x, z, ry, k) => { // light pillars
      const o = new Obj(), g = new Obj(), H = R(3.5, 6);
      o.cyl(0.35, H, x, H / 2, z, C('#141826'), { seg: 8 });
      for (let y = 0.6; y < H; y += 0.9) g.cyl(0.38, 0.12, x, y, z, neon[k & 1], { seg: 8 });
      g.sph(0.3, x, H + 0.2, z, neon[(k + 1) & 1], { seg: 8 });
      D.addObj(o); G.addObj(g); hitBox(0.8, H, 0.8, x, H / 2, z);
    });
    scatter(8, 1.4, (x, z, ry) => { // speaker stacks
      const o = new Obj(), g = new Obj();
      for (let k = 0; k < 3; k++) {
        const y = 0.6 + k * 1.15;
        o.box(1.6, 1.1, 1.2, x, y, z, C('#0e1018'), { ry });
        const fx = x - Math.sin(ry) * 0.61, fz = z - Math.cos(ry) * 0.61;
        g.cyl(0.38, 0.04, fx, y, fz, neon[k & 1], { rx: PI / 2, ry, seg: 12 });
      }
      D.addObj(o); G.addObj(g); hitBox(1.6, 3.5, 1.4, x, 1.75, z, ry);
    });
    const dj = bigSpot(4);
    if (dj) {
      const [x, z] = dj, o = new Obj(), g = new Obj();
      o.box(6, 0.4, 4, x, 0.2, z, C('#1a1d2b'));
      o.box(4.2, 1.2, 1.4, x, 1.0, z, C('#0e1018'));
      g.box(4.3, 0.5, 0.05, x, 1.0, z - 0.73, neon[0]);
      g.box(4.3, 0.06, 1.42, x, 1.62, z, neon[1]);
      o.cyl(0.4, 0.08, x - 1.2, 1.65, z, C('#30343f'), { seg: 14 }); o.cyl(0.4, 0.08, x + 1.2, 1.65, z, C('#30343f'), { seg: 14 });
      D.addObj(o); G.addObj(g); hitBox(4.2, 1.7, 1.4, x, 0.85, z);
    }
    // disco ball
    const cx = (HALL.x0 + HALL.x1) / 2, cz = (HALL.z0 + HALL.z1) / 2;
    const b = new Obj(); b.ico(1.6, 0, 0, 0, C('#c9d2e6'), { d: 1, jit: 0.35 });
    const bg = new Obj(); bg.ico(0.5, 0, -1.4, 0, neon[1], { d: 0 });
    spinner(root, b, cx, HALL.h - 4, cz, 'y', 0.8, bg);
    const r = new Obj(); r.bar(new V3(cx, HALL.h - 2.4, cz), new V3(cx, HALL.h, cz), 0.05, PAL.black); D.addObj(r);
    hitBox(3.2, 3.2, 3.2, cx, HALL.h - 4, cz);
  },

  // ---------------------------------------------------------------- cold storage
  cold(D, G) {
    const rack = (x, z, ry, L) => {
      const o = new Obj(), up = C('#2a6fdb'), beam = C('#ff8a3d');
      // local frame: u along the rack, v depth
      const P = (u, v) => [x + Math.cos(ry) * u + Math.sin(ry) * v, z - Math.sin(ry) * u + Math.cos(ry) * v];
      for (let u = -L / 2; u <= L / 2 + 0.01; u += L / 3) for (const v of [-0.6, 0.6]) { const [px, pz] = P(u, v); o.box(0.12, 6, 0.12, px, 3, pz, up, { ry }); }
      for (const y of [0.15, 2.1, 4.1]) for (const v of [-0.6, 0.6]) { const [px, pz] = P(0, v); o.box(L, 0.14, 0.1, px, y, pz, beam, { ry }); }
      for (const y of [0.22, 2.17, 4.17]) for (let u = -L / 2 + 0.8; u < L / 2; u += 1.5) {
        if (rng() < 0.2) continue;
        const [px, pz] = P(u, 0), h = R(0.8, 1.6);
        o.box(1.2, 0.12, 1.1, px, y + 0.08, pz, C('#b98a52'), { ry });
        o.box(1.1, h, 1.0, px, y + 0.14 + h / 2, pz, rcol(['#e8ddc9', '#d9c7a5', '#ffffff', '#cfe3f2', '#c8a57a']), { ry, jit: 0.05 });
      }
      D.addObj(o); hitBox(L, 6, 1.4, x, 3, z, ry);
    };
    for (const [x, z, ry] of wallSpots(14, 2.2, 5)) rack(x, z, ry, 10);
    scatter(16, 1.4, (x, z) => { // ice block piles
      const o = new Obj();
      for (let k = 0; k < RI(2, 5); k++) o.box(R(0.8, 1.4), R(0.6, 1.1), R(0.8, 1.4), x + R(-0.7, 0.7), 0.4 + k * 0.45, z + R(-0.7, 0.7), C('#bfe6fa'), { ry: R(0, PI), jit: 0.08 });
      D.addObj(o); hitBox(2, 2, 2, x, 1, z);
    });
    scatter(24, 1, (x, z) => { const o = new Obj(); o.ico(R(0.6, 1.2), x, 0.1, z, C('#ffffff'), { sy: 0.45, d: 1, jit: 0.04 }); D.addObj(o); });
    scatter(5, 2.5, (x, z, ry) => { // cooling units with fans
      const o = new Obj();
      o.box(4, 2.4, 2, x, 1.2, z, C('#eef2f6'), { ry, jit: 0.02 });
      D.addObj(o); hitBox(4, 2.4, 2, x, 1.2, z, ry);
      for (const u of [-1, 1]) {
        const fo = new Obj(); for (let k = 0; k < 4; k++) fo.box(0.12, 0.75, 0.04, 0, 0.38, 0, C('#5d6f86'), { rz: k * PI / 2 });
        const fx = x + Math.cos(ry) * u, fz = z - Math.sin(ry) * u;
        spinner(WORLD.group, fo, fx, 2.43, fz, 'y', 9);
      }
    });
  },

  // ---------------------------------------------------------------- factory
  factory(D, G, root) {
    scatter(7, 3, (x, z, ry) => { // machines
      const o = new Obj(), g = new Obj(), w = R(3.5, 5.5), h = R(2.2, 3.6);
      o.box(w, h, 3, x, h / 2, z, rcol(['#5d6b52', '#4b5d73', '#7a6a55']), { ry, jit: 0.03 });
      o.box(w * 0.6, 0.5, 2.6, x, h + 0.25, z, C('#3a3f48'), { ry });
      o.cyl(0.25, 3, x + R(-1, 1), h + 1.5, z, C('#8a8f96'), { seg: 8 });
      g.box(0.9, 0.6, 0.05, x - Math.sin(ry) * 1.53, h * 0.6, z - Math.cos(ry) * 1.53, C('#4ff26a'), { ry });
      g.sph(0.15, x, h + 0.65, z, C('#ff5a3a'), { seg: 6 });
      D.addObj(o); G.addObj(g); hitBox(w, h + 0.5, 3, x, h / 2, z, ry);
    });
    scatter(5, 2.2, (x, z) => { // robot arms (turning)
      const base = new Obj(); base.cyl(0.9, 0.5, x, 0.25, z, C('#2c3a5c'), { seg: 10 }); D.addObj(base);
      const a = new Obj(), col = C('#ff8a3d');
      a.cyl(0.55, 0.6, 0, 0.3, 0, col, { seg: 10 });
      a.bar(new V3(0, 0.5, 0), new V3(0.4, 2.4, 0), 0.32, col);
      a.sph(0.28, 0.4, 2.4, 0, C('#2c3a5c'), { seg: 8 });
      a.bar(new V3(0.4, 2.4, 0), new V3(1.9, 2.0, 0), 0.24, col);
      a.box(0.3, 0.4, 0.5, 2.0, 1.85, 0, C('#2c3a5c'));
      spinner(root, a, x, 0.5, z, 'y', R(0.6, 1.4) * (rng() < 0.5 ? -1 : 1));
      hitBox(1.2, 2.8, 1.2, x, 1.4, z);
    });
    scatter(30, 0.8, (x, z) => { // crates and barrels
      const o = new Obj();
      if (rng() < 0.5) { crate(o, x, 0, z, R(0.8, 1.3), C('#c8a57a')); if (rng() < 0.4) crate(o, x + 0.1, 1.0, z, 0.8, C('#d9b98a')); }
      else for (let k = 0; k < RI(1, 3); k++) { const bx = x + (k - 1) * 0.65; o.cyl(0.3, 0.9, bx, 0.45, z, rcol(['#2a6fdb', '#e8322b', '#ffcc1f', '#2bb24a']), { seg: 10 }); o.cyl(0.31, 0.06, bx, 0.6, z, C('#3a3f48'), { seg: 10 }); }
      D.addObj(o); hitBox(1.4, 1.6, 1.4, x, 0.8, z);
    });
    const silo = bigSpot(4);
    if (silo) for (const [dx, dz] of [[0, 0], [3.2, 0.6]]) {
      const [x, z] = [silo[0] + dx, silo[1] + dz], o = new Obj(), H = HALL.h - 3;
      o.cyl(1.5, H, x, H / 2, z, C('#c9ced5'), { seg: 12, jit: 0.02 }); o.cone(1.5, 1.2, x, H + 0.6, z, C('#9097a1'), { seg: 12 });
      for (let y = 1.5; y < H; y += 2.5) o.cyl(1.53, 0.12, x, y, z, C('#ffcc1f'), { seg: 12 });
      D.addObj(o); hitBox(3, H, 3, x, H / 2, z);
    }
    // pipes along the long walls
    for (const zz of [HALL.z0 + 1.2, HALL.z1 - 1.2]) { const o = new Obj(); o.cyl(0.35, HALL.x1 - HALL.x0 - 4, (HALL.x0 + HALL.x1) / 2, HALL.h - 5.5, zz, C('#b9c3cf'), { rz: PI / 2, seg: 10 }); o.cyl(0.25, HALL.x1 - HALL.x0 - 4, (HALL.x0 + HALL.x1) / 2, HALL.h - 6.4, zz, C('#e8322b'), { rz: PI / 2, seg: 10 }); D.addObj(o); }
  },

  // ---------------------------------------------------------------- fun fair
  fair(D, G, root) {
    // ferris wheel
    const fw = bigSpot(11);
    if (fw) {
      const [x, z] = fw, R0 = 9, o = new Obj(), w = new Obj(), gl = new Obj();
      for (const sz of [-1.2, 1.2]) { o.bar(new V3(x - 4, 0, z + sz), new V3(x, R0 + 1.5, z + sz), 0.3, C('#e8edf2')); o.bar(new V3(x + 4, 0, z + sz), new V3(x, R0 + 1.5, z + sz), 0.3, C('#e8edf2')); }
      o.box(9, 0.3, 3.2, x, 0.15, z, C('#5a2a75'));
      D.addObj(o); hitBox(9, R0 + 2, 3, x, (R0 + 2) / 2, z);
      const N = 12, cols = ['#e8322b', '#ffcc1f', '#2a6fdb', '#2bb24a', '#ff8a3d', '#f45ba5'];
      for (const sz of [-0.9, 0.9]) w.torus(R0, 0.06, 0, 0, sz, C('#e8edf2'), { seg: 24 });
      for (let k = 0; k < N; k++) {
        const a = (k / N) * TAU, cx = Math.cos(a) * R0, cy = Math.sin(a) * R0;
        w.bar(new V3(0, 0, 0), new V3(cx, cy, 0.9), 0.08, C('#e8edf2')); w.bar(new V3(0, 0, 0), new V3(cx, cy, -0.9), 0.08, C('#e8edf2'));
        w.box(1.3, 1.1, 1.3, cx, cy - 0.9, 0, C(cols[k % cols.length]));
        gl.sph(0.14, cx, cy, 1.0, C('#fff2a8'), { seg: 5 });
      }
      w.cyl(0.6, 2.2, 0, 0, 0, C('#ffcc1f'), { rx: PI / 2, seg: 10 });
      spinner(root, w, x, R0 + 1.5, z, 'z', 0.25, gl);
    }
    // carousel
    const cs = bigSpot(6, (HALL.x0 + HALL.x1) / 2, (HALL.z0 + HALL.z1) / 2);
    if (cs) {
      const [x, z] = cs, o = new Obj(), top = new Obj(), gl = new Obj();
      o.cyl(5, 0.4, x, 0.2, z, C('#d8d0e8'), { seg: 16 }); o.cyl(0.5, 4.2, x, 2.3, z, C('#ffcc1f'), { seg: 10 });
      D.addObj(o); hitBox(10, 4.5, 10, x, 2.25, z);
      top.cone(5.6, 1.8, 0, 4.6, 0, C('#e8322b'), { seg: 16 });
      for (let k = 0; k < 16; k += 2) top.box(0.6, 1.0, 0.1, Math.cos(k / 16 * TAU) * 5.3, 3.8, Math.sin(k / 16 * TAU) * 5.3, C('#ffffff'), { ry: -k / 16 * TAU + PI / 2 });
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * TAU, px = Math.cos(a) * 3.6, pz = Math.sin(a) * 3.6;
        top.cyl(0.06, 3.6, px, 2.2, pz, C('#e8edf2'), { seg: 5 });
        top.box(0.45, 0.8, 1.4, px, 1.3, pz, C(['#ffffff', '#ffcc1f', '#8be9ff', '#f45ba5'][k % 4]), { ry: -a });
        top.box(0.3, 0.5, 0.35, px, 1.7, pz - 0.6 * Math.cos(a), C('#6b4a2a'), { ry: -a });
      }
      for (let k = 0; k < 24; k++) gl.sph(0.12, Math.cos(k / 24 * TAU) * 5.5, 3.75, Math.sin(k / 24 * TAU) * 5.5, C('#fff2a8'), { seg: 4 });
      spinner(root, top, x, 0.4, z, 'y', 0.5, gl);
    }
    scatter(6, 2.4, (x, z, ry, k) => { // food stands
      const o = new Obj(), g = new Obj(), c = C(['#e8322b', '#2a6fdb', '#2bb24a', '#ff8a3d'][k % 4]);
      o.box(3.4, 1.1, 2, x, 0.55, z, C('#f3e6cf'), { ry }); o.box(3.6, 0.1, 2.2, x, 1.15, z, C('#a5714a'), { ry });
      for (const u of [-1.6, 1.6]) o.box(0.1, 2.4, 0.1, x + Math.cos(ry) * u, 1.2, z - Math.sin(ry) * u, PAL.white, { ry });
      for (let s2 = -3; s2 <= 3; s2++) o.box(0.52, 0.14, 2.6, x + Math.cos(ry) * s2 * 0.52, 2.45, z - Math.sin(ry) * s2 * 0.52, (s2 & 1) ? c : PAL.white, { ry, rx: 0.15 });
      for (let s2 = -3; s2 <= 3; s2 += 1) g.sph(0.08, x + Math.cos(ry) * s2 * 0.5, 2.3, z - Math.sin(ry) * s2 * 0.5, C('#fff2a8'), { seg: 4 });
      D.addObj(o); G.addObj(g); hitBox(3.6, 2.6, 2.4, x, 1.3, z, ry);
    });
    scatter(12, 0.6, (x, z) => { // balloon bunches
      const o = new Obj();
      for (let k = 0; k < 5; k++) { const bx = x + R(-0.5, 0.5), bz = z + R(-0.5, 0.5), by = R(2.8, 3.6); o.sph(0.32, bx, by, bz, rcol(['#e8322b', '#ffcc1f', '#2a6fdb', '#2bb24a', '#f45ba5']), { sy: 1.2, seg: 7 }); o.bar(new V3(x, 0.9, z), new V3(bx, by - 0.4, bz), 0.015, PAL.white); }
      o.box(0.3, 0.9, 0.3, x, 0.45, z, C('#a5714a'));
      D.addObj(o);
    });
  },

  // ---------------------------------------------------------------- airplane hangar
  hangar(D, G, root) {
    const ps = bigSpot(17);
    if (ps) {
      const [x, z] = ps, o = new Obj(), g = new Obj(), body = C('#f3f4f6'), blue = C('#2a6fdb');
      const L = 26, y = 3.6;
      o.cyl(1.9, L, x, y, z, body, { rz: PI / 2, seg: 12, jit: 0.02 });
      o.cone(1.9, 4, x - L / 2 - 2, y, z, body, { rz: PI / 2, seg: 12 });
      o.cone(1.9, 6, x + L / 2 + 3, y + 0.4, z, body, { rz: -PI / 2, seg: 12, sy: 1 });
      o.box(L * 0.95, 0.6, 3.82, x, y - 0.3, z, blue);
      o.box(4.5, 0.35, 30, x + 1, y - 0.6, z, body, { jit: 0.02 }); // wings
      o.box(2.2, 4.6, 0.3, x + L / 2 + 3.2, y + 3.2, z, blue, { rz: -0.35 }); // tail fin
      o.box(2.4, 0.25, 10, x + L / 2 + 3.6, y + 0.9, z, body);
      for (const sz of [-6.5, 6.5]) { o.cyl(1.0, 3.6, x, y - 1.6, z + sz, C('#c9ced5'), { rz: PI / 2, seg: 10 }); o.cyl(0.7, 0.2, x - 1.85, y - 1.6, z + sz, C('#1d2029'), { rz: PI / 2, seg: 10 }); }
      for (const [dx, dz] of [[-9, 0], [2, -2.5], [2, 2.5]]) { o.cyl(0.12, y - 1.6, x + dx, (y - 1.6) / 2, z + dz, C('#8a8f96'), { seg: 6 }); o.cyl(0.5, 0.4, x + dx, 0.5, z + dz, C('#1d2029'), { rz: PI / 2, seg: 10 }); }
      for (let k = -10; k <= 8; k += 2) g.box(0.9, 0.6, 0.05, x + k, y + 0.7, z - 1.86, C('#bfe6ff'));
      for (let k = -10; k <= 8; k += 2) g.box(0.9, 0.6, 0.05, x + k, y + 0.7, z + 1.86, C('#bfe6ff'));
      D.addObj(o); G.addObj(g);
      hitBox(L + 8, 4.2, 4, x, y, z); hitBox(4.5, 0.6, 30, x + 1, y - 0.6, z); hitBox(3, 5, 1, x + L / 2 + 3.2, y + 3, z);
    }
    scatter(9, 3.4, (x, z, ry) => { // cargo containers
      const o = new Obj(), c = rcol(['#e8322b', '#2a6fdb', '#2bb24a', '#ff8a3d', '#8a8f96']);
      o.box(6, 2.6, 2.4, x, 1.3, z, c, { ry, jit: 0.03 });
      for (let u = -2.7; u <= 2.7; u += 0.45) o.box(0.08, 2.5, 2.44, x + Math.cos(ry) * u, 1.3, z - Math.sin(ry) * u, c.clone().multiplyScalar(0.85), { ry });
      D.addObj(o); hitBox(6, 2.6, 2.4, x, 1.3, z, ry);
    });
    scatter(8, 1.2, (x, z, ry) => { // tool carts
      const o = new Obj(); o.box(1.2, 0.9, 0.7, x, 0.6, z, C('#e8322b'), { ry }); for (let k = 0; k < 3; k++) o.box(1.15, 0.03, 0.65, x, 0.35 + k * 0.28, z, C('#2a2f3a'), { ry });
      D.addObj(o);
    });
  },

  // ---------------------------------------------------------------- parking garage
  garage(D, G) {
    const cols = ['#e8322b', '#2a6fdb', '#f3f4f6', '#1d2029', '#ffcc1f', '#8a8f96', '#2bb24a', '#a24bd8'];
    for (const [x, z, ry] of wallSpots(3.2, 3.2, 2.2)) { if (rng() < 0.3) continue; D.addObj(carObj(C(pick(cols))), matAt(x, 0, z, ry + PI)); hitBox(1.9, 1.5, 4.2, x, 0.75, z, ry); }
    scatter(14, 2.2, (x, z, ry) => { D.addObj(carObj(C(pick(cols))), matAt(x, 0, z, ry)); hitBox(1.9, 1.5, 4.2, x, 0.75, z, ry); });
    // concrete column grid (good hook targets)
    for (let x = HALL.x0 + 12; x < HALL.x1 - 6; x += 12) for (let z = HALL.z0 + 12; z < HALL.z1 - 6; z += 12) {
      if (!freeAt(x, z, 0.9)) continue;
      DECO_USED.push({ x, z, r: 0.9 });
      const o = new Obj(); o.box(0.9, HALL.h, 0.9, x, HALL.h / 2, z, C('#b0b3b8'), { jit: 0.02 });
      o.box(0.94, 0.9, 0.94, x, 0.45, z, C('#ffcc1f')); o.box(0.95, 0.25, 0.95, x, 0.6, z, C('#1d2029'));
      D.addObj(o); hitBox(0.9, HALL.h, 0.9, x, HALL.h / 2, z);
    }
    scatter(4, 0.8, (x, z, ry) => { const o = new Obj(), g = new Obj(); o.box(0.8, 1.7, 0.6, x, 0.85, z, C('#2a6fdb'), { ry }); g.box(0.5, 0.35, 0.05, x - Math.sin(ry) * 0.31, 1.3, z - Math.cos(ry) * 0.31, C('#8be9ff'), { ry }); D.addObj(o); G.addObj(g); hitBox(0.8, 1.7, 0.6, x, 0.85, z, ry); });
  },

  // ---------------------------------------------------------------- gym
  gym(D, G) {
    for (const [x, z, ry] of wallSpots(6, 0.8, 1.6)) { // wall bars
      const o = new Obj(), wood = C('#d9a65f');
      for (const u of [-1.2, 1.2]) o.box(0.12, 3, 0.12, x + Math.cos(ry) * u, 1.5, z - Math.sin(ry) * u, wood, { ry });
      for (let y = 0.3; y < 3; y += 0.3) o.cyl(0.035, 2.4, x, y, z, wood, { rz: PI / 2, ry, seg: 5 });
      D.addObj(o);
    }
    const hoop = (x, z, ry) => {
      const o = new Obj();
      o.box(1.8, 1.1, 0.06, x, 4.2, z, C('#ffffff'), { ry }); o.box(0.6, 0.45, 0.07, x, 3.95, z, C('#e8322b'), { ry });
      const fx = x - Math.sin(ry) * 0.55, fz = z - Math.cos(ry) * 0.55;
      o.torus(0.24, 0.12, fx, 3.65, fz, C('#ff6a1a'), { rx: PI / 2, seg: 10 });
      D.addObj(o); hitBox(1.8, 1.2, 0.6, x, 4.1, z, ry);
    };
    hoop((HALL.x0 + HALL.x1) / 2, HALL.z0 + 0.6, 0); hoop((HALL.x0 + HALL.x1) / 2, HALL.z1 - 0.6, PI);
    hoop(HALL.x0 + 0.6, (HALL.z0 + HALL.z1) / 2, -PI / 2); hoop(HALL.x1 - 0.6, (HALL.z0 + HALL.z1) / 2, PI / 2);
    scatter(4, 1.6, (x, z, ry) => { // vaulting boxes
      const o = new Obj();
      for (let k = 0; k < 4; k++) o.box(1.6 - k * 0.08, 0.3, 0.9 - k * 0.04, x, 0.15 + k * 0.3, z, C('#d9a65f'), { ry, jit: 0.03 });
      o.box(1.35, 0.14, 0.75, x, 1.27, z, C('#f3e6cf'), { ry });
      D.addObj(o); hitBox(1.6, 1.35, 0.9, x, 0.67, z, ry);
    });
    scatter(8, 1.6, (x, z, ry) => { // benches
      const o = new Obj(); o.box(3, 0.08, 0.3, x, 0.42, z, C('#d9a65f'), { ry }); for (const u of [-1.2, 1.2]) o.box(0.08, 0.4, 0.35, x + Math.cos(ry) * u, 0.2, z - Math.sin(ry) * u, C('#a5714a'), { ry });
      D.addObj(o);
    });
    scatter(6, 1.4, (x, z, ry) => { // mat piles
      const o = new Obj(); for (let k = 0; k < RI(2, 5); k++) o.box(2.4, 0.25, 1.4, x, 0.13 + k * 0.26, z, k & 1 ? C('#2a6fdb') : C('#1f5fd0'), { ry: ry + R(-0.1, 0.1) });
      D.addObj(o); hitBox(2.4, 1.2, 1.4, x, 0.6, z, ry);
    });
    scatter(20, 0.5, (x, z) => { const o = new Obj(); const r = R(0.22, 0.4); o.sph(r, x, r, z, rcol(['#ff6a1a', '#e8322b', '#2a6fdb', '#ffcc1f', '#f3f4f6']), { seg: 9 }); D.addObj(o); });
  },

  // ---------------------------------------------------------------- pinball
  pinball(D, G) {
    const neon = WORLD.theme.neon.map(C);
    scatter(8, 1.6, (x, z) => { const o = new Obj(); o.sph(1.4, x, 1.4, z, C('#d7dde8'), { seg: 12, jit: 0.12 }); D.addObj(o); hitBox(2.6, 2.8, 2.6, x, 1.4, z); });
    scatter(12, 1.2, (x, z, ry, k) => { // drop targets
      const o = new Obj(), g = new Obj();
      for (let u = -1; u <= 1; u++) { o.box(0.8, 1.3, 0.25, x + Math.cos(ry) * u * 0.9, 0.65, z - Math.sin(ry) * u * 0.9, C(['#ff3bd4', '#ffcc1f', '#29e6ff'][(k + u + 3) % 3]), { ry }); }
      g.box(2.8, 0.08, 0.3, x, 0.04, z, neon[k & 1], { ry });
      D.addObj(o); G.addObj(g); hitBox(2.8, 1.3, 0.4, x, 0.65, z, ry);
    });
    scatter(16, 0.9, (x, z, ry, k) => { // glowing floor arrows
      const g = new Obj();
      const a = new V3(x + Math.sin(ry) * 0.9, 0.02, z + Math.cos(ry) * 0.9), b = new V3(x - Math.cos(ry) * 0.7, 0.02, z + Math.sin(ry) * 0.7), c = new V3(x + Math.cos(ry) * 0.7, 0.02, z - Math.sin(ry) * 0.7);
      G.tri(a, b, c, neon[k & 1], 0, UP);
    });
    scatter(6, 1, (x, z, ry, k) => { // light columns
      const o = new Obj(), g = new Obj(), H = 5;
      o.cyl(0.4, H, x, H / 2, z, C('#140f30'), { seg: 8 });
      for (let y = 0.5; y < H; y += 0.5) g.cyl(0.42, 0.18, x, y, z, ((y * 2 + k) & 1) ? neon[0] : neon[1], { seg: 8 });
      D.addObj(o); G.addObj(g); hitBox(0.8, H, 0.8, x, H / 2, z);
    });
  },

  // ---------------------------------------------------------------- ice stadium
  rink(D, G, root) {
    // bleachers on the long walls, where there is space
    const bleach = (z0, dir) => {
      for (let x = HALL.x0 + 10; x < HALL.x1 - 10; x += 24) {
        const xs = x, xe = x + 20;
        let ok = true; for (let t = xs; t <= xe; t += 2) if (!clearOfTrack(t, z0 + dir * 4.5, 1)) ok = false;
        if (!ok) continue;
        const o = new Obj();
        for (let r = 0; r < 4; r++) {
          const z = z0 + dir * (4 - r), y = 0.45 * (r + 1);
          o.box(xe - xs, y, 1.0, (xs + xe) / 2, y / 2, z, r & 1 ? C('#c6ccd4') : C('#d3d8df'));
          for (let px = xs + 0.6; px < xe; px += 0.75) o.box(0.5, 0.12, 0.45, px, y + 0.06, z, r & 1 ? C('#1f4fa0') : C('#e8322b'));
          for (let px = xs + 1; px < xe - 0.5; px += R(0.9, 2.4)) {
            if (rng() < 0.35) continue;
            const sh = rcol(['#e8322b', '#2a6fdb', '#ffcc1f', '#ffffff', '#1d2029']);
            o.box(0.42, 0.55, 0.26, px, y + 0.67, z, sh); o.box(0.26, 0.28, 0.26, px, y + 1.1, z, rcol(['#f1c7a3', '#d9a27a', '#a8714f', '#6e4a33']));
            o.box(0.28, 0.12, 0.28, px, y + 1.27, z, rcol(['#e8322b', '#2a6fdb', '#ffffff'])); // beanies
          }
        }
        D.addObj(o); hitBox(xe - xs, 2.8, 4.5, (xs + xe) / 2, 1.4, z0 + dir * 2.2);
        DECO_USED.push({ x: (xs + xe) / 2, z: z0 + dir * 2.2, r: 10 });
      }
    };
    bleach(HALL.z0 + 0.5, 1); bleach(HALL.z1 - 0.5, -1);
    const goal = (x, z, ry) => {
      const o = new Obj(), red = C('#e8322b'), net = C('#f3f4f6');
      const P = (u, v) => [x + Math.cos(ry) * u + Math.sin(ry) * v, z - Math.sin(ry) * u + Math.cos(ry) * v];
      for (const u of [-0.9, 0.9]) { const [px, pz] = P(u, 0); o.cyl(0.05, 1.2, px, 0.6, pz, red, { seg: 6 }); }
      { const [px, pz] = P(0, 0); o.box(1.8, 0.1, 0.1, px, 1.2, pz, red, { ry }); }
      { const [px, pz] = P(0, 0.55); o.box(1.8, 1.15, 0.04, px, 0.58, pz, net, { ry }); o.box(1.8, 0.04, 1.1, px, 1.18, P(0, 0.0)[1] + (pz - P(0, 0)[1]) / 2, net, { ry }); }
      D.addObj(o); hitBox(1.9, 1.2, 1.1, x, 0.6, z, ry);
    };
    const g1 = spot(1.6), g2 = spot(1.6);
    if (g1) goal(g1[0], g1[1], R(0, TAU)); if (g2) goal(g2[0], g2[1], R(0, TAU));
    const zb = spot(2.2);
    if (zb) { // ice resurfacer
      const [x, z] = zb, ry = R(0, TAU), o = new Obj();
      o.box(1.8, 1.4, 3.6, x, 1.0, z, C('#f3f4f6'), { ry }); o.box(1.82, 0.4, 3.62, x, 0.5, z, C('#2a6fdb'), { ry }); o.box(1.4, 0.8, 1.1, x, 2.1, z, C('#bfe6ff'), { ry });
      D.addObj(o); hitBox(1.8, 2.4, 3.6, x, 1.2, z, ry);
    }
    // hanging scoreboard cube (turning slowly)
    const cx = (HALL.x0 + HALL.x1) / 2, cz = (HALL.z0 + HALL.z1) / 2;
    const cube = new Obj(), scr = new Obj();
    cube.box(6, 3.4, 6, 0, 0, 0, C('#1d2029'));
    for (let k = 0; k < 4; k++) { const a = k * PI / 2; scr.box(5.2, 2.6, 0.05, Math.sin(a) * 3.03, 0, Math.cos(a) * 3.03, k & 1 ? C('#8be9ff') : C('#ffcc1f'), { ry: a }); }
    spinner(root, cube, cx, HALL.h - 5, cz, 'y', 0.15, scr);
    hitBox(6, 3.4, 6, cx, HALL.h - 5, cz);
    scatter(10, 0.4, (x, z) => { const o = new Obj(); o.cyl(0.04, 1.4, x, 0.7, z, C('#6b4a2a'), { rz: R(-1.2, 1.2), seg: 4 }); o.cyl(0.04, 0.4, x, 0.06, z, C('#1d2029'), { rz: PI / 2, seg: 4 }); D.addObj(o); });
  },
};
