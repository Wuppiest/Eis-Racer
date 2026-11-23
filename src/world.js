// ============================================================
//  Eis-Racer – the go-kart hall: building, track, bridge, barriers, decoration
//  + invisible grapple proxies (everything you see can be hooked)
// ============================================================
const C = (h) => new T.Color(h);
const PAL = {
  floor1: C('#a7aeb6'), floor2: C('#9fa6ae'), floorLine: C('#f2c200'),
  asphalt: C('#3c404a'), white: C('#f3f4f6'), red: C('#e8322b'), blue: C('#2a6fdb'), yellow: C('#ffcc1f'),
  tire: C('#24262c'), tireHole: C('#111216'),
  concrete: C('#c9ced5'), concreteDark: C('#9097a1'), under: C('#7f8690'),
  wallLow: C('#e3e6eb'), wallUp: C('#6f92b8'), wallRib: C('#62849f'), kick: C('#3a404c'),
  column: C('#2c3a5c'), truss: C('#a9b3c2'), purlin: C('#8b95a6'), ceiling: C('#4b5567'),
  lampHouse: C('#2f3542'), lamp: C('#fff8e6'), window: C('#d6ebff'), sky: C('#e6f3ff'),
  steel: C('#b3bdc9'), black: C('#1d2029'),
};
const WHITE = C('#ffffff');

const WORLD = { hit: [], anchors: [], lights: [], start: null, flags: [] };

// ---------- grapple proxies, chunked so the raycaster can skip far cells ----------
const HIT_CELL = 36;
const hitCells = new Map();
const hitGlobal = new MeshAcc();
function hitAccAt(x, z) {
  const k = Math.floor(x / HIT_CELL) + ',' + Math.floor(z / HIT_CELL);
  let a = hitCells.get(k);
  if (!a) { a = new MeshAcc(); hitCells.set(k, a); }
  return a;
}
function hitBox(w, h, d, x, y, z, ry = 0, acc = null) {
  const m = new T.Matrix4().compose(new V3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new V3(w, h, d));
  (acc || hitAccAt(x, z)).add(geoBox(), m, WHITE);
}
// oriented box between two points on the floor plane
function segRy(ax, az, bx, bz) { return Math.atan2(-(bz - az), bx - ax); }
function segBox(obj, ax, az, bx, bz, y, th, h, color, o = {}) {
  const L = Math.hypot(bx - ax, bz - az) + (o.ext || 0);
  obj.box(L, h, th, (ax + bx) / 2, y, (az + bz) / 2, color, { ry: segRy(ax, az, bx, bz), jit: o.jit || 0 });
}
function hitSeg(ax, az, bx, bz, y, th, h) {
  hitBox(Math.hypot(bx - ax, bz - az) + 0.2, h, th, (ax + bx) / 2, y, (az + bz) / 2, segRy(ax, az, bx, bz));
}
// point on the track: sample + lateral offset
const tp = (s, lat, y) => new V3(s.x + s.nx * lat, y, s.z + s.nz * lat);

// is (x,z) free of every piece of track (with margin r)? optional height window for the track pieces
function clearOfTrack(x, z, r, maxH = 99) {
  for (let i = 0; i < NS; i += 2) {
    const s = TS[i];
    if (s.h > maxH) continue;
    const dx = x - s.x, dz = z - s.z, lim = HW + 1.4 + r;
    if (dx * dx + dz * dz < lim * lim) return false;
  }
  return true;
}
const insideHall = (x, z, m) => x > HALL.x0 + m && x < HALL.x1 - m && z > HALL.z0 + m && z < HALL.z1 - m;

