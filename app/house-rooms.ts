import type { HouseLandscape } from './house-landscape';
import { addWindowCraft } from './window-craft';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWindowEnvironment } from './room-environment';
import {
  rooms,
  roomForObject,
  houseFurniture,
  type HouseView,
  type RoomId,
} from './house-data';
import type { ObjectId } from './room-data';
import type { Environment } from './environment-data';

type Kit = {
  landscape: HouseLandscape;
  scene: T.Scene;
  study: T.Group;
  groups: Map<ObjectId, T.Group>;
  interactables: T.Object3D[];
  materials: T.Material[];
  textures: T.Texture[];
  oak: T.MeshStandardMaterial;
  paleWood: T.MeshStandardMaterial;
  darkWood: T.MeshStandardMaterial;
  cream: T.MeshStandardMaterial;
  white: T.MeshStandardMaterial;
  brass: T.MeshStandardMaterial;
  charcoal: T.MeshStandardMaterial;
  textile: (color: string) => T.MeshStandardMaterial;
  artMats: T.MeshStandardMaterial[];
};
export function buildHouse(k: Kit) {
  const {
    materials,
    textures,
    oak,
    paleWood,
    darkWood,
    cream,
    white,
    brass,
    charcoal,
  } = k;
  const roots = {
    study: k.study,
    living: new T.Group(),
    bedroom: new T.Group(),
    gallery: new T.Group(),
  };
  for (const id of ['living', 'bedroom', 'gallery'] as const) {
    roots[id].position.set(rooms[id].x, 0, rooms[id].z);
    k.scene.add(roots[id]);
  }
  const mat = (color: string, roughness = 0.8, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    materials.push(m);
    return m;
  };
  const fabric = k.textile;
  const terracotta = mat('#b76e53'),
    green = mat('#466455'),
    sage = mat('#8d9a81'),
    black = mat('#171c1c', 0.48);
  const ivoryCloth = fabric('#d5cbb5'),
    sofaCloth = fabric('#9b9f86'),
    bedCloth = fabric('#e9dfc9'),
    blanketCloth = fabric('#788e89');
  const terracottaWall = cream.clone();
  terracottaWall.color.set('#cfa58a');
  materials.push(terracottaWall);
  const galleryWall = cream.clone();
  galleryWall.color.set('#e6ddc9');
  materials.push(galleryWall);
  const glass = new T.MeshPhysicalMaterial({
    color: '#c5ded8',
    roughness: 0.08,
    metalness: 0.08,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  materials.push(glass);
  const glassEdge = mat('#becfc1', 0.28);
  function mesh(
    parent: T.Object3D,
    geo: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const obj = new T.Mesh(geo, m);
    obj.position.set(x, y, z);
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  function b(
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    r = 0.02,
  ) {
    return mesh(
      p,
      r
        ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 3, h / 3, d / 3))
        : new T.BoxGeometry(w, h, d),
      m,
      x,
      y,
      z,
    );
  }
  function cyl(
    p: T.Object3D,
    rt: number,
    rb: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) {
    return mesh(p, new T.CylinderGeometry(rt, rb, h, 24), m, x, y, z);
  }
  function ball(
    p: T.Object3D,
    r: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    const o = mesh(p, new T.SphereGeometry(r, 20, 12), m, x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  }
  function torus(
    p: T.Object3D,
    r: number,
    t: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) {
    return mesh(p, new T.TorusGeometry(r, t, 8, 40), m, x, y, z);
  }
  function rod(
    p: T.Object3D,
    a: number[],
    v: number[],
    r: number,
    m: T.Material,
  ) {
    const aa = new T.Vector3(...(a as [number, number, number])),
      bb = new T.Vector3(...(v as [number, number, number]));
    const mid = aa.clone().add(bb).multiplyScalar(0.5);
    const o = cyl(p, r, r, aa.distanceTo(bb), mid.x, mid.y, mid.z, m);
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      bb.sub(aa).normalize(),
    );
    return o;
  }
  function line(
    p: T.Object3D,
    points: number[][],
    radius: number,
    m: T.Material,
  ) {
    const curve = new T.CatmullRomCurve3(
      points.map((v) => new T.Vector3(...(v as [number, number, number]))),
    );
    return mesh(p, new T.TubeGeometry(curve, 32, radius, 6, false), m);
  }
  function group(room: RoomId, id?: ObjectId, x = 0, y = 0, z = 0) {
    const p = new T.Group();
    p.position.set(x, y, z);
    roots[room].add(p);
    if (id) {
      p.userData.id = id;
      k.groups.set(id, p);
      k.interactables.push(p);
    }
    return p;
  }
  function child(p: T.Object3D, x = 0, y = 0, z = 0) {
    const g = new T.Group();
    g.position.set(x, y, z);
    p.add(g);
    return g;
  }
  function seam(p: T.Object3D, w: number, d: number, y: number, m: T.Material) {
    const shape = new T.Shape(),
      r = Math.min(0.06, w / 4, d / 4);
    shape.moveTo(-w / 2 + r, -d / 2);
    shape.lineTo(w / 2 - r, -d / 2);
    shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    shape.lineTo(w / 2, d / 2 - r);
    shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    shape.lineTo(-w / 2 + r, d / 2);
    shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    shape.lineTo(-w / 2, -d / 2 + r);
    shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    line(
      p,
      shape.getPoints(5).map((v) => [v.x, y, v.y]),
      0.005,
      m,
    );
  }
  function cushion(
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) {
    const g = child(p, x, y, z);
    b(g, w, h, d, 0, 0, 0, m, Math.min(h * 0.35, 0.12));
    seam(g, w - 0.035, d - 0.035, 0, ivoryCloth);
    return g;
  }
  function book(
    p: T.Object3D,
    w: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: T.Material,
  ) {
    b(p, w, 0.07, d, x, y, z, white, 0.008);
    for (const sign of [-1, 1])
      b(p, w + 0.02, 0.01, d + 0.02, x, y + sign * 0.04, z, color, 0.006);
    for (let i = 0; i < 4; i++)
      b(p, w - 0.01, 0.001, d - 0.015, x, y - 0.021 + i * 0.014, z, cream, 0);
  }
  function plant(p: T.Object3D, x: number, y: number, z: number, scale = 1) {
    const g = child(p, x, y, z);
    g.scale.setScalar(scale);
    cyl(g, 0.17, 0.12, 0.28, 0, 0.14, 0, terracotta);
    cyl(g, 0.158, 0.158, 0.025, 0, 0.278, 0, darkWood);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4,
        xx = Math.cos(a) * (0.1 + i * 0.01),
        zz = Math.sin(a) * 0.18,
        yy = 0.4 + (i % 4) * 0.12;
      rod(g, [0, 0.27, 0], [xx, yy, zz], 0.01, green);
      const l = ball(g, 0.14, xx, yy, zz, green, 0.44, 1.5, 0.15);
      l.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.55);
    }
    return g;
  }
  function feet(p: T.Object3D, w: number, d: number, height: number) {
    for (const x of [-w / 2, w / 2])
      for (const z of [-d / 2, d / 2]) {
        cyl(p, 0.04, 0.031, height, x, height / 2 + 0.08, z, darkWood);
        cyl(p, 0.034, 0.034, 0.035, x, 0.1, z, brass);
      }
  }
  function label(
    p: T.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w = 0.35,
  ) {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 80;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e9dfc9';
    ctx.fillRect(0, 0, 320, 80);
    ctx.fillStyle = '#485043';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 160, 49);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    textures.push(t);
    const m = new T.MeshBasicMaterial({ map: t, toneMapped: false });
    materials.push(m);
    return mesh(p, new T.PlaneGeometry(w, w / 4), m, x, y, z);
  }

  // Repeated floor boards remain real geometry; batch them by material after construction.
  const floors: Record<string, T.Group> = {};
  for (const id of ['living', 'bedroom', 'gallery'] as const) {
    const p = group(id);
    floors[id] = p;
    b(p, 8, 0.4, 6.8, 0, -0.23, 0, paleWood, 0.04);
    if (id === 'gallery') {
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 9; col++)
          b(
            p,
            0.876,
            0.036,
            0.829,
            -3.51 + col * 0.878,
            0.06,
            -2.92 + row * 0.831,
            (row + col) % 3 === 0 ? cream : galleryWall,
            0.001,
          );
    } else {
      for (let row = 0; row < 16; row++)
        for (let col = 0; col < 4; col++)
          b(
            p,
            1.976,
            0.035,
            0.407,
            -2.98 + col * 1.985,
            0.06,
            -3.16 + row * 0.417,
            row % 3 === 0 ? paleWood : oak,
            0.002,
          );
    }
  }
  // Exterior window bays face their room; no sky or rain is drawn inside furniture space.
  const windows: ReturnType<typeof createWindowEnvironment>[] = [];
  function windowWall(
    room: RoomId,
    id: ObjectId,
    side: 'back' | 'left' | 'right',
    wallMaterial: T.Material,
  ) {
    const parent = group(room, id),
      g = child(parent);
    if (side === 'back') g.position.set(0, 0, -3.31);
    else {
      g.position.set(side === 'left' ? -3.91 : 3.91, 0, 0);
      g.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    }
    const span = side === 'back' ? 8 : 6.8;
    b(
      g,
      (span - 3.28) / 2,
      3.65,
      0.17,
      -(span + 3.28) / 4,
      1.83,
      0,
      wallMaterial,
    );
    b(
      g,
      (span - 3.28) / 2,
      3.65,
      0.17,
      (span + 3.28) / 4,
      1.83,
      0,
      wallMaterial,
    );
    b(g, 3.28, 0.91, 0.17, 0, 0.46, 0, wallMaterial);
    b(g, 3.28, 0.62, 0.17, 0, 3.35, 0, wallMaterial);
    b(g, span, 0.1, 0.2, 0, 3.67, 0, white);
    b(g, span, 0.13, 0.2, 0, 0.15, 0.07, paleWood);
    const w = child(g, 0, 1.98, 0.03);
    windows.push(createWindowEnvironment(w, room, k.landscape));
    addWindowCraft(w, paleWood, brass, materials);
    for (const x of [-1.67, 1.67]) b(w, 0.14, 2.35, 0.23, x, 0, 0.04, oak);
    for (const y of [-1.13, 1.13]) b(w, 3.49, 0.14, 0.23, 0, y, 0.04, oak);
    b(w, 0.065, 2.18, 0.08, 0, 0, 0.12, white);
    b(w, 3.22, 0.06, 0.08, 0, -0.05, 0.12, white);
    b(w, 3.57, 0.1, 0.4, 0, -1.18, 0.14, paleWood);
    rod(w, [-1.94, 1.3, 0.15], [1.94, 1.3, 0.15], 0.025, brass);
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const curtain = cyl(
          w,
          0.072,
          0.083,
          2.45,
          side * (1.65 + i * 0.067),
          0,
          0.16 + Math.sin(i * 1.5) * 0.035,
          ivoryCloth,
        );
        curtain.scale.z = 0.7;
        const ring = torus(
          w,
          0.052,
          0.008,
          side * (1.65 + i * 0.067),
          1.3,
          0.15,
          brass,
        );
        ring.rotation.y = Math.PI / 2;
      }
    return parent;
  }
  // The living-room TV occupies the solid north wall; its window is on the east facade.
  const livingBack = group('living');
  b(livingBack, 8, 3.65, 0.17, 0, 1.83, -3.31, cream);
  b(livingBack, 8, 0.1, 0.2, 0, 3.67, -3.31, white);
  b(livingBack, 8, 0.14, 0.2, 0, 0.15, -3.22, paleWood);
  const livingWindow = windowWall('living', 'livingWindow', 'right', cream);
  windowWall('bedroom', 'bedroomWindow', 'left', terracottaWall);
  const galleryWindow = windowWall(
    'gallery',
    'galleryWindow',
    'right',
    galleryWall,
  );

  // LIVING ROOM. Seats look north at the screen, with an uninterrupted west-side aisle.
  const lf = houseFurniture.living;
  const sofa = group('living', 'livingSofa', lf.sofa.x, 0, lf.sofa.z);
  sofa.rotation.y = Math.PI;
  feet(sofa, 3.12, 1.08, 0.24);
  b(sofa, 3.55, 0.24, 1.38, 0, 0.43, 0, oak, 0.07);
  b(sofa, 3.31, 0.65, 0.19, 0, 0.91, -0.57, sofaCloth, 0.09);
  for (const x of [-1.64, 1.64])
    cushion(sofa, 0.27, 0.6, 1.32, x, 0.82, 0, sofaCloth);
  for (const x of [-1.05, 0, 1.05]) {
    cushion(sofa, 1.0, 0.22, 1.12, x, 0.67, 0.025, sofaCloth);
    const back = cushion(sofa, 1.02, 0.56, 0.2, x, 0.99, -0.38, sofaCloth);
    back.rotation.x = -0.13;
  }
  const pillow = cushion(
    sofa,
    0.48,
    0.48,
    0.18,
    -1.13,
    0.98,
    -0.22,
    ivoryCloth,
  );
  pillow.rotation.z = 0.22;
  const pillow2 = cushion(
    sofa,
    0.42,
    0.44,
    0.17,
    1.06,
    0.98,
    -0.22,
    fabric('#b9816c'),
  );
  pillow2.rotation.z = -0.18;
  const throwMat = fabric('#b4b6a0');
  for (let i = 0; i < 10; i++)
    b(
      sofa,
      0.052,
      0.025,
      0.99,
      -0.48 + i * 0.052,
      0.806,
      0.12,
      throwMat,
      0.009,
    );
  const rug = group('living');
  b(rug, 4.5, 0.027, 3.32, 0.55, 0.096, 0.15, ivoryCloth, 0.08);
  for (const x of [-1.55, 2.66])
    b(rug, 0.017, 0.004, 3.05, x, 0.112, 0.15, sage, 0);
  const table = group('living', undefined, lf.table.x, 0, lf.table.z);
  feet(table, 1.35, 0.52, 0.52);
  b(table, 1.75, 0.1, 0.83, 0, 0.63, 0, oak, 0.13);
  b(table, 1.45, 0.055, 0.58, 0, 0.29, 0, darkWood, 0.025);
  book(table, 0.42, 0.32, -0.43, 0.736, 0.05, green);
  book(table, 0.38, 0.3, -0.41, 0.83, 0.04, terracotta);
  cyl(table, 0.18, 0.18, 0.025, 0.49, 0.7, 0.04, brass);
  cyl(table, 0.065, 0.05, 0.12, 0.49, 0.77, 0.04, cream);
  const handle = torus(table, 0.042, 0.011, 0.56, 0.79, 0.04, cream);
  handle.rotation.y = Math.PI / 2;
  // Slatted walnut media console, open equipment bays, sliding collection drawer and cable routes.
  const cabinet = group('living', undefined, lf.media.x, 0, lf.media.z);
  feet(cabinet, 4.2, 0.46, 0.18);
  for (const y of [0.29, 0.86])
    b(cabinet, 4.55, 0.085, 0.72, 0, y, 0, oak, 0.025);
  for (const x of [-2.23, -0.68, 0.69, 2.23])
    b(cabinet, 0.08, 0.54, 0.72, x, 0.575, 0, oak);
  b(cabinet, 4.5, 0.5, 0.035, 0, 0.57, -0.34, darkWood);
  const md = group('living', 'mediaDrawer', lf.media.x + 1.45, 0, lf.media.z);
  const mediaDrawer = child(md);
  b(mediaDrawer, 1.39, 0.4, 0.07, 0, 0.58, 0.34, oak);
  for (let i = 0; i < 17; i++)
    b(
      mediaDrawer,
      0.033,
      0.36,
      0.026,
      -0.65 + i * 0.081,
      0.58,
      0.39,
      paleWood,
      0.008,
    );
  b(mediaDrawer, 0.34, 0.026, 0.035, 0, 0.73, 0.423, brass, 0.009);
  b(mediaDrawer, 1.26, 0.045, 0.5, 0, 0.4, 0.04, darkWood);
  for (let i = 0; i < 7; i++)
    b(
      mediaDrawer,
      0.12,
      0.29,
      0.34,
      -0.48 + i * 0.15,
      0.56,
      0.065,
      i % 3 === 0 ? green : ivoryCloth,
      0.014,
    );
  // Television bezel, rear casing, vents, feet, status diode and soundbar drivers.
  const tv = group('living', 'television', lf.media.x, 0, lf.media.z - 0.02);
  b(tv, 4.3, 2.46, 0.135, 0, 2.27, -0.005, black, 0.055);
  b(tv, 3.7, 1.6, 0.13, 0, 2.27, -0.13, charcoal, 0.06);
  for (let i = 0; i < 26; i++)
    b(tv, 0.063, 0.38, 0.01, -1.3 + i * 0.105, 2.55, -0.205, darkWood, 0.003);
  for (const sign of [-1, 1]) {
    rod(
      tv,
      [sign * 1.36, 1.08, -0.07],
      [sign * 1.62, 0.915, 0.18],
      0.026,
      black,
    );
    rod(
      tv,
      [sign * 1.36, 1.08, -0.07],
      [sign * 1.17, 0.915, -0.25],
      0.026,
      black,
    );
  }
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 1280;
  screenCanvas.height = 720;
  const screenTexture = new T.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = T.SRGBColorSpace;
  textures.push(screenTexture);
  const screenMat = new T.MeshBasicMaterial({
    map: screenTexture,
    toneMapped: false,
  });
  materials.push(screenMat);
  const screen = mesh(
    tv,
    new T.PlaneGeometry(4.12, 2.3175),
    screenMat,
    0,
    2.3,
    0.071,
  );
  const diode = mat('#7a4030');
  diode.emissive.set('#ed7143');
  diode.emissiveIntensity = 0.7;
  ball(tv, 0.013, 0, 1.067, 0.075, diode);
  b(tv, 2.1, 0.115, 0.13, 0, 0.98, 0.12, charcoal, 0.045);
  for (let i = 0; i < 70; i++)
    ball(tv, 0.0055, -0.91 + i * 0.026, 0.98, 0.188, black);
  line(
    tv,
    [
      [0.7, 1.1, -0.12],
      [0.8, 0.93, -0.29],
      [1.1, 0.5, -0.29],
      [0.5, 0.36, -0.28],
    ],
    0.015,
    black,
  );
  const tvLight = new T.PointLight('#a3bbc7', 0, 4, 2);
  tvLight.position.set(0, 2.2, 0.4);
  tv.add(tvLight);
  let tvOn = false;
  function paintTV(on: boolean, source = '') {
    tvOn = on;
    const c = screenCanvas.getContext('2d')!;
    c.fillStyle = on ? '#20382f' : '#121919';
    c.fillRect(0, 0, 1280, 720);
    const gradient = c.createLinearGradient(0, 0, 1280, 720);
    gradient.addColorStop(0, on ? '#7c958850' : '#42534915');
    gradient.addColorStop(1, '#0c171500');
    c.fillStyle = gradient;
    c.fillRect(0, 0, 1280, 720);
    if (on) {
      c.fillStyle = '#eae4d0';
      c.font = '18px sans-serif';
      c.fillText('SATORI / HOME CINEMA', 68, 66);
      c.font = '48px sans-serif';
      c.fillText(source || 'A quiet evening.', 68, 285);
      c.font = '21px sans-serif';
      c.fillStyle = '#a6b6a1';
      c.fillText('YOUTUBE    /    LOCAL VIDEO', 70, 344);
      for (let i = 0; i < 3; i++) {
        c.fillStyle = ['#acb5a0', '#c18e70', '#718f8c'][i];
        c.fillRect(70 + i * 370, 430, 330, 175);
        c.strokeStyle = '#eee5cf';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(235 + i * 370, 518, 45, 0, Math.PI * 2);
        c.stroke();
      }
    }
    screenTexture.needsUpdate = true;
    diode.emissive.set(on ? '#8ddca5' : '#ed7143');
  }
  paintTV(false);
  // Switch-style hybrid console with dock, screen, separate Joy-Con rails and controls.
  const sw = group(
    'living',
    'switch',
    lf.media.x - 1.46,
    -0.63,
    lf.media.z + 0.02,
  );
  b(sw, 0.87, 0.4, 0.23, 0, 1.09, 0, charcoal, 0.06);
  b(sw, 0.92, 0.49, 0.07, 0, 1.21, -0.07, black, 0.045);
  b(sw, 0.69, 0.37, 0.006, 0, 1.235, -0.029, green, 0.014);
  const joyColors = [mat('#79b7b8'), mat('#d87660')];
  const joycons: T.Group[] = [];
  for (const sign of [-1, 1]) {
    const joy = child(sw, sign * 0.48, 1.235, -0.035);
    joycons.push(joy);
    b(joy, 0.16, 0.49, 0.074, 0, 0, 0, joyColors[sign === -1 ? 0 : 1], 0.058);
    const joyY = sign === -1 ? 0.1 : -0.08;
    const stick = cyl(joy, 0.034, 0.03, 0.026, 0, joyY, 0.05, black);
    stick.rotation.x = Math.PI / 2;
    for (const [dx, dy] of [
      [0, 0.039],
      [0.039, 0],
      [0, -0.039],
      [-0.039, 0],
    ])
      ball(
        joy,
        0.014,
        dx,
        (sign === -1 ? -0.1 : 0.11) + dy,
        0.044,
        black,
        1,
        1,
        0.45,
      );
    b(joy, 0.045, 0.007, 0.006, 0, 0.187, 0.042, white, 0.001);
    b(joy, 0.11, 0.029, 0.043, 0, 0.252, -0.013, black, 0.014);
    for (let i = 0; i < 4; i++)
      ball(joy, 0.0035, -0.025 + i * 0.016, -0.202, 0.042, white);
  }
  label(sw, 'SWITCH', 0, 1.1, 0.12, 0.43);
  const console = group(
    'living',
    'console',
    lf.media.x - 0.03,
    0,
    lf.media.z + 0.06,
  );
  b(console, 0.94, 0.13, 0.45, 0, 0.43, 0, black, 0.035);
  b(console, 0.97, 0.025, 0.46, 0, 0.51, 0, white, 0.025);
  const consoleLed = mat('#354e56');
  consoleLed.emissive.set('#7cb9d8');
  consoleLed.emissiveIntensity = 0.1;
  b(console, 0.59, 0.009, 0.012, -0.1, 0.475, 0.233, consoleLed, 0.002);
  for (let i = 0; i < 17; i++)
    b(
      console,
      0.025,
      0.07,
      0.008,
      -0.39 + i * 0.043,
      0.43,
      0.232,
      charcoal,
      0.004,
    );
  // Speakers sit symmetrically on the cabinet, clear of the TV image.
  for (const sign of [-1, 1]) {
    const speaker = child(cabinet, sign * 1.98, 0.9, 0.05);
    b(speaker, 0.3, 0.45, 0.26, 0, 0.225, 0, charcoal, 0.035);
    for (const [yy, rr] of [
      [0.15, 0.089],
      [0.34, 0.044],
    ]) {
      const ring = torus(speaker, rr, 0.012, 0, yy, 0.139, black);
      ball(speaker, rr * 0.7, 0, yy, 0.142, black, 1, 1, 0.2);
      ring.castShadow = false;
    }
  }
  const padMat = mat('#d0c8b2', 0.54);
  const controller = group(
    'living',
    'controller',
    lf.table.x + 0.12,
    0,
    lf.table.z + 0.04,
  );
  controller.rotation.x = -Math.PI / 2;
  // Controls are constructed on local XY; rotate the assembly flat onto the coffee table.
  controller.position.y = 0.748;
  b(controller, 0.44, 0.2, 0.085, 0, 0, 0, padMat, 0.065);
  for (const sign of [-1, 1]) {
    const grip = b(
      controller,
      0.16,
      0.27,
      0.095,
      sign * 0.17,
      -0.055,
      0,
      padMat,
      0.065,
    );
    grip.rotation.z = sign * 0.22;
    const stick = cyl(
      controller,
      0.035,
      0.028,
      0.034,
      sign * 0.08,
      -0.015,
      0.06,
      black,
    );
    stick.rotation.x = Math.PI / 2;
  }
  b(controller, 0.075, 0.019, 0.018, -0.14, 0.052, 0.062, black, 0.005);
  b(controller, 0.019, 0.075, 0.018, -0.14, 0.052, 0.062, black, 0.005);
  for (const [dx, dy] of [
    [0, 0.03],
    [0.03, 0],
    [0, -0.03],
    [-0.03, 0],
  ])
    ball(controller, 0.012, 0.14 + dx, 0.05 + dy, 0.056, black, 1, 1, 0.4);
  const remote = child(table, 0.65, 0.723, -0.21);
  b(remote, 0.1, 0.026, 0.3, 0, 0, 0, black, 0.022);
  for (let i = 0; i < 5; i++)
    for (const x of [-0.024, 0.024])
      ball(remote, 0.008, x, 0.018, -0.06 + i * 0.034, ivoryCloth, 1, 0.4, 1);
  const floorLamp = group('living', 'livingLamp', lf.lamp.x, 0, lf.lamp.z);
  cyl(floorLamp, 0.29, 0.31, 0.05, 0, 0.11, 0, brass);
  line(
    floorLamp,
    [
      [0, 0.13, 0],
      [0, 1.8, 0],
      [-0.16, 2.36, 0],
      [-0.72, 2.32, 0],
      [-0.88, 2.06, 0],
    ],
    0.022,
    brass,
  );
  const livingShade = mat('#ded0ac');
  livingShade.side = T.DoubleSide;
  cyl(floorLamp, 0.15, 0.34, 0.32, -0.88, 1.95, 0, livingShade);
  const livingLight = new T.PointLight('#ffcc86', 4, 5, 2);
  livingLight.position.set(-0.88, 1.75, 0);
  floorLamp.add(livingLight);
  plant(roots.living, -2.9, 0.08, -2.6, 1.35);

  // BEDROOM. Bed axis points toward the foot bench; both sides and the wardrobe remain reachable.
  const bf = houseFurniture.bedroom;
  const bed = group('bedroom', 'sleepBed', bf.bed.x, 0, bf.bed.z);
  feet(bed, 2.56, 3.14, 0.27);
  b(bed, 2.9, 0.26, 3.65, 0, 0.4, 0, oak, 0.085);
  b(bed, 3.02, 1.02, 0.16, 0, 0.94, -1.74, oak, 0.09);
  for (const x of [-0.73, 0.73])
    cushion(bed, 1.42, 0.78, 0.14, x, 1.02, -1.635, ivoryCloth);
  cushion(bed, 2.79, 0.32, 3.43, 0, 0.68, 0.02, bedCloth);
  cushion(bed, 2.77, 0.12, 2.29, 0, 0.898, 0.59, bedCloth);
  for (const x of [-0.72, 0.72]) {
    const p = cushion(bed, 1.16, 0.2, 0.66, x, 0.952, -1.05, bedCloth);
    p.rotation.y = x * 0.06;
    const q = cushion(bed, 0.9, 0.17, 0.51, x, 0.98, -0.72, ivoryCloth);
    q.rotation.y = -x * 0.05;
  }
  // Woven runner bends over the foot, with raised seams and fringe.
  b(bed, 2.83, 0.045, 0.68, 0, 0.985, 1.02, blanketCloth, 0.03);
  b(bed, 2.83, 0.32, 0.04, 0, 0.81, 1.354, blanketCloth, 0.015);
  for (let i = 0; i < 35; i++) {
    b(bed, 0.012, 0.01, 0.65, -1.36 + i * 0.08, 1.01, 1.02, ivoryCloth, 0.003);
    rod(
      bed,
      [-1.36 + i * 0.08, 0.67, 1.373],
      [-1.36 + i * 0.08, 0.59, 1.378],
      0.005,
      ivoryCloth,
    );
  }
  const bedRug = group('bedroom');
  b(bedRug, 4.18, 0.028, 4.39, -0.5, 0.098, 0.05, ivoryCloth, 0.08);
  const lamps: T.PointLight[] = [];
  const bedside = group('bedroom', 'bedsideLamp');
  for (const x of [-2.55, 1.54]) {
    const stand = child(roots.bedroom, x, 0, -1.94);
    feet(stand, 0.49, 0.51, 0.14);
    b(stand, 0.66, 0.49, 0.69, 0, 0.42, 0, oak, 0.04);
    b(stand, 0.59, 0.2, 0.035, 0, 0.48, 0.356, paleWood, 0.015);
    b(stand, 0.16, 0.014, 0.03, 0, 0.48, 0.385, brass, 0.005);
    b(stand, 0.72, 0.065, 0.75, 0, 0.704, 0, paleWood, 0.025);
    const light = child(bedside, x, 0.742, -1.98);
    cyl(light, 0.12, 0.15, 0.045, 0, 0.023, 0, brass);
    cyl(light, 0.018, 0.018, 0.3, 0, 0.18, 0, brass);
    cyl(light, 0.12, 0.22, 0.26, 0, 0.42, 0, ivoryCloth);
    const glow = new T.PointLight('#ffd391', 3, 3, 2);
    glow.position.set(0, 0.38, 0);
    light.add(glow);
    lamps.push(glow);
  }
  const sleepBook = group('bedroom', 'bedroomBook', -2.55, 0.78, -1.77);
  book(sleepBook, 0.27, 0.34, 0, 0, 0, green);
  book(sleepBook, 0.25, 0.3, 0.025, 0.095, -0.03, terracotta);
  // A quiet analogue alarm clock on the right nightstand.
  const clock = child(roots.bedroom, 1.6, 0.89, -1.78);
  const face = cyl(clock, 0.1, 0.1, 0.055, 0, 0, 0, cream);
  face.rotation.x = Math.PI / 2;
  const rim = torus(clock, 0.105, 0.012, 0, 0, 0.033, brass);
  rim.castShadow = false;
  for (let i = 0; i < 12; i++)
    ball(
      clock,
      0.005,
      Math.sin((i * Math.PI) / 6) * 0.078,
      Math.cos((i * Math.PI) / 6) * 0.078,
      0.034,
      black,
    );
  rod(clock, [0, 0, 0.038], [0, 0.054, 0.038], 0.005, black);
  rod(clock, [0, 0, 0.04], [0.043, -0.025, 0.04], 0.004, black);
  feet(clock, 0.12, 0.03, 0.04);
  const wardrobe = group(
    'bedroom',
    'wardrobe',
    bf.wardrobe.x,
    0,
    bf.wardrobe.z,
  );
  wardrobe.rotation.y = -Math.PI / 2;
  for (const x of [-1.235, 1.235])
    b(wardrobe, 0.08, 2.62, 0.84, x, 1.41, 0, oak, 0.025);
  for (const y of [0.14, 2.7])
    b(wardrobe, 2.55, 0.08, 0.84, 0, y, 0, oak, 0.025);
  b(wardrobe, 2.38, 2.44, 0.05, 0, 1.42, -0.4, darkWood, 0.01);
  for (const yy of [0.29, 1.08, 2.47])
    b(wardrobe, 2.33, 0.06, 0.62, 0, yy, 0, paleWood, 0.013);
  rod(wardrobe, [-1.06, 2.29, 0.05], [0.05, 2.29, 0.05], 0.012, brass);
  for (let i = 0; i < 4; i++) {
    const xx = -0.86 + i * 0.24;
    line(
      wardrobe,
      [
        [xx, 2.27, 0.05],
        [xx - 0.09, 2.09, 0.05],
        [xx + 0.09, 2.09, 0.05],
        [xx, 2.27, 0.05],
      ],
      0.009,
      brass,
    );
    const garment = child(wardrobe, xx, 1.82, 0.05),
      cloth = i % 2 ? ivoryCloth : blanketCloth;
    b(garment, 0.18, 0.43, 0.065, 0, 0, 0, cloth, 0.028);
    for (const sign of [-1, 1]) {
      const sleeve = b(
        garment,
        0.064,
        0.22,
        0.065,
        sign * 0.11,
        0.065,
        0,
        cloth,
        0.025,
      );
      sleeve.rotation.z = sign * 0.24;
      const collar = b(
        garment,
        0.045,
        0.061,
        0.018,
        sign * 0.025,
        0.195,
        0.038,
        ivoryCloth,
        0.008,
      );
      collar.rotation.z = sign * 0.35;
    }
    b(garment, 0.004, 0.34, 0.003, 0, -0.015, 0.035, ivoryCloth, 0.001);
    for (let button = 0; button < 4; button++)
      ball(garment, 0.005, 0, 0.09 - button * 0.07, 0.04, brass, 1, 1, 0.4);
  }
  for (let i = 0; i < 3; i++)
    cushion(wardrobe, 0.83, 0.1, 0.46, 0.66, 1.17 + i * 0.115, 0.05, bedCloth);
  b(wardrobe, 0.87, 0.35, 0.55, 0.62, 0.49, 0.02, ivoryCloth, 0.025);
  const doors: T.Group[] = [];
  for (const sign of [-1, 1]) {
    const door = child(wardrobe, sign * 1.18, 0, 0.43);
    doors.push(door);
    b(door, 1.16, 2.47, 0.065, -sign * 0.58, 1.42, 0, paleWood, 0.025);
    for (let i = 0; i < 8; i++)
      b(
        door,
        0.01,
        2.34,
        0.009,
        -sign * (0.09 + i * 0.139),
        1.42,
        0.038,
        oak,
        0.002,
      );
    rod(
      door,
      [-sign * 1.035, 1.21, 0.067],
      [-sign * 1.035, 1.59, 0.067],
      0.013,
      brass,
    );
  }
  const bench = group('bedroom', undefined, bf.bench.x, 0, bf.bench.z);
  feet(bench, 1.98, 0.39, 0.37);
  b(bench, 2.28, 0.08, 0.56, 0, 0.47, 0, oak, 0.04);
  cushion(bench, 2.24, 0.12, 0.55, 0, 0.57, 0, blanketCloth);
  plant(roots.bedroom, -2.9, 0.08, 2.38, 1.25);
  const basket = child(roots.bedroom, 2.73, 0.08, 2.55);
  cyl(basket, 0.3, 0.25, 0.42, 0, 0.21, 0, ivoryCloth);
  for (let i = 0; i < 9; i++) {
    const ring = torus(
      basket,
      0.25 + i * 0.0055,
      0.009,
      0,
      0.035 + i * 0.044,
      0,
      paleWood,
    );
    ring.rotation.x = Math.PI / 2;
  }
  cushion(basket, 0.36, 0.17, 0.39, 0, 0.44, 0, bedCloth);

  // GALLERY. Wall pieces, independent pedestals and a viewing bench with clear circulation.
  const art = group('gallery', 'galleryArt');
  for (let i = 0; i < 3; i++) {
    const x = -0.65 + i * 1.43;
    b(art, 1.25, 1.68, 0.09, x, 2.05, -3.145, oak, 0.018);
    b(art, 1.14, 1.57, 0.013, x, 2.05, -3.09, white, 0.005);
    const painting = mesh(
      art,
      new T.PlaneGeometry(0.96, 1.39),
      k.artMats[i],
      x,
      2.05,
      -3.079,
    );
    painting.castShadow = false;
    label(art, `0${i + 1} / SELECTED WORK`, x, 1.08, -3.07, 0.62);
  }
  const galleryLamps = group('gallery', 'galleryLight');
  b(galleryLamps, 5.5, 0.06, 0.065, 0.65, 3.32, -2.64, charcoal, 0.015);
  const spotlights: T.SpotLight[] = [];
  for (let i = 0; i < 3; i++) {
    const x = -0.65 + i * 1.43;
    rod(galleryLamps, [x, 3.33, -2.64], [x, 3.11, -2.62], 0.015, brass);
    const hood = cyl(galleryLamps, 0.07, 0.095, 0.2, x, 3.06, -2.72, charcoal);
    hood.rotation.x = -0.6;
    const light = new T.SpotLight('#fff0c8', 4, 5, 0.62, 0.65, 1.3);
    light.position.set(x, 3.0, -2.56);
    light.target.position.set(x, 1.8, -3.1);
    galleryLamps.add(light, light.target);
    spotlights.push(light);
  }
  const plinth = group('gallery', 'gallerySculpture', 0.1, 0, -0.45);
  b(plinth, 1, 0.92, 1, 0, 0.55, 0, cream, 0.035);
  b(plinth, 1.05, 0.045, 1.05, 0, 1.03, 0, white, 0.012);
  const sculpture = child(plinth, 0, 1.06, 0);
  cyl(sculpture, 0.2, 0.24, 0.055, 0, 0.025, 0, brass);
  const r1 = torus(sculpture, 0.36, 0.045, 0, 0.5, 0, brass);
  r1.rotation.y = 0.6;
  const r2 = torus(sculpture, 0.24, 0.039, 0.05, 0.77, 0, terracotta);
  r2.rotation.y = -0.3;
  ball(sculpture, 0.09, -0.24, 0.31, 0, green);
  label(plinth, '01 / ORBIT', 0, 0.75, 0.506, 0.54);
  const caseGroup = group('gallery', 'galleryCase', 2.5, 0, 0.2);
  b(caseGroup, 0.82, 0.76, 1.7, 0, 0.48, 0, oak, 0.025);
  b(caseGroup, 0.86, 0.06, 1.74, 0, 0.89, 0, ivoryCloth, 0.008);
  const lid = child(caseGroup, -0.44, 0.92, 0);
  for (const x of [0, 0.88])
    b(lid, 0.012, 0.53, 1.78, x, 0.265, 0, glass, 0.001);
  for (const z of [-0.89, 0.89])
    b(lid, 0.88, 0.53, 0.012, 0.44, 0.265, z, glass, 0.001);
  b(lid, 0.88, 0.012, 1.78, 0.44, 0.53, 0, glass, 0.001);
  for (const x of [0, 0.88])
    for (const z of [-0.89, 0.89])
      rod(lid, [x, 0, z], [x, 0.53, z], 0.007, glassEdge);
  for (let i = 0; i < 3; i++) {
    const o = child(caseGroup, 0, 0.94, -0.53 + i * 0.53);
    cyl(o, 0.1, 0.12, 0.028, 0, 0.014, 0, cream);
    if (i === 0) {
      const orbit = torus(o, 0.13, 0.028, 0, 0.19, 0, brass);
      orbit.rotation.y = 0.6;
      cyl(o, 0.018, 0.025, 0.09, 0, 0.045, 0, brass);
    } else if (i === 1) {
      cyl(o, 0.1, 0.07, 0.24, 0, 0.14, 0, terracotta);
      cyl(o, 0.078, 0.078, 0.008, 0, 0.262, 0, darkWood);
      const lip = torus(o, 0.093, 0.009, 0, 0.265, 0, terracotta);
      lip.rotation.x = Math.PI / 2;
      torus(o, 0.045, 0.014, 0.11, 0.16, 0, terracotta);
    } else {
      b(o, 0.19, 0.21, 0.14, 0, 0.115, 0, green, 0.012);
      ball(o, 0.067, 0, 0.265, 0, brass);
    }
  }
  const galleryBench = group('gallery', undefined, -0.1, 0, 2.1);
  feet(galleryBench, 1.98, 0.47, 0.39);
  b(galleryBench, 2.25, 0.09, 0.67, 0, 0.49, 0, oak, 0.04);
  cushion(galleryBench, 2.19, 0.13, 0.63, 0, 0.59, 0, ivoryCloth);
  const catalogue = group('gallery', undefined, -2.9, 0, -0.15);
  b(catalogue, 0.8, 0.89, 0.7, 0, 0.535, 0, oak);
  b(catalogue, 0.92, 0.07, 0.83, 0, 1.01, 0, paleWood, 0.04);
  book(catalogue, 0.44, 0.57, 0, 1.1, 0, green);
  book(catalogue, 0.41, 0.56, 0.02, 1.2, 0, ivoryCloth);
  label(catalogue, 'CATALOGUE', 0, 0.74, 0.36, 0.53);
  plant(roots.gallery, -2.9, 0.08, 2.34, 1.65);

  // Shared partitions contain real 1.4-unit door openings, aligned with each room's aisles.
  const partitions: { base: T.Group; upper: T.Group; neighbours: RoomId[] }[] =
    [];
  function partition(
    x: number,
    z: number,
    length: number,
    rotation: number,
    door: number,
    neighbours: RoomId[],
    m: T.Material,
  ) {
    const base = new T.Group(),
      upper = new T.Group();
    for (const g of [base, upper]) {
      g.position.set(x, 0, z);
      g.rotation.y = rotation;
      k.scene.add(g);
    }
    const left = door - 0.7,
      right = door + 0.7;
    for (const [a, bx] of [
      [-length / 2, left],
      [right, length / 2],
    ]) {
      const span = bx - a;
      if (span <= 0) continue;
      b(base, span, 0.73, 0.14, (a + bx) / 2, 0.445, 0, m, 0.015);
      b(base, span, 0.06, 0.19, (a + bx) / 2, 0.84, 0, paleWood, 0.008);
      b(upper, span, 2.82, 0.14, (a + bx) / 2, 2.21, 0, m, 0.015);
    }
    b(upper, 1.4, 0.95, 0.14, door, 3.175, 0, m, 0.012);
    for (const xx of [left, right]) {
      b(upper, 0.07, 2.63, 0.2, xx, 1.395, 0, oak, 0.012);
      b(base, 0.07, 0.77, 0.2, xx, 0.465, 0, oak, 0.01);
    }
    b(upper, 1.47, 0.07, 0.2, door, 2.74, 0, oak, 0.012);
    b(base, 1.4, 0.025, 0.26, door, 0.09, 0, paleWood, 0.005);
    partitions.push({ base, upper, neighbours });
  }
  partition(4, 0, 6.8, Math.PI / 2, -1.75, ['study', 'living'], cream);
  partition(
    4,
    6.8,
    6.8,
    Math.PI / 2,
    -1.85,
    ['bedroom', 'gallery'],
    galleryWall,
  );
  partition(0, 3.4, 8, 0, 2.65, ['study', 'bedroom'], terracottaWall);
  partition(8, 3.4, 8, 0, -2.4, ['living', 'gallery'], galleryWall);
  // Cutaway exterior edge: reveal interiors while retaining a continuous house footprint.
  const edges = new T.Group();
  k.scene.add(edges);
  b(edges, 12.9, 0.22, 0.13, 2.45, 0.19, 10.14, paleWood, 0.015);
  b(edges, 1.7, 0.22, 0.13, 11.15, 0.19, 10.14, paleWood, 0.015);
  b(edges, 1.4, 0.025, 0.26, 9.6, 0.09, 10.14, paleWood, 0.005);
  b(edges, 0.13, 0.22, 13.6, 11.93, 0.19, 3.4, paleWood, 0.015);
  const planLabels = new T.Group();
  k.scene.add(planLabels);
  for (const [id, spec] of Object.entries(rooms)) {
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#faf6e9';
    ctx.beginPath();
    ctx.roundRect(8, 16, 368, 96, 48);
    ctx.fill();
    ctx.fillStyle = '#435540';
    ctx.font = '38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${spec.number}  ${spec.name}`, 192, 78);
    const texture = new T.CanvasTexture(c);
    texture.colorSpace = T.SRGBColorSpace;
    textures.push(texture);
    const material = new T.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    materials.push(material);
    const sprite = new T.Sprite(material);
    sprite.position.set(spec.x, 1, spec.z + 2.75);
    sprite.scale.set(2.15, 0.72, 1);
    sprite.renderOrder = 30;
    sprite.userData.room = id;
    planLabels.add(sprite);
  }
  const compassCanvas = document.createElement('canvas');
  compassCanvas.width = compassCanvas.height = 128;
  const cc = compassCanvas.getContext('2d')!;
  cc.fillStyle = '#52624c';
  cc.font = '26px sans-serif';
  cc.textAlign = 'center';
  cc.fillText('N', 64, 28);
  cc.beginPath();
  cc.moveTo(64, 38);
  cc.lineTo(47, 94);
  cc.lineTo(64, 82);
  cc.lineTo(81, 94);
  cc.closePath();
  cc.fill();
  const compassTexture = new T.CanvasTexture(compassCanvas);
  compassTexture.colorSpace = T.SRGBColorSpace;
  textures.push(compassTexture);
  const compassMaterial = new T.MeshBasicMaterial({
    map: compassTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  materials.push(compassMaterial);
  const compass = new T.Mesh(new T.PlaneGeometry(1.1, 1.1), compassMaterial);
  compass.rotation.x = -Math.PI / 2;
  compass.position.set(4, 0.6, -4.18);
  compass.renderOrder = 30;
  planLabels.add(compass);
  planLabels.visible = false;

  // Merge static siblings by material, preserving all interactive and animated groups.
  function batch(parent: T.Object3D) {
    parent.children
      .filter((o) => o instanceof T.Group)
      .forEach((o) => batch(o));
    const bins = new Map<T.Material, T.Mesh[]>();
    for (const o of parent.children) {
      if (
        !(o instanceof T.Mesh) ||
        o === screen ||
        o.material === glass ||
        o.material === diode ||
        o.material === consoleLed ||
        o.geometry instanceof T.PlaneGeometry
      )
        continue;
      const m = o.material;
      if (Array.isArray(m)) continue;
      const list = bins.get(m) || [];
      list.push(o);
      bins.set(m, list);
    }
    for (const [m, list] of bins) {
      if (list.length < 3) continue;
      const copies = list.map((o) => {
        o.updateMatrix();
        return (
          o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
        ).applyMatrix4(o.matrix);
      });
      const geo = mergeGeometries(copies);
      copies.forEach((g) => g.dispose());
      if (!geo) continue;
      const merged = mesh(parent, geo, m);
      merged.castShadow = list.some((o) => o.castShadow);
      for (const o of list) {
        parent.remove(o);
        o.geometry.dispose();
      }
    }
  }
  // Window groups own their resources and animations; keep them separate from batching.
  for (const room of ['living', 'bedroom', 'gallery'] as const)
    for (const g of roots[room].children) {
      if (g.userData.id?.endsWith('Window')) continue;
      batch(g);
    }
  for (const p of partitions) {
    batch(p.base);
    batch(p.upper);
  }
  let pulled = false,
    joyOut = false,
    consoleOn = false,
    wardrobeOpen = false,
    caseOpen = false,
    angle = 0,
    lampOn = true,
    bedLampOn = true,
    exhibitOn = true,
    sofaIndex = 0,
    bedIndex = 0,
    padIndex = 0;
  let currentView: HouseView = 'study';
  let videoTexture: T.VideoTexture | null = null;
  return {
    roots,
    setView(view: HouseView) {
      currentView = view;
      planLabels.visible = view === 'plan';
      art.visible = galleryLamps.visible = view !== 'plan';
      const all = view === 'overview' || view === 'plan';
      for (const id of Object.keys(rooms) as RoomId[])
        roots[id].visible = all || view === id;
      for (const p of partitions) {
        p.base.visible = all || p.neighbours.includes(view as RoomId);
        p.upper.visible =
          view === 'overview' || (!all && view === p.neighbours[1]);
      }
      // East walls are cut away in overview and room views; show their low sill and window on demand.
      livingWindow.visible = view === 'plan';
      galleryWindow.visible = view === 'plan';
      // East facades reappear when the camera moves to the interior side of the window.
      edges.visible = all;
    },
    setEnvironment(value: Environment) {
      windows.forEach((w) => w.set(value));
    },
    setTelevision(on: boolean, source = '') {
      paintTV(on, source);
      if (!on) {
        videoTexture?.dispose();
        videoTexture = null;
        screenMat.map = screenTexture;
      }
    },
    setVideo(video: HTMLVideoElement | null) {
      videoTexture?.dispose();
      videoTexture = video ? new T.VideoTexture(video) : null;
      if (videoTexture) videoTexture.colorSpace = T.SRGBColorSpace;
      screenMat.map = videoTexture || screenTexture;
      screenMat.needsUpdate = true;
    },
    interact(id: ObjectId) {
      if (id === 'livingSofa')
        sofaCloth.color.set(['#9b9f86', '#b7836e', '#7b929a'][++sofaIndex % 3]);
      if (id === 'switch') joyOut = !joyOut;
      if (id === 'console') consoleOn = !consoleOn;
      if (id === 'controller')
        padMat.color.set(['#d0c8b2', '#899d93', '#bf8d7e'][++padIndex % 3]);
      if (id === 'livingLamp') lampOn = !lampOn;
      if (id === 'mediaDrawer') pulled = !pulled;
      if (id === 'sleepBed') {
        const schemes = [
          ['#e9dfc9', '#788e89'],
          ['#e1c7b3', '#a57d6d'],
          ['#c7d2d3', '#788b9d'],
        ];
        const c = schemes[++bedIndex % 3];
        bedCloth.color.set(c[0]);
        blanketCloth.color.set(c[1]);
      }
      if (id === 'bedsideLamp') bedLampOn = !bedLampOn;
      if (id === 'wardrobe') wardrobeOpen = !wardrobeOpen;
      if (id === 'galleryCase') caseOpen = !caseOpen;
      if (id === 'gallerySculpture') angle += Math.PI / 2;
      if (id === 'galleryLight') exhibitOn = !exhibitOn;
    },
    update(
      t: number,
      dt: number,
      reduced: boolean,
      night: boolean,
      cameraX: number,
      viewer: T.Camera,
    ) {
      livingWindow.visible =
        (currentView === 'living' ||
          currentView === 'overview' ||
          currentView === 'plan') &&
        cameraX < 11.8;
      galleryWindow.visible =
        (currentView === 'gallery' ||
          currentView === 'overview' ||
          currentView === 'plan') &&
        cameraX < 11.8;
      const a = 1 - Math.exp(-dt * 5);
      windows.forEach((w) => w.update(t, dt, reduced, viewer));
      mediaDrawer.position.z = T.MathUtils.lerp(
        mediaDrawer.position.z,
        pulled ? 0.45 : 0,
        a,
      );
      joycons.forEach((g, i) => {
        const sign = i === 0 ? -1 : 1;
        g.position.x = T.MathUtils.lerp(
          g.position.x,
          sign * (joyOut ? 0.72 : 0.48),
          a,
        );
        g.position.y = T.MathUtils.lerp(g.position.y, joyOut ? 1.37 : 1.235, a);
      });
      doors.forEach(
        (g, i) =>
          (g.rotation.y = T.MathUtils.lerp(
            g.rotation.y,
            wardrobeOpen ? (i === 0 ? -1.78 : 1.78) : 0,
            a,
          )),
      );
      lid.rotation.z = T.MathUtils.lerp(lid.rotation.z, caseOpen ? 1.05 : 0, a);
      sculpture.rotation.y = T.MathUtils.lerp(sculpture.rotation.y, angle, a);
      livingLight.intensity = T.MathUtils.lerp(
        livingLight.intensity,
        lampOn ? (night ? 7 : 2.4) : 0,
        a,
      );
      lamps.forEach(
        (l) =>
          (l.intensity = T.MathUtils.lerp(
            l.intensity,
            bedLampOn ? (night ? 4 : 1.4) : 0,
            a,
          )),
      );
      spotlights.forEach(
        (l) =>
          (l.intensity = T.MathUtils.lerp(l.intensity, exhibitOn ? 4 : 0, a)),
      );
      consoleLed.emissiveIntensity = consoleOn ? 2 : 0.1;
      tvLight.intensity = T.MathUtils.lerp(
        tvLight.intensity,
        tvOn ? (night ? 2.1 : 0.5) : 0,
        a,
      );
    },
    roomForObject,
    dispose() {
      windows.forEach((w) => w.dispose());
      videoTexture?.dispose();
    },
  };
}
