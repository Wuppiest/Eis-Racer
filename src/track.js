// ============================================================
//  Eis-Racer – track layout: closed spline, samples, queries
// ============================================================
const TRACK_W = 13, HW = TRACK_W / 2;   // track width / half width (m)
const HALL = { x0: -96, x1: 96, z0: -70, z1: 70, h: 17 };

// control points [x, z, height]; driven in this order, start/finish at the first point
const CP = [
  [-30, -54, 0],
  [10, -54, 0],
  [44, -54, 0],
  [70, -48, 0],
  [82, -30, 0],   // right hairpin
  [74, -12, 0],
  [52, -6, 0],
  [26, -6, 0],    // middle straight (passes under the bridge)
  [-6, -6, 0],
  [-36, -2, 0],
  [-66, 8, 0],    // left sweeper
  [-78, 30, 0],
  [-66, 52, 0],
  [-38, 58, 0],   // top straight
  [-8, 58, 0],
  [20, 54, 0],
  [38, 42, 0.6],  // turn down, ramp up
  [45, 24, 4.2],
  [44, 6, 6.6],   // bridge over the middle straight
  [42, -14, 6.6],
  [36, -28, 3.6],
  [18, -32, 0.6], // ramp down into the left run
  [-12, -32, 0],
  [-46, -32, 0],
  [-70, -34, 0],  // left hairpin back onto the start straight
  [-79, -38, 0],
  [-81.5, -45.5, 0],
  [-79, -53, 0],
  [-70, -57, 0],
  [-50, -56, 0],
];

const curve = new T.CatmullRomCurve3(CP.map((p) => new V3(p[0], p[2], p[1])), true, 'centripetal');
const TLEN = curve.getLength();
const NS = Math.round(TLEN / 0.5);
const DS = TLEN / NS;
// samples: x, z, h, tangent tx/tz, normal nx/nz (points to the right of travel), heading, curvature, slope
const TS = [];
{
  const p = new V3(), t = new V3();
  for (let i = 0; i < NS; i++) {
    curve.getPointAt(i / NS, p);
    curve.getTangentAt(i / NS, t);
    const l = Math.hypot(t.x, t.z) || 1;
    const tx = t.x / l, tz = t.z / l;
    let h = p.y < 0.06 ? 0 : p.y;
    TS.push({ i, x: p.x, z: p.z, h, tx, tz, nx: -tz, nz: tx, k: 0, slope: 0, s: i * DS, under: false, over: false });
  }
  for (let i = 0; i < NS; i++) {
    const a = TS[(i - 4 + NS) % NS], b = TS[(i + 4) % NS], c = TS[i];
    const ha = Math.atan2(a.tz, a.tx), hb = Math.atan2(b.tz, b.tx);
    c.k = angDiff(ha, hb) / (8 * DS);           // signed curvature (1/m)
    c.slope = (b.h - a.h) / (8 * DS);           // dh/ds
  }
  // flag samples that have another (higher / lower) piece of track crossing them
  for (let i = 0; i < NS; i++) {
    const a = TS[i];
    for (let j = 0; j < NS; j += 2) {
      const d = Math.abs(i - j), ring = Math.min(d, NS - d);
      if (ring * DS < 40) continue;
      const b = TS[j];
      const dx = a.x - b.x, dz = a.z - b.z;
      if (dx * dx + dz * dz < (TRACK_W + 4) * (TRACK_W + 4)) {
        if (b.h > a.h + 3) a.under = true;
        if (a.h > b.h + 3) a.over = true;
      }
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