// ---------- sign textures ----------
function drawSign(g, w, h, o) {
  g.fillStyle = o.bg; g.fillRect(0, 0, w, h);
  if (o.stripe) { g.fillStyle = o.stripe; g.fillRect(0, h * 0.82, w, h * 0.18); }
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = h * 0.06; g.strokeRect(h * 0.03, h * 0.03, w - h * 0.06, h - h * 0.06); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (o.icon) { g.font = `${h * 0.55}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.fillText(o.icon, h * 0.55, h * (o.stripe ? 0.43 : 0.5)); }
  g.fillStyle = o.fg;
  const x0 = o.icon ? h * 1.05 : h * 0.2;
  const cx = (x0 + w - h * 0.2) / 2;
  if (o.italic) { g.save(); g.translate(cx, 0); g.transform(1, 0, -0.18, 1, 0, 0); g.translate(-cx, 0); }
  fitText(g, o.text, cx, h * (o.sub ? 0.36 : (o.stripe ? 0.43 : 0.5)), w - x0 - h * 0.2, h * (o.sub ? 0.5 : 0.62));
  if (o.italic) g.restore();
  if (o.sub) { g.globalAlpha = 0.85; fitText(g, o.sub, cx, h * 0.72, w - x0 - h * 0.2, h * 0.2, 800); g.globalAlpha = 1; }
}
const SPONSORS = [
  { text: 'FROSTY KART', sub: 'Leihkarts ab 9,90 €', bg: '#1f6fe0', fg: '#ffffff', stripe: '#ffcc1f', icon: '🏎️' },
  { text: 'PINGUIN PIZZA', sub: 'heiß auf Eis', bg: '#ffffff', fg: '#e8322b', stripe: '#e8322b', icon: '🍕' },
  { text: 'GLETSCHER-GRILL', bg: '#2b2f3a', fg: '#ffcc1f', stripe: '#e8322b', icon: '🌭' },
  { text: 'POLARSTERN', sub: 'Energy Drink', bg: '#12c7c0', fg: '#0b2540', icon: '⭐' },
  { text: 'KUFE & KO', sub: 'Schlittschuh-Service', bg: '#ff8a3d', fg: '#ffffff', stripe: '#ffffff', icon: '⛸️' },
  { text: 'EISZEIT', sub: 'Softeis · Slush · Shakes', bg: '#ffe066', fg: '#2b2f3a', stripe: '#3d8bff', icon: '🍦' },
  { text: 'HAKEN-HANNES', sub: 'Seile & Haken seit 1987', bg: '#ffffff', fg: '#1f2a44', stripe: '#ffcc1f', icon: '🪝' },
  { text: 'SCHOLLE24', sub: 'Eisschollen-Verleih', bg: '#3d8bff', fg: '#ffffff', stripe: '#8be9ff', icon: '🧊' },
];

// ============================================================
function buildWorld(scene) {
  const S = new MeshAcc();    // static hall shell: receives shadows only
  const D = new MeshAcc();    // track, barriers, decoration: casts shadows
  const G = new MeshAcc();    // self-lit (lamps, windows)
  rng = mulberry32(42);

  buildFloor(S);
  buildHall(S, D, G);
  buildTrack(D);
  buildBarriers(D);
  buildBridgeSupports(D);
  buildGantry(D, scene);
  buildDecor(D, G, scene);
  buildAnchors(D, G);

  const ms = S.build(VCMAT); ms.receiveShadow = true; scene.add(ms);
  const md = D.build(VCMAT); md.receiveShadow = true; md.castShadow = true; scene.add(md);
  const mg = G.build(GLOWMAT); scene.add(mg);
  buildSigns(scene);

  // grapple proxies (not rendered)
  const HITMAT = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const mk = (acc) => { const m = new T.Mesh(acc.geometry(), HITMAT); m.updateMatrixWorld(true); WORLD.hit.push(m); };
  mk(hitGlobal);
  for (const acc of hitCells.values()) if (acc.count) mk(acc);

  // start: 12 m before the line, on the centerline
  const si = NS - Math.round(12 / DS), s = TS[si];
  WORLD.start = { x: s.x, z: s.z, idx: si, yaw: Math.atan2(-s.tx, -s.tz) };
}

// ---------- floor: big epoxy tiles + painted walkways ----------
function buildFloor(S) {
  const t = 4;
  for (let x = HALL.x0; x < HALL.x1; x += t) for (let z = HALL.z0; z < HALL.z1; z += t) {
    const c = ((x + z) / t) & 1 ? PAL.floor1 : PAL.floor2;
    S.quad(new V3(x, 0, z), new V3(x + t, 0, z), new V3(x + t, 0, z + t), new V3(x, 0, z + t), c, 0.02, UP);
  }
  // yellow safety lines 2.5 m off the walls
  const y = 0.012, m = 2.5, w = 0.18;
  const line = (ax, az, bx, bz) => { const o = new Obj(); segBox(o, ax, az, bx, bz, y - 0.004, w, 0.008, PAL.floorLine); S.addObj(o); };
  line(HALL.x0 + m, HALL.z0 + m, HALL.x1 - m, HALL.z0 + m); line(HALL.x0 + m, HALL.z1 - m, HALL.x1 - m, HALL.z1 - m);
  line(HALL.x0 + m, HALL.z0 + m, HALL.x0 + m, HALL.z1 - m); line(HALL.x1 - m, HALL.z0 + m, HALL.x1 - m, HALL.z1 - m);
  hitBox(HALL.x1 - HALL.x0, 0.2, HALL.z1 - HALL.z0, 0, -0.1, 0, 0, hitGlobal);
}
const UP = new V3(0, 1, 0), DOWN = new V3(0, -1, 0);

// ---------- hall: walls, columns, windows, roof trusses, lamps ----------
function buildHall(S, D, G) {
  const H = HALL.h;
  const walls = [
    { a: [HALL.x0, HALL.z0], b: [HALL.x1, HALL.z0], n: [0, 1] },
    { a: [HALL.x1, HALL.z1], b: [HALL.x0, HALL.z1], n: [0, -1] },
    { a: [HALL.x0, HALL.z1], b: [HALL.x0, HALL.z0], n: [1, 0] },
    { a: [HALL.x1, HALL.z0], b: [HALL.x1, HALL.z1], n: [-1, 0] },
  ];
  for (const w of walls) {
    const [ax, az] = w.a, [bx, bz] = w.b, [nx, nz] = w.n;
    const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
    const o = new Obj();
    const off = (k) => [ax + dx * k - nx * 0.25, az + dz * k - nz * 0.25];
    const full = (y0, y1, c, inset = 0, jit = 0) => {
      const p0 = [ax - nx * (0.25 - inset), az - nz * (0.25 - inset)], p1 = [bx - nx * (0.25 - inset), bz - nz * (0.25 - inset)];
      segBox(o, p0[0], p0[1], p1[0], p1[1], (y0 + y1) / 2, 0.5, y1 - y0, c, { jit });
    };
    full(0, 0.35, PAL.kick, 0.03);
    full(0.35, 2.9, PAL.wallLow, 0, 0.015);
    full(2.9, 3.5, PAL.blue, 0.02);
    full(3.5, H, PAL.wallUp, 0, 0.02);
    // corrugation ribs (skip the window band)
    for (let k = 0.6; k < L; k += 1.2) {
      const [px, pz] = off(k);
      const rx = px + nx * 0.3, rz = pz + nz * 0.3;
      for (const [y0, y1] of [[3.5, 10.6], [13.4, H]]) o.box(0.3, y1 - y0, 0.3, rx, (y0 + y1) / 2, rz, PAL.wallRib, { ry: segRy(0, 0, dx, dz) });
    }
    S.addObj(o);
    // windows (self-lit) between the columns
    for (let k = 3; k + 3 <= L; k += 4) {
      const [px, pz] = off(k + 2);
      const g = new Obj(); g.box(3.3, 2.5, 0.1, px + nx * 0.3, 12, pz + nz * 0.3, PAL.window, { ry: segRy(0, 0, dx, dz) });
      G.addObj(g);
    }
    // columns every 12 m
    for (let k = 12; k < L - 6; k += 12) {
      const [px, pz] = off(k);
      const c = new Obj(), ry = segRy(0, 0, dx, dz);
      const cx = px + nx * 0.55, cz = pz + nz * 0.55;
      c.box(0.9, H, 0.12, cx + nx * 0.35, H / 2, cz + nz * 0.35, PAL.column, { ry });
      c.box(0.9, H, 0.12, cx - nx * 0.25, H / 2, cz - nz * 0.25, PAL.column, { ry });
      c.box(0.14, H, 0.6, cx + nx * 0.05, H / 2, cz + nz * 0.05, PAL.column, { ry });
      c.box(1.1, 0.4, 0.9, cx + nx * 0.05, 0.2, cz + nz * 0.05, PAL.yellow, { ry });
      D.addObj(c);
      hitBox(0.9, H, 0.9, cx, H / 2, cz, ry);
    }
    hitBox(Math.abs(dx) > 0.5 ? L : 1, H, Math.abs(dz) > 0.5 ? L : 1, (ax + bx) / 2 - nx * 0.5, H / 2, (az + bz) / 2 - nz * 0.5, 0, hitGlobal);
  }
  // ceiling
  {
    const o = new Obj(); o.box(HALL.x1 - HALL.x0, 0.3, HALL.z1 - HALL.z0, 0, H + 0.15, 0, PAL.ceiling); S.addObj(o);
    hitBox(HALL.x1 - HALL.x0, 0.3, HALL.z1 - HALL.z0, 0, H + 0.15, 0, 0, hitGlobal);
  }
  // skylights between trusses
  for (let x = HALL.x0 + 18; x < HALL.x1 - 6; x += 24) for (const z of [-42, 0, 42]) {
    const g = new Obj(); g.box(6, 0.1, 16, x, H - 0.02, z, PAL.sky); G.addObj(g);
  }
  // trusses (span along z) every 12 m
  const yb = 14.2, yt = H - 0.4;
  for (let x = HALL.x0 + 12; x < HALL.x1 - 1; x += 12) {
    const o = new Obj();
    o.box(0.35, 0.35, HALL.z1 - HALL.z0, x, yb, 0, PAL.truss);
    o.box(0.35, 0.35, HALL.z1 - HALL.z0, x, yt, 0, PAL.truss);
    let up = true;
    for (let z = HALL.z0; z < HALL.z1 - 0.1; z += 3.5) {
      o.bar(new V3(x, yb, z), new V3(x, yt, z), 0.16, PAL.truss);
      o.bar(new V3(x, up ? yb : yt, z), new V3(x, up ? yt : yb, z + 3.5), 0.14, PAL.truss);
      up = !up;
    }
    S.addObj(o);
    for (let z = HALL.z0; z < HALL.z1; z += 35) hitBox(0.6, 0.6, 35, x, yb, z + 17.5);
    // hanging lamps
    for (let z = HALL.z0 + 7; z < HALL.z1 - 3; z += 9) {
      const l = new Obj();
      l.box(2.8, 0.2, 0.55, x, yb - 0.45, z, PAL.lampHouse);
      l.bar(new V3(x - 1.1, yb - 0.35, z), new V3(x - 1.1, yb - 0.15, z), 0.04, PAL.black);
      l.bar(new V3(x + 1.1, yb - 0.35, z), new V3(x + 1.1, yb - 0.15, z), 0.04, PAL.black);
      S.addObj(l);
      const g = new Obj(); g.box(2.55, 0.06, 0.4, x, yb - 0.57, z, PAL.lamp); G.addObj(g);
    }
  }
  // purlins along x
  for (let z = HALL.z0 + 7; z < HALL.z1; z += 7) { const o = new Obj(); o.box(HALL.x1 - HALL.x0, 0.25, 0.2, 0, H - 0.15, z, PAL.purlin); S.addObj(o); }
}

// ---------- track surface: asphalt ribbon, kerbs, start/finish, deck sides ----------
let KERB = null;
function buildTrack(D) {
  // kerbs on curved parts (spread a bit so they start before the corner)
  KERB = new Uint8Array(NS);
  for (let i = 0; i < NS; i++) if (Math.abs(TS[i].k) > 1 / 34) for (let d = -8; d <= 8; d++) KERB[((i + d) % NS + NS) % NS] = 1;
  const ew = (i) => (KERB[i] ? 1.1 : 0.32);
  const yS = (s) => s.h + 0.03;
  for (let i = 0; i < NS; i++) {
    const a = TS[i], b = tsAt(i + 1), ib = (i + 1) % NS;
    const ya = yS(a), yb = yS(b);
    const la = [-HW, -HW + ew(i), HW - ew(i), HW], lb = [-HW, -HW + ew(ib), HW - ew(ib), HW];
    const edge = KERB[i] ? ((Math.floor(i / 3) & 1) ? PAL.red : PAL.white) : PAL.white;
    const cols = [edge, PAL.asphalt, edge];
    for (let k = 0; k < 3; k++) {
      D.quad(tp(a, la[k], ya), tp(a, la[k + 1], ya), tp(b, lb[k + 1], yb), tp(b, lb[k], yb), cols[k], k === 1 ? 0.035 : 0, UP);
    }
    if (a.h > 0.04 || b.h > 0.04) {
      // deck shoulder up to the barrier, slab sides + underside
      const W2 = HW + 0.7, bot = (s) => Math.max(0, s.h - 0.8);
      for (const sd of [-1, 1]) {
        D.quad(tp(a, sd * HW, ya), tp(a, sd * W2, ya), tp(b, sd * W2, yb), tp(b, sd * HW, yb), PAL.concrete, 0, UP);
        const out = new V3(a.nx * sd, 0, a.nz * sd);
        D.quad(tp(a, sd * W2, ya), tp(a, sd * W2, ya - 0.3), tp(b, sd * W2, yb - 0.3), tp(b, sd * W2, yb), PAL.blue, 0, out);
        D.quad(tp(a, sd * W2, ya - 0.3), tp(a, sd * W2, bot(a)), tp(b, sd * W2, bot(b)), tp(b, sd * W2, yb - 0.3), PAL.concrete, 0.03, out);
        // solid embankment on the low part of the ramps
        if (EMBANK(a) || EMBANK(b)) D.quad(tp(a, sd * W2, bot(a)), tp(a, sd * W2, 0), tp(b, sd * W2, 0), tp(b, sd * W2, bot(b)), PAL.concreteDark, 0.04, out);
      }
      D.quad(tp(a, -W2, bot(a)), tp(a, W2, bot(a)), tp(b, W2, bot(b)), tp(b, -W2, bot(b)), PAL.under, 0, DOWN);
      // track surface proxy for the hook (ground level is covered by the floor)
      const acc = hitAccAt(a.x, a.z);
      acc.quad(tp(a, -W2, ya), tp(a, W2, ya), tp(b, W2, yb), tp(b, -W2, yb), WHITE, 0, UP);
      acc.quad(tp(a, -W2, bot(a)), tp(a, W2, bot(a)), tp(b, W2, bot(b)), tp(b, -W2, bot(b)), WHITE, 0, DOWN);
    }
  }
  // checkered start / finish line
  const cells = 13, rows = 3;
  for (let r = 0; r < rows; r++) {
    const a = tsAt(r), b = tsAt(r + 1);
    for (let c = 0; c < cells; c++) {
      const l0 = -HW + (c * TRACK_W) / cells, l1 = -HW + ((c + 1) * TRACK_W) / cells;
      const col = (c + r) & 1 ? PAL.black : PAL.white;
      D.quad(tp(a, l0, a.h + 0.04), tp(a, l1, a.h + 0.04), tp(b, l1, b.h + 0.04), tp(b, l0, b.h + 0.04), col, 0, UP);
    }
  }
  // starting grid box behind the line
  const gi = NS - Math.round(12 / DS);
  for (const [l0, l1, d0, d1] of [[-2.2, 2.2, -1.8, -1.6], [-2.2, -2.0, -1.8, 1.8], [2.0, 2.2, -1.8, 1.8]]) {
    const a = tsAt(gi + Math.round(d0 / DS)), b = tsAt(gi + Math.round(d1 / DS));
    D.quad(tp(a, l0, 0.04), tp(a, l1, 0.04), tp(b, l1, 0.04), tp(b, l0, 0.04), PAL.white, 0, UP);
  }
}
// low ramp parts get a filled embankment, high ones and the crossing a slab on pillars
function EMBANK(s) {
  if (s.h < 0.04 || s.h > 3.4) return false;
  for (let d = -24; d <= 24; d += 4) { const o = tsAt(s.i + d); if (o.over) return false; }
  return true;
}

// ---------- barriers: tire stacks on the ground, concrete curb + rail on the decks ----------
function edgeBlocked(s, sd) {
  const p = tp(s, sd * (HW + 0.55), 0);
  for (let j = 0; j < NS; j += 2) {
    const d = Math.abs(j - s.i), ring = Math.min(d, NS - d);
    if (ring * DS < 30) continue;
    const o = TS[j];
    if (Math.abs(o.h - s.h) > 3) continue;
    const dx = p.x - o.x, dz = p.z - o.z;
    if (dx * dx + dz * dz < (HW + 0.7) * (HW + 0.7)) return true;
  }
  return false;
}
function buildBarriers(D) {
  const tireStack = (o, x, z, top) => {
    for (let k = 0; k < 3; k++) o.cyl(0.5, 0.3, x, 0.15 + k * 0.3, z, PAL.tire, { seg: 9, jit: 0.06 });
    o.cyl(0.506, 0.14, x, 0.75, z, top, { seg: 9 });
    o.cyl(0.24, 0.02, x, 0.905, z, PAL.tireHole, { seg: 7 });
  };
  for (const sd of [-1, 1]) {
    let runStart = null;
    for (let i = 0; i <= NS; i++) {
      const s = tsAt(i);
      const ground = s.h < 0.35 && i < NS;
      const ok = ground && !edgeBlocked(s, sd);
      // tire stacks every metre
      if (ok && i % 2 === 0) {
        const o = new Obj(), p = tp(s, sd * (HW + 0.55), 0);
        const top = (Math.floor(i / 4) & 1) ? PAL.red : PAL.white;
        tireStack(o, p.x, p.z, top);
        D.addObj(o);
      }
      // hit proxy runs (4 m boxes)
      if (ok && runStart === null) runStart = i;
      if (runStart !== null && (!ok || i - runStart >= 8)) {
        const a = tp(tsAt(runStart), sd * (HW + 0.55), 0), b = tp(tsAt(i), sd * (HW + 0.55), 0);
        if (i > runStart) hitSeg(a.x, a.z, b.x, b.z, 0.45, 1.0, 0.9);
        runStart = ok ? i : null;
      }
      // elevated: curb + rail
      if (s.h >= 0.3 && i < NS && i % 2 === 0) {
        const n = tsAt(i + 2), o = new Obj();
        const a = tp(s, sd * (HW + 0.35), 0), b = tp(n, sd * (HW + 0.35), 0);
        const col = (Math.floor(i / 6) & 1) ? PAL.red : PAL.white;
        const ym = (s.h + n.h) / 2;
        segBox(o, a.x, a.z, b.x, b.z, ym + 0.3, 0.6, 0.6, col, { ext: 0.05 });
        segBox(o, a.x, a.z, b.x, b.z, ym + 1.25, 0.12, 0.14, PAL.steel, { ext: 0.05 });
        if (i % 4 === 0) o.box(0.1, 0.7, 0.1, a.x, s.h + 0.9, a.z, PAL.steel);
        D.addObj(o);
        if (i % 8 === 0) { const e = tp(tsAt(i + 8), sd * (HW + 0.35), 0); hitSeg(a.x, a.z, e.x, e.z, ym + 0.65, 0.7, 1.3); }
      }
    }
  }
}

// ---------- pillars under the high deck ----------
function buildBridgeSupports(D) {
  for (let i = 0; i < NS; i += 14) {
    const s = TS[i];
    if (s.h < 3 || s.over || EMBANK(s)) continue;
    if (!clearOfTrack(s.x, s.z, 0.8, s.h - 3)) continue;
    const o = new Obj(), top = s.h - 0.8, ry = Math.atan2(-s.tz, s.tx);
    o.box(1.2, top - 0.6, 1.2, s.x, (top - 0.6) / 2, s.z, PAL.concrete, { ry, jit: 0.03 });
    o.box(1.6, 0.25, 1.6, s.x, 0.125, s.z, PAL.concreteDark, { ry });
    o.box(1.3, 0.6, TRACK_W - 0.6, s.x, top - 0.3, s.z, PAL.concreteDark, { ry });
    // yellow-black warning wrap
    for (let k = 0; k < 4; k++) o.box(1.24, 0.25, 1.24, s.x, 0.5 + k * 0.5, s.z, k & 1 ? PAL.black : PAL.yellow, { ry });
    D.addObj(o);
    hitBox(1.3, top, 1.3, s.x, top / 2, s.z, ry);
    hitBox(1.3, 0.6, TRACK_W, s.x, top - 0.3, s.z, ry);
  }
  // steel girders below the crossing span
  for (let i = 0; i < NS; i++) {
    const s = TS[i];
    if (!s.over) continue;
    const n = tsAt(i + 1), o = new Obj();
    for (const lat of [-HW + 1.5, 0, HW - 1.5]) {
      const a = tp(s, lat, 0), b = tp(n, lat, 0);
      segBox(o, a.x, a.z, b.x, b.z, (s.h + n.h) / 2 - 1.05, 0.35, 0.5, PAL.blue, { ext: 0.02 });
    }
    D.addObj(o);
  }
}

// ---------- start / finish gantry with countdown lights ----------
function buildGantry(D, scene) {
  const s = TS[1], o = new Obj();
  const ry = Math.atan2(-s.tz, s.tx);
  const L = tp(s, -(HW + 1.6), 0), Rr = tp(s, HW + 1.6, 0);
  const top = 6.4;
  for (const p of [L, Rr]) {
    o.box(0.8, top, 0.8, p.x, top / 2, p.z, PAL.steel, { ry });
    o.box(1.4, 0.4, 1.4, p.x, 0.2, p.z, PAL.concreteDark, { ry });
    for (let k = 0; k < 5; k++) o.box(0.84, 0.35, 0.84, p.x, 0.7 + k * 0.7, p.z, k & 1 ? PAL.white : PAL.red, { ry });
    hitBox(0.9, top, 0.9, p.x, top / 2, p.z, ry);
  }
  segBox(o, L.x, L.z, Rr.x, Rr.z, top + 0.2, 1.0, 1.6, PAL.black, { ext: 0.8 });
  D.addObj(o);
  hitSeg(L.x, L.z, Rr.x, Rr.z, top + 0.2, 1.1, 1.7);
  // banner (both faces) + lights facing the approaching racers
  const yaw = Math.atan2(s.tx, s.tz); // plane normal (+z) → travel direction
  for (const back of [0, 1]) {
    const m = signMesh(TRACK_W + 2.4, 1.5, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1f2a44'); gr.addColorStop(1, '#10162a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // checkered ends
      const c = h / 4;
      for (let x = 0; x < 3; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) & 1 ? '#fff' : '#111'; g.fillRect(x * c, y * c, c, c); g.fillRect(w - (x + 1) * c, y * c, c, c); }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe066';
      g.save(); g.translate(w / 2, 0); g.transform(1, 0, -0.2, 1, 0, 0);
      fitText(g, back ? 'ZIEL' : 'START · ZIEL', 0, h * 0.54, w * 0.7, h * 0.72);
      g.restore();
    }, true);
    m.position.set(s.x - s.tx * (back ? -0.51 : 0.51), top + 0.2, s.z - s.tz * (back ? -0.51 : 0.51));
    m.rotation.y = back ? yaw : yaw + PI;
    scene.add(m);
  }
  WORLD.lights = [];
  for (let k = 0; k < 5; k++) {
    const lat = (k - 2) * 1.5;
    const mat = new T.MeshBasicMaterial({ color: '#3a0d0d' });
    const m = new T.Mesh(geoSph(10), mat);
    m.scale.setScalar(0.32);
    const p = tp(s, lat, top - 0.75);
    m.position.set(p.x - s.tx * 0.55, p.y, p.z - s.tz * 0.55);
    scene.add(m);
    const hous = new Obj(); hous.box(0.95, 0.95, 0.4, p.x - s.tx * 0.35, p.y, p.z - s.tz * 0.35, PAL.black, { ry }); D.addObj(hous);
    WORLD.lights.push(mat);
  }
}

// ---------- decoration: paddock, karts, snack bar, podium, bleachers, cones, banners ----------
function kartObj(color, num) {
  const o = new Obj();
  o.box(1.0, 0.08, 1.9, 0, 0.14, 0, PAL.black);
  o.box(1.15, 0.22, 0.25, 0, 0.22, -1.0, color);               // front bumper
  o.box(0.75, 0.3, 0.55, 0, 0.3, -0.75, color, { rx: -0.35 });  // nose
  o.box(0.25, 0.22, 1.1, -0.62, 0.22, 0.05, color);            // side pods
  o.box(0.25, 0.22, 1.1, 0.62, 0.22, 0.05, color);
  o.box(0.55, 0.12, 0.5, 0, 0.32, 0.25, PAL.black);             // seat
  o.box(0.55, 0.55, 0.12, 0, 0.55, 0.52, PAL.black, { rx: 0.25 });
  o.bar(new V3(0, 0.25, -0.35), new V3(0, 0.55, -0.1), 0.05, PAL.steel, true);
  o.torus(0.16, 0.18, 0, 0.6, -0.07, PAL.black, { rx: -1.1, seg: 10 });
  o.box(0.6, 0.4, 0.4, 0, 0.35, 0.85, PAL.concreteDark);        // engine
  o.box(1.25, 0.18, 0.2, 0, 0.22, 1.05, color);                 // rear bumper
  for (const [x, z, r] of [[-0.62, -0.62, 0.16], [0.62, -0.62, 0.16], [-0.66, 0.62, 0.2], [0.66, 0.62, 0.2]]) {
    o.cyl(r, 0.2 + r * 0.4, x, r, z, PAL.tire, { rz: PI / 2, seg: 9 });
    o.cyl(r * 0.5, 0.22 + r * 0.4, x, r, z, PAL.steel, { rz: PI / 2, seg: 6 });
  }
  o.box(0.3, 0.22, 0.02, 0, 0.38, -1.06, PAL.white);
  return o;
}
function buildDecor(D, G, scene) {
  const place = (x, z, r, fn) => { if (insideHall(x, z, r + 1) && clearOfTrack(x, z, r)) { fn(x, z); return true; } return false; };

  // --- paddock with parked karts in the big infield ---
  const kartCols = ['#e8322b', '#2a6fdb', '#ffcc1f', '#2bb24a', '#ff8a3d', '#a24bd8', '#12c7c0', '#f45ba5'];
  let kn = 0;
  for (let row = 0; row < 2; row++) for (let k = 0; k < 6; k++) {
    const x = -44 + k * 3.2, z = 22 + row * 5;
    place(x, z, 1.5, () => {
      const o = kartObj(C(kartCols[kn++ % kartCols.length]));
      D.addObj(o, matAt(x, 0, z, row ? 0 : PI));
      hitBox(1.3, 1.0, 2.2, x, 0.5, z);
    });
  }
  // paddock floor paint + tire piles
  {
    const o = new Obj(); o.box(24, 0.02, 13, -36, 0.011, 24.5, C('#c3cad3')); o.box(24.6, 0.018, 13.6, -36, 0.009, 24.5, PAL.yellow); D.addObj(o);
  }
  for (const [x, z] of [[-52, 18], [-52, 31], [-20, 34], [-18, 15]]) place(x, z, 1.2, () => {
    const o = new Obj();
    o.box(2.2, 0.15, 2.2, x, 0.075, z, C('#b98a52'));
    for (let a = 0; a < 4; a++) for (let k = 0; k < RI(2, 4); k++) o.cyl(0.42, 0.3, x + (a & 1 ? 0.5 : -0.5), 0.3 + k * 0.3, z + (a & 2 ? 0.5 : -0.5), PAL.tire, { seg: 9, jit: 0.06 });
    D.addObj(o); hitBox(2.2, 1.4, 2.2, x, 0.7, z);
  });

  // --- snack bar container ---
  place(-6, 30, 6, (x, z) => {
    const o = new Obj();
    o.box(9, 3.2, 3.6, x, 1.6, z, C('#ff8a3d'), { jit: 0.02 });
    for (let k = -4; k <= 4; k += 0.5) o.box(0.08, 3.2, 3.64, x + k, 1.6, z, C('#e8752c'));
    o.box(6, 1.3, 0.1, x, 1.9, z - 1.81, C('#2b1b10'));         // serving hatch
    o.box(6.6, 0.12, 1.2, x, 2.65, z - 2.3, PAL.red, { rx: -0.25 }); // awning
    o.box(6.4, 0.12, 0.7, x, 1.15, z - 2.05, C('#d8d8d8'));       // counter
    for (const k of [-2.5, 0, 2.5]) { // tables + stools
      o.cyl(0.6, 0.06, x + k, 1.05, z - 6, PAL.white, { seg: 10 }); o.cyl(0.07, 1.05, x + k, 0.52, z - 6, PAL.steel, { seg: 6 });
      o.cyl(0.25, 0.08, x + k - 0.9, 0.6, z - 6, PAL.red, { seg: 8 }); o.cyl(0.25, 0.08, x + k + 0.9, 0.6, z - 6, PAL.blue, { seg: 8 });
      o.cyl(0.05, 0.6, x + k - 0.9, 0.3, z - 6, PAL.steel, { seg: 5 }); o.cyl(0.05, 0.6, x + k + 0.9, 0.3, z - 6, PAL.steel, { seg: 5 });
    }
    D.addObj(o);
    hitBox(9, 3.2, 3.6, x, 1.6, z);
    const m = signMesh(6, 1.1, 96, (g, w, h) => drawSign(g, w, h, { text: 'SNACK-BAR', bg: '#ffe066', fg: '#2b1b10', icon: '🍟', border: '#e8322b' }));
    m.position.set(x, 3.75, z - 1.85); m.rotation.y = PI; scene.add(m);
    const b = new Obj(); b.box(6.2, 1.3, 0.12, x, 3.75, z - 1.75, PAL.black); D.addObj(b);
    hitBox(6.2, 1.3, 0.3, x, 3.75, z - 1.75);
  });

  // --- podium ---
  place(14, 24, 3.5, (x, z) => {
    const o = new Obj();
    o.box(2, 1.6, 2, x, 0.8, z, C('#ffcc1f'), { jit: 0.03 });
    o.box(2, 1.1, 2, x - 2, 0.55, z, C('#c9d2dd'), { jit: 0.03 });
    o.box(2, 0.75, 2, x + 2, 0.375, z, C('#d98b4a'), { jit: 0.03 });
    o.box(6.6, 0.06, 3.4, x, 0.03, z, PAL.red);
    D.addObj(o);
    hitBox(6, 1.6, 2, x, 0.8, z);
    for (const [dx, t, h] of [[0, '1', 1.6], [-2, '2', 1.1], [2, '3', 0.75]]) {
      const m = signMesh(0.9, 0.9, 64, (g, w, hh) => { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w / 2, hh / 2, hh * 0.46, 0, TAU); g.fill(); g.fillStyle = '#1f2a44'; g.font = `900 ${hh * 0.7}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, hh * 0.54); });
      m.material.transparent = true; m.position.set(x + dx, h * 0.55, z - 1.01); m.rotation.y = PI; scene.add(m);
    }
  });

  // --- flag poles with checkered flags (animated) ---
  const flagTex = canvasTex(64, 40, (g, w, h) => { for (let x = 0; x < 8; x++) for (let y = 0; y < 5; y++) { g.fillStyle = (x + y) & 1 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); } });
  const flagMat = new T.MeshLambertMaterial({ map: flagTex, side: T.DoubleSide });
  for (const [x, z] of [[-48, 36], [-24, 36], [22, 30], [6, 22], [-64, -46], [56, -24], [64, -36]]) place(x, z, 0.5, () => {
    const o = new Obj(); o.cyl(0.07, 7, x, 3.5, z, PAL.steel, { seg: 6 }); o.sph(0.14, x, 7.05, z, PAL.yellow, { seg: 6 }); o.cyl(0.35, 0.2, x, 0.1, z, PAL.concreteDark, { seg: 8 });
    D.addObj(o); hitBox(0.4, 7, 0.4, x, 3.5, z);
    const geo = new T.PlaneGeometry(1.8, 1.1, 8, 1);
    const f = new T.Mesh(geo, flagMat); f.position.set(x + 0.9, 6.35, z); f.castShadow = true; scene.add(f);
    WORLD.flags.push({ mesh: f, base: geo.attributes.position.array.slice(), ph: rng() * TAU });
  });

  // --- bleachers + spectators along the south wall ---
  const bx0 = -42, bx1 = 42, bz = HALL.z0 + 0.5;
  {
    const o = new Obj();
    for (let r = 0; r < 4; r++) {
      const z = bz + 3.6 - r * 1.0, y = 0.45 * (r + 1);
      o.box(bx1 - bx0, y, 1.0, (bx0 + bx1) / 2, y / 2, z, r & 1 ? C('#c6ccd4') : C('#d3d8df'), { jit: 0.01 });
      for (let x = bx0 + 0.6; x < bx1; x += 0.75) o.box(0.5, 0.12, 0.45, x, y + 0.06, z + 0.15, r & 1 ? PAL.blue : C('#3d8bff'));
    }
    // railing
    for (let x = bx0; x <= bx1; x += 2) o.box(0.08, 1.1, 0.08, x, 0.55, bz + 4.4, PAL.steel);
    o.box(bx1 - bx0, 0.1, 0.1, (bx0 + bx1) / 2, 1.1, bz + 4.4, PAL.steel);
    o.box(bx1 - bx0, 0.06, 0.06, (bx0 + bx1) / 2, 0.6, bz + 4.4, PAL.steel);
    // crowd
    const shirts = ['#e8322b', '#2a6fdb', '#ffcc1f', '#2bb24a', '#ff8a3d', '#ffffff', '#a24bd8', '#1d2029', '#12c7c0', '#f45ba5'];
    const skins = ['#f1c7a3', '#d9a27a', '#a8714f', '#6e4a33', '#f7d9bf'];
    for (let r = 0; r < 4; r++) for (let x = bx0 + 1; x < bx1 - 0.5; x += R(0.9, 2.6)) {
      if (rng() < 0.3) continue;
      const z = bz + 3.6 - r * 1.0 + 0.1, y = 0.45 * (r + 1) + 0.12;
      const sh = C(pick(shirts)), sk = C(pick(skins)), hair = C(pick(['#2b1b10', '#5a3a1a', '#d9b25a', '#1d1d1d', '#a04020']));
      o.box(0.42, 0.55, 0.26, x, y + 0.55, z, sh);
      o.box(0.4, 0.3, 0.3, x, y + 0.15, z - 0.05, C('#2b3550'));
      o.box(0.26, 0.28, 0.26, x, y + 0.98, z, sk);
      o.box(0.28, 0.08, 0.28, x, y + 1.14, z + 0.01, hair);
      if (rng() < 0.45) { o.box(0.1, 0.5, 0.1, x - 0.27, y + 1.05, z, sh, { rz: 0.25 }); o.box(0.1, 0.5, 0.1, x + 0.27, y + 1.05, z, sh, { rz: -0.25 }); }
      else { o.box(0.1, 0.45, 0.1, x - 0.27, y + 0.55, z, sh); o.box(0.1, 0.45, 0.1, x + 0.27, y + 0.55, z, sh); }
    }
    D.addObj(o);
    hitBox(bx1 - bx0, 2.8, 4.2, (bx0 + bx1) / 2, 1.4, bz + 2.2);
  }

  // --- traffic cones in the narrow infields ---
  for (let i = 0; i < 60; i++) {
    const x = R(HALL.x0 + 6, HALL.x1 - 6), z = R(HALL.z0 + 8, HALL.z1 - 6);
    place(x, z, 0.3, () => {
      const o = new Obj();
      o.box(0.5, 0.05, 0.5, x, 0.025, z, PAL.red);
      o.cone(0.22, 0.7, x, 0.4, z, C('#ff6a1a'), { seg: 8 });
      o.cyl(0.155, 0.1, x, 0.45, z, PAL.white, { seg: 8, rt: 0.85 });
      D.addObj(o);
    });
  }

  // --- hanging banners from the trusses ---
  const ban = ['EIS-RACER', 'GRIP? NEIN DANKE', 'HAKEN RAUS!', '3 RUNDEN', 'KALT BLEIBEN', 'SCHOLLEN-CUP'];
  let bi = 0;
  for (const [x, z] of [[-48, -20], [-12, 14], [24, -20], [-72, 40], [60, 40], [-36, -44]]) {
    const t = ban[bi++ % ban.length];
    const o = new Obj(); o.box(0.12, 0.12, 8.6, x, 13.95, z, PAL.steel); o.bar(new V3(x, 14, z - 4), new V3(x, 14.2, z - 4), 0.03, PAL.black); D.addObj(o);
    for (const side of [1, -1]) {
      const m = signMesh(8, 3.2, 128, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3d8bff'); gr.addColorStop(1, '#1f5fd0');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = '#8be9ff'; g.fillRect(0, 0, w, h * 0.08); g.fillRect(0, h * 0.92, w, h * 0.08);
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
        g.save(); g.translate(w / 2, 0); g.transform(1, 0, -0.18, 1, 0, 0); fitText(g, t, 0, h * 0.52, w * 0.86, h * 0.5); g.restore();
      });
      m.position.set(x + side * 0.03, 12.25, z); m.rotation.y = side * PI / 2; scene.add(m);
    }
    hitBox(0.3, 3.4, 8.2, x, 12.25, z);
  }

  // --- bunting (little flags) on strings between trusses ---
  const bcols = [PAL.red, PAL.yellow, PAL.blue, PAL.white, C('#2bb24a')];
  for (const z of [-50, -25, 5, 32, 52]) for (let x = HALL.x0 + 12; x < HALL.x1 - 12; x += 12) {
    if (rng() < 0.35) continue;
    const sag = 1.2, y0 = 13.9;
    const pt = (u) => new V3(x + u * 12, y0 - Math.sin(u * PI) * sag, z);
    const o = new Obj();
    for (let k = 0; k < 6; k++) o.bar(pt(k / 6), pt((k + 1) / 6), 0.025, PAL.black);
    D.addObj(o);
    for (let k = 0.5; k < 12; k += 0.85) {
      const a = pt((k - 0.3) / 12), b = pt((k + 0.3) / 12), m = pt(k / 12), c = new V3(m.x, m.y - 0.6, m.z);
      const col = bcols[Math.floor(k / 0.85) % bcols.length];
      D.tri(a, b, c, col, 0, new V3(0, 0, 1)); D.tri(a, b, c, col, 0, new V3(0, 0, -1));
    }
  }

  // --- rolling doors on the north wall ---
  for (const x of [52, 70]) {
    const o = new Obj();
    o.box(9, 6.5, 0.2, x, 3.25, HALL.z1 - 0.55, C('#b9c3cf'));
    for (let y = 0.4; y < 6.5; y += 0.4) o.box(9, 0.06, 0.24, x, y, HALL.z1 - 0.55, C('#9aa5b3'));
    o.box(9.6, 0.6, 0.6, x, 6.8, HALL.z1 - 0.6, PAL.column);
    o.box(0.4, 6.5, 0.4, x - 4.7, 3.25, HALL.z1 - 0.6, PAL.yellow); o.box(0.4, 6.5, 0.4, x + 4.7, 3.25, HALL.z1 - 0.6, PAL.yellow);
    D.addObj(o);
  }
}

