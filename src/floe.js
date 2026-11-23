// ============================================================
//  Eis-Racer – the ice floe, the rider's legs, grapple launcher, hook + rope
// ============================================================
const FLOE_TOP = 0.42;   // height of the floe's upper surface
const FLOE_R = 1.35;     // collision radius

function buildFloe() {
  const grp = new T.Group();
  const acc = new MeshAcc();
  rng = mulberry32(1234);
  // irregular outline (a bit longer than wide)
  const N = 13, ring = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + R(-0.12, 0.12);
    const r = R(1.12, 1.4);
    ring.push({ x: Math.sin(a) * r * 0.95, z: Math.cos(a) * r * 1.18, yt: FLOE_TOP + R(-0.04, 0.03) });
  }
  const top = C('#f2faff'), top2 = C('#e3f3fd'), bevel = C('#c8ebfb'), side = C('#93d3f0'), side2 = C('#79c2e8');
  const center = new V3(0, FLOE_TOP + 0.04, 0);
  for (let i = 0; i < N; i++) {
    const a = ring[i], b = ring[(i + 1) % N];
    const ai = new V3(a.x * 0.86, a.yt, a.z * 0.86), bi = new V3(b.x * 0.86, b.yt, b.z * 0.86);
    const ao = new V3(a.x, a.yt - 0.09, a.z), bo = new V3(b.x, b.yt - 0.09, b.z);
    const ab = new V3(a.x * 0.93, 0.02, a.z * 0.93), bb = new V3(b.x * 0.93, 0.02, b.z * 0.93);
    acc.tri(center, ai, bi, i & 1 ? top : top2, 0.025, UP);
    acc.quad(ai, ao, bo, bi, bevel, 0.03, UP);
    const out = new V3(a.x + b.x, 0, a.z + b.z).normalize();
    // side split into two bands for a chunkier look
    const am = new V3(a.x * 0.98, 0.2, a.z * 0.98), bm = new V3(b.x * 0.98, 0.2, b.z * 0.98);
    acc.quad(ao, am, bm, bo, side, 0.05, out);
    acc.quad(am, ab, bb, bm, side2, 0.05, out);
  }
  // a few snow lumps and frost cracks
  const o = new Obj();
  o.ico(0.22, -0.55, FLOE_TOP + 0.03, 0.55, C('#ffffff'), { sy: 0.4 });
  o.ico(0.16, 0.6, FLOE_TOP + 0.02, -0.35, C('#ffffff'), { sy: 0.35 });
  o.ico(0.12, 0.45, FLOE_TOP + 0.02, 0.75, C('#ffffff'), { sy: 0.4 });
  for (const [x0, z0, x1, z1] of [[-0.2, -0.9, 0.15, -0.35], [0.15, -0.35, 0.05, 0.1], [0.5, 0.2, 0.95, 0.45], [-0.75, -0.1, -0.35, -0.3]]) {
    o.bar(new V3(x0, FLOE_TOP + 0.05, z0), new V3(x1, FLOE_TOP + 0.05, z1), 0.025, C('#9fd6ef'));
  }
  // seat cushion + rider legs (sitting, knees up, boots forward = -z)
  o.box(0.62, 0.08, 0.55, 0, FLOE_TOP + 0.05, 0.12, C('#e8322b'));
  const pants = C('#3b5b9a'), boot = C('#1d2029'), sole = C('#ffcc1f');
  for (const sx of [-0.17, 0.17]) {
    const hip = new V3(sx, FLOE_TOP + 0.2, 0.05), knee = new V3(sx * 1.25, FLOE_TOP + 0.48, -0.42), ankle = new V3(sx * 1.3, FLOE_TOP + 0.16, -0.82);
    o.bar(hip, knee, 0.2, pants, true);
    o.sph(0.11, knee.x, knee.y, knee.z, pants, { seg: 7 });
    o.bar(knee, ankle, 0.17, pants, true);
    o.box(0.19, 0.2, 0.34, ankle.x, FLOE_TOP + 0.11, ankle.z - 0.08, boot);
    o.box(0.2, 0.05, 0.36, ankle.x, FLOE_TOP + 0.02, ankle.z - 0.08, sole);
  }
  acc.addObj(o);
  const mesh = acc.build(VCMAT);
  mesh.castShadow = true; mesh.receiveShadow = true;
  grp.add(mesh);
  return grp;
}

