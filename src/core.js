'use strict';
// ============================================================
//  Eis-Racer – core: helpers, RNG, low-poly geometry, mesh merging
// ============================================================
const T = THREE;
const V3 = T.Vector3;
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const smooth = (t) => t * t * (3 - 2 * t);
const angDiff = (a, b) => { let d = b - a; while (d > PI) d -= TAU; while (d < -PI) d += TAU; return d; };

// ---------- deterministic RNG ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(7);
const R = (a, b) => a + (b - a) * rng();
const RI = (a, b) => Math.floor(a + (b - a + 1) * rng());
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

// ---------- geometry cache (non-indexed → flat normals = low-poly look) ----------
const GEO = {};
function GC(key, fn) {
  if (!GEO[key]) { const g = fn(); GEO[key] = g.index ? g.toNonIndexed() : g; }
  return GEO[key];
}
const geoBox = () => GC('box', () => new T.BoxGeometry(1, 1, 1));
const geoCyl = (seg = 8, rt = 1) => GC('cyl' + seg + '_' + rt, () => new T.CylinderGeometry(rt, 1, 1, seg));
const geoSph = (seg = 8) => GC('sph' + seg, () => new T.SphereGeometry(1, seg, Math.max(3, Math.round(seg * 0.6))));
const geoCone = (seg = 8) => GC('cone' + seg, () => new T.ConeGeometry(1, 1, seg));
const geoTorus = (tube = 0.35, seg = 10, arc = TAU) => GC('tor' + tube + '_' + seg + '_' + arc.toFixed(2), () => new T.TorusGeometry(1, tube, 5, seg, arc));
const geoIco = (d = 0) => GC('ico' + d, () => new T.IcosahedronGeometry(1, d));

// ---------- object builder: list of colored parts in local space ----------
const _m4 = new T.Matrix4();
const COL = (c) => (c instanceof T.Color ? c : new T.Color(c));
class Obj {
  constructor() { this.parts = []; }
  add(geo, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0, jit = 0) {
    const m = new T.Matrix4().compose(new V3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'YXZ')), new V3(sx, sy, sz));
    this.parts.push({ geo, m, color: COL(color), jit });
    return this;
  }
  // all positions are part centers
  box(w, h, d, x, y, z, c, o = {}) { return this.add(geoBox(), x, y, z, w, h, d, c, o.rx || 0, o.ry || 0, o.rz || 0, o.jit || 0); }
  cyl(r, h, x, y, z, c, o = {}) { return this.add(geoCyl(o.seg || 8, o.rt != null ? o.rt : 1), x, y, z, r * (o.sx || 1), h, r * (o.sz || 1), c, o.rx || 0, o.ry || 0, o.rz || 0, o.jit || 0); }
  sph(r, x, y, z, c, o = {}) { return this.add(geoSph(o.seg || 8), x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o.rx || 0, o.ry || 0, o.rz || 0, o.jit || 0); }
  cone(r, h, x, y, z, c, o = {}) { return this.add(geoCone(o.seg || 8), x, y, z, r * (o.sx || 1), h, r * (o.sz || 1), c, o.rx || 0, o.ry || 0, o.rz || 0, o.jit || 0); }
  torus(r, tube, x, y, z, c, o = {}) { return this.add(geoTorus(tube, o.seg || 10, o.arc || TAU), x, y, z, r, r, r * (o.sz || 1), c, o.rx || 0, o.ry || 0, o.rz || 0, o.jit || 0); }
  ico(r, x, y, z, c, o = {}) { return this.add(geoIco(o.d || 0), x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), c, o.rx || 0, o.ry || 0, o.rz || 0, o.jit || 0); }
  // thin bar between two points
  bar(a, b, t, c, round = false) {
    const d = new V3().subVectors(b, a), len = d.length();
    const q = new T.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize());
    const tt = round ? t * 0.5 : t;
    const m = new T.Matrix4().compose(new V3().addVectors(a, b).multiplyScalar(0.5), q, new V3(tt, len, tt));
    this.parts.push({ geo: round ? geoCyl(6) : geoBox(), m, color: COL(c), jit: 0 });
    return this;
  }
  // copy another Obj in with a transform
  put(other, x, y, z, ry = 0, s = 1) {
    const m = matAt(x, y, z, ry, s);
    for (const pt of other.parts) this.parts.push({ geo: pt.geo, m: new T.Matrix4().multiplyMatrices(m, pt.m), color: pt.color, jit: pt.jit });
    return this;
  }
}
function matAt(x, y, z, ry = 0, s = 1) { return new T.Matrix4().compose(new V3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new V3(s, s, s)); }

