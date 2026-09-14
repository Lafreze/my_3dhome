import { furnitureSuite, refinedTabletop } from './furniture-suite';
import { fitTimberGrain, interiorMaterial } from './house-finishes';
import { interiorPalette as palette } from './interior-palette';
import { paintingTexture } from './painting-textures';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addOakFloor } from './house-finishes';
import { attachSeats, type SeatAnchors } from './seat-scene';
import { barFurniture as f, barStools } from './bar-layout';
import {
  barDrinks,
  barRecords,
  createBarState,
  paintDartboard,
  dartTotal,
  type DartHit,
} from './bar-state';
import { rooms, type HouseView } from './house-data';
import type { ObjectId } from './room-data';
import type { WallCutaways } from './wall-cutaway';

type Kit = {
  assets: import('./asset-loading').RoomAssets;
  root: T.Group;
  seats: SeatAnchors;
  cutaways: WallCutaways;
  materials: T.Material[];
  textures: T.Texture[];
  floorMaterials: T.MeshStandardMaterial[];
  oak: T.MeshStandardMaterial;
  darkWood: T.MeshStandardMaterial;
  cream: T.MeshStandardMaterial;
  brass: T.MeshStandardMaterial;
  charcoal: T.MeshStandardMaterial;
  textile: (color: string) => T.MeshStandardMaterial;
  groups: Map<ObjectId, T.Group>;
  interactables: T.Object3D[];
};
export function buildBar(k: Kit) {
  const suite = furnitureSuite(k.materials, k.textures, k.assets);
  const { root, brass, charcoal } = k;
  root.name = '07 / Amber — neighbourhood listening bar';
  const state = createBarState();
  const mat = (color: string, roughness = 0.7, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    k.materials.push(m);
    return m;
  };
  const wood = suite.timber,
    dark = suite.recess;
  const wall = k.cream.clone();
  wall.color.set('#ded5c9');
  k.materials.push(wall);
  const velvet = interiorMaterial(
      'velvet',
      palette.barVelvet,
      k.materials,
      k.textures,
    ),
    saddle = interiorMaterial(
      'leather',
      palette.barLeather,
      k.materials,
      k.textures,
    );
  const cream = mat('#e8d9b8'),
    copper = mat('#ae7852', 0.35, 0.6),
    steel = mat('#b4bdba', 0.22, 0.85),
    leaf = mat('#66804b'),
    orange = mat('#d5a243');
  const glass = new T.MeshPhysicalMaterial({
    color: '#e6e7d9',
    transparent: true,
    opacity: 0.23,
    roughness: 0.08,
    metalness: 0.05,
    side: T.DoubleSide,
  });
  k.materials.push(glass);
  const drinkMat = mat('#d29138', 0.24),
    bottleColors = [
      mat('#415d42', 0.2),
      mat('#98713c', 0.23),
      mat('#5e4130', 0.2),
      mat('#84783f', 0.2),
    ];
  const glow = mat('#ffe0a0', 0.3);
  glow.emissive.set('#ffc468');
  glow.emissiveIntensity = 0.8;
  function mesh(
    p: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
    name?: string,
  ) {
    fitTimberGrain(g, m);
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    if (name) {
      o.name = name;
      o.userData.independent = true;
    }
    p.add(o);
    return o;
  }
  const box = (
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    r = 0.018,
  ) =>
    mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)),
      m,
      x,
      y,
      z,
    );
  const cyl = (
    p: T.Object3D,
    rt: number,
    rb: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => mesh(p, new T.CylinderGeometry(rt, rb, h, 24), m, x, y, z);
  const ball = (
    p: T.Object3D,
    r: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => mesh(p, new T.SphereGeometry(r, 12, 8), m, x, y, z);
  function group(p: T.Object3D, x = 0, y = 0, z = 0, name?: string) {
    const g = new T.Group();
    g.position.set(x, y, z);
    g.name = name || '';
    p.add(g);
    return g;
  }
  function object(id: ObjectId, x = 0, z = 0) {
    const g = group(root, x, 0, z, id);
    g.userData.id = id;
    k.groups.set(id, g);
    k.interactables.push(g);
    return g;
  }
  function rod(
    p: T.Object3D,
    a: number[],
    b: number[],
    r: number,
    m: T.Material,
  ) {
    const v = new T.Vector3(...a),
      end = new T.Vector3(...b),
      mid = v.clone().add(end).multiplyScalar(0.5);
    const o = cyl(p, r, r, v.distanceTo(end), mid.x, mid.y, mid.z, m);
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      end.sub(v).normalize(),
    );
    return o;
  }
  function tube(p: T.Object3D, points: number[][], r: number, m: T.Material) {
    return mesh(
      p,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((v) => new T.Vector3(...v))),
        24,
        r,
        7,
        false,
      ),
      m,
    );
  }
  function panel(
    p: T.Object3D,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    paint: (c: CanvasRenderingContext2D, cv: HTMLCanvasElement) => void,
  ) {
    const cv = document.createElement('canvas');
    cv.width = 768;
    cv.height = Math.round((768 * h) / w);
    paint(cv.getContext('2d')!, cv);
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    k.textures.push(tex);
    const m = new T.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    k.materials.push(m);
    const o = mesh(p, new T.PlaneGeometry(w, h), m, x, y, z, 'Printed surface');
    o.castShadow = false;
    return { cv, tex, mesh: o };
  }
  function label(
    p: T.Object3D,
    text: string,
    w: number,
    x: number,
    y: number,
    z: number,
    h = 0.25,
  ) {
    return panel(p, w, h, x, y, z, (c, cv) => {
      c.fillStyle = '#29382d';
      c.fillRect(0, 0, cv.width, cv.height);
      c.fillStyle = '#e4d0a4';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `500 ${cv.height * 0.49}px Georgia,"Noto Serif SC",serif`;
      c.fillText(text, cv.width / 2, cv.height / 2, cv.width * 0.94);
    });
  }
  function bottle(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    i: number,
    scale = 1,
  ) {
    const b = group(p, x, y, z);
    b.scale.setScalar(scale);
    const m = bottleColors[i % 4];
    cyl(b, 0.065, 0.071, 0.24, 0, 0.12, 0, m);
    cyl(b, 0.025, 0.065, 0.065, 0, 0.272, 0, m);
    cyl(b, 0.025, 0.025, 0.12, 0, 0.35, 0, m);
    cyl(b, 0.029, 0.029, 0.032, 0, 0.425, 0, brass);
    box(b, 0.112, 0.13, 0.007, 0, 0.15, 0.069, cream, 0.002);
    box(b, 0.075, 0.013, 0.009, 0, 0.18, 0.075, m, 0.001);
    return b;
  }
  function tumbler(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    filled = true,
  ) {
    const g = group(p, x, y, z);
    cyl(g, 0.077, 0.064, 0.17, 0, 0.085, 0, glass);
    cyl(g, 0.063, 0.059, 0.055, 0, 0.045, 0, filled ? drinkMat : glass);
    cyl(g, 0.105, 0.105, 0.012, 0, 0.005, 0, copper);
    return g;
  }
  function candle(p: T.Object3D, x: number, y: number, z: number) {
    cyl(p, 0.075, 0.065, 0.14, x, y + 0.07, z, glass);
    cyl(p, 0.05, 0.05, 0.08, x, y + 0.04, z, cream);
    ball(p, 0.02, x, y + 0.1, z, glow);
  }
  function plant(p: T.Object3D, x: number, y: number, z: number) {
    cyl(p, 0.12, 0.085, 0.19, x, y + 0.095, z, copper);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4,
        xx = x + Math.sin(a) * 0.17,
        zz = z + Math.cos(a) * 0.14;
      rod(
        p,
        [x, y + 0.16, z],
        [xx, y + 0.35 + (i % 3) * 0.05, zz],
        0.007,
        leaf,
      );
      const o = ball(p, 0.085, xx, y + 0.35 + (i % 3) * 0.05, zz, leaf);
      o.scale.set(0.6, 1.65, 0.35);
      o.rotation.z = Math.sin(a) * 0.9;
    }
  }
  function picture(
    p: T.Object3D,
    x: number,
    y: number,
    index: number,
    w = 0.75,
    h = 0.96,
  ) {
    const g = group(p, x, y, 0.135);
    box(g, w + 0.13, h + 0.13, 0.065, 0, 0, 0, dark);
    box(g, w + 0.06, h + 0.06, 0.015, 0, 0, 0.04, cream);
    const m = new T.MeshStandardMaterial({
      map: paintingTexture(
        k.assets,
        'bar',
        index === 1 || index === 2
          ? 'art.rainy-lanterns'
          : index === 3
            ? 'art.coastal-dawn'
            : 'art.moonlit-water',
        k.textures,
        w / h,
      ),
      roughness: 0.9,
    });
    k.materials.push(m);
    mesh(g, new T.PlaneGeometry(w, h), m, 0, 0, 0.052);
  }
  // Full room envelope, including a real opening facing the corridor.
  box(root, 9, 0.4, 8, 0, -0.23, 0, wood, 0.04);
  addOakFloor(root, 8.85, 7.85, k.floorMaterials);
  function roomWall(
    width: number,
    x: number,
    z: number,
    yaw: number,
    door?: number,
  ) {
    const lower = group(root, x, 0, z),
      upper = group(root, x, 0, z);
    lower.rotation.y = upper.rotation.y = yaw;
    const points = [
      -width / 2,
      width / 2,
      ...(door === undefined ? [] : [door - 0.7, door + 0.7]),
    ].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1],
        mid = (a + b) / 2,
        w = b - a;
      if (door !== undefined && Math.abs(mid - door) < 0.7) continue;
      box(lower, w, 0.65, 0.16, mid, 0.405, 0, dark);
      box(lower, w, 0.065, 0.21, mid, 0.758, 0.018, wood);
      box(upper, w, 2.85, 0.16, mid, 2.19, 0, wall);
      box(upper, w, 0.56, 0.025, mid, 1.05, 0.1, dark);
      box(upper, w, 0.055, 0.065, mid, 1.35, 0.12, wood);
      for (let q = a + 0.13; q < b - 0.05; q += 0.47) {
        box(lower, 0.036, 0.49, 0.035, q, 0.405, 0.1, wood);
        box(upper, 0.036, 0.52, 0.035, q, 1.055, 0.13, wood);
      }
      box(upper, w, 0.14, 0.24, mid, 3.55, 0, dark);
      box(lower, w, 0.09, 0.2, mid, 0.13, 0.05, wood);
    }
    if (door !== undefined) {
      box(upper, 1.4, 0.92, 0.16, door, 3.16, 0, wall);
      for (const d of [-0.75, 0.75])
        box(upper, 0.1, 2.65, 0.24, door + d, 1.43, 0, wood);
      box(upper, 1.62, 0.1, 0.24, door, 2.8, 0, wood);
      box(root, 0.24, 0.025, 1.38, x, 0.098, z - Math.sin(yaw) * door, wood);
    }
    k.cutaways.add(
      [upper],
      {
        x: rooms.bar.x + x,
        z: rooms.bar.z + z,
        nx: Math.sin(yaw),
        nz: Math.cos(yaw),
      },
      ['bar'],
    );
    return upper;
  }
  const north = roomWall(9, 0, -3.91, 0),
    east = roomWall(8, 4.41, 0, -Math.PI / 2, 0.15);
  const gardenDoor = object('barGardenDoor', 4.31, 0.15);
  gardenDoor.rotation.y = -Math.PI / 2;
  label(gardenDoor, 'CONSERVATORY', 1.27, 0, 3.05, 0);
  k.cutaways.add([gardenDoor], { x: 22.81, z: 14.35, nx: -1, nz: 0 }, ['bar']);
  roomWall(9, 0, 3.91, Math.PI);
  const west = roomWall(8, -4.41, 0, Math.PI / 2, -1.9);
  const exit = object('barExitDoor', -4.31, 1.9);
  exit.rotation.y = Math.PI / 2;
  label(exit, '← EAST WALK · 连廊', 1.27, 0, 3.05, 0);
  for (const side of [-0.76, 0.76])
    box(exit, 0.09, 2.65, 0.08, side, 1.42, 0, wood);
  k.cutaways.add([exit], { x: 14.09, z: 16.1, nx: 1, nz: 0 }, ['bar']);
  // Back bar: bottles and glasses are individually shaped; the sink has a recessed basin.
  const back = group(root, f.backbar.x, 0, f.backbar.z);
  // Cabinet carcass and worktop are hollow at the sink and fridge apertures.
  box(back, 4.15, 0.09, 0.76, 0, 0.18, 0, dark);
  box(back, 4.15, 0.84, 0.04, 0, 0.66, -0.36, dark);
  for (const x of [-2.04, 0.63, 2.04])
    box(back, 0.07, 0.94, 0.76, x, 0.61, 0, dark);
  for (const [x, w] of [
    [-1.6, 1.05],
    [0.9, 2.45],
  ])
    box(back, w, 0.1, 0.86, x, 1.13, 0, suite.stone);
  for (const z of [-0.355, 0.355])
    box(back, 0.75, 0.1, 0.15, -0.7, 1.13, z, suite.stone);
  for (const x of [-1.63, -0.88, 0.02]) {
    box(back, 0.68, 0.72, 0.04, x, 0.64, 0.4, wood);
    rod(back, [x - 0.1, 0.87, 0.442], [x + 0.1, 0.87, 0.442], 0.018, brass);
  }
  // Replace the top under the sink with an actual lowered metallic bowl, framed above the counter.
  const sink = group(back, -0.7, 1.16, 0);
  box(sink, 0.69, 0.018, 0.45, 0, -0.16, 0, steel);
  cyl(sink, 0.035, 0.035, 0.012, 0, -0.144, 0, charcoal);
  for (const x of [-0.342, 0.342])
    box(sink, 0.018, 0.18, 0.45, x, -0.07, 0, steel);
  for (const z of [-0.217, 0.217])
    box(sink, 0.69, 0.18, 0.018, 0, -0.07, z, steel);
  for (const x of [-0.36, 0.36]) box(sink, 0.05, 0.06, 0.52, x, 0.03, 0, steel);
  for (const z of [-0.235, 0.235])
    box(sink, 0.7, 0.06, 0.05, 0, 0.03, z, steel);
  tube(
    sink,
    [
      [0, 0.02, -0.27],
      [0, 0.45, -0.27],
      [0, 0.48, -0.1],
      [0, 0.33, -0.06],
    ],
    0.022,
    brass,
  );
  for (const x of [-0.23, 0.23]) {
    cyl(sink, 0.03, 0.04, 0.08, x, 0.05, -0.26, brass);
    box(sink, 0.13, 0.018, 0.025, x, 0.1, -0.26, brass);
  }
  for (const y of [1.82, 2.52, 3.19]) {
    box(back, 4.22, 0.065, 0.44, 0, y, -0.12, wood);
    rod(back, [-2.01, y + 0.1, 0.095], [2.01, y + 0.1, 0.095], 0.012, brass);
    for (let i = 0; i < 12; i++)
      bottle(
        back,
        -1.88 + i * 0.34,
        y + 0.035,
        -0.12,
        i,
        i % 4 === 0 ? 0.9 : 1,
      );
    for (const x of [-2.02, 2.02])
      rod(back, [x, y, -0.27], [x, y + 0.15, 0.09], 0.012, brass);
  }
  for (const x of [-2.12, 2.12])
    box(back, 0.1, 2.5, 0.45, x, 2.02, -0.12, dark);
  for (let i = 0; i < 8; i++) {
    const x = -1.85 + i * 0.23;
    rod(back, [x, 1.8, 0.1], [x, 1.59, 0.1], 0.011, glass);
    cyl(back, 0.04, 0.073, 0.11, x, 1.53, 0.1, glass);
    cyl(back, 0.07, 0.07, 0.014, x, 1.795, 0.1, glass);
  }
  plant(back, 1.87, 3.23, -0.1);
  plant(back, -1.9, 3.23, -0.1);
  label(north, 'AMBER  /  琥珀小酒馆', 3.8, -2.2, 3.46, 0.15, 0.25);
  const fridge = object('barFridge', f.backbar.x + 1.28, f.backbar.z + 0.1);
  box(fridge, 1.12, 0.9, 0.045, 0, 0.63, -0.29, charcoal);
  for (const x of [-0.535, 0.535])
    box(fridge, 0.05, 0.9, 0.84, x, 0.63, 0.12, charcoal);
  for (const y of [0.205, 1.055])
    box(fridge, 1.1, 0.05, 0.84, 0, y, 0.12, steel);
  box(fridge, 0.98, 0.79, 0.015, 0, 0.63, -0.26, steel);
  for (const y of [0.35, 0.68]) {
    box(fridge, 0.98, 0.025, 0.73, 0, y, 0.13, steel);
    for (let i = 0; i < 4; i++)
      bottle(fridge, -0.33 + i * 0.22, y + 0.02, 0.22, i, 0.64);
  }
  const fridgeHinge = group(fridge, -0.53, 0.64, 0.57, 'Fridge door hinge');
  for (const x of [0, 1.06])
    box(fridgeHinge, 0.055, 0.86, 0.05, x, 0, 0, charcoal);
  for (const y of [-0.405, 0.405])
    box(fridgeHinge, 1.06, 0.055, 0.05, 0.53, y, 0, charcoal);
  box(fridgeHinge, 1.005, 0.755, 0.017, 0.53, 0, 0, glass);
  rod(fridgeHinge, [0.94, -0.15, 0.08], [0.94, 0.15, 0.08], 0.017, brass);
  const cold = new T.PointLight('#dcefc5', 0, 2, 2);
  cold.position.set(0, 0.75, 0.64);
  fridge.add(cold);
  // Counter leaves a continuous staff aisle and an open end to the right.
  const counter = object('barMix', f.counter.x, f.counter.z);
  box(counter, 4.2, 1.31, 0.72, 0, 0.785, 0, dark);
  box(counter, 4.38, 0.14, 0.96, 0, 1.515, 0, suite.stone, 0.065);
  for (let i = 0; i < 5; i++) {
    const x = -1.65 + i * 0.825;
    box(counter, 0.75, 1.02, 0.032, x, 0.81, 0.378, wood);
    box(counter, 0.63, 0.88, 0.024, x, 0.81, 0.403, suite.lacquer);
  }
  for (const x of [-1.92, -0.65, 0.65, 1.92])
    rod(counter, [x, 0.29, 0.39], [x, 0.29, 0.67], 0.023, brass);
  rod(counter, [-2, 0.29, 0.67], [2, 0.29, 0.67], 0.027, brass);
  const turn = group(root, f.return.x, 0, f.return.z);
  box(turn, 0.68, 1.31, 2.1, 0, 0.785, 0, dark);
  box(turn, 0.84, 0.14, 2.23, 0, 1.515, 0, wood, 0.055);
  label(
    counter,
    '三款心情 · 一杯慢慢来',
    1.2,
    -1.12,
    1.605,
    -0.04,
    0.24,
  ).mesh.rotation.x = -Math.PI / 2;
  for (const x of [-1.6, -0.65, 0.65, 1.6])
    cyl(counter, 0.11, 0.11, 0.012, x, 1.592, 0.24, copper);
  const shaker = group(counter, 0.3, 1.59, -0.05, 'Cocktail shaker');
  cyl(shaker, 0.1, 0.08, 0.29, 0, 0.145, 0, steel);
  cyl(shaker, 0.055, 0.1, 0.055, 0, 0.318, 0, steel);
  cyl(shaker, 0.055, 0.055, 0.05, 0, 0.37, 0, steel);
  const jigger = group(counter, 0.62, 1.59, -0.13);
  cyl(jigger, 0.046, 0.018, 0.065, 0, 0.1, 0, steel);
  cyl(jigger, 0.018, 0.037, 0.055, 0, 0.04, 0, steel);
  const pouringBottle = bottle(counter, -0.15, 1.59, -0.22, 1, 0.85);
  const serving = group(counter, 1.13, 1.59, 0.13, 'Finished cocktail');
  cyl(serving, 0.085, 0.072, 0.22, 0, 0.11, 0, glass);
  cyl(serving, 0.115, 0.115, 0.012, 0, 0.005, 0, copper);
  const liquid = cyl(serving, 0.072, 0.064, 0.16, 0, 0.092, 0, drinkMat);
  liquid.userData.independent = true;
  const ice = group(serving, 0, 0.18, 0, 'Ice cubes');
  for (const [x, z] of [
    [-0.028, -0.015],
    [0.03, 0.019],
    [-0.013, 0.036],
  ]) {
    const cube = box(ice, 0.045, 0.05, 0.045, x, 0, z, glass);
    cube.rotation.y = x * 19;
  }
  const garnish = group(serving, 0.066, 0.22, 0, 'Citrus garnish');
  const slice = cyl(garnish, 0.06, 0.06, 0.013, 0, 0, 0, orange);
  slice.rotation.x = Math.PI / 2;
  const pulp = cyl(garnish, 0.049, 0.049, 0.015, 0, 0, 0, cream);
  pulp.rotation.x = Math.PI / 2;
  const pour = rod(
    counter,
    [0.17, 2.135, -0.22],
    [0.3, 1.985, -0.05],
    0.01,
    drinkMat,
  );
  pour.userData.independent = true;
  pour.visible = false;
  const bowl = group(counter, -1.8, 1.59, -0.1);
  cyl(bowl, 0.16, 0.1, 0.09, 0, 0.045, 0, wood);
  for (let i = 0; i < 5; i++)
    ball(
      bowl,
      0.052,
      Math.sin(i * 2.4) * 0.1,
      0.1,
      Math.cos(i * 2.4) * 0.08,
      i % 2 ? leaf : orange,
    );
  // Four real high seats, including foot rings and splayed legs.
  for (const s of barStools) {
    const g = group(root, s.x, 0, s.z, s.id);
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        rod(
          g,
          [x * 0.23, 0.12, z * 0.23],
          [x * 0.16, 1.1, z * 0.16],
          0.035,
          wood,
        );
    const ring = mesh(
      g,
      new T.TorusGeometry(0.225, 0.017, 7, 32),
      brass,
      0,
      0.55,
      0,
    );
    ring.rotation.x = Math.PI / 2;
    cyl(g, 0.295, 0.285, 0.1, 0, 1.075, 0, wood);
    cyl(g, 0.294, 0.294, 0.19, 0, 1.178, 0, saddle);
    const piping = mesh(
      g,
      new T.TorusGeometry(0.284, 0.009, 6, 36),
      copper,
      0,
      1.245,
      0,
    );
    piping.rotation.x = Math.PI / 2;
    attachSeats(k.seats, g, [s.id]);
    k.interactables.push(g);
  }
  const rug = panel(root, 3.2, 3.55, 2.65, 0.09, -1.86, (c, cv) => {
    c.fillStyle = '#746762';
    c.fillRect(0, 0, cv.width, cv.height);
    for (const [inset, color] of [
      [14, '#a28b79'],
      [26, '#615b59'],
      [39, '#b29c86'],
      [51, '#847166'],
    ] as const) {
      c.strokeStyle = color;
      c.lineWidth = 7;
      c.strokeRect(inset, inset, cv.width - inset * 2, cv.height - inset * 2);
    }
    c.strokeStyle = '#a99581';
    c.lineWidth = 4;
    for (let y = 90; y < cv.height - 60; y += 80)
      for (let x = 92; x < cv.width - 60; x += 80) {
        c.beginPath();
        c.moveTo(x, y - 18);
        c.lineTo(x + 13, y);
        c.lineTo(x, y + 18);
        c.lineTo(x - 13, y);
        c.closePath();
        c.stroke();
      }
  });
  const rugWool = interiorMaterial('wool', '#ffffff', k.materials, k.textures);
  rugWool.map = (rug.mesh.material as T.MeshStandardMaterial).map;
  rug.mesh.material = rugWool;
  rug.mesh.rotation.x = -Math.PI / 2;
  function booth(
    x: number,
    z: number,
    width: number,
    yaw: number,
    ids: string[],
  ) {
    const g = group(root, x, 0, z, ids[0]);
    g.rotation.y = yaw;
    box(g, width, 0.39, 0.8, 0, 0.385, 0, dark);
    box(g, width - 0.08, 0.27, 0.72, 0, 0.675, 0.035, velvet, 0.085);
    box(g, width, 0.99, 0.2, 0, 1.08, -0.315, velvet, 0.08);
    box(g, width + 0.035, 0.065, 0.22, 0, 1.61, -0.315, wood);
    for (let v = -width / 2 + 0.17; v < width / 2; v += 0.3) {
      box(g, 0.015, 0.77, 0.025, v, 1.13, -0.2, dark, 0.004);
      ball(g, 0.018, v, 1.18, -0.182, brass);
    }
    for (const side of [-1, 1]) {
      box(g, 0.1, 0.57, 0.81, side * (width / 2 - 0.02), 0.9, 0, wood);
      box(
        g,
        0.12,
        0.12,
        0.79,
        side * (width / 2 - 0.02),
        1.17,
        0,
        velvet,
        0.035,
      );
    }
    attachSeats(k.seats, g, ids);
    k.interactables.push(g);
  }
  booth(f.boothNorth.x, f.boothNorth.z, f.boothNorth.width, 0, [
    'bar-sofa-north-1',
    'bar-sofa-north-2',
  ]);
  booth(f.boothEast.x, f.boothEast.z, f.boothEast.depth, -Math.PI / 2, [
    'bar-sofa-east-1',
    'bar-sofa-east-2',
  ]);
  for (const [i, t] of [f.tableNorth, f.tableEast].entries()) {
    const g = group(root, t.x, 0, t.z);
    cyl(g, 0.23, 0.3, 0.065, 0, 0.13, 0, dark);
    cyl(g, 0.047, 0.07, 0.85, 0, 0.56, 0, brass);
    refinedTabletop(g, t.width, t.width, 1.0475, suite, true);
    candle(g, -0.12, 1.055, 0);
    tumbler(g, 0.17, 1.06, -0.06);
    if (i) plant(g, 0.13, 1.055, 0.19);
  }
  for (const x of [1.27, 3.8]) {
    const cushion = box(root, 0.33, 0.43, 0.17, x, 1.03, -3.45, saddle, 0.075);
    cushion.rotation.z = x < 2 ? -0.18 : 0.18;
  }
  picture(north, 1.8, 2.46, 1, 0.82, 1.0);
  picture(north, 3.05, 2.48, 3, 0.74, 0.92);
  picture(east, -2.1, 2.53, 4, 0.73, 0.95);
  picture(east, -0.9, 2.5, 2, 0.52, 0.71);
  // Record cabinet faces the entry; the platter and tonearm remain independent.
  const record = object('barRecord', f.record.x, f.record.z);
  record.rotation.y = Math.PI;
  box(record, 1.8, 0.88, 0.64, 0, 0.58, 0, wood);
  box(record, 1.87, 0.075, 0.71, 0, 1.055, 0, dark);
  for (const x of [-0.82, 0.82])
    for (const z of [-0.25, 0.25])
      box(record, 0.055, 0.17, 0.055, x, 0.17, z, dark);
  for (let i = 0; i < 20; i++) {
    const m = i % 3 === 0 ? velvet : i % 3 === 1 ? saddle : cream;
    const sleeve = box(
      record,
      0.048,
      0.6,
      0.36,
      -0.73 + i * 0.054,
      0.61,
      0.155,
      m,
      0.003,
    );
    sleeve.rotation.z = -0.08;
  }
  const turntable = group(record, 0.16, 1.1, 0);
  box(turntable, 1.12, 0.085, 0.52, 0, 0.04, 0, wood);
  const vinyl = group(turntable, -0.14, 0.09, 0, 'Vinyl platter');
  cyl(vinyl, 0.235, 0.235, 0.019, 0, 0, 0, charcoal);
  for (const r of [0.13, 0.17, 0.2, 0.222]) {
    const line = mesh(
      vinyl,
      new T.TorusGeometry(r, 0.0015, 4, 48),
      steel,
      0,
      0.011,
      0,
    );
    line.rotation.x = Math.PI / 2;
  }
  const recordInk = mat('#c89851');
  const recordLabel = cyl(vinyl, 0.074, 0.074, 0.021, 0, 0.008, 0, orange);
  recordLabel.userData.independent = true;
  cyl(vinyl, 0.009, 0.009, 0.028, 0, 0.02, 0, brass);
  const arm = group(turntable, 0.39, 0.13, -0.14, 'Tonearm');
  cyl(arm, 0.033, 0.04, 0.035, 0, 0, 0, brass);
  rod(arm, [0, 0.016, 0], [-0.12, 0.035, 0.23], 0.012, steel);
  box(arm, 0.035, 0.035, 0.075, -0.13, 0.03, 0.25, charcoal);
  const sleeve = group(record, -0.64, 1.1, -0.14);
  box(sleeve, 0.34, 0.38, 0.032, 0, 0.19, 0, velvet);
  label(sleeve, 'AMBER', 0.28, 0, 0.26, 0.018, 0.1);
  plant(record, 0.72, 1.1, -0.05);
  // Entry details live beside the door, outside its swing and walking width.
  const hooks = group(west, -3.25, 2.18, 0.15);
  box(hooks, 0.7, 0.14, 0.07, 0, 0, 0, wood);
  for (const x of [-0.24, 0, 0.24])
    tube(
      hooks,
      [
        [x, 0.03, 0.035],
        [x, -0.1, 0.13],
        [x, -0.03, 0.17],
      ],
      0.015,
      brass,
    );
  const coat = group(hooks, -0.17, -0.17, 0.13);
  box(coat, 0.26, 0.54, 0.075, 0, -0.25, 0, velvet, 0.06);
  for (const side of [-1, 1]) {
    const o = box(coat, 0.105, 0.37, 0.06, side * 0.2, -0.16, 0, velvet, 0.04);
    o.rotation.z = side * 0.32;
  }
  for (let i = 0; i < 3; i++)
    ball(coat, 0.01, 0, -0.15 - i * 0.12, 0.045, brass);
  const umbrella = group(root, f.umbrellas.x, 0.1, f.umbrellas.z);
  cyl(umbrella, 0.15, 0.12, 0.53, 0, 0.265, 0, brass);
  for (const x of [-0.045, 0.055]) {
    const u = group(umbrella, x, 0.16, 0);
    u.rotation.z = x * 1.5;
    cyl(u, 0.05, 0.025, 0.65, 0, 0.35, 0, velvet);
    tube(
      u,
      [
        [0, 0.65, 0],
        [0, 0.86, 0],
        [0.085, 0.89, 0],
        [0.11, 0.8, 0],
      ],
      0.018,
      dark,
    );
  }
  // Dedicated east wall and a clear throw lane, away from tables and the entrance.
  const dart = object('barDarts', 4.27, 2.35);
  dart.position.y = 2.48;
  dart.rotation.y = -Math.PI / 2;
  k.cutaways.add(
    [dart],
    { x: rooms.bar.x + 4.27, z: rooms.bar.z + 2.35, nx: -1, nz: 0 },
    ['bar'],
  );
  box(dart, 1.8, 2.0, 0.1, 0, 0, 0, dark, 0.065);
  box(dart, 1.68, 1.88, 0.04, 0, 0, 0.067, wood);
  panel(dart, 1.55, 1.55, 0, 0.08, 0.094, (c, cv) =>
    paintDartboard(c, cv.width),
  );
  const scoreLabel = label(
    dart,
    '九镖一局 · 0 分',
    1.36,
    0,
    -0.83,
    0.096,
    0.17,
  );
  const dartMeshes: T.Group[] = [];
  let hits: DartHit[] = [];
  let dartAge = 1;
  box(root, 0.034, 0.01, 1.75, 0.5, 0.095, 2.35, brass);
  const throwLabel = label(
    root,
    '投掷线  /  请留空',
    1.18,
    -0.1,
    0.102,
    2.35,
    0.18,
  );
  throwLabel.mesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  for (const z of [1.475, 3.225])
    box(root, 3.8, 0.008, 0.018, 2.4, 0.096, z, copper);
  const lights: T.PointLight[] = [];
  function sconce(p: T.Object3D, x: number, y: number) {
    const g = group(p, x, y, 0.17);
    cyl(g, 0.08, 0.08, 0.025, 0, 0, 0, brass).rotation.x = Math.PI / 2;
    tube(
      g,
      [
        [0, 0, 0],
        [0, -0.09, 0.16],
        [0, 0.1, 0.23],
      ],
      0.018,
      brass,
    );
    cyl(g, 0.075, 0.052, 0.19, 0, 0.19, 0.23, glass);
    ball(g, 0.04, 0, 0.19, 0.23, glow);
    cyl(g, 0.055, 0.1, 0.06, 0, 0.31, 0.23, brass);
  }
  sconce(north, 0.3, 2.63);
  sconce(east, 3.5, 2.73);
  sconce(west, 0.5, 2.65);
  sconce(east, -3.25, 2.67);
  for (const [x, z] of [
    [-1.9, -1.8],
    [2.8, -1.6],
    [2.9, 2.35],
  ]) {
    const light = new T.PointLight('#ffdc9d', 6, 9, 1.8);
    light.position.set(x, 3.1, z);
    root.add(light);
    lights.push(light);
  }
  const pendants = group(root, 0, 0, 0);
  for (const x of [-3.4, -1.1]) {
    rod(pendants, [x, 3.55, -0.55], [x, 2.85, -0.55], 0.012, charcoal);
    cyl(pendants, 0.06, 0.29, 0.2, x, 2.77, -0.55, brass);
    cyl(pendants, 0.26, 0.26, 0.012, x, 2.66, -0.55, glow);
  }
  // Merge only static sibling meshes; hinges, seats, tools and flight pieces keep their transforms.
  function batch(parent: T.Object3D) {
    for (const child of parent.children)
      if (child instanceof T.Group) batch(child);
    const buckets = new Map<T.Material, T.Mesh[]>();
    for (const o of parent.children)
      if (
        o instanceof T.Mesh &&
        !Array.isArray(o.material) &&
        !o.userData.independent &&
        !o.material.transparent
      ) {
        const bucket = buckets.get(o.material) || [];
        bucket.push(o);
        buckets.set(o.material, bucket);
      }
    for (const [material, objects] of buckets)
      if (objects.length > 3) {
        const geometries = objects.map((o) => {
          o.updateMatrix();
          return (
            o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
          ).applyMatrix4(o.matrix);
        });
        const combined = mergeGeometries(geometries);
        geometries.forEach((g) => g.dispose());
        if (combined) {
          for (const o of objects) {
            parent.remove(o);
            o.geometry.dispose();
          }
          mesh(parent, combined, material);
        }
      }
  }
  // Bottle, tonearm and shimmer must not be baked with nearby geometry.
  recordLabel.userData.independent = true;
  batch(root);
  let lamp = true,
    focused = false;
  return {
    snapshot: () => ({
      ...state.snapshot(),
      darts: hits.map((h) => ({ ...h })),
      dartTotal: dartTotal(hits),
    }),
    prepare: (drink: import('./bar-state').BarDrink) => state.prepare(drink),
    clear: () => state.clear(),
    setRecord(this: void, index: number | null) {
      state.record(index);
      const i = state.snapshot().record;
      if (i !== null) {
        recordInk.color.set(barRecords[i].color);
      }
    },
    setDarts(this: void, next: DartHit[]) {
      hits = next.slice(0, 9);
      for (const g of dartMeshes) {
        dart.remove(g);
        g.traverse((o) => {
          if (o instanceof T.Mesh) o.geometry.dispose();
        });
      }
      dartMeshes.length = 0;
      hits.forEach((h, i) => {
        const g = group(
          dart,
          h.x * (1.55 / 2.42),
          0.08 - h.y * (1.55 / 2.42),
          0.12,
          `Dart ${i + 1}`,
        );
        rod(g, [0, 0, 0], [0, 0, 0.24], 0.009, steel);
        rod(g, [0, 0, 0.12], [0, 0, 0.26], 0.015, brass);
        for (const a of [0, Math.PI / 2]) {
          const fin = box(g, 0.08, 0.012, 0.085, 0, 0, 0.23, saddle, 0.003);
          fin.rotation.z = a;
        }
        dartMeshes.push(g);
      });
      dartAge = 0;
      const c = scoreLabel.cv.getContext('2d')!;
      c.fillStyle = '#29382d';
      c.fillRect(0, 0, scoreLabel.cv.width, scoreLabel.cv.height);
      c.fillStyle = '#e4d0a4';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '42px serif';
      c.fillText(
        `${hits.length} / 9 镖 · ${dartTotal(hits)} 分`,
        scoreLabel.cv.width / 2,
        scoreLabel.cv.height / 2,
      );
      scoreLabel.tex.needsUpdate = true;
    },
    setFocus(id: ObjectId | null) {
      focused = !!id?.startsWith('bar');
    },
    setView(_view: HouseView) {
      focused = false;
    },
    setLamp(on: boolean) {
      lamp = on;
    },
    interact(id: ObjectId) {
      if (id === 'barFridge') state.fridge();
    },
    update(t: number, dt: number, reduced: boolean, night: boolean) {
      state.update(dt);
      const s = state.snapshot();
      fridgeHinge.rotation.y = T.MathUtils.damp(
        fridgeHinge.rotation.y,
        s.fridgeOpen ? -1.8 : 0,
        7,
        dt,
      );
      cold.intensity = s.fridgeOpen ? 1.3 : 0;
      if (!root.visible) return;
      lights.forEach((l) => (l.intensity = lamp ? (night ? 9 : 5) : 0));
      glow.emissiveIntensity = lamp ? 0.85 : 0;
      pendants.visible = !focused;
      vinyl.rotation.y = s.record !== null && !reduced ? t * 2.1 : 0;
      arm.rotation.y = T.MathUtils.damp(
        arm.rotation.y,
        s.record === null ? -0.65 : 0,
        5,
        dt,
      );
      drinkMat.color.set(barDrinks[s.drink].color);
      liquid.visible = s.phase !== 'idle' && s.phase !== 'ice';
      ice.visible = s.phase !== 'idle';
      garnish.visible = s.phase === 'garnish' || s.phase === 'ready';
      liquid.scale.y =
        s.phase === 'pour' ? Math.max(0.03, (s.age - 1.3) / 1.7) : 1;
      shaker.position.y =
        1.59 +
        (s.phase === 'shake' && !reduced ? 0.25 + Math.sin(t * 22) * 0.05 : 0);
      shaker.rotation.z =
        s.phase === 'shake' && !reduced ? Math.sin(t * 22) * 0.5 : 0;
      pouringBottle.rotation.z = s.phase === 'pour' ? -2.05 : 0;
      pouringBottle.position.y = s.phase === 'pour' ? 2.3 : 1.59;
      pour.visible = s.phase === 'pour';
      dartAge = Math.min(1, dartAge + dt * 3);
      if (dartMeshes.length) {
        const last = dartMeshes.at(-1)!;
        last.position.z = 0.12 + (reduced ? 0 : (1 - dartAge) * 3.4);
      }
    },
  };
}