// ---------- anchor posts at the apex of every corner (great hook targets) ----------
function buildAnchors(D, G) {
  const cand = [];
  for (let i = 0; i < NS; i++) {
    const k = Math.abs(TS[i].k);
    if (k < 1 / 40) continue;
    let max = true;
    for (let d = -20; d <= 20; d++) if (Math.abs(tsAt(i + d).k) > k) { max = false; break; }
    if (max) cand.push(i);
  }
  let last = -1e9;
  for (const i of cand) {
    const s = TS[i];
    if (s.i * DS - last < 22) continue;
    const side = Math.sign(s.k);
    for (const off of [3.4, 5, 7]) {
      const p = tp(s, side * (HW + off), 0);
      if (!insideHall(p.x, p.z, 2) || !clearOfTrack(p.x, p.z, 0.4, s.h + 3)) continue;
      const base = 0, H = 5.5;
      const o = new Obj();
      o.cyl(0.9, 0.3, p.x, base + 0.15, p.z, PAL.concreteDark, { seg: 10 });
      for (let k = 0; k < 9; k++) o.cyl(0.32, H / 9, p.x, base + 0.3 + (k + 0.5) * (H / 9), p.z, k & 1 ? PAL.black : PAL.yellow, { seg: 10 });
      o.torus(0.55, 0.28, p.x, base + H + 0.6, p.z, PAL.red, { seg: 12 });
      D.addObj(o);
      const g = new Obj(); g.sph(0.3, p.x, base + H + 0.6, p.z, C('#8be9ff'), { seg: 8 }); G.addObj(g);
      hitBox(0.8, H + 1.2, 0.8, p.x, (H + 1.2) / 2, p.z);
      hitBox(1.5, 0.6, 1.5, p.x, base + H + 0.6, p.z);
      WORLD.anchors.push(new V3(p.x, base + H + 0.6, p.z));
      last = s.i * DS;
      break;
    }
  }
}

