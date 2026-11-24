// ============================================================
//  Eis-Racer – track layout: closed spline, samples, queries
// ============================================================
// all of these are (re)set by setupTrack() when a map is loaded
let TRACK_W = 13, HW = TRACK_W / 2;   // track width / half width (m)
let HALL = { x0: -96, x1: 96, z0: -70, z1: 70, h: 17 };
let CP = [], TLEN = 0, NS = 0, DS = 0.5;
let TS = [];   // samples: x, z, h, tangent tx/tz, normal nx/nz (points right of travel), curvature k, slope

// control points [x, z, height]; driven in this order, start/finish at the first point
function setupTrack(def) {
  TRACK_W = def.width || 13; HW = TRACK_W / 2;
  HALL = Object.assign({ h: 17 }, def.hall);
  CP = def.cp;
  const curve = new T.CatmullRomCurve3(CP.map((p) => new V3(p[0], p[2] || 0, p[1])), true, 'centripetal');
  TLEN = curve.getLength();
  NS = Math.round(TLEN / 0.5);
  DS = TLEN / NS;
  TS = [];
  const p = new V3(), t = new V3();
  for (let i = 0; i < NS; i++) {
    curve.getPointAt(i / NS, p);
    curve.getTangentAt(i / NS, t);
    const l = Math.hypot(t.x, t.z) || 1;
    const tx = t.x / l, tz = t.z / l;
    const h = p.y < 0.06 ? 0 : p.y;
    TS.push({ i, x: p.x, z: p.z, h, tx, tz, nx: -tz, nz: tx, k: 0, slope: 0, s: i * DS, under: false, over: false, flatTop: false, flatNear: false });
  }
  for (let i = 0; i < NS; i++) {
    const a = TS[(i - 4 + NS) % NS], b = TS[(i + 4) % NS], c = TS[i];
    c.k = angDiff(Math.atan2(a.tz, a.tx), Math.atan2(b.tz, b.tx)) / (8 * DS); // signed curvature (1/m)
    c.slope = (b.h - a.h) / (8 * DS);                                          // dh/ds
  }
  // glitch "Kreuzungs-Verwechslung": the nearest other piece at the same level, if close enough
  for (let i = 0; i < NS; i++) {
    const a = TS[i]; let best = (TRACK_W + 5) * (TRACK_W + 5), bj = -1;
    for (let j = 0; j < NS; j += 2) {
      const d = Math.abs(i - j), ring = Math.min(d, NS - d);
      if (ring * DS < 60 || Math.abs(a.h - TS[j].h) > 1) continue;
      const dx = a.x - TS[j].x, dz = a.z - TS[j].z, dd = dx * dx + dz * dz;
      if (dd < best) { best = dd; bj = j; }
    }
    a.alt = bj;
  }
  // other pieces of track crossing this sample: above / below (bridge) or on the same level (flat crossing)
  for (let i = 0; i < NS; i++) {
    const a = TS[i];
    for (let j = 0; j < NS; j += 2) {
      const d = Math.abs(i - j), ring = Math.min(d, NS - d);
      if (ring * DS < 40) continue;
      const b = TS[j];
      const dx = a.x - b.x, dz = a.z - b.z, dd = dx * dx + dz * dz;
      if (dd < (TRACK_W + 4) * (TRACK_W + 4)) {
        if (b.h > a.h + 3) { a.under = true; a.ceil = Math.min(a.ceil || 99, b.h); }
        if (a.h > b.h + 3) a.over = true;
      }
      if (Math.abs(a.h - b.h) < 1 && dd < (HW + 1.5) * (HW + 1.5)) { a.flatNear = true; if (i > j) a.flatTop = true; }
    }
  }
}
const tsAt = (i) => TS[((i % NS) + NS) % NS];

// nearest point on the centerline, searched locally around a guess index (keeps lower / upper decks apart)
const _tq = { i: 0, f: 0, lat: 0, h: 0, tx: 1, tz: 0, nx: 0, nz: 1, slope: 0, s: 0, k: 0 };
function trackQuery(x, z, guess, win = 40, out = _tq) {
  let best = 1e18, bi = guess;
  for (let d = -win; d <= win; d++) {
    const s = tsAt(guess + d), dx = x - s.x, dz = z - s.z, dd = dx * dx + dz * dz;
    if (dd < best) { best = dd; bi = s.i; }
  }
  // project onto the segment toward the neighbor on the correct side
  const a = TS[bi];
  let dx = x - a.x, dz = z - a.z;
  const along = dx * a.tx + dz * a.tz;
  const j = along >= 0 ? bi : (bi - 1 + NS) % NS;
  const s0 = TS[j], s1 = tsAt(j + 1);
  const sx = s1.x - s0.x, sz = s1.z - s0.z, sl = sx * sx + sz * sz;
  const f = clamp(((x - s0.x) * sx + (z - s0.z) * sz) / sl, 0, 1);
  const cx = s0.x + sx * f, cz = s0.z + sz * f;
  const tx = lerp(s0.tx, s1.tx, f), tz = lerp(s0.tz, s1.tz, f), tl = Math.hypot(tx, tz);
  out.i = j; out.f = f;
  out.tx = tx / tl; out.tz = tz / tl; out.nx = -out.tz; out.nz = out.tx;
  out.lat = (x - cx) * out.nx + (z - cz) * out.nz;
  out.h = lerp(s0.h, s1.h, f);
  out.slope = lerp(s0.slope, s1.slope, f);
  out.k = lerp(s0.k, s1.k, f);
  out.s = (j + f) * DS;
  return out;
}

// global nearest sample (only used when placing decoration)
function nearestTrack(x, z, minH = -1, maxH = 99) {
  let best = 1e18, bi = -1;
  for (let i = 0; i < NS; i++) {
    const s = TS[i];
    if (s.h < minH || s.h > maxH) continue;
    const dx = x - s.x, dz = z - s.z, dd = dx * dx + dz * dz;
    if (dd < best) { best = dd; bi = i; }
  }
  return { i: bi, d: Math.sqrt(best) };
}