// grapple launcher in the right hand (child of the camera)
function buildLauncher() {
  const grp = new T.Group();
  const o = new Obj();
  const body = C('#ffcc1f'), dark = C('#2a2f3a'), steel = C('#b9c3cf'), glove = C('#e8322b'), cuff = C('#24315a');
  o.box(0.11, 0.12, 0.34, 0, 0, 0, body);                       // main body
  o.box(0.115, 0.03, 0.3, 0, 0.065, 0.01, dark);                // top rail
  o.cyl(0.04, 0.22, 0, 0.01, -0.26, dark, { rx: PI / 2, seg: 8 }); // barrel
  o.cyl(0.05, 0.04, 0, 0.01, -0.36, steel, { rx: PI / 2, seg: 8 }); // muzzle ring
  o.cyl(0.055, 0.1, 0, -0.005, 0.08, steel, { rz: PI / 2, seg: 10 }); // rope reel
  o.cyl(0.06, 0.08, 0, -0.005, 0.08, C('#ff8a3d'), { rz: PI / 2, seg: 10 });
  o.box(0.07, 0.15, 0.08, 0, -0.11, 0.08, dark, { rx: 0.25 });  // grip
  // glove around the grip
  o.box(0.12, 0.11, 0.12, 0.0, -0.12, 0.1, glove, { rx: 0.25 });
  o.box(0.1, 0.05, 0.05, -0.01, -0.07, 0.03, glove);              // finger on trigger
  o.box(0.12, 0.12, 0.2, 0.0, -0.17, 0.25, cuff, { rx: 0.5 });    // sleeve
  const mesh = new MeshAcc().addObj(o).build(VCMAT);
  grp.add(mesh);
  // the hook sitting in the muzzle while loaded
  const hk = buildHookMesh(); hk.position.set(0, 0.01, -0.39); hk.scale.setScalar(0.8); grp.add(hk);
  grp.userData.loaded = hk;
  grp.userData.muzzle = new V3(0, 0.01, -0.4);
  return grp;
}

function buildHookMesh() {
  const o = new Obj(), steel = C('#cfd7e0'), tip = C('#ff5a3a');
  o.cyl(0.03, 0.16, 0, 0, 0, steel, { rx: PI / 2, seg: 6 });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU;
    const dx = Math.cos(a), dy = Math.sin(a);
    o.bar(new V3(0, 0, -0.07), new V3(dx * 0.08, dy * 0.08, -0.03), 0.022, steel);
    o.bar(new V3(dx * 0.08, dy * 0.08, -0.03), new V3(dx * 0.1, dy * 0.1, 0.03), 0.022, steel);
    o.cone(0.022, 0.05, dx * 0.1, dy * 0.1, 0.055, tip, { rx: PI / 2, seg: 5 });
  }
  o.sph(0.035, 0, 0, -0.09, tip, { seg: 6 });
  return new MeshAcc().addObj(o).build(VCMAT);
}

// rope: a thin box stretched between two points
function buildRope() {
  const m = new T.Mesh(geoBox(), new T.MeshLambertMaterial({ color: '#ffb020', emissive: '#4a2a00' }));
  m.castShadow = true;
  m.visible = false;
  return m;
}
const _ra = new V3(), _rq = new T.Quaternion(), _rz = new V3(0, 0, 1);
function setRope(m, a, b, thick = 0.025) {
  _ra.subVectors(b, a);
  const L = _ra.length();
  if (L < 1e-4) { m.visible = false; return; }
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(_rz, _ra.divideScalar(L));
  m.scale.set(thick, thick, L);
  m.visible = true;
}