// ---------- sponsor boards on the walls, big logos ----------
function buildSigns(scene) {
  let k = 0;
  const wallSign = (x, z, ry, w, h, y, opts) => {
    const m = signMesh(w, h, 128, (g, cw, ch) => drawSign(g, cw, ch, opts));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  };
  // lower wall boards between columns
  for (let x = HALL.x0 + 18; x < HALL.x1 - 10; x += 12) {
    wallSign(x, HALL.z1 - 0.52, PI, 9, 1.8, 1.7, SPONSORS[k++ % SPONSORS.length]);
    if (x < -44 || x > 44) wallSign(x, HALL.z0 + 0.52, 0, 9, 1.8, 1.7, SPONSORS[k++ % SPONSORS.length]);
  }
  for (let z = HALL.z0 + 18; z < HALL.z1 - 10; z += 12) {
    wallSign(HALL.x0 + 0.52, z, PI / 2, 9, 1.8, 1.7, SPONSORS[k++ % SPONSORS.length]);
    wallSign(HALL.x1 - 0.52, z, -PI / 2, 9, 1.8, 1.7, SPONSORS[k++ % SPONSORS.length]);
  }
  // big logos
  const logo = (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(16,22,42,.92)'; roundRect(g, 0, 0, w, h, h * 0.12); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(w / 2, 0); g.transform(1, 0, -0.2, 1, 0, 0);
    const gr = g.createLinearGradient(0, h * 0.15, 0, h * 0.85); gr.addColorStop(0, '#e6fbff'); gr.addColorStop(0.5, '#8be9ff'); gr.addColorStop(1, '#3d8bff');
    g.fillStyle = gr; g.font = `900 ${h * 0.62}px ${FONT}`;
    g.lineWidth = h * 0.05; g.strokeStyle = '#0b1830'; g.strokeText('EIS-RACER', 0, h * 0.47); g.fillText('EIS-RACER', 0, h * 0.47);
    g.fillStyle = '#ffcc1f'; g.font = `900 ${h * 0.14}px ${FONT}`; g.fillText('KART ARENA · SCHOLLEN-CUP', 0, h * 0.86);
    g.restore();
  };
  for (const [x, z, ry, w] of [[HALL.x0 + 0.55, 0, PI / 2, 34], [HALL.x1 - 0.55, 0, -PI / 2, 34], [0, HALL.z1 - 0.55, PI, 40]]) {
    const m = signMesh(w, w * 0.22, 256, logo, true);
    m.material.transparent = true; m.position.set(x, 7.2, z); m.rotation.y = ry; scene.add(m);
  }
}
