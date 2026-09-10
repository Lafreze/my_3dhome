import {
  createCoffeeState,
  coffeeHeat,
  drinks,
  type CoffeeSnapshot,
  type Drink,
} from './coffee-state';
import { createSteamEffect } from './steam-effect';
import type { InteriorBreeze } from './interior-atmosphere';
import { addOakFloor } from './house-finishes';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ObjectId } from './room-data';
import type { WallCutaways } from './wall-cutaway';
import type { HouseLandscape } from './house-landscape';
import type { Environment } from './environment-data';
import { createWindowEnvironment } from './room-environment';
import { localPbr } from './room-materials';
import type { RoomAssets } from './asset-loading';
import {
  cafeLayout,
  cafeBistroTables,
  cafeChairs,
  cafeCounterItems,
} from './cafe-layout';
import { addCafeBotany } from './cafe-botany';
import { attachSeats, type SeatAnchors } from './seat-scene';

type Kit = {
  onCoffee: (state: CoffeeSnapshot) => void;
  assets: RoomAssets;
  breeze: InteriorBreeze;
  floorMaterials: T.MeshStandardMaterial[];
  contactMaterial: T.Material;
  oak: T.MeshStandardMaterial;
  darkWood: T.MeshStandardMaterial;
  cream: T.MeshStandardMaterial;
  white: T.MeshStandardMaterial;
  ceramic: T.MeshStandardMaterial;
  glass: T.MeshPhysicalMaterial;
  brass: T.MeshStandardMaterial;
  seats: SeatAnchors;
  root: T.Group;
  materials: T.Material[];
  textures: T.Texture[];
  groups: Map<ObjectId, T.Group>;
  interactables: T.Object3D[];
  cutaways: WallCutaways;
  landscape: HouseLandscape;
};
export function buildCafe(k: Kit) {
  const { root, materials, textures } = k;
  root.name = 'cafe';
  const mat = (color: string, roughness = 0.6, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    m.name = `cafe/${color}`;
    materials.push(m);
    return m;
  };
  const wood = k.oak,
    darkWood = k.darkWood,
    leather = mat('#71816c', 0.73),
    tan = mat('#ac7350', 0.64);
  for (const m of [leather, tan]) {
    Object.assign(
      m,
      localPbr(k.assets, textures, 'leather_white', new T.Vector2(2, 2), false),
    );
    m.normalScale.set(0.3, 0.3);
  }
  const green = mat('#829077', 0.78),
    plaster = k.cream,
    black = mat('#252c28', 0.48, 0.08),
    brass = k.brass,
    steel = mat('#afb5ac', 0.36, 0.9),
    ceramic = k.ceramic,
    coffee = mat('#663621', 0.25),
    roastedBean = mat('#060606', 0.78),
    beanCrease = mat('#010101', 0.9),
    crema = mat('#bd8b54', 0.45),
    milk = mat('#f7e9cb', 0.6),
    crumb = mat('#ce8b44', 0.85),
    cocoa = mat('#4f2c20', 0.8),
    leaf = mat('#456644', 0.88);
  k.breeze.add(leaf);
  const glass = k.glass;
  const stone = mat('#ddd2bc', 0.45);
  // Separate fine aggregate for the honed countertop, free of floor grout lines.
  const mineralCanvas = document.createElement('canvas');
  mineralCanvas.width = mineralCanvas.height = 512;
  const mc = mineralCanvas.getContext('2d')!;
  mc.fillStyle = '#ded6c4';
  mc.fillRect(0, 0, 512, 512);
  const noise = (i: number) => {
    const n = Math.sin(i * 127.1 + 31.7) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let i = 0; i < 6500; i++) {
    mc.fillStyle = ['#908d7930', '#ffffff50', '#61584018'][i % 3];
    mc.beginPath();
    mc.ellipse(
      noise(i) * 512,
      noise(i + 44) * 512,
      0.4 + noise(i + 89) * 1.7,
      0.3 + noise(i + 124) * 1.2,
      noise(i + 1) * 6.28,
      0,
      6.28,
    );
    mc.fill();
  }
  const mineral = new T.CanvasTexture(mineralCanvas);
  mineral.colorSpace = T.SRGBColorSpace;
  mineral.wrapS = mineral.wrapT = T.RepeatWrapping;
  mineral.anisotropy = 8;
  textures.push(mineral);
  stone.map = mineral;
  stone.bumpMap = mineral;
  stone.bumpScale = 0.004;
  const glow = mat('#fff2d7', 0.4);
  glow.emissive.set('#ffcb82');
  glow.emissiveIntensity = 0.65;
  const indicator = mat('#cad8a0', 0.4);
  indicator.emissive.set('#91c97a');
  indicator.emissiveIntensity = 0.7;
  const child = (p: T.Object3D, x = 0, y = 0, z = 0) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    p.add(g);
    return g;
  };
  function object(id: ObjectId, x = 0, y = 0, z = 0) {
    const g = child(root, x, y, z);
    g.name = id;
    g.userData.id = id;
    k.groups.set(id, g);
    k.interactables.push(g);
    return g;
  }
  function mesh(
    p: T.Object3D,
    geo: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    p.add(o);
    return o;
  }
  function box(
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    r = 0.015,
  ) {
    return mesh(
      p,
      r
        ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3))
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
    n = 32,
  ) {
    return mesh(p, new T.CylinderGeometry(rt, rb, h, n), m, x, y, z);
  }
  function ball(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    m: T.Material,
  ) {
    const o = mesh(p, new T.SphereGeometry(1, 20, 12), m, x, y, z);
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
  function tube(p: T.Object3D, points: number[][], r: number, m: T.Material) {
    return mesh(
      p,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(
          points.map((a) => new T.Vector3(a[0], a[1], a[2])),
        ),
        32,
        r,
        8,
        false,
      ),
      m,
    );
  }
  function rod(
    p: T.Object3D,
    a: number[],
    b: number[],
    r: number,
    m: T.Material,
  ) {
    const av = new T.Vector3(a[0], a[1], a[2]),
      bv = new T.Vector3(b[0], b[1], b[2]);
    const c = av.clone().add(bv).multiplyScalar(0.5),
      o = cyl(p, r, r, av.distanceTo(bv), c.x, c.y, c.z, m, 12);
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      bv.sub(av).normalize(),
    );
    return o;
  }
  function lathe(
    p: T.Object3D,
    points: number[][],
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) {
    return mesh(
      p,
      new T.LatheGeometry(
        points.map((a) => new T.Vector2(a[0], a[1])),
        48,
      ),
      m,
      x,
      y,
      z,
    );
  }
  function textPanel(
    p: T.Object3D,
    lines: string[],
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    bg = '#213c31',
    color = '#ecdfbc',
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.round((1024 * h) / w);
    const ctx = canvas.getContext('2d')!;
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 8;
    textures.push(tex);
    const m = mat('#ffffff', 0.88);
    m.map = tex;
    mesh(p, new T.PlaneGeometry(w, h), m, x, y, z);
    const paint = (rows: string[]) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = color + '80';
      ctx.lineWidth = 2;
      ctx.strokeRect(25, 25, 974, canvas.height - 50);
      ctx.fillStyle = color;
      ctx.textAlign = rows.length === 1 ? 'center' : 'left';
      if (rows.length === 1) {
        const size = Math.min(57, canvas.height * 0.43);
        ctx.font = `500 ${size}px Georgia`;
        ctx.textBaseline = 'middle';
        ctx.fillText(rows[0], 512, canvas.height / 2, 880);
        ctx.textBaseline = 'alphabetic';
        tex.needsUpdate = true;
        return;
      }
      rows.forEach((line, i) => {
        ctx.font = `${i === 0 ? '500' : '400'} ${i === 0 ? 57 : 36}px ${i === 0 ? 'Georgia' : 'sans-serif'}`;
        ctx.fillText(
          line,
          65,
          95 + (i * (canvas.height - 135)) / Math.max(1, rows.length - 1),
        );
      });
      tex.needsUpdate = true;
    };
    paint(lines);
    return paint;
  }
  const warmCups: { group: T.Group; size: number }[] = [];
  function cup(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    size = 0.12,
    latte = false,
    filled = true,
    saucer = true,
  ) {
    const g = child(p, x, y, z);
    if (filled && warmCups.length < 8) warmCups.push({ group: g, size });
    lathe(
      g,
      [
        [0, 0],
        [size * 0.65, 0],
        [size * 0.76, 0.018],
        [size, size * 1.3],
        [size * 0.92, size * 1.36],
        [size * 0.84, size * 1.22],
        [size * 0.64, 0.04],
        [0, 0.04],
      ],
      ceramic,
    );
    // An open C-shaped handle joins the outside wall; a full torus used to protrude into the drink.
    tube(
      g,
      [
        [size * 0.96, size * 1.11, 0],
        [size * 1.38, size * 1.17, 0],
        [size * 1.57, size * 0.78, 0],
        [size * 1.28, size * 0.3, 0],
        [size * 0.8, size * 0.38, 0],
      ],
      size * 0.115,
      ceramic,
    );
    if (filled)
      cyl(
        g,
        size * 0.85,
        size * 0.85,
        0.006,
        0,
        size * 1.16,
        0,
        latte ? crema : coffee,
      );
    if (saucer)
      lathe(
        g,
        [
          [0, 0],
          [size * 0.97, 0],
          [size * 1.4, 0.008],
          [size * 1.48, 0.024],
          [size * 1.45, 0.034],
          [size, 0.022],
          [0, 0.019],
        ],
        ceramic,
        0,
        -0.022,
        0,
      );
    if (latte) {
      for (let i = 0; i < 6; i++)
        for (const side of [-1, 1]) {
          const shape = ball(
            g,
            side * size * (0.25 - i * 0.024),
            size * 1.2,
            -size * 0.32 + i * size * 0.12,
            size * (0.28 - i * 0.025),
            0.002,
            size * 0.075,
            milk,
          );
          shape.rotation.y = side * 0.45;
        }
      tube(
        g,
        [
          [0, size * 1.2, -size * 0.4],
          [0.015, size * 1.2, 0],
          [0, size * 1.2, size * 0.45],
        ],
        0.003,
        milk,
      );
    }
    return g;
  }
  function plant(p: T.Object3D, x: number, y: number, z: number, s = 1) {
    const g = child(p, x, y, z);
    g.scale.setScalar(s);
    lathe(
      g,
      [
        [0.2, 0],
        [0.25, 0.05],
        [0.29, 0.48],
        [0.28, 0.5],
        [0.245, 0.48],
        [0.21, 0.08],
      ],
      ceramic,
    );
    cyl(g, 0.247, 0.247, 0.02, 0, 0.45, 0, coffee);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4,
        h = 0.7 + noise(i) * 0.55,
        dx = Math.cos(a) * 0.35,
        dz = Math.sin(a) * 0.35;
      rod(g, [0, 0.45, 0], [dx, h, dz], 0.009, green);
      const l = ball(g, dx, h, dz, 0.11, 0.26, 0.028, leaf);
      l.rotation.set(0.25, a, -0.55 + noise(i + 32));
    }
  }
  // Continuous warm oak floor, a woven entry mat and a fine brass perimeter.
  const architecture = child(root);
  architecture.name = 'cafe/foundation';
  box(architecture, 16, 0.4, 8, 0, -0.23, 0, darkWood, 0.04);
  addOakFloor(architecture, 15.92, 7.92, k.floorMaterials);
  for (const item of [...Object.values(cafeLayout), ...cafeBistroTables]) {
    const patch = mesh(
      architecture,
      new T.PlaneGeometry(item.width * 1.15, item.depth * 1.15),
      k.contactMaterial,
      item.x,
      0.082,
      item.z,
    );
    patch.rotation.x = -Math.PI / 2;
    patch.castShadow = false;
  }
  for (const x of [-7.82, 7.82])
    box(architecture, 0.017, 0.008, 7.65, x, 0.081, 0, brass, 0.001);
  for (const z of [-3.82, 3.82])
    box(architecture, 15.65, 0.008, 0.017, 0, 0.081, z, brass, 0.001);
  const matEntry = mat('#737260', 0.98);
  box(architecture, 1.4, 0.018, 0.65, -1.35, 0.092, 3.5, matEntry, 0.015);
  for (let i = 0; i < 20; i++)
    box(
      architecture,
      0.011,
      0.004,
      0.6,
      -1.99 + i * 0.067,
      0.103,
      3.5,
      black,
      0.001,
    );
  // Exterior walls and their attached joinery disappear together from the reverse side.
  const west = child(root),
    east = child(root);
  box(west, 0.17, 3.65, 8, -7.91, 1.83, 0, plaster);
  box(east, 0.17, 3.65, 8, 7.91, 1.83, 0, plaster);
  for (const [g, x, m] of [
    [west, -7.79, darkWood],
    [east, 7.79, darkWood],
  ] as const) {
    box(g, 0.055, 1.1, 7.75, x, 0.66, 0, m);
    box(g, 0.08, 0.045, 7.8, x, 1.23, 0, brass);
    box(g, 0.08, 0.15, 7.8, x, 0.16, 0, m);
    box(g, 0.22, 0.1, 8, x, 3.68, 0, plaster);
  }
  k.cutaways.add([west], { x: -3.91, z: 14.2, nx: 1, nz: 0 }, ['cafe']);
  k.cutaways.add([east], { x: 11.91, z: 14.2, nx: -1, nz: 0 }, ['cafe']);
  // Shared northern walls are built by the house shell. These are the cafe-side finishes.
  const north = child(root);
  for (const [a, b] of [
    [-7.9, -2.07],
    [-0.63, 4.88],
    [6.32, 7.9],
  ])
    box(north, b - a, 3.48, 0.025, (a + b) / 2, 1.82, -3.89, plaster, 0.003);
  for (const [a, b] of [
    [-7.9, -2.07],
    [-0.63, 4.88],
    [6.32, 7.9],
  ])
    box(north, b - a, 0.045, 0.045, (a + b) / 2, 1.22, -3.865, brass, 0.006);
  k.cutaways.add([north], { x: 4, z: 10.2, nx: 0, nz: 1 }, ['cafe'], true);
  const windows: ReturnType<typeof createWindowEnvironment>[] = [];
  const front = object('cafeWindow');
  for (const [a, b] of [
    [-7.9, -2.08],
    [-0.62, 7.9],
  ]) {
    box(front, b - a, 0.34, 0.17, (a + b) / 2, 0.25, 3.91, green);
    box(front, b - a, 0.52, 0.17, (a + b) / 2, 3.39, 3.91, green);
    const aperture = child(front, (a + b) / 2, 1.77, 3.87);
    aperture.rotation.y = Math.PI;
    windows.push(
      createWindowEnvironment(aperture, 'cafe', k.landscape, {
        width: b - a - 0.18,
        height: 2.62,
      }),
    );
    for (const side of [a, b])
      box(front, 0.1, 3.22, 0.2, side, 1.69, 3.84, darkWood, 0.008);
    for (const y of [0.45, 3.09])
      box(front, b - a, 0.095, 0.21, (a + b) / 2, y, 3.83, darkWood, 0.008);
    const sections = Math.ceil((b - a) / 1.9);
    for (let i = 1; i < sections; i++)
      box(
        front,
        0.045,
        2.65,
        0.09,
        a + ((b - a) * i) / sections,
        1.77,
        3.8,
        brass,
        0.005,
      );
    box(front, b - a, 0.08, 0.28, (a + b) / 2, 0.48, 3.74, wood);
  }
  box(front, 1.46, 0.65, 0.17, -1.35, 3.35, 3.91, green);
  const entry = child(front, -1.35, 0, 3.84);
  for (const x of [-0.7, 0.7]) box(entry, 0.08, 2.73, 0.14, x, 1.42, 0, wood);
  for (const y of [0.12, 2.76]) box(entry, 1.48, 0.08, 0.14, 0, y, 0, wood);
  box(entry, 1.29, 2.5, 0.012, 0, 1.44, 0, glass, 0);
  for (const z of [-0.12, 0.12])
    rod(entry, [0.46, 1.15, z], [0.46, 1.68, z], 0.025, brass);
  const sign = child(front, 3, 3.35, 3.805);
  sign.rotation.y = Math.PI;
  textPanel(
    sign,
    ['SATORI  /  COFFEE'],
    2.7,
    0.4,
    0,
    0,
    0,
    '#204b3c',
    '#e8d8ae',
  );
  k.cutaways.add([front], { x: 4, z: 18.11, nx: 0, nz: -1 }, ['cafe']);
  // Service counter: recessed toe kick, sage fluting, eased oak lip and brass foot rail.
  const counter = child(root, cafeLayout.counter.x, 0, cafeLayout.counter.z);
  box(counter, 5.7, 1.25, 1.12, 0, 0.79, 0, green, 0.065);
  box(counter, 5.48, 0.18, 0.86, 0, 0.18, 0, black);
  box(counter, 5.87, 0.13, 1.3, 0, 1.47, 0, wood, 0.06);
  box(counter, 5.65, 0.045, 0.055, 0, 1.33, 0.58, brass, 0.008);
  for (let i = 0; i < 91; i++)
    box(
      counter,
      0.038,
      1.02,
      0.055,
      -2.75 + i * 0.061,
      0.79,
      0.58,
      green,
      0.013,
    );
  rod(counter, [-2.65, 0.36, 0.81], [2.65, 0.36, 0.81], 0.023, brass);
  for (const x of [-2.5, 0, 2.5])
    rod(counter, [x, 0.34, 0.58], [x, 0.36, 0.8], 0.021, brass);
  // Rear cabinet doors, drawers, open cup shelves, sink and gooseneck mixer.
  const back = child(
    root,
    cafeLayout.backCounter.x,
    0,
    cafeLayout.backCounter.z,
  );
  box(back, 5.4, 1.25, 0.7, 0, 0.73, 0, darkWood);
  box(back, 5.5, 0.1, 0.82, 0, 1.39, 0, stone, 0.025);
  for (let i = 0; i < 6; i++) {
    box(back, 0.86, 1.04, 0.028, -2.22 + i * 0.89, 0.77, 0.369, green, 0.014);
    rod(
      back,
      [-2.38 + i * 0.89, 1.1, 0.42],
      [-2.08 + i * 0.89, 1.1, 0.42],
      0.014,
      brass,
    );
  }
  const sink = child(back, 1.85, 1.45, 0);
  box(sink, 0.75, 0.025, 0.5, 0, 0, 0, steel, 0.035);
  box(sink, 0.63, 0.013, 0.38, 0, 0.015, 0, black, 0.055);
  cyl(sink, 0.043, 0.043, 0.008, 0, 0.025, 0, steel);
  tube(
    sink,
    [
      [0.28, 0, -0.18],
      [0.28, 0.37, -0.18],
      [0.18, 0.48, -0.18],
      [0.02, 0.4, -0.18],
      [0.02, 0.29, -0.1],
    ],
    0.02,
    steel,
  );
  cyl(sink, 0.03, 0.045, 0.08, 0.38, 0.05, -0.16, steel);
  rod(sink, [0.38, 0.09, -0.16], [0.48, 0.14, -0.16], 0.016, steel);
  for (const y of [2.15, 2.69]) {
    box(north, 2.05, 0.085, 0.37, -6.58, y, -3.66, wood);
    for (const x of [-7.4, -5.78]) {
      box(north, 0.04, 0.32, 0.035, x, y - 0.16, -3.82, black);
      rod(north, [x, y - 0.28, -3.82], [x, y - 0.035, -3.49], 0.012, black);
    }
    for (let i = 0; i < 7; i++)
      cup(north, -7.34 + i * 0.24, y + 0.056, -3.59, 0.075, false, false);
  }
  // Slim menu boards form a coherent backdrop, with a changeable daily special.
  const menu = object('cafeMenu');
  const menuPaint: ((rows: string[]) => void)[] = [];
  for (let i = 0; i < 2; i++) {
    box(menu, 1.53, 1.21, 0.065, -4.6 + i * 1.68, 2.7, -3.8, darkWood, 0.012);
    menuPaint.push(
      textPanel(
        menu,
        i === 0
          ? [
              'COFFEE',
              'Espresso       3.5',
              'Flat white      4.5',
              'Filter coffee   4.0',
            ]
          : [
              'SLOW MOMENTS',
              'Honey oat latte',
              'Ethiopia · floral',
              'Freshly baked',
            ],
        1.43,
        1.1,
        -4.6 + i * 1.68,
        2.7,
        -3.755,
      ),
    );
  }
  k.cutaways.add([menu], { x: 4, z: 10.2, nx: 0, nz: 1 }, ['cafe'], true);
  // Two-group espresso machine. The public side reveals polished casing and copper brew groups.
  const espresso = object('cafeEspresso', -5.18, 1.545, -1.08);
  espresso.rotation.y = Math.PI;
  const machineBack = child(espresso, 0, 0.58, -0.347);
  machineBack.rotation.y = Math.PI;
  textPanel(
    machineBack,
    ['SATORI / ESPRESSO'],
    1.16,
    0.23,
    0,
    0,
    0,
    '#274638',
    '#dfcda9',
  );
  for (const x of [-0.59, 0.59])
    for (const z of [-0.23, 0.23])
      cyl(espresso, 0.04, 0.05, 0.09, x, 0.045, z, black);
  box(espresso, 1.52, 0.09, 0.76, 0, 0.12, 0, steel, 0.03);
  box(espresso, 1.44, 0.64, 0.45, 0, 0.52, -0.11, steel, 0.045);
  box(espresso, 1.35, 0.49, 0.027, 0, 0.53, 0.136, green, 0.025);
  box(espresso, 1.48, 0.06, 0.72, 0, 0.875, -0.01, steel, 0.025);
  for (const x of [-0.77, 0.77]) {
    box(espresso, 0.035, 0.64, 0.6, x, 0.52, 0, steel);
    for (let i = 0; i < 8; i++)
      box(
        espresso,
        0.039,
        0.011,
        0.32,
        x,
        0.32 + i * 0.043,
        -0.08,
        black,
        0.003,
      );
  }
  box(espresso, 1.37, 0.027, 0.4, 0, 0.182, 0.25, black, 0.008);
  for (let i = 0; i < 29; i++)
    box(
      espresso,
      0.016,
      0.012,
      0.38,
      -0.65 + i * 0.046,
      0.201,
      0.25,
      steel,
      0.003,
    );
  for (const x of [-0.37, 0.37]) {
    cyl(espresso, 0.105, 0.082, 0.13, x, 0.53, 0.24, brass);
    cyl(espresso, 0.077, 0.09, 0.04, x, 0.449, 0.25, steel);
    rod(espresso, [x, 0.465, 0.27], [x, 0.465, 0.49], 0.031, black);
    for (const dx of [-0.029, 0.029])
      cyl(espresso, 0.01, 0.01, 0.08, x + dx, 0.394, 0.25, steel);
    for (let i = 0; i < 4; i++) {
      const key = cyl(
        espresso,
        0.021,
        0.021,
        0.012,
        x - 0.105 + i * 0.07,
        0.717,
        0.158,
        i === 3 ? indicator : steel,
        16,
      );
      key.rotation.x = Math.PI / 2;
    }
    cup(espresso, x, 0.224, 0.25, 0.097);
  }
  for (const x of [-0.61, 0.61]) {
    const dial = cyl(espresso, 0.069, 0.069, 0.025, x, 0.77, 0.155, brass);
    dial.rotation.x = Math.PI / 2;
    const face = cyl(espresso, 0.057, 0.057, 0.006, x, 0.77, 0.172, ceramic);
    face.rotation.x = Math.PI / 2;
    rod(espresso, [x, 0.77, 0.18], [x - 0.026, 0.803, 0.18], 0.004, black);
    tube(
      espresso,
      [
        [x, 0.58, 0.17],
        [x + Math.sign(x) * 0.07, 0.48, 0.22],
        [x + Math.sign(x) * 0.09, 0.24, 0.35],
      ],
      0.015,
      steel,
    );
  }
  for (const z of [-0.3, 0.25])
    rod(espresso, [-0.69, 0.99, z], [0.69, 0.99, z], 0.013, steel);
  for (const x of [-0.69, 0.69])
    for (const z of [-0.3, 0.25])
      rod(espresso, [x, 0.9, z], [x, 0.99, z], 0.013, steel);
  for (const x of [-0.45, -0.15, 0.15, 0.45])
    cup(espresso, x, 1.031, -0.06, 0.082, false, false, false).rotation.x =
      Math.PI;
  const streams = child(espresso);
  for (const x of [-0.37, 0.37])
    for (const dx of [-0.029, 0.029])
      cyl(streams, 0.005, 0.005, 0.1, x + dx, 0.329, 0.25, coffee, 8);
  streams.visible = false;
  // Conical burr grinder, transparent bean hopper, hopper collar and dosing fork.
  const grinder = child(counter, -1.74, 1.545, -0.02);
  grinder.rotation.y = Math.PI;
  cyl(grinder, 0.22, 0.25, 0.045, 0, 0.024, 0, steel);
  box(grinder, 0.31, 0.47, 0.35, 0, 0.285, 0, black, 0.04);
  cyl(grinder, 0.15, 0.15, 0.07, 0, 0.55, -0.03, steel);
  lathe(
    grinder,
    [
      [0.11, 0.55],
      [0.19, 0.7],
      [0.2, 0.91],
      [0.19, 0.95],
    ],
    glass,
  );
  cyl(grinder, 0.215, 0.215, 0.026, 0, 0.96, 0, black);
  cyl(grinder, 0.173, 0.105, 0.19, 0, 0.66, 0, roastedBean);
  const beans = new T.InstancedMesh(
    new T.SphereGeometry(1, 20, 12).scale(0.027, 0.016, 0.018),
    roastedBean,
    112,
  );
  const creases = new T.InstancedMesh(
    new T.TubeGeometry(
      new T.CatmullRomCurve3([
        new T.Vector3(-0.022, 0.01, 0),
        new T.Vector3(-0.009, 0.015, 0.002),
        new T.Vector3(0.009, 0.015, -0.002),
        new T.Vector3(0.022, 0.01, 0),
      ]),
      12,
      0.0015,
      5,
      false,
    ),
    beanCrease,
    112,
  );
  const bean = new T.Object3D();
  for (let i = 0; i < 112; i++) {
    const angle = i * 2.4,
      r = 0.158 * Math.sqrt((i + 0.5) / 112);
    bean.position.set(
      Math.cos(angle) * r,
      0.756 + 0.025 * (1 - r / 0.158) + noise(i + 9) * 0.017,
      Math.sin(angle) * r,
    );
    bean.rotation.set(
      (noise(i + 2) - 0.5) * 0.5,
      angle,
      (noise(i + 7) - 0.5) * 0.3,
    );
    bean.updateMatrix();
    beans.setMatrixAt(i, bean.matrix);
    creases.setMatrixAt(i, bean.matrix);
  }
  for (const m of [beans, creases]) {
    m.castShadow = m.receiveShadow = true;
    grinder.add(m);
  }
  box(grinder, 0.09, 0.11, 0.11, 0, 0.46, 0.2, steel);
  for (const x of [-0.055, 0.055])
    rod(grinder, [x, 0.31, 0.14], [x, 0.31, 0.28], 0.01, steel);
  // Point of sale angled toward the guest, card terminal, napkins and takeaway station.
  const pos = child(
    counter,
    cafeCounterItems.register.x - cafeLayout.counter.x,
    1.55,
    cafeCounterItems.register.z - cafeLayout.counter.z,
  );
  box(pos, 0.29, 0.035, 0.25, 0, 0, 0, black);
  rod(pos, [0, 0.015, 0], [0, 0.27, -0.03], 0.03, black);
  const terminal = child(pos, 0, 0.35, 0);
  terminal.rotation.x = -0.2;
  box(terminal, 0.48, 0.32, 0.045, 0, 0, 0, black, 0.022);
  textPanel(
    terminal,
    ['SATORI', 'Welcome'],
    0.41,
    0.25,
    0,
    0,
    0.027,
    '#233a30',
    '#e9dbc0',
  );
  const reader = child(
    counter,
    cafeCounterItems.cardReader.x - cafeLayout.counter.x,
    1.55,
    cafeCounterItems.cardReader.z - cafeLayout.counter.z,
  );
  box(
    reader,
    cafeCounterItems.cardReader.width,
    0.065,
    cafeCounterItems.cardReader.depth,
    0,
    0.03,
    0,
    black,
    0.014,
  );
  for (let i = 0; i < 6; i++)
    box(
      reader,
      0.029,
      0.005,
      0.027,
      -0.06 + (i % 3) * 0.057,
      0.066,
      -0.05 + Math.floor(i / 3) * 0.07,
      ceramic,
      0.005,
    );
  const napkins = child(
    counter,
    cafeCounterItems.napkins.x - cafeLayout.counter.x,
    1.55,
    cafeCounterItems.napkins.z - cafeLayout.counter.z,
  );
  box(napkins, 0.38, 0.11, 0.27, 0, 0.05, 0, darkWood);
  for (let i = 0; i < 8; i++)
    box(napkins, 0.31, 0.006, 0.23, 0, 0.115 + i * 0.008, 0, ceramic, 0.002);
  for (let i = 0; i < 6; i++)
    lathe(
      counter,
      [
        [0.09, 0],
        [0.12, 0.24],
        [0.116, 0.25],
        [0.105, 0.23],
        [0.08, 0.02],
      ],
      ceramic,
      cafeCounterItems.cups.x - cafeLayout.counter.x,
      1.55 + i * 0.045,
      cafeCounterItems.cups.z - cafeLayout.counter.z,
    );
  // Refrigerated pastry case with glass rear sliding doors and two lit display shelves.
  const pastry = object(
    'cafePastry',
    cafeCounterItems.pastry.x,
    1.545,
    cafeCounterItems.pastry.z,
  );
  box(pastry, 1.04, 0.13, 0.91, 0, 0.065, 0, darkWood, 0.025);
  for (const y of [0.16, 0.43]) {
    box(pastry, 0.94, 0.027, 0.72, 0, y, 0, stone, 0.01);
    box(pastry, 0.92, 0.012, 0.015, 0, y + 0.035, -0.36, glow, 0.002);
  }
  for (const x of [-0.5, 0.5])
    box(pastry, 0.012, 0.71, 0.82, x, 0.485, 0, glass, 0.001);
  box(pastry, 1.03, 0.012, 0.86, 0, 0.85, 0, glass, 0.001);
  box(pastry, 1.03, 0.71, 0.012, 0, 0.485, 0.42, glass, 0.001);
  for (const x of [-0.51, 0.51])
    rod(pastry, [x, 0.13, -0.42], [x, 0.85, -0.42], 0.012, brass);
  const pastryDoor = child(pastry);
  box(pastry, 0.47, 0.68, 0.012, -0.245, 0.49, -0.425, glass, 0.001);
  box(pastryDoor, 0.47, 0.68, 0.012, 0.245, 0.49, -0.446, glass, 0.001);
  rod(pastryDoor, [0.38, 0.41, -0.463], [0.38, 0.59, -0.463], 0.01, brass);
  rod(pastry, [-0.38, 0.41, -0.439], [-0.38, 0.59, -0.439], 0.01, brass);
  for (const y of [0.143, 0.835])
    box(pastry, 1.01, 0.015, 0.045, 0, y, -0.435, steel, 0.003);
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 3; i++) {
      const x = -0.29 + i * 0.29,
        y = 0.185 + row * 0.27,
        z = 0.02;
      box(pastry, 0.25, 0.012, 0.34, x, y, z, ceramic, 0.025);
      if (row === 0) {
        for (let j = -3; j <= 3; j++) {
          const croissant = ball(
            pastry,
            x + j * 0.022,
            y + 0.052,
            z + Math.abs(j) * 0.016,
            0.027,
            0.045 - Math.abs(j) * 0.005,
            0.065 - Math.abs(j) * 0.006,
            crumb,
          );
          croissant.rotation.z = -j * 0.11;
        }
      } else {
        cyl(pastry, 0.07, 0.055, 0.065, x, y + 0.04, z, crumb);
        ball(pastry, x, y + 0.083, z, 0.085, 0.052, 0.08, crumb);
        for (let n = 0; n < 8; n++)
          ball(
            pastry,
            x + (noise(n + i) - 0.5) * 0.11,
            y + 0.12,
            z + (noise(n + i + 20) - 0.5) * 0.1,
            0.009,
            0.008,
            0.009,
            cocoa,
          );
      }
    }
  textPanel(
    pastry,
    ['BAKED TODAY'],
    0.75,
    0.085,
    0,
    0.067,
    0.47,
    '#58402b',
    '#f7e4ba',
  );
  // Pour-over station on the back worktop, articulated kettle and real ribbed dripper.
  const brew = object('cafePourOver', -4.6, 1.45, -3.38);
  box(brew, 0.7, 0.035, 0.5, 0, 0.02, 0, black, 0.025);
  lathe(
    brew,
    [
      [0.12, 0],
      [0.14, 0.04],
      [0.18, 0.22],
      [0.12, 0.33],
      [0.11, 0.35],
      [0.09, 0.33],
      [0.15, 0.2],
      [0.1, 0.04],
    ],
    glass,
    0,
    0.045,
    0,
  );
  lathe(
    brew,
    [
      [0.03, 0],
      [0.17, 0.23],
      [0.18, 0.24],
      [0.17, 0.25],
      [0.018, 0.025],
    ],
    ceramic,
    0,
    0.405,
    0,
  );
  for (let i = 0; i < 22; i++) {
    const a = (i * 6.28) / 22;
    rod(
      brew,
      [Math.sin(a) * 0.034, 0.432, Math.cos(a) * 0.034],
      [Math.sin(a) * 0.171, 0.63, Math.cos(a) * 0.171],
      0.004,
      brass,
    );
  }
  const kettlePivot = child(brew, 0.48, 0.17, 0.02),
    kettle = child(kettlePivot);
  lathe(
    kettle,
    [
      [0, 0],
      [0.16, 0],
      [0.21, 0.1],
      [0.19, 0.26],
      [0.11, 0.34],
      [0.09, 0.35],
    ],
    black,
  );
  cyl(kettle, 0.12, 0.12, 0.022, 0, 0.36, 0, wood);
  ball(kettle, 0, 0.395, 0, 0.034, 0.03, 0.034, wood);
  tube(
    kettle,
    [
      [-0.17, 0.1, 0],
      [-0.29, 0.12, 0],
      [-0.33, 0.3, 0],
      [-0.41, 0.4, 0],
    ],
    0.016,
    steel,
  );
  tube(
    kettle,
    [
      [0.13, 0.28, 0],
      [0.29, 0.3, 0],
      [0.32, 0.1, 0],
      [0.19, 0.06, 0],
    ],
    0.024,
    wood,
  );
  const pour = child(brew);
  const pourStream = cyl(pour, 0.006, 0.006, 1, 0, 0, 0, steel, 8);
  pour.visible = false;
  // Merchandise is part of the back bar, with folded bags, valve seals and shelf labels.
  for (let i = 0; i < 4; i++) {
    const x = -2.76 + i * 0.22;
    box(north, 0.17, 0.3, 0.11, x, 1.6, -3.36, i % 2 ? green : tan, 0.012);
    box(north, 0.16, 0.03, 0.13, x, 1.76, -3.36, brass, 0.004);
    textPanel(
      north,
      [i % 2 ? 'BLEND' : 'ORIGIN'],
      0.115,
      0.15,
      x,
      1.6,
      -3.294,
      '#ece0bd',
      '#294936',
    );
  }
  // East banquette: segmented leather pads, welt piping, routed oak plinth, bag hooks.
  const seating = object('cafeSeat');
  const bench = child(
    seating,
    cafeLayout.banquette.x,
    0,
    cafeLayout.banquette.z,
  );
  box(bench, 0.95, 0.51, 5.8, 0, 0.36, 0, darkWood, 0.025);
  attachSeats(
    k.seats,
    bench,
    Array.from({ length: 9 }, (_, i) => `cafe-banquette-${i + 1}`),
  );
  box(bench, 0.9, 0.16, 5.72, -0.05, 0.68, 0, wood, 0.04);
  for (let i = 0; i < 9; i++) {
    box(bench, 0.85, 0.2, 0.617, -0.07, 0.84, -2.55 + i * 0.637, leather, 0.07);
    const pad = box(
      bench,
      0.18,
      0.96,
      0.617,
      0.34,
      1.33,
      -2.55 + i * 0.637,
      leather,
      0.052,
    );
    pad.rotation.z = -0.1;
    for (const zz of [-0.29, 0.29])
      rod(
        bench,
        [-0.4, 0.912, -2.55 + i * 0.637 + zz],
        [0.24, 0.912, -2.55 + i * 0.637 + zz],
        0.004,
        green,
      );
    ball(bench, 0.227, 1.35, -2.55 + i * 0.637, 0.013, 0.019, 0.019, darkWood);
  }
  for (const z of [-2.7, -0.8, 1.1, 2.7])
    rod(bench, [-0.22, 0.1, z], [-0.22, 0.29, z], 0.033, brass);
  // Table bases have weighted feet and realistic edges; loose chairs always face their tabletop.
  function table(
    x: number,
    z: number,
    w: number,
    d: number,
    round = false,
    height = 1.18,
  ) {
    const g = child(root, x, 0, z);
    if (round) {
      cyl(g, w / 2, w / 2, 0.07, 0, height, 0, wood, 64);
      cyl(
        g,
        w / 2 - 0.025,
        w / 2 - 0.025,
        0.025,
        0,
        height - 0.05,
        0,
        darkWood,
        64,
      );
    } else {
      box(g, w, 0.08, d, 0, height, 0, wood, 0.055);
      box(g, w - 0.08, 0.04, d - 0.08, 0, height - 0.055, 0, darkWood, 0.018);
    }
    cyl(g, 0.24, 0.3, 0.045, 0, 0.13, 0, black, 48);
    cyl(g, 0.048, 0.072, height - 0.15, 0, (height + 0.13) / 2, 0, black);
    cyl(g, 0.075, 0.075, 0.05, 0, 0.18, 0, brass);
    if (w > 2)
      for (const x of [-0.85, 0.85]) {
        rod(g, [x, 0.15, -0.38], [x, 0.15, 0.38], 0.035, black);
        rod(g, [x, 0.15, 0], [x, height - 0.04, 0], 0.035, black);
      }
    return g;
  }
  for (const [index, t] of cafeBistroTables.entries()) {
    const g = table(t.x, t.z, t.width, t.depth);
    if (index === 0) cup(g, 0.18, 1.239, -0.18, 0.11, true);
    if (index === 1) cup(g, 0.18, 1.239, -0.18, 0.11, false, false);
    if (index !== 0) continue;
    box(g, 0.21, 0.01, 0.3, -0.22, 1.231, 0.16, plaster, 0.002);
    cyl(g, 0.055, 0.05, 0.14, -0.25, 1.304, -0.2, ceramic);
    rod(g, [-0.25, 1.37, -0.2], [-0.23, 1.57, -0.18], 0.004, green);
    ball(g, -0.23, 1.57, -0.18, 0.065, 0.045, 0.05, milk);
  }
  const communal = table(
    cafeLayout.communal.x,
    cafeLayout.communal.z,
    2.65,
    1.25,
  );
  cup(communal, -0.82, 1.238, 0.1, 0.12, true);
  cup(communal, 0.7, 1.238, -0.3, 0.1);
  box(communal, 0.41, 0.025, 0.55, 0.51, 1.24, 0.2, tan, 0.007);
  box(communal, 0.37, 0.019, 0.51, 0.51, 1.263, 0.2, plaster, 0.004);
  box(communal, 0.41, 0.012, 0.55, 0.51, 1.282, 0.2, green, 0.006);
  plant(communal, 0, 1.235, 0, 0.36);
  box(communal, 0.3, 0.006, 0.07, 0, 1.225, -0.49, brass, 0.01);
  for (const x of [-0.08, 0.07])
    box(communal, 0.04, 0.003, 0.023, x, 1.23, -0.49, black, 0.003);
  const lounge = table(
    cafeLayout.loungeTable.x,
    cafeLayout.loungeTable.z,
    0.95,
    0.95,
    true,
    0.77,
  );
  cup(lounge, 0.15, 0.816, -0.1, 0.11, true);
  box(lounge, 0.23, 0.013, 0.34, -0.14, 0.815, 0.13, green, 0.008);
  function chair(x: number, z: number, yaw: number, lounge = false) {
    const g = child(root, x, 0, z);
    g.rotation.y = yaw;
    if (lounge) {
      for (const xx of [-0.43, 0.43])
        for (const zz of [-0.43, 0.38]) {
          rod(g, [xx * 1.03, 0.1, zz * 1.03], [xx, 0.6, zz], 0.039, darkWood);
          cyl(g, 0.04, 0.04, 0.06, xx * 1.03, 0.13, zz * 1.03, brass);
        }
      box(g, 0.99, 0.12, 1.01, 0, 0.56, 0, wood, 0.035);
      box(g, 0.82, 0.23, 0.89, 0, 0.75, -0.015, tan, 0.09);
      const back = box(g, 0.9, 0.78, 0.22, 0, 1.21, 0.4, tan, 0.08);
      back.rotation.x = 0.13;
      for (const xx of [-0.49, 0.49]) {
        box(g, 0.13, 0.1, 1.02, xx, 1.05, -0.005, wood, 0.04);
        rod(g, [xx, 0.61, -0.38], [xx, 1.05, -0.38], 0.035, wood);
        rod(g, [xx, 0.61, 0.38], [xx, 1.05, 0.38], 0.035, wood);
      }
      tube(
        g,
        [
          [-0.36, 0.88, -0.39],
          [0.36, 0.88, -0.39],
          [0.37, 0.88, 0.34],
          [-0.36, 0.88, 0.34],
          [-0.36, 0.88, -0.39],
        ],
        0.004,
        brass,
      );
    } else {
      for (const xx of [-0.27, 0.27])
        for (const zz of [-0.25, 0.25]) {
          rod(g, [xx * 1.2, 0.09, zz * 1.2], [xx, 0.71, zz], 0.026, wood);
          cyl(g, 0.027, 0.027, 0.07, xx * 1.2, 0.12, zz * 1.2, brass, 16);
        }
      box(g, 0.66, 0.07, 0.63, 0, 0.705, 0, wood, 0.08);
      box(g, 0.6, 0.09, 0.57, 0, 0.78, 0, leather, 0.09);
      for (const xx of [-0.28, 0.28])
        rod(g, [xx, 0.61, 0.25], [xx, 1.42, 0.31], 0.025, wood);
      const backPoints = Array.from({ length: 13 }, (_, i) => {
        const a = -1.18 + (i * 2.36) / 12;
        return [Math.sin(a) * 0.38, 1.4, 0.04 + Math.cos(a) * 0.31];
      });
      for (const y of [1.26, 1.3, 1.34, 1.38, 1.42])
        tube(
          g,
          backPoints.map((a) => [a[0], y, a[2]]),
          0.023,
          wood,
        );
      for (const xx of [-0.27, 0.27])
        rod(g, [xx, 0.32, -0.26], [xx, 0.32, 0.26], 0.017, darkWood);
      rod(g, [-0.27, 0.35, 0.2], [0.27, 0.35, 0.2], 0.017, darkWood);
    }
    return g;
  }
  for (const [i, c] of cafeChairs.entries()) {
    const seat = chair(c.x, c.z, c.yaw, c.style === 'lounge');
    attachSeats(k.seats, seat, [`cafe-chair-${i + 1}`]);
    k.interactables.push(seat);
  }

  // Coffee botanical triptych on the west wall, with slim frames and individual compositions.
  for (let i = 0; i < 3; i++) {
    const art = child(west, -7.8, 2.35, 0.25 + i * 0.95);
    art.rotation.y = Math.PI / 2;
    box(art, 0.77, 1.1, 0.055, 0, 0, 0, darkWood);
    const paper = child(art, 0, 0, 0.037);
    box(paper, 0.68, 1, 0.014, 0, 0, 0, plaster, 0.001);
    const stalk = child(paper, 0, -0.34, 0.012);
    tube(
      stalk,
      [
        [-0.12, 0, 0],
        [0.04, 0.26, 0],
        [-0.02, 0.63, 0],
      ],
      0.006,
      green,
    );
    for (let j = 0; j < 5; j++) {
      const a = ball(
        stalk,
        (j % 2 ? 1 : -1) * 0.1,
        0.12 + j * 0.095,
        0.005,
        0.085,
        0.037,
        0.007,
        i === 1 ? coffee : green,
      );
      a.rotation.z = (j % 2 ? 1 : -1) * 0.6;
    }
  }
  // Pendant bells, real cable lengths, ceiling roses and upland oak ceiling battens.
  const fixtures = object('cafeLight');
  const lights: T.PointLight[] = [];
  const lightSites = [
    [-6, -1.05],
    [-3.35, -1.05],
    [1.1, 0.25],
    [5.42, -1.65],
    [5.42, 0.45],
    [5.42, 2.55],
    [-5.65, 2.2],
  ];
  for (const [x, z] of lightSites) {
    const y = z === -1.05 ? 2.95 : 2.78;
    cyl(fixtures, 0.1, 0.1, 0.035, x, 3.64, z, black);
    rod(fixtures, [x, 3.62, z], [x, y + 0.28, z], 0.007, black);
    lathe(
      fixtures,
      [
        [0.035, 0.29],
        [0.08, 0.25],
        [0.12, 0.16],
        [0.22, 0.06],
        [0.3, 0],
        [0.3, -0.025],
        [0.28, -0.028],
        [0.2, 0.04],
        [0.1, 0.14],
        [0.055, 0.23],
      ],
      black,
      x,
      y,
      z,
    );
    torus(fixtures, 0.295, 0.013, x, y - 0.017, z, brass).rotation.x =
      Math.PI / 2;
    cyl(fixtures, 0.225, 0.225, 0.012, x, y + 0.02, z, glow, 48);
    const l = new T.PointLight('#ffd9a0', 0, 5.5, 2);
    l.position.set(x, y - 0.08, z);
    root.add(l);
    lights.push(l);
  }
  const beams = child(fixtures);
  for (const x of [-6.8, -4.8, -2.8, 0.1, 2.3, 4.5, 6.7])
    box(beams, 0.12, 0.14, 7.75, x, 3.65, 0, wood, 0.012);
  box(beams, 15.8, 0.14, 0.12, 0, 3.65, -3.86, wood);
  box(beams, 15.8, 0.14, 0.12, 0, 3.65, 3.86, wood);
  const service = createCoffeeState(k.onCoffee);
  const servedCup = cup(root, -4.22, 1.557, -0.6, 0.12, false, false);
  const drinkSurface = mat(drinks.latte.color, 0.28);
  // Liquid stays inside the sloping inner wall, below the ceramic lip.
  cyl(servedCup, 0.094, 0.094, 0.003, 0, 0.135, 0, drinkSurface);
  servedCup.name = 'Finished coffee / clear pickup';
  servedCup.visible = false;
  const serviceSteam = createSteamEffect({
    count: 9,
    height: 0.35,
    width: 0.075,
    seed: 19,
  });
  serviceSteam.root.position.y = 0.165;
  servedCup.add(serviceSteam.root);
  const steam = createSteamEffect({
    count: 16,
    height: 0.56,
    width: 0.13,
    seed: 2,
  });
  steam.root.position.set(-0.37, 0.44, 0.25);
  espresso.add(steam.root);
  const wisps = warmCups.map(({ group, size }, i) => {
    const effect = createSteamEffect({
      count: 7,
      height: 0.29,
      width: 0.075,
      seed: i + 5,
    });
    effect.root.position.y = size * 1.45;
    group.add(effect.root);
    return effect;
  });
  const shelfGlow = new T.PointLight('#ffc87b', 1, 3.1, 2);
  shelfGlow.position.set(-6.58, 2.25, -3.36);
  root.add(shelfGlow);
  for (const y of [2.15, 2.69])
    box(north, 1.98, 0.012, 0.02, -6.58, y - 0.045, -3.49, glow, 0.002);
  let aromaUntil = 0,
    now = 0,
    caseOpen = false,
    seatIndex = 0,
    menuIndex = 0,
    master = true,
    localLight = true,
    planView = false,
    focus: ObjectId | null = null;
  // Merge only static siblings. Animation pivots, labels and glass stay independent.
  function batch(p: T.Object3D) {
    for (const c of p.children) if (c instanceof T.Group) batch(c);
    const bins = new Map<T.Material, T.Mesh[]>();
    for (const o of p.children) {
      if (
        !(o instanceof T.Mesh) ||
        o instanceof T.InstancedMesh ||
        Array.isArray(o.material) ||
        o.material === glass ||
        o.geometry instanceof T.PlaneGeometry
      )
        continue;
      const list = bins.get(o.material) || [];
      list.push(o);
      bins.set(o.material, list);
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
      mesh(p, geo, m);
      for (const o of list) {
        p.remove(o);
        o.geometry.dispose();
      }
    }
  }
  for (const g of root.children)
    if (g instanceof T.Group && g !== front) batch(g);
  addCafeBotany({
    root,
    north,
    west,
    front,
    materials,
    textures,
    breeze: k.breeze,
  });
  return {
    prepareCoffee(drink: Drink) {
      return service.start(drink);
    },
    clearCoffee() {
      service.clear();
    },
    coffeeSnapshot: service.snapshot,
    aroma() {
      aromaUntil = now + 8;
    },
    setPlan(plan: boolean) {
      planView = plan;
      focus = null;
    },
    setFocus(id: ObjectId | null) {
      focus = id;
    },
    setLamp(on: boolean) {
      master = on;
    },
    setEnvironment(value: Environment) {
      windows.forEach((w) => w.set(value));
    },
    interact(id: ObjectId) {
      if (id === 'cafeEspresso') service.start('espresso');
      if (id === 'cafePourOver') service.start('filter');
      if (id === 'cafePastry') caseOpen = !caseOpen;
      if (id === 'cafeSeat')
        leather.color.set(['#174d3c', '#8b6046', '#536269'][++seatIndex % 3]);
      if (id === 'cafeLight') localLight = !localLight;
      if (id === 'cafeMenu') {
        const specials = [
          ['Honey oat latte', 'Ethiopia · floral'],
          ['Orange cold brew', 'Colombia · cacao'],
          ['Vanilla flat white', 'Brazil · hazelnut'],
        ];
        const choice = specials[++menuIndex % 3];
        menuPaint[1](['SLOW MOMENTS', ...choice, 'Freshly baked']);
      }
    },
    update(
      t: number,
      dt: number,
      reduced: boolean,
      night: boolean,
      viewer: T.Camera,
    ) {
      now = t;
      service.update(dt);
      const serving = service.snapshot();
      servedCup.visible = serving.phase === 'ready';
      servedCup.scale.fromArray([...drinks[serving.drink].scale]);
      servedCup.position.y = 1.537 + 0.022 * drinks[serving.drink].scale[1];
      drinkSurface.color.set(drinks[serving.drink].color);
      serviceSteam.update(
        dt,
        serving.heat,
        reduced,
        root.visible && !planView && servedCup.visible,
      );
      wisps.forEach((w, i) =>
        w.update(
          dt,
          coffeeHeat(t + 30 + i * 19) * (t < aromaUntil ? 1.2 : 0.65),
          reduced,
          root.visible && !planView,
        ),
      );
      shelfGlow.intensity = master && localLight ? (night ? 1.6 : 0.7) : 0;
      fixtures.visible = !planView && (!focus || focus === 'cafeLight');
      beams.visible = viewer.position.y < 3.65;
      const a = 1 - Math.exp(-dt * 5),
        brewing = serving.phase === 'extracting' && serving.drink !== 'filter',
        pouring = serving.phase === 'extracting' && serving.drink === 'filter';
      streams.visible = brewing;
      steam.update(dt, brewing ? 1.5 : 0, reduced, root.visible && !planView);
      indicator.emissiveIntensity = brewing
        ? reduced
          ? 1
          : 0.7 + Math.sin(t * 4) * 0.3
        : 0.45;
      pastryDoor.position.x = T.MathUtils.lerp(
        pastryDoor.position.x,
        caseOpen ? -0.46 : 0,
        a,
      );
      kettlePivot.rotation.z = T.MathUtils.lerp(
        kettlePivot.rotation.z,
        pouring ? 0.58 : 0,
        a,
      );
      kettlePivot.position.y = T.MathUtils.lerp(
        kettlePivot.position.y,
        pouring ? 0.6 : 0.17,
        a,
      );
      pour.visible = pouring;
      if (pouring) {
        kettlePivot.updateMatrix();
        const start = new T.Vector3(-0.41, 0.4, 0).applyMatrix4(
            kettlePivot.matrix,
          ),
          end = new T.Vector3(0, 0.63, 0);
        const axis = end.clone().sub(start);
        pourStream.position.copy(start.add(end).multiplyScalar(0.5));
        pourStream.scale.y = axis.length();
        pourStream.quaternion.setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          axis.normalize(),
        );
      }
      lights.forEach(
        (l) =>
          (l.intensity = T.MathUtils.lerp(
            l.intensity,
            master && localLight ? (night ? 9 : 4.5) : 0,
            a,
          )),
      );
      glow.emissiveIntensity = T.MathUtils.lerp(
        glow.emissiveIntensity,
        master && localLight ? 0.75 : 0,
        a,
      );
      windows.forEach((w) => w.update(t, dt, reduced, viewer));
    },
    dispose() {
      steam.dispose();
      serviceSteam.dispose();
      wisps.forEach((w) => w.dispose());
      windows.forEach((w) => w.dispose());
    },
  };
}