// ---------- merges parts into one vertex-colored geometry ----------
// jit: per-face brightness variation (polished low-poly shading on big surfaces)
class MeshAcc {
  constructor() { this.pos = []; this.nor = []; this.col = []; }
  add(geo, matrix, color, jit = 0) {
    const g = geo.clone();
    g.applyMatrix4(matrix);
    g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nor.push(n[i]); }
    const nv = p.length / 3;
    for (let i = 0; i < nv; i += 3) {
      const k = jit ? 1 + (rng() - 0.5) * 2 * jit : 1;
      for (let v = 0; v < 3; v++) this.col.push(color.r * k, color.g * k, color.b * k);
    }
    g.dispose();
  }
  addObj(obj, matrix = null) {
    for (const pt of obj.parts) {
      if (matrix) { _m4.multiplyMatrices(matrix, pt.m); this.add(pt.geo, _m4, pt.color, pt.jit); }
      else this.add(pt.geo, pt.m, pt.color, pt.jit);
    }
    return this;
  }
  // raw triangle (world space), flat normal; hint = direction the visible side should face
  tri(a, b, c, color, jit = 0, hint = null) {
    const n = new V3().subVectors(c, b).cross(new V3().subVectors(a, b));
    if (n.lengthSq() < 1e-12) return;
    n.normalize();
    if (hint && n.dot(hint) < 0) { const t = b; b = c; c = t; n.negate(); }
    const k = jit ? 1 + (rng() - 0.5) * 2 * jit : 1;
    for (const p of [a, b, c]) { this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.col.push(color.r * k, color.g * k, color.b * k); }
  }
  // quad a-b-c-d (outline order), visible side facing hint
  quad(a, b, c, d, color, jit = 0, hint = null) {
    const k = jit ? 1 + (rng() - 0.5) * 2 * jit : 1;
    const cc = k === 1 ? color : color.clone().multiplyScalar(k);
    this.tri(a, b, c, cc, 0, hint); this.tri(a, c, d, cc, 0, hint);
  }
  get count() { return this.pos.length / 3; }
  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  build(mat) { return new T.Mesh(this.geometry(), mat); }
}

// one material for (almost) everything: vertex colors, flat lambert
const VCMAT = new T.MeshLambertMaterial({ vertexColors: true });
// self-lit parts (lamps, windows, neon)
const GLOWMAT = new T.MeshBasicMaterial({ vertexColors: true, fog: false });

// ---------- canvas helpers ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
function fitText(g, txt, x, y, maxW, size, weight = 900) {
  let fs = size;
  g.font = `${weight} ${fs}px ${FONT}`;
  while (g.measureText(txt).width > maxW && fs > 6) { fs -= 1; g.font = `${weight} ${fs}px ${FONT}`; }
  g.fillText(txt, x, y);
  return fs;
}
// textured sign: a flat plane (w × h) with its own canvas texture
function signMesh(w, h, px, draw, glow = false) {
  const tex = canvasTex(Math.round(px * w / h), px, draw);
  const mat = glow ? new T.MeshBasicMaterial({ map: tex }) : new T.MeshLambertMaterial({ map: tex });
  const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
  return m;
}
