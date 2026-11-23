// ============================================================
//  Eis-Racer – the 10 maps: layout, hall, look and special elements
//  cp: control points [x, z, height] in driving order (start/finish at the first one)
//  elements: placed along the track with `at` = fraction of the lap (0..1), `lat` = sideways offset (m)
// ============================================================

// 3-lobed clover for the fair: smooth r(a) = R0 + A·cos(3a)
function cloverCP() {
  const out = [];
  for (let k = 0; k < 24; k++) {
    const a = PI / 2 + (k / 24) * TAU;
    const r = 46 + 13 * Math.cos(3 * (a - PI / 2));
    out.push([Math.cos(a) * r * 1.12, -Math.sin(a) * r * 0.85, 0]);
  }
  return out.slice(2).concat(out.slice(0, 2));
}

const MAPS = [
  // ---------------------------------------------------------------- 1
  {
    id: 'arena', name: 'Kart Arena', sub: 'Der Klassiker mit Brücke', icon: '🏁',
    theme: { decor: 'arena', barrier: 'tires' },
    elements: [],
    width: 13, hall: { x0: -96, x1: 96, z0: -70, z1: 70, h: 17 },
    cp: [
      [-30, -54, 0], [10, -54, 0], [44, -54, 0], [70, -48, 0], [82, -30, 0], [74, -12, 0], [52, -6, 0], [26, -6, 0],
      [-6, -6, 0], [-36, -2, 0], [-66, 8, 0], [-78, 30, 0], [-66, 52, 0], [-38, 58, 0], [-8, 58, 0], [20, 54, 0],
      [38, 42, 0.6], [45, 24, 4.2], [44, 6, 6.6], [42, -14, 6.6], [36, -28, 3.6], [18, -32, 0.6], [-12, -32, 0],
      [-46, -32, 0], [-70, -34, 0], [-79, -38, 0], [-81.5, -45.5, 0], [-79, -53, 0], [-70, -57, 0], [-50, -56, 0],
    ],
  },
  // ---------------------------------------------------------------- 2
  {
    id: 'night', name: 'Nachtschicht', sub: 'Neon-Acht mit Kreuzung', icon: '🌙',
    theme: {
      decor: 'night', barrier: 'neon', neon: ['#ff3bd4', '#29e6ff'], fog: '#0b0c18', fogNear: 30, fogFar: 170,
      hemi: 0.6, hemiSky: '#8a7cff', hemiGround: '#1a1030', sun: 0.5, sunCol: '#a9b4ff', bg: '#0b0c18',
      pal: { floor1: '#1d2030', floor2: '#191c2a', floorLine: '#29e6ff', asphalt: '#262a36', wallLow: '#1b1e2c', wallUp: '#141828', wallRib: '#10131f',
        wallStripe: '#ff3bd4', kick: '#0d0f18', ceiling: '#0b0d16', truss: '#2a3044', purlin: '#20263a', column: '#151a2c', lamp: '#ff6ae0', window: '#1a1f3a',
        sky: '#3a2a7a', concrete: '#3a3f52', concreteDark: '#2a2e3d', under: '#1d2030', deckStripe: '#29e6ff', kerbA: '#ff3bd4', kerbB: '#29e6ff', edge: '#29e6ff',
        barA: '#ff3bd4', barB: '#0e1018', lampHouse: '#0e1018' },
      sponsors: [
        { text: 'NACHTSCHICHT', sub: 'Rennen bis 6 Uhr früh', bg: '#0e1018', fg: '#ff3bd4', stripe: '#29e6ff', icon: '🌙' },
        { text: 'NEON-NUDELN', sub: 'leuchten im Dunkeln', bg: '#1a0f2e', fg: '#29e6ff', icon: '🍜' },
        { text: 'BASS-BUDE', sub: 'Lautsprecher & Licht', bg: '#ff3bd4', fg: '#0e1018', icon: '🔊' },
        { text: 'POLARSTERN', sub: 'Energy Drink', bg: '#12c7c0', fg: '#0b2540', icon: '⭐' },
      ],
    },
    elements: [
      { type: 'boost', at: 0.205, len: 14 }, { type: 'boost', at: 0.705, len: 14 },
      { type: 'boost', at: 0.46, len: 10 }, { type: 'boost', at: 0.96, len: 10 },
      { type: 'bumper', at: 0.36, lat: 0, color: '#29e6ff' }, { type: 'bumper', at: 0.86, lat: 0, color: '#ff3bd4' },
    ],
    width: 13, hall: { x0: -96, x1: 96, z0: -58, z1: 58, h: 14 },
    cp: [
      [-78, 4, 0], [-72, -20, 0], [-54, -36, 0], [-30, -32, 0], [-14, -16, 0], [14, 14, 0], [32, 30, 0], [56, 38, 0],
      [74, 24, 0], [80, 0, 0], [74, -24, 0], [56, -38, 0], [32, -32, 0], [14, -16, 0], [-14, 14, 0], [-32, 30, 0],
      [-56, 38, 0], [-74, 24, 0],
    ],
  },
  // ---------------------------------------------------------------- 3
  {
    id: 'cold', name: 'Kühlhaus', sub: 'Serpentinen auf Blankeis', icon: '❄️',
    theme: {
      decor: 'cold', barrier: 'ice', fog: '#dcecf8', fogNear: 50, fogFar: 200, bg: '#dcecf8', hemi: 1.9, hemiSky: '#f4fbff', hemiGround: '#9fb8cc', sunCol: '#eaf6ff',
      pal: { floor1: '#e4ecf3', floor2: '#dbe5ee', floorLine: '#3d8bff', asphalt: '#56677d', wallLow: '#f4f8fb', wallUp: '#d6e7f4', wallRib: '#c4d9ea', wallStripe: '#3d8bff',
        column: '#7fa7c9', ceiling: '#9fb3c6', truss: '#e8eef4', purlin: '#c9d6e2', lamp: '#eef8ff', kerbA: '#3d8bff', kerbB: '#f3f4f6',
        barA: '#bfe6fa', barB: '#f4fbff', curbA: '#3d8bff', deckStripe: '#3d8bff' },
    },
    elements: [
      { type: 'superice', at: 0.31, len: 50 }, { type: 'superice', at: 0.56, len: 50 },
      { type: 'slider', at: 0.1, style: 'pallet', period: 4.2 }, { type: 'slider', at: 0.135, style: 'pallet', period: 3.4, phase: 0.5 },
      { type: 'slider', at: 0.8, style: 'pallet', period: 3.8, phase: 0.25 },
      { type: 'slush', at: 0.92, len: 26 },
    ],
    width: 12, hall: { x0: -98, x1: 94, z0: -64, z1: 64, h: 13 },
    cp: [
      [-50, -45, 0], [-10, -45, 0], [30, -45, 0], [60, -45, 0], [71, -41, 0], [75, -30, 0], [71, -19, 0], [60, -15, 0],
      [20, -15, 0], [-20, -15, 0], [-45, -15, 0], [-56, -11, 0], [-60, 0, 0], [-56, 11, 0], [-45, 15, 0], [0, 15, 0],
      [30, 15, 0], [60, 15, 0], [71, 19, 0], [75, 30, 0], [71, 41, 0], [60, 45, 0], [20, 45, 0], [-20, 45, 0],
      [-62, 45, 0], [-76, 39, 0], [-81, 26, 0], [-81, 0, 0], [-81, -26, 0], [-76, -39, 0], [-64, -45, 0],
    ],
  },
  // ---------------------------------------------------------------- 4
  {
    id: 'factory', name: 'Fabrikhalle', sub: 'Förderbänder, Pressen, Kran', icon: '🏭',
    theme: {
      decor: 'factory', barrier: 'concrete', fog: '#bdb6a8', fogNear: 50, fogFar: 190, bg: '#bdb6a8', hemi: 1.6, hemiSky: '#fff1d8', hemiGround: '#6f6a60', sunCol: '#ffe2b8',
      pal: { floor1: '#8f908b', floor2: '#888984', floorLine: '#ffcc1f', asphalt: '#3a3c40', wallLow: '#9a9ea4', wallUp: '#5d6b52', wallRib: '#4f5c45', wallStripe: '#ffcc1f',
        column: '#d9a521', ceiling: '#3e4148', truss: '#c9a227', purlin: '#8a7a3a', lamp: '#ffe0a8', window: '#e8dcc0', kerbA: '#ffcc1f', kerbB: '#1d2029',
        barA: '#ffcc1f', barB: '#1d2029', curbA: '#ffcc1f', curbB: '#1d2029', deckStripe: '#ffcc1f' },
      sponsors: [
        { text: 'SCHRAUBE & MUTTER', sub: 'Industriebedarf', bg: '#ffcc1f', fg: '#1d2029', icon: '🔩' },
        { text: 'BAND-AG', sub: 'Förderanlagen', bg: '#2c3a5c', fg: '#ffffff', stripe: '#ff8a3d', icon: '🏭' },
        { text: 'KRAN-KARL', sub: 'hebt alles', bg: '#ff8a3d', fg: '#ffffff', icon: '🏗️' },
        { text: 'HAKEN-HANNES', sub: 'Seile & Haken seit 1987', bg: '#ffffff', fg: '#1f2a44', stripe: '#ffcc1f', icon: '🪝' },
      ],
    },
    elements: [
      { type: 'conveyor', at: 0.08, len: 18, dir: 'fwd', speed: 22 }, { type: 'conveyor', at: 0.34, len: 12, dir: 'left', speed: 9 },
      { type: 'arm', at: 0.26, arms: 2, w: 1.0 },
      { type: 'slider', at: 0.55, style: 'press', period: 2.8 }, { type: 'slider', at: 0.61, style: 'press', period: 2.8, phase: 0.5 },
      { type: 'crane', at: 0.86, len: 40, period: 8 }, { type: 'crane', at: 0.12, len: 36, period: 10 },
    ],
    width: 13, hall: { x0: -96, x1: 96, z0: -64, z1: 64, h: 16 },
    cp: [
      [-40, -46, 0], [0, -46, 0], [40, -46, 0], [66, -41, 0], [79, -22, 0], [80, 8, 0], [68, 38, 0], [42, 46, 0],
      [22, 44, 0], [10, 30, 0], [-6, 16, 0], [-22, 18, 0], [-32, 34, 0], [-46, 46, 0], [-68, 40, 0], [-80, 18, 0],
      [-80, -18, 0], [-68, -40, 0],
    ],
  },
  // ---------------------------------------------------------------- 5
  {
    id: 'fair', name: 'Kirmes', sub: 'Drehscheiben & Karussell', icon: '🎡',
    theme: {
      decor: 'fair', barrier: 'blocks', neon: ['#ffd84a', '#ff5ab0'], fog: '#2a1638', fogNear: 50, fogFar: 180, bg: '#2a1638', hemi: 1.25, hemiSky: '#ffd8f0', hemiGround: '#4a2a3a', sun: 1.2, sunCol: '#ffe8c8',
      pal: { floor1: '#d8c39a', floor2: '#cfb98f', floorLine: '#ff5ab0', asphalt: '#4a3c56', wallLow: '#7a2a55', wallUp: '#4a2266', wallRib: '#3c1c55', wallStripe: '#ffd84a',
        ceiling: '#2a1238', truss: '#d8d0e8', purlin: '#a89cc0', column: '#ffd84a', lamp: '#ffe9a8', window: '#ffb8e0', sky: '#ffd8f0', kerbA: '#ff5ab0', kerbB: '#ffd84a',
        barA: '#e8322b', barB: '#ffd84a' },
      sponsors: [
        { text: 'ZUCKERWATTE', sub: 'rosa & blau', bg: '#ff9ad5', fg: '#ffffff', icon: '🍭' },
        { text: 'AUTOSCOOTER', sub: 'gleich nebenan', bg: '#2a6fdb', fg: '#ffd84a', icon: '🎢' },
        { text: 'LOSBUDE', sub: 'jedes Los gewinnt', bg: '#ffd84a', fg: '#7a2a55', icon: '🎟️' },
        { text: 'BRATWURST-BERND', bg: '#e8322b', fg: '#ffffff', stripe: '#ffd84a', icon: '🌭' },
      ],
    },
    elements: [
      { type: 'turntable', at: 0.16, w: 1.2 }, { type: 'turntable', at: 0.5, w: -1.2 }, { type: 'turntable', at: 0.83, w: 1.4 },
      { type: 'arm', at: 0.33, arms: 4, w: 0.8, len: 5.6 },
      { type: 'bumper', at: 0.65, lat: -1.8, color: '#ffd84a' }, { type: 'bumper', at: 0.69, lat: 1.8, color: '#ff5ab0' },
    ],
    width: 13, hall: { x0: -86, x1: 86, z0: -66, z1: 66, h: 18 },
    cp: cloverCP(),
  },
  // ---------------------------------------------------------------- 6
  {
    id: 'hangar', name: 'Flugzeughangar', sub: 'Breit, schnell, Triebwerks-Wind', icon: '✈️',
    theme: {
      decor: 'hangar', barrier: 'blocks', floor: 'grid', fog: '#d8dee4', fogNear: 80, fogFar: 260, bg: '#d8dee4', hemi: 1.85, sunCol: '#ffffff',
      pal: { floor1: '#c7cbd0', floor2: '#c1c6cb', floorLine: '#ffcc1f', asphalt: '#454a53', wallLow: '#b8c4cf', wallUp: '#9fb0bf', wallRib: '#93a4b4', wallStripe: '#e8322b',
        column: '#e8edf2', ceiling: '#7d8896', truss: '#eef2f6', purlin: '#c9d2dc', barA: '#e8322b', barB: '#f3f4f6' },
      sponsors: [
        { text: 'FLUGHAFEN FROST', sub: 'Abflug Gate B', bg: '#2a6fdb', fg: '#ffffff', stripe: '#ffcc1f', icon: '✈️' },
        { text: 'KEROSIN-KIOSK', sub: 'Kaffee für Piloten', bg: '#ffffff', fg: '#2a6fdb', icon: '☕' },
        { text: 'TURBINEN-TOM', sub: 'Windmaschinen', bg: '#1d2029', fg: '#ffcc1f', icon: '🌀' },
        { text: 'SCHOLLE24', sub: 'Eisschollen-Verleih', bg: '#3d8bff', fg: '#ffffff', stripe: '#8be9ff', icon: '🧊' },
      ],
    },
    elements: [
      { type: 'fan', at: 0.23, side: -1, len: 34, force: 16 }, { type: 'fan', at: 0.64, side: 1, len: 34, force: 16 },
      { type: 'boost', at: 0.04, len: 16 }, { type: 'boost', at: 0.52, len: 16 },
      { type: 'pendulum', at: 0.84, len: 8, period: 3.6 },
      { type: 'crane', at: 0.42, len: 46, period: 9 },
    ],
    width: 16, hall: { x0: -118, x1: 118, z0: -74, z1: 74, h: 24 },
    cp: [
      [-60, -50, 0], [-20, -50, 0], [-4, -48, 0], [8, -38, 0], [24, -36, 0], [38, -46, 0], [60, -50, 0], [86, -44, 0],
      [100, -20, 0], [100, 20, 0], [86, 44, 0], [60, 50, 0], [20, 50, 0], [-20, 50, 0], [-60, 50, 0], [-86, 44, 0],
      [-100, 20, 0], [-100, -20, 0], [-86, -44, 0],
    ],
  },
  // ---------------------------------------------------------------- 7
  {
    id: 'garage', name: 'Parkhaus', sub: 'Hochstraße und Schranken', icon: '🅿️',
    theme: {
      decor: 'garage', barrier: 'concrete', floor: 'parking', fog: '#9ea3a8', fogNear: 30, fogFar: 150, bg: '#9ea3a8', hemi: 1.45, hemiSky: '#e8f2ff', hemiGround: '#5a5d62', sun: 1.2, sunCol: '#eaf4ff',
      pal: { floor1: '#7d8085', floor2: '#777a7f', floorLine: '#ffcc1f', asphalt: '#55585e', wallLow: '#a3a6aa', wallUp: '#8d9196', wallRib: '#85898e', wallStripe: '#ffcc1f',
        column: '#c9ccd0', ceiling: '#6a6d72', truss: '#9a9da2', purlin: '#8a8d92', lamp: '#e8f6ff', window: '#9fb4c4', kerbA: '#ffcc1f', kerbB: '#1d2029',
        barA: '#ffcc1f', barB: '#1d2029', curbA: '#ffcc1f', curbB: '#c9ccd0', deckStripe: '#ffcc1f', concrete: '#b5b8bd' },
      sponsors: [
        { text: 'P1 PARKEN', sub: 'erste Stunde gratis', bg: '#2a6fdb', fg: '#ffffff', icon: '🅿️' },
        { text: 'AUSFAHRT', sub: 'bitte Ticket bereithalten', bg: '#2bb24a', fg: '#ffffff', icon: '⬅️' },
        { text: 'WASCHSTRASSE', sub: 'Glanz & Wachs', bg: '#8be9ff', fg: '#0b2540', icon: '🧽' },
        { text: 'REIFEN-RUDI', sub: 'Winterreifen? Wozu!', bg: '#1d2029', fg: '#ffcc1f', icon: '🛞' },
      ],
    },
    elements: [
      { type: 'gate', at: 0.07, side: 1, period: 5 }, { type: 'gate', at: 0.3, side: -1, period: 4.4, phase: 0.4 },
      { type: 'gate', at: 0.83, side: 1, period: 5.2, phase: 0.7 },
      { type: 'slider', at: 0.4, style: 'car', period: 4.5, amp: 3 },
    ],
    width: 12, hall: { x0: -96, x1: 96, z0: -96, z1: 74, h: 15 },
    cp: [
      [-50, -50, 0], [0, -50, 0], [40, -50, 0], [66, -45, 0], [78, -26, 0], [72, -6, 0], [50, 0, 0], [20, 0, 0],
      [-20, 0, 0], [-50, 2, 0], [-70, 14, 0], [-74, 34, 0], [-62, 52, 0], [-40, 57, 0], [-20, 56, 1.4], [0, 51, 4.4],
      [16, 40, 6.6], [26, 20, 6.6], [30, 0, 6.6], [30, -20, 6.6], [30, -40, 6.6], [29, -58, 5.6], [22, -71, 3.4],
      [6, -78, 1.0], [-14, -79, 0], [-50, -79, 0], [-68, -78, 0], [-80, -71, 0], [-83, -61, 0], [-77, -53, 0], [-64, -50, 0],
    ],
  },
  // ---------------------------------------------------------------- 8
  {
    id: 'gym', name: 'Turnhalle', sub: 'Eng, verwinkelt, Medizinbälle', icon: '🏀',
    theme: {
      decor: 'gym', barrier: 'mats', floor: 'planks', fog: '#efe6d6', fogNear: 40, fogFar: 150, bg: '#efe6d6', hemi: 1.8, hemiSky: '#fff6e8', hemiGround: '#9a7a50', sunCol: '#fff0d8',
      pal: { floor1: '#d9a65f', floor2: '#cf9b55', floorLine: '#ffffff', asphalt: '#3d6fb8', wallLow: '#efe9dd', wallUp: '#e2dacb', wallRib: '#d6cdbd', wallStripe: '#e8322b',
        column: '#c0392b', ceiling: '#e8e2d6', truss: '#bfb8aa', purlin: '#ada698', lamp: '#fff4dc', kerbA: '#ffffff', kerbB: '#e8322b', edge: '#ffffff',
        barA: '#2a6fdb', barB: '#e8322b' },
      sponsors: [
        { text: 'TV EISBERG 1899', sub: 'Abteilung Schollensport', bg: '#ffffff', fg: '#c0392b', stripe: '#2a6fdb', icon: '🏅' },
        { text: 'APFELSCHORLE', sub: 'nur am Kiosk', bg: '#2bb24a', fg: '#ffffff', icon: '🍏' },
        { text: 'MEDIZINBALL-MAX', sub: '5 kg pure Freude', bg: '#a5714a', fg: '#ffffff', icon: '🏐' },
        { text: 'HALLENSCHUHE', sub: 'keine Straßenschuhe!', bg: '#ffcc1f', fg: '#1d2029', icon: '👟' },
      ],
    },
    elements: [
      { type: 'bumper', at: 0.1, lat: -2.5, style: 'ball', r: 1.0, kick: 11 }, { type: 'bumper', at: 0.14, lat: 2.5, style: 'ball', r: 1.0, kick: 11, color: '#2a6fdb' },
      { type: 'bumper', at: 0.68, lat: 0, style: 'ball', r: 1.1, kick: 11, color: '#e8322b' },
      { type: 'pendulum', at: 0.44, len: 6, period: 2.8 }, { type: 'pendulum', at: 0.86, len: 6, period: 3.2, phase: 0.3 },
      { type: 'slider', at: 0.75, style: 'mat', bw: 2.4, bd: 1.0, period: 3.2, amp: 3 },
    ],
    width: 11, hall: { x0: -70, x1: 70, z0: -50, z1: 52, h: 12 },
    cp: [
      [-30, -32, 0], [0, -32, 0], [30, -32, 0], [46, -26, 0], [52, -12, 0], [46, 0, 0], [30, 2, 0], [16, -6, 0],
      [2, -12, 0], [-10, -6, 0], [-14, 6, 0], [-6, 18, 0], [10, 20, 0], [30, 18, 0], [42, 18, 0], [49, 21, 0], [52, 28, 0],
      [49, 35, 0], [42, 38, 0], [10, 38, 0], [-20, 38, 0], [-40, 35, 0], [-52, 22, 0], [-54, 0, 0], [-52, -20, 0], [-44, -30, 0],
    ],
  },
  // ---------------------------------------------------------------- 9
  {
    id: 'pinball', name: 'Flipper', sub: 'Bumper und Flipperarme', icon: '🕹️',
    theme: {
      decor: 'pinball', barrier: 'neon', neon: ['#ffcc1f', '#ff3bd4'], fog: '#120c2a', fogNear: 40, fogFar: 170, bg: '#120c2a', hemi: 0.85, hemiSky: '#9a7cff', hemiGround: '#200a30', sun: 0.7, sunCol: '#c8b8ff',
      pal: { floor1: '#1a1440', floor2: '#1f1850', floorLine: '#ffcc1f', asphalt: '#2b2160', wallLow: '#1b1238', wallUp: '#140f30', wallRib: '#100b28', wallStripe: '#ff3bd4',
        kick: '#0b0820', ceiling: '#0e0a22', truss: '#3a2c6a', purlin: '#2a2050', column: '#251a50', lamp: '#ffe066', window: '#2a1f5a', sky: '#3a2a7a',
        kerbA: '#ffcc1f', kerbB: '#ff3bd4', edge: '#ffcc1f', barA: '#ff3bd4', barB: '#0e0a22', lampHouse: '#0e0a22' },
      sponsors: [
        { text: 'EXTRA BALL', sub: 'bei 1.000.000 Punkten', bg: '#ff3bd4', fg: '#ffffff', icon: '🎱' },
        { text: 'TILT!', sub: 'nicht so fest rütteln', bg: '#ffcc1f', fg: '#1a1440', icon: '⚠️' },
        { text: 'HIGHSCORE', sub: 'trag dich ein', bg: '#29e6ff', fg: '#1a1440', icon: '🏆' },
      ],
    },
    elements: [
      { type: 'bumper', at: 0.05, lat: -3.5, color: '#ff3bd4' }, { type: 'bumper', at: 0.09, lat: 2.5, color: '#29e6ff' }, { type: 'bumper', at: 0.13, lat: -2, color: '#ffcc1f' },
      { type: 'bumper', at: 0.55, lat: 3.5, color: '#ff3bd4' }, { type: 'bumper', at: 0.59, lat: -2.5, color: '#29e6ff' }, { type: 'bumper', at: 0.63, lat: 2, color: '#ffcc1f' },
      { type: 'flipper', at: 0.2, side: 1, period: 2.2 }, { type: 'flipper', at: 0.2, side: -1, period: 2.2, phase: 0.5 },
      { type: 'flipper', at: 0.7, side: 1, period: 2.4, phase: 0.25 }, { type: 'flipper', at: 0.7, side: -1, period: 2.4, phase: 0.75 },
      { type: 'boost', at: 0.36, len: 14 }, { type: 'boost', at: 0.86, len: 14 },
    ],
    width: 16, hall: { x0: -62, x1: 62, z0: -82, z1: 82, h: 16 },
    cp: [
      [-36, 30, 0], [-36, 0, 0], [-36, -34, 0], [-26, -54, 0], [0, -62, 0], [26, -54, 0], [36, -34, 0], [36, 0, 0],
      [36, 34, 0], [26, 54, 0], [0, 62, 0], [-26, 54, 0],
    ],
  },
  // ---------------------------------------------------------------- 10
  {
    id: 'rink', name: 'Eisstadion', sub: 'Das Finale: alles auf einmal', icon: '🏆',
    theme: {
      decor: 'rink', barrier: 'boards', floor: 'ice', ice: 0.55, fog: '#d8e8f2', fogNear: 60, fogFar: 220, bg: '#d8e8f2', hemi: 1.9, hemiSky: '#ffffff', hemiGround: '#a8c4d8', sunCol: '#f2f8ff',
      pal: { floor1: '#eef7fc', floor2: '#e6f2f9', floorLine: '#e8322b', asphalt: '#cbe3f1', wallLow: '#ffffff', wallUp: '#1f4fa0', wallRib: '#1a4590', wallStripe: '#e8322b',
        column: '#e8322b', ceiling: '#1b2c4a', truss: '#dfe6ee', purlin: '#b0bccb', kerbA: '#e8322b', kerbB: '#2a6fdb', edge: '#2a6fdb',
        barA: '#ffcc1f', barB: '#2a6fdb', curbA: '#2a6fdb', curbB: '#ffffff', deckStripe: '#e8322b' },
    },
    elements: [
      { type: 'boost', at: 0.035, len: 16 }, { type: 'turntable', at: 0.3, w: 1.3 },
      { type: 'arm', at: 0.42, arms: 3, w: 0.9 }, { type: 'superice', at: 0.72, len: 30 },
      { type: 'gate', at: 0.88, side: -1, period: 4.6 }, { type: 'pendulum', at: 0.09, len: 7, period: 3.2 },
      { type: 'bumper', at: 0.57, lat: 0, style: 'ball', color: '#2a6fdb', r: 1.0, kick: 12 },
    ],
    width: 13, hall: { x0: -110, x1: 106, z0: -64, z1: 62, h: 18 },
    cp: [
      [-60, -12, 0], [-20, -12, 0], [10, -14, 0], [30, -30, 0], [50, -42, 0], [72, -36, 0], [86, -16, 0], [88, 10, 0],
      [76, 32, 0], [54, 44, 0.4], [32, 40, 2.5], [16, 26, 5.2], [4, 6, 6.6], [-4, -12, 6.6], [-14, -28, 4.5],
      [-30, -38, 1.5], [-50, -40, 0], [-80, -40, 0], [-90, -36, 0], [-94, -26, 0], [-90, -16, 0], [-80, -12, 0],
    ],
  },
];
