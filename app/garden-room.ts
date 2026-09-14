import { gardenDetails as detail } from './garden-detail-layout';
import { edgeDrapeGeometry, gardenBasinGeometry } from './garden-joinery';
import { gardenCraftFinishes, trowelGeometry } from './garden-surfaces';
import { furnitureSuite, refinedTabletop } from './furniture-suite';
import { fitTimberGrain, interiorMaterial } from './house-finishes';
import { interiorPalette as palette } from './interior-palette';
import { createSpineAtlas, bindingColors } from './book-spines';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addOakFloor } from './house-finishes';
import { pillowGeometry } from './bed-linen';
import { attachSeats, type SeatAnchors } from './seat-scene';
import { rooms, type HouseView } from './house-data';
import type { ObjectId } from './room-data';
import type { WallCutaways } from './wall-cutaway';
import type { HouseLandscape } from './house-landscape';
import type { InteriorBreeze } from './interior-atmosphere';
import type { Environment } from './environment-data';
import { createWindowEnvironment } from './room-environment';
import { gardenFurniture as f, gardenPortals } from './garden-layout';
import { gardenBotany } from './garden-botany';
import { createGardenState } from './garden-state';

type Kit = {
  assets: import('./asset-loading').RoomAssets;
  root: T.Group;
  seats: SeatAnchors;
  cutaways: WallCutaways;
  landscape: HouseLandscape;
  breeze: InteriorBreeze;
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
export function buildGarden(k: Kit) {
  const suite = furnitureSuite(k.materials, k.textures, k.assets);
  const craft = gardenCraftFinishes(k.materials, k.textures);
  const { root, brass, charcoal } = k,
    state = createGardenState();
  root.name = '09 / Conservatory — read, grow, rest';
  const mat = (color: string, roughness = 0.78, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    k.materials.push(m);
    return m;
  };
  const wood = suite.timber,
    dark = suite.recess;
  const cream = k.cream.clone();
  cream.color.set('#e9e3d8');
  k.materials.push(cream);
  const green = k.textile(palette.gardenAccent),
    linen = k.textile(palette.gardenLinen),
    ochre = interiorMaterial('wool', '#b6b3a5', k.materials, k.textures);
  linen.side = T.DoubleSide;
  const cane = interiorMaterial('ash', '#b9a17d', k.materials, k.textures),
    paper = mat('#ede4cc'),
    white = interiorMaterial('glaze', '#eee7db', k.materials, k.textures),
    lemon = mat('#ddb345'),
    water = mat('#bacbb3', 0.18);
  const glass = new T.MeshPhysicalMaterial({
    color: '#eff6f3',
    transparent: true,
    opacity: 0.14,
    roughness: 0.09,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const windowGlass = glass.clone();
  windowGlass.opacity = 0.065;
  windowGlass.roughness = 0.065;
  windowGlass.name = 'Conservatory / low tint panoramic glazing';
  k.materials.push(glass, windowGlass);
  const glow = mat('#ffe4ae');
  glow.emissive.set('#ffc47e');
  glow.emissiveIntensity = 0.4;
  const bot = gardenBotany(k.materials, k.textures, k.breeze);
  function mesh(
    p: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
    name = '',
  ) {
    fitTimberGrain(g, m);
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
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
    r = 0.012,
  ) =>
    mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 3, h / 3, d / 3)),
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
  ) => mesh(p, new T.CylinderGeometry(rt, rb, h, 20), m, x, y, z);
  const ball = (
    p: T.Object3D,
    r: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => mesh(p, new T.SphereGeometry(r, 12, 9), m, x, y, z);
  const group = (p: T.Object3D, x = 0, y = 0, z = 0, name = '') => {
    const g = new T.Group();
    g.position.set(x, y, z);
    g.name = name;
    p.add(g);
    return g;
  };
  const object = (id: ObjectId, x: number, z: number) => {
    const g = group(root, x, 0, z, id);
    g.userData.id = id;
    k.groups.set(id, g);
    k.interactables.push(g);
    return g;
  };
  const rod = (
    p: T.Object3D,
    a: number[],
    b: number[],
    r: number,
    m: T.Material,
  ) => {
    const u = new T.Vector3(...a),
      v = new T.Vector3(...b),
      mid = u.clone().add(v).multiplyScalar(0.5);
    const o = cyl(p, r, r, u.distanceTo(v), mid.x, mid.y, mid.z, m);
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      v.sub(u).normalize(),
    );
    return o;
  };
  const tube = (p: T.Object3D, pts: number[][], r: number, m: T.Material) =>
    mesh(
      p,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(pts.map((v) => new T.Vector3(...v))),
        24,
        r,
        6,
        false,
      ),
      m,
    );
  function panel(
    p: T.Object3D,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    draw: (c: CanvasRenderingContext2D, cv: HTMLCanvasElement) => void,
  ) {
    const cv = document.createElement('canvas');
    cv.width = 640;
    cv.height = Math.round((640 * h) / w);
    draw(cv.getContext('2d')!, cv);
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    k.textures.push(tex);
    const m = new T.MeshStandardMaterial({
      map: tex,
      roughness: 0.9,
      side: T.DoubleSide,
    });
    k.materials.push(m);
    const o = mesh(
      p,
      new T.PlaneGeometry(w, h),
      m,
      x,
      y,
      z,
      'Printed botanical detail',
    );
    o.castShadow = false;
    return { cv, tex, mesh: o };
  }
  const label = (
    p: T.Object3D,
    text: string,
    w: number,
    x: number,
    y: number,
    z: number,
    h = 0.2,
  ) =>
    panel(p, w, h, x, y, z, (c, cv) => {
      c.fillStyle = '#495a41';
      c.fillRect(0, 0, cv.width, cv.height);
      c.strokeStyle = '#c7b382';
      c.lineWidth = 3;
      c.strokeRect(7, 7, cv.width - 14, cv.height - 14);
      c.fillStyle = '#f0e2bf';
      c.font = `500 ${cv.height * 0.46}px serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, cv.width / 2, cv.height / 2, cv.width * 0.93);
    });
  const pillow = (
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    angle = 0,
  ) => {
    const o = mesh(p, pillowGeometry(w, h, d), m, x, y, z);
    o.rotation.z = angle;
    return o;
  };
  const bookAtlas = createSpineAtlas(k.textures, k.materials);
  const bookBindings = bindingColors.map((c) => mat(c));
  function volume(
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    angle = 0,
  ) {
    const g = group(p, x, y, z);
    g.rotation.y = angle;
    box(g, w, h, d, 0, h / 2, 0, m);
    box(g, w * 0.9, h * 0.66, d * 1.015, 0.012, h / 2, 0, paper);
    return g;
  }
  function cup(p: T.Object3D, x: number, y: number, z: number, clear = false) {
    const g = group(p, x, y, z);
    mesh(
      g,
      new T.LatheGeometry(
        [
          [0.052, 0],
          [0.065, 0.015],
          [0.073, 0.15],
          [0.064, 0.15],
          [0.056, 0.025],
        ].map(([x, y]) => new T.Vector2(x, y)),
        20,
      ),
      clear ? glass : white,
    );
    if (!clear)
      tube(
        g,
        [
          [0.064, 0.12, 0],
          [0.116, 0.12, 0],
          [0.122, 0.06, 0],
          [0.063, 0.04, 0],
        ],
        0.009,
        white,
      );
    return g;
  }
  function plate(p: T.Object3D, x: number, y: number, z: number, r = 0.2) {
    cyl(p, r, r * 0.83, 0.024, x, y, z, white);
    mesh(
      p,
      new T.TorusGeometry(r * 0.94, 0.012, 5, 32).rotateX(Math.PI / 2),
      white,
      x,
      y + 0.017,
      z,
    );
  }
  function bottle(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    r = 0.075,
    h = 0.34,
    m: T.Material = glass,
  ) {
    const g = group(p, x, y, z);
    mesh(
      g,
      new T.LatheGeometry(
        [
          [0, 0],
          [r, 0.008],
          [r, h * 0.65],
          [r * 0.45, h * 0.8],
          [r * 0.42, h],
          [r * 0.32, h],
          [r * 0.32, h * 0.8],
        ].map(([x, y]) => new T.Vector2(x, y)),
        20,
      ),
      m,
    );
    return g;
  }
  function wovenBasket(p: T.Object3D, w: number, d: number, h: number) {
    box(p, w, 0.04, d, 0, 0.02, 0, cane);
    for (const z of [-d / 2, d / 2]) {
      for (let i = 0; i <= Math.round(w / 0.065); i++)
        rod(
          p,
          [-w / 2 + (i * w) / Math.round(w / 0.065), 0.03, z],
          [-w / 2 + (i * w) / Math.round(w / 0.065), h, z],
          0.012,
          cane,
        );
      for (let y = 0.06; y < h; y += 0.055)
        rod(p, [-w / 2, y, z], [w / 2, y, z], 0.011, dark);
    }
    for (const x of [-w / 2, w / 2]) {
      for (let z = -d / 2; z <= d / 2; z += 0.065)
        rod(p, [x, 0.03, z], [x, h, z], 0.011, cane);
      for (let y = 0.06; y < h; y += 0.055)
        rod(p, [x, y, -d / 2], [x, y, d / 2], 0.012, cane);
    }
    for (const z of [-d / 2, d / 2])
      rod(p, [-w / 2, h, z], [w / 2, h, z], 0.027, cane);
  }
  function planter(
    loc: { x: number; z: number; width: number; depth: number },
    seed: number,
  ) {
    const g = group(root, loc.x, 0, loc.z);
    const width = Math.max(loc.width, loc.depth),
      depth = Math.min(loc.width, loc.depth);
    if (loc.depth > loc.width) g.rotation.y = Math.PI / 2;
    box(g, width, 0.59, depth, 0, 0.4, 0, wood);
    box(g, width + 0.07, 0.065, depth + 0.07, 0, 0.72, 0, dark);

    for (let x = -width / 2 + 0.18; x < width / 2; x += 0.35) {
      box(g, 0.03, 0.46, 0.035, x, 0.4, depth / 2 + 0.02, dark);
    }
    for (let i = 0; i < Math.max(3, Math.round(width / 0.55)); i++)
      bot.plant(
        g,
        -width / 2 + 0.28 + i * 0.53 + Math.sin(seed + i * 2.3) * 0.025,
        0.754,
        Math.cos(seed + i * 1.7) * 0.065,
        0.6 + (i % 4) * 0.045,
        i === 0 ? 'vine' : 'flowers',
        seed + i,
      );
    return g;
  }

  // One uninterrupted floor: timber reading/lounging areas and a flush tiled potting floor.
  box(root, 6.8, 0.4, 23.8, 0, -0.23, 0, wood, 0.035);
  const floorNorth = group(root, 0, 0, -8.7);
  addOakFloor(floorNorth, 6.68, 6.28, k.floorMaterials);
  const floorSouth = group(root, 0, 0, 8.0);
  addOakFloor(floorSouth, 6.68, 7.68, k.floorMaterials);
  const tiles = ['#bd987e', '#c49f83', '#b4917b', '#cba78b'].map((c) =>
    interiorMaterial('clay', c, k.materials, k.textures),
  );
  box(root, 6.68, 0.022, 9.75, 0, 0.066, -0.7, mat('#9b907a'));
  for (let i = 0; i < 14; i++)
    for (let j = 0; j < 20; j++)
      box(
        root,
        0.467,
        0.021,
        0.467,
        -3.11 + i * 0.478,
        0.077,
        -5.19 + j * 0.478,
        tiles[(i * 7 + j * 3) % 4],
        0.004,
      );
  const windows: ReturnType<typeof createWindowEnvironment>[] = [];
  function wall(
    p: T.Group,
    w: number,
    doorPositions: number[] = [],
    glazed = false,
  ) {
    const upper = group(p),
      lower = group(p);
    const cuts = [
      -w / 2,
      w / 2,
      ...doorPositions.flatMap((v) => [v - 0.7, v + 0.7]),
    ].sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1],
        b = cuts[i],
        m = (a + b) / 2;
      if (doorPositions.some((d) => Math.abs(m - d) < 0.7)) continue;
      box(lower, b - a, 0.68, 0.16, m, 0.42, 0, cream);
      box(lower, b - a, 0.075, 0.22, m, 0.785, 0, wood);
      box(lower, b - a, 0.1, 0.2, m, 0.12, 0.015, dark);
      if (!glazed) box(upper, b - a, 2.72, 0.16, m, 2.17, 0, cream);
      box(upper, b - a, 0.17, 0.24, m, 3.58, 0, wood);
    }
    for (const d of doorPositions) {
      box(upper, 1.4, 0.83, 0.16, d, 3.1, 0, cream);
      for (const dx of [-0.75, 0.75])
        box(upper, 0.105, 2.67, 0.25, d + dx, 1.43, 0, wood);
      box(upper, 1.62, 0.1, 0.24, d, 2.82, 0, wood);
      box(lower, 1.4, 0.025, 0.24, d, 0.09, 0, wood);
    }
    p.updateWorldMatrix(true, false);
    const point = p.getWorldPosition(new T.Vector3()),
      normal = new T.Vector3(0, 0, 1).applyQuaternion(
        p.getWorldQuaternion(new T.Quaternion()),
      );
    k.cutaways.add(
      [upper],
      { x: point.x, z: point.z, nx: normal.x, nz: normal.z },
      ['garden'],
    );
    return upper;
  }
  const westBase = group(root, -3.31, 0, 0);
  westBase.rotation.y = Math.PI / 2;
  const west = wall(
    westBase,
    23.8,
    gardenPortals.map((p) => -(p.along - rooms.garden.z)),
  );
  const eastBase = group(root, 3.31, 0, 0);
  eastBase.rotation.y = -Math.PI / 2;
  const east = wall(eastBase, 23.8, [], true);
  function windowBay(p: T.Group, x: number, width: number) {
    const g = group(p, x, 2.13, 0.025);
    windows.push(
      createWindowEnvironment(g, 'garden', k.landscape, {
        width: width - 0.13,
        height: 2.56,
      }),
    );
    const pane = box(g, width, 2.57, 0.012, 0, 0, 0.06, windowGlass);
    pane.castShadow = false;
    for (const xx of [-width / 2, width / 2])
      box(g, 0.055, 2.66, 0.13, xx, 0, 0.075, craft.frame);
    for (const yy of [-1.3, 1.3])
      box(g, width, 0.05, 0.12, 0, yy, 0.095, craft.frame);
    // Wide, uninterrupted full-height panes: no central rail or small square lights.
    const divisions = Math.ceil(width / 3.0);
    for (let j = 1; j < divisions; j++)
      box(
        g,
        0.034,
        2.56,
        0.09,
        -width / 2 + (j * width) / divisions,
        0,
        0.12,
        craft.frame,
      );
    box(g, width, 0.055, 0.37, 0, -1.34, 0.13, craft.stone);
    // A restrained sill channel and discreet drainage slots complete the aluminium joinery.
    box(g, width - 0.12, 0.012, 0.025, 0, -1.303, 0.2, craft.frame);
    for (const x of [-width * 0.3, width * 0.3])
      box(g, 0.07, 0.006, 0.011, x, -1.295, 0.215, dark, 0.002);
    return g;
  }
  for (const [z, w] of [
    [-7.4, 8.7],
    [0.5, 6.5],
    [7.9, 7.7],
  ])
    windowBay(east, z, w);
  for (const z of [-11.8, -2.9, 3.9, 11.8])
    box(east, 0.105, 2.77, 0.18, z, 2.2, 0, craft.frame);
  const northBase = group(root, 0, 0, -11.81),
    north = wall(northBase, 6.8, [], true);
  windowBay(north, 0, 6.45);
  const southBase = group(root, 0, 0, 11.81);
  southBase.rotation.y = Math.PI;
  wall(southBase, 6.8);
  // A continuous glazed eave with slender rafters reinforces the conservatory silhouette.
  for (let i = 0; i < 8; i++) {
    const z = -10.4125 + i * 2.975;
    const roof = box(east, 2.94, 0.012, 1.09, z, 3.69, 0.55, windowGlass);
    roof.rotation.x = 0.21;
    roof.castShadow = false;
  }
  for (let i = 0; i <= 8; i++)
    rod(
      east,
      [-11.9 + i * 2.975, 3.57, 0],
      [-11.9 + i * 2.975, 3.83, 1.12],
      0.025,
      craft.frame,
    );
  rod(east, [-11.9, 3.83, 1.12], [11.9, 3.83, 1.12], 0.034, craft.frame);
  for (const [i, p] of gardenPortals.entries()) {
    const id = (
        ['gardenLibraryDoor', 'gardenGameDoor', 'gardenBarDoor'] as const
      )[i],
      g = object(id, -3.2, p.along - rooms.garden.z);
    g.rotation.y = Math.PI / 2;
    label(
      g,
      ['藏书室 · LIBRARY', '游戏房 · PLAY', '酒吧 · AMBER'][i],
      1.3,
      0,
      3.03,
      0,
      0.19,
    );
    k.cutaways.add([g], { x: 23.2, z: p.along, nx: 1, nz: 0 }, ['garden']);
  }
  label(north, 'THE CONSERVATORY · 植物园', 3.6, 0, 3.64, 0.15, 0.25);
  // Hanging baskets are attached above head height to the glazed wall and follow its cutaway.
  for (const [i, z] of [-9.9, -6.8, -3.8, -0.9, 2.6, 5.5, 8.8, 11].entries()) {
    const g = group(east, z, 2.82, 0.45);
    bot.plant(g, 0, 0, 0, 0.84, i % 3 === 1 ? 'vine' : 'flowers', 43 + i);
    for (const x of [-0.15, 0.15])
      rod(g, [x, 0.3, 0], [0, 0.75, -0.15], 0.006, brass);
  }

  // READING CORNER: upholstery, pressed-flower album and the objects used beside it.
  function sofa(p: T.Group, width: number, depth: number) {
    box(p, width, 0.42, depth, 0, 0.425, 0, wood, 0.035);
    box(p, width, 0.64, 0.15, 0, 0.93, -depth / 2 + 0.05, wood, 0.035);
    for (const x of [-width / 2 + 0.09, width / 2 - 0.09])
      box(p, 0.16, 0.38, depth, x, 0.76, 0, wood);
    pillow(p, width - 0.38, 0.23, depth - 0.12, 0, 0.75, 0.04, linen);
    for (const x of [-width * 0.29, width * 0.28])
      pillow(
        p,
        0.56,
        0.53,
        0.19,
        x,
        1.04,
        -depth / 2 + 0.23,
        x < 0 ? green : ochre,
        x < 0 ? -0.08 : 0.08,
      );
    for (const x of [-width / 2 + 0.16, width / 2 - 0.16])
      for (const z of [-depth / 2 + 0.16, depth / 2 - 0.16])
        box(p, 0.08, 0.2, 0.08, x, 0.14, z, wood);
  }
  const readingSofa = group(root, f.readingSofa.x, 0, f.readingSofa.z);
  sofa(readingSofa, f.readingSofa.width, f.readingSofa.depth);
  attachSeats(k.seats, readingSofa, ['garden-reading-1', 'garden-reading-2']);
  k.interactables.push(readingSofa);
  const readingReturn = group(root, f.readingReturn.x, 0, f.readingReturn.z);
  readingReturn.rotation.y = -Math.PI / 2;
  sofa(readingReturn, f.readingReturn.depth, f.readingReturn.width);
  attachSeats(k.seats, readingReturn, ['garden-reading-3']);
  k.interactables.push(readingReturn);
  const readingThrow = mesh(
    readingSofa,
    edgeDrapeGeometry(0.38, 0.13, 0.28),
    linen,
    1.654,
    0.957,
    0.02,
    'Garden detail / supported arm throw',
  );
  readingThrow.rotation.y = Math.PI / 2;
  const bookcase = group(root, f.bookcase.x, 0, f.bookcase.z);
  bookcase.rotation.y = Math.PI / 2;
  bookcase.name = 'Garden detail / open bookcase';
  for (const x of [-1.11, 1.11])
    box(bookcase, 0.08, 1.18, 0.52, x, 0.715, 0, wood);
  box(bookcase, 2.14, 1.1, 0.035, 0, 0.72, -0.245, dark);
  box(bookcase, 2.3, 0.055, 0.56, 0, 1.3, 0.03, wood);
  for (const [row, y] of [0.2, 0.73].entries()) {
    box(bookcase, 2.3, 0.055, 0.56, 0, y, 0.03, dark);
    for (let i = 0; i < 12; i++) {
      const serial = row * 13 + i + 113,
        w = 0.085 + (serial % 4) * 0.013,
        h = 0.22 + ((serial * 7) % 9) * 0.015;
      const g = volume(
        bookcase,
        w,
        h,
        0.22,
        -0.98 + i * 0.175,
        y + 0.03,
        0.1,
        bookBindings[serial % bookBindings.length],
        i % 5 === 0 ? 0.05 : 0,
      );
      const spine = mesh(
        g,
        bookAtlas.geometry(w * 0.94, h * 0.96, serial),
        bookAtlas.material,
        0,
        h / 2,
        0.116,
      );
      spine.castShadow = false;
    }
  }
  const shelfPlant = bot.plant(
    bookcase,
    detail.bookcase.plantX,
    detail.bookcase.top + 0.002,
    0.02,
    0.55,
    'broad',
    11,
  );
  shelfPlant.name = 'Garden detail / bookcase plant';
  const topBooks = group(
    bookcase,
    detail.bookcase.bookStart,
    detail.bookcase.top + 0.002,
    0.05,
    'Garden detail / top books',
  );
  for (let i = 0; i < 3; i++) {
    const h = 0.27 + i * 0.025;
    const book = volume(
      topBooks,
      0.1,
      h,
      0.23,
      i * 0.145,
      0,
      0,
      bookBindings[4 + i],
    );
    const spine = mesh(
      book,
      bookAtlas.geometry(0.094, h * 0.96, 151 + i),
      bookAtlas.material,
      0,
      h / 2,
      0.12,
    );
    spine.castShadow = false;
  }
  const hooks = group(west, 10.5, 2.38, 0.15);
  box(hooks, 1.7, 0.09, 0.08, 0, 0, 0, wood);
  for (let i = 0; i < 4; i++) {
    const x = -0.65 + i * 0.43;
    rod(hooks, [x, 0, 0], [x, -0.13, 0.1], 0.018, brass);
    tube(
      hooks,
      [
        [x, -0.105, 0.09],
        [x - 0.024, -0.15, 0.15],
        [x, -0.17, 0.15],
        [x + 0.024, -0.15, 0.15],
        [x, -0.105, 0.09],
      ],
      0.004,
      craft.twine,
    );
    for (let j = 0; j < 7; j++) {
      const zz = 0.15 + (j % 2) * 0.02;
      rod(
        hooks,
        [x, -0.16, zz],
        [x + (j - 3) * 0.031, -0.58, zz],
        0.004,
        bot.bark,
      );
      const flower = ball(hooks, 0.055, x + (j - 3) * 0.032, -0.62, zz, ochre);
      flower.scale.set(0.4, 1, 0.4);
    }
  }
  planter(f.readingPlanter, 60);
  function roundTable(p: T.Group, r: number, h: number) {
    refinedTabletop(p, r * 2, r * 2, h + 0.0375, suite, true);
    for (const a of [0, 2.094, 4.188])
      rod(
        p,
        [Math.sin(a) * r * 0.6, 0.1, Math.cos(a) * r * 0.6],
        [Math.sin(a) * r * 0.46, h - 0.04, Math.cos(a) * r * 0.46],
        0.038,
        suite.timber,
      );
  }
  const reading = object('gardenAlbum', f.readingTable.x, f.readingTable.z);
  roundTable(reading, 0.86, 0.82);
  const album = group(
    reading,
    detail.reading.album.x,
    detail.reading.top + 0.002,
    detail.reading.album.z,
    'Garden detail / open album',
  );
  album.rotation.y = detail.reading.album.yaw;
  album.scale.setScalar(detail.reading.album.scale);
  box(album, 0.87, 0.033, 0.62, 0, 0.017, 0, green);
  box(album, 0.39, 0.04, 0.57, -0.218, 0.05, 0, paper);
  box(album, 0.39, 0.04, 0.57, 0.218, 0.05, 0, paper);
  function herbarium(
    c: CanvasRenderingContext2D,
    cv: HTMLCanvasElement,
    index: number,
  ) {
    c.fillStyle = '#eee7ce';
    c.fillRect(0, 0, cv.width, cv.height);
    c.strokeStyle = '#b5ac89';
    c.lineWidth = 2;
    c.strokeRect(22, 22, cv.width - 44, cv.height - 44);
    c.fillStyle = '#536443';
    c.font = '34px serif';
    c.textAlign = 'center';
    c.fillText(
      ['薄荷 · MINT', '雏菊 · DAISY', '银杏 · GINKGO'][index],
      cv.width / 2,
      75,
    );
    c.strokeStyle = '#7a7750';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(cv.width * 0.44, cv.height * 0.79);
    c.quadraticCurveTo(
      cv.width * 0.52,
      cv.height * 0.53,
      cv.width * 0.6,
      cv.height * 0.23,
    );
    c.stroke();
    for (let i = 0; i < 7; i++) {
      const yy = cv.height * (0.29 + i * 0.062),
        x = cv.width * (0.57 - i * 0.013);
      c.save();
      c.translate(x, yy);
      c.rotate(i % 2 ? 0.5 : 2.8);
      c.fillStyle = ['#859467', '#ccb776', '#92955c'][index];
      c.beginPath();
      c.ellipse(
        48,
        0,
        index === 2 ? 65 : 48,
        23 + (index === 2 ? 13 : 0),
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.restore();
    }
    c.fillStyle = '#82795f';
    c.font = '24px serif';
    c.fillText('采集于一个有风的午后', cv.width / 2, cv.height - 54);
  }
  const albumLeft = panel(album, 0.39, 0.56, -0.216, 0.074, 0, (c, cv) =>
    herbarium(c, cv, 0),
  );
  albumLeft.mesh.rotation.x = -Math.PI / 2;
  const albumRight = panel(album, 0.39, 0.56, 0.216, 0.074, 0, (c, cv) =>
    herbarium(c, cv, 1),
  );
  albumRight.mesh.rotation.x = -Math.PI / 2;
  const pagePivot = group(album, 0, 0.079, 0, 'Pressed album turning page');
  const page = panel(pagePivot, 0.39, 0.56, 0.215, 0, 0, (c, cv) =>
    herbarium(c, cv, 0),
  );
  page.mesh.rotation.x = -Math.PI / 2;
  const fieldGuide = volume(
    reading,
    detail.reading.guide.width,
    0.065,
    detail.reading.guide.depth,
    detail.reading.guide.x,
    detail.reading.top + 0.002,
    detail.reading.guide.z,
    dark,
    detail.reading.guide.yaw,
  );
  fieldGuide.name = 'Garden detail / field guide';
  label(fieldGuide, '植物图鉴', 0.28, 0, 0.067, 0, 0.1).mesh.rotation.x =
    -Math.PI / 2;
  // The ribbon stays wholly on its page, clear of the turning leaf.
  box(album, 0.025, 0.003, 0.23, -0.35, 0.077, 0.13, ochre);
  const biscuits = group(
    reading,
    detail.reading.plate.x,
    detail.reading.top,
    detail.reading.plate.z,
    'Garden detail / biscuit plate',
  );
  plate(biscuits, 0, 0.012, 0, detail.reading.plate.radius);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5,
      x = Math.cos(a) * 0.09,
      z = Math.sin(a) * 0.09;
    cyl(biscuits, 0.045, 0.047, 0.024, x, 0.037, z, ochre);
    for (let j = 0; j < 3; j++)
      ball(biscuits, 0.005, x + (j - 1) * 0.015, 0.052, z, bot.bark);
  }
  const tea = group(
    reading,
    detail.reading.cup.x,
    detail.reading.top,
    detail.reading.cup.z,
    'Garden detail / tea and coaster',
  );
  cyl(tea, 0.112, 0.112, 0.008, 0, 0.004, 0, cane);
  cup(tea, 0, 0.009, 0);
  const magnifier = group(
    reading,
    detail.reading.magnifier.x,
    detail.reading.top + 0.013,
    detail.reading.magnifier.z,
    'Garden detail / magnifier',
  );
  magnifier.rotation.y = detail.reading.magnifier.yaw;
  mesh(
    magnifier,
    new T.TorusGeometry(0.075, 0.01, 8, 32).rotateX(Math.PI / 2),
    brass,
  );
  cyl(magnifier, 0.068, 0.068, 0.005, 0, 0, 0, glass);
  rod(magnifier, [0, 0, 0.075], [0, 0, 0.2], 0.012, dark);
  const readingBasket = group(
    bookcase,
    detail.bookcase.basketX,
    detail.bookcase.top + 0.002,
    0.03,
    'Garden detail / book basket',
  );
  wovenBasket(readingBasket, 0.5, 0.3, 0.23);
  for (let i = 0; i < 3; i++)
    volume(
      readingBasket,
      0.085,
      0.29,
      0.2,
      -0.13 + i * 0.1,
      0.04,
      0,
      green,
      0.04 * i,
    );

  // POTTING AREA: circular tree bench and a worktable with three removable prop trays.
  const lemonBench = group(
    root,
    f.lemonBench.x,
    0,
    f.lemonBench.z,
    'Lemon tree circular bench',
  );
  bot.citrus(lemonBench);
  for (let i = 0; i < 23; i++) {
    const a = -1.26 + (i * 2.52) / 22,
      g = group(lemonBench, Math.sin(a) * 1.08, 0, Math.cos(a) * 1.08);
    g.rotation.y = a;
    box(g, 0.135, 0.07, 0.45, 0, 0.78, 0, wood);
    if (i % 5 === 0)
      for (const z of [-0.12, 0.12])
        box(g, 0.065, 0.61, 0.065, 0, 0.45, z, dark);
  }
  attachSeats(k.seats, lemonBench, ['garden-tree-1', 'garden-tree-2']);
  k.interactables.push(lemonBench);
  const bench = object('gardenWorkbench', f.workbench.x, f.workbench.z);
  box(bench, 3.1, 0.09, 1.34, 0, 1.07, 0, craft.stone, 0.032);
  box(bench, 3.0, 0.035, 1.24, 0, 1.006, 0, wood);
  // Protected splash edge, corner fixings and a towel bar stay inside the existing footprint.
  box(bench, 3.04, 0.075, 0.035, 0, 1.15, -0.64, craft.steel, 0.012);
  for (const x of [-1.37, 1.37])
    for (const z of [-0.48, 0.48])
      cyl(bench, 0.013, 0.013, 0.003, x, 1.117, z, craft.steel);
  rod(bench, [-1.39, 0.88, 0.54], [-0.72, 0.88, 0.54], 0.016, craft.steel);
  box(bench, 2.91, 0.07, 1.15, 0, 0.32, 0, dark);
  for (const x of [-1.37, 1.37])
    for (const z of [-0.48, 0.48])
      box(bench, 0.095, 0.95, 0.095, x, 0.59, z, wood);
  for (const z of [-0.48, 0.48]) box(bench, 2.9, 0.22, 0.07, 0, 0.88, z, wood);
  for (const [i, x] of [-1.03, -0.57, 0.76, 1.1].entries()) {
    const p = group(bench, x, 0.36, 0);
    bot.pot(p, 0.19, 0.27, undefined, false);
    if (i % 2 === 0) {
      const pp = group(p, 0.02, 0.16, 0);
      bot.pot(pp, 0.17, 0.27, undefined, false);
    }
  }
  const soilSack = group(bench, 0.02, 0.35, 0.11);
  pillow(soilSack, 0.58, 0.42, 0.44, 0, 0.24, 0, linen);
  label(soilSack, 'POTTING SOIL', 0.36, 0, 0.25, 0.23, 0.14);
  const seedlings = group(bench, -0.75, 1.13, -0.1, 'Seedling tray');
  box(seedlings, 1.04, 0.06, 0.68, 0, 0.03, 0, charcoal);
  const shoots: T.Group[] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++) {
      const p = group(seedlings, -0.38 + col * 0.25, 0.06, -0.22 + row * 0.21);
      box(p, 0.215, 0.055, 0.18, 0, 0.027, 0, bot.soil);
      const shoot = group(p, 0, 0.06, 0);
      bot.foliage(
        shoot,
        [
          { x: 0, y: 0, z: 0, dx: 1, dy: 0.6, dz: 0, l: 0.16, w: 0.08 },
          { x: 0, y: 0.02, z: 0, dx: -1, dy: 0.9, dz: 0, l: 0.15, w: 0.085 },
        ],
        col + row * 8,
      );
      shoots.push(shoot);
    }
  const seedPackets = group(bench, 0.16, 1.124, -0.32);
  seedPackets.rotation.y = -0.16;
  for (let i = 0; i < 3; i++) {
    const b = volume(
      seedPackets,
      0.23,
      0.008,
      0.31,
      i * 0.055,
      0.006 + i * 0.013,
      i * 0.018,
      paper,
      -i * 0.13,
    );
    label(
      b,
      ['MINT', 'DAISY', 'BASIL'][i],
      0.17,
      0,
      0.011,
      0,
      0.1,
    ).mesh.rotation.x = -Math.PI / 2;
  }
  // A real coil, overlapping gloves, scissors with separate handles and a worn hand trowel.
  const twine = group(bench, 0.85, 1.13, -0.38);
  cyl(twine, 0.072, 0.072, 0.22, 0, 0.11, 0, dark);
  for (let i = 0; i < 13; i++)
    mesh(
      twine,
      new T.TorusGeometry(0.09, 0.016, 5, 20).rotateX(Math.PI / 2),
      craft.twine,
      0,
      0.025 + i * 0.014,
      0,
    );
  tube(
    bench,
    [
      [0.84, 1.14, -0.3],
      [0.65, 1.14, -0.13],
      [0.97, 1.14, 0.06],
      [1.07, 1.14, 0.21],
    ],
    0.008,
    craft.twine,
  );
  const tools = group(bench, 0.5, 1.14, 0.27, 'Gardening hand tools');
  tools.rotation.y = -0.13;
  for (const [i, x] of [-0.18, 0.02].entries()) {
    mesh(
      tools,
      new T.TorusGeometry(0.065, 0.012, 8, 28).rotateX(Math.PI / 2),
      craft.enamel,
      x,
      0.006,
      0,
    );
    const blade = new T.Shape();
    blade.moveTo(-0.012, 0.04);
    blade.quadraticCurveTo(-0.024, -0.12, 0.018, -0.25);
    blade.quadraticCurveTo(0.047, -0.15, 0.024, 0.04);
    blade.closePath();
    const b = mesh(
      tools,
      new T.ExtrudeGeometry(blade, {
        depth: 0.005,
        bevelEnabled: true,
        bevelSize: 0.0015,
        bevelThickness: 0.001,
        bevelSegments: 2,
        steps: 1,
      }),
      craft.steel,
      -0.075,
      i * 0.006,
      -0.1,
    );
    b.rotation.x = Math.PI / 2;
    b.rotation.z = i ? -0.3 : 0.3;
    rod(tools, [x, 0, -0.045], [-0.075, 0.012, -0.12], 0.009, craft.steel);
  }
  cyl(tools, 0.02, 0.02, 0.009, -0.075, 0.022, -0.12, brass);
  box(tools, 0.022, 0.002, 0.003, -0.075, 0.027, -0.12, charcoal, 0.001);
  const trowel = group(bench, 1.12, 1.135, 0.21);
  trowel.rotation.y = 0.35;
  mesh(
    trowel,
    new T.LatheGeometry(
      [
        [0.018, -0.1],
        [0.033, -0.08],
        [0.035, 0.045],
        [0.024, 0.09],
        [0.012, 0.1],
      ].map((p) => new T.Vector2(...p)),
      24,
    ),
    wood,
    0,
    0.035,
    0,
  ).rotation.x = Math.PI / 2;
  cyl(trowel, 0.022, 0.022, 0.038, 0, 0.027, -0.084, craft.steel).rotation.x =
    Math.PI / 2;
  mesh(trowel, trowelGeometry(), craft.steel);
  rod(trowel, [0, 0.025, -0.08], [0, 0.012, -0.16], 0.009, craft.steel);
  for (let i = 0; i < 2; i++) {
    const glove = group(bench, -0.23 + i * 0.16, 1.132 + i * 0.012, 0.36);
    glove.rotation.y = 0.25 - i * 0.5;
    box(glove, 0.195, 0.045, 0.06, 0, 0.025, 0.104, linen, 0.014);
    for (const x of [-0.062, 0.062])
      rod(glove, [x, 0.047, -0.075], [x, 0.047, 0.06], 0.002, craft.twine);
    pillow(glove, 0.19, 0.045, 0.22, 0, 0.023, 0, craft.glove);
    for (let j = 0; j < 4; j++)
      box(
        glove,
        0.034,
        0.033,
        0.15,
        -0.057 + j * 0.04,
        0.022,
        -0.14,
        craft.glove,
        0.012,
      );
    box(glove, 0.07, 0.038, 0.1, 0.106, 0.021, -0.026, craft.glove, 0.013);
  }
  mesh(
    bench,
    edgeDrapeGeometry(
      detail.workcloth.width,
      detail.workcloth.run,
      detail.workcloth.drop,
    ),
    linen,
    detail.workcloth.x,
    detail.workcloth.y,
    detail.workcloth.z,
    'Garden detail / workbench edge cloth',
  );
  const wateringPivot = group(
    bench,
    -1.32,
    1.13,
    0.35,
    'Animated watering can',
  );
  mesh(
    wateringPivot,
    new T.LatheGeometry(
      [
        [0.15, 0],
        [0.16, 0.02],
        [0.15, 0.2],
        [0.13, 0.24],
        [0.113, 0.24],
        [0.13, 0.2],
        [0.14, 0.03],
      ].map((p) => new T.Vector2(...p)),
      32,
    ),
    craft.enamel,
  );
  for (const y of [0.02, 0.235])
    mesh(
      wateringPivot,
      new T.TorusGeometry(y < 0.1 ? 0.153 : 0.123, 0.005, 6, 32).rotateX(
        Math.PI / 2,
      ),
      craft.steel,
      0,
      y,
      0,
    );
  rod(wateringPivot, [0.11, 0.11, 0], [0.34, 0.25, 0], 0.034, craft.steel);
  const rose = group(wateringPivot, 0.35, 0.25, 0);
  rose.rotation.z = -Math.PI / 3;
  cyl(rose, 0.07, 0.065, 0.035, 0, 0, 0, craft.steel);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.399,
      r = Math.sqrt(i / 9) * 0.052;
    cyl(
      rose,
      0.004,
      0.004,
      0.001,
      Math.sin(a) * r,
      0.018,
      Math.cos(a) * r,
      charcoal,
    );
  }
  tube(
    wateringPivot,
    [
      [-0.11, 0.21, 0],
      [-0.25, 0.26, 0],
      [-0.29, 0.07, 0],
      [-0.1, 0.06, 0],
    ],
    0.016,
    craft.steel,
  );
  const waterDrops = new T.InstancedMesh(
    new T.SphereGeometry(0.013, 6, 4),
    water,
    20,
  );
  waterDrops.name = 'Watering droplets';
  waterDrops.visible = false;
  bench.add(waterDrops);
  const rack = group(root, f.plantShelf.x, 0, f.plantShelf.z);
  rack.rotation.y = -Math.PI / 2;
  for (const y of [0.24, 0.86, 1.6]) {
    box(rack, 5.5, 0.052, 0.56, 0, y, 0, wood);
    for (const x of [-2.65, -0.8, 0.8, 2.65])
      box(rack, 0.05, 1.53, 0.05, x, 0.87, -0.2, wood);
  }
  for (let i = 0; i < 8; i++) {
    const plant = bot.plant(
      rack,
      -2.36 + i * 0.67,
      0.888,
      0,
      i % 3 === 0 ? 0.48 : 0.5,
      i % 3 === 0 ? 'fern' : 'flowers',
      100 + i,
    );
    plant.name = `Garden detail / middle shelf plant ${i}`;
  }
  for (let i = 0; i < 5; i++) {
    const p = group(rack, -2.1 + i, 0.268, 0.02);
    if (i === 2) continue; // The central shelf holds a seed wallet instead of another empty pot.
    bot.pot(p, 0.22, 0.31, undefined, false);
  }
  // Flowering upper shelf leaves the terrarium and hydroponic bottles clear.
  for (const [i, x] of [-2.55, -0.12, 0.68].entries()) {
    const plant = bot.plant(
      rack,
      x,
      1.628,
      0,
      0.5 + (i % 2) * 0.06,
      'flowers',
      117 + i,
    );
    plant.name = `Garden detail / top shelf plant ${i}`;
  }
  // Three small window brackets add bloom clusters without using floor circulation.
  for (const [i, z] of [-7.8, 4.95, 10.7].entries()) {
    const ledge = group(east, z, 1.05, 0.18);
    box(ledge, 0.82, 0.06, 0.48, 0, 0, 0.1, wood);
    for (const x of [-0.28, 0.28])
      rod(ledge, [x, -0.22, -0.1], [x, -0.03, 0.24], 0.018, brass);
    bot.plant(ledge, -0.16, 0.032, 0.1, 0.56, 'flowers', 130 + i);
    bot.plant(ledge, 0.23, 0.032, 0.13, 0.38, 'flowers', 137 + i);
  }
  const hydro = group(rack, 1.82, 1.65, 0);
  for (let i = 0; i < 3; i++) {
    const b = bottle(hydro, (i - 1) * 0.22, 0, 0, 0.075, 0.34);
    cyl(b, 0.065, 0.065, 0.16, 0, 0.09, 0, water);
    bot.foliage(
      b,
      [
        { x: 0, y: 0.36, z: 0, dx: 0.4, dy: 1, dz: 0.2, l: 0.32, w: 0.13 },
        { x: 0, y: 0.46, z: 0, dx: -1, dy: 0.6, dz: 0, l: 0.17, w: 0.1 },
      ],
      i,
    );
    rod(b, [0, 0.06, 0], [0, 0.65, 0], 0.005, bot.bark);
  }
  const terrarium = object('gardenTerrarium', 2.94, -2.6);
  cyl(terrarium, 0.29, 0.29, 0.055, 0, 1.65, 0, wood);
  cyl(terrarium, 0.27, 0.27, 0.1, 0, 1.715, 0, bot.soil);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const s = ball(
      terrarium,
      0.07,
      Math.sin(a) * 0.18,
      1.8,
      Math.cos(a) * 0.18,
      bot.moss,
    );
    s.scale.y = 0.5;
  }
  bot.foliage(
    terrarium,
    [
      { x: 0, y: 1.8, z: 0, dx: 1, dy: 0.4, dz: 0, l: 0.25, w: 0.1 },
      { x: 0, y: 1.82, z: 0, dx: -1, dy: 1, dz: 0, l: 0.31, w: 0.09 },
    ],
    44,
  );
  const dome = group(terrarium, 0, 1.678, 0, 'Garden detail / terrarium cover');
  mesh(
    dome,
    new T.LatheGeometry(
      [
        [0.29, 0],
        [0.3, 0.18],
        [0.26, 0.41],
        [0.15, 0.54],
        [0.05, 0.58],
      ].map(([x, y]) => new T.Vector2(x, y)),
      32,
    ),
    glass,
  );
  ball(dome, 0.045, 0, 0.625, 0, glass);
  const mushroomStem = cyl(
    terrarium,
    0.015,
    0.018,
    0.12,
    0.12,
    1.86,
    0.06,
    white,
  );
  void mushroomStem;
  const cap = ball(terrarium, 0.058, 0.12, 1.934, 0.06, ochre);
  cap.scale.y = 0.43;
  planter(f.westPlanter, 72);
  planter(f.loungePlanter, 83);
  const basin = group(
    root,
    f.basin.x,
    0,
    f.basin.z,
    'Garden detail / clear water basin',
  );
  mesh(basin, gardenBasinGeometry(), white);
  cyl(basin, 0.37, 0.37, 0.008, 0, detail.basin.waterY, 0, water);
  // A rear-mounted bamboo spout rests outside the water well.
  rod(basin, [0.22, 0.1, -0.49], [0.22, 1.42, -0.49], 0.035, cane);
  rod(basin, [0.22, 1.35, -0.49], [0.05, 1.22, -0.13], 0.032, cane);
  rod(basin, [0.05, 1.215, -0.13], [0.05, 0.735, -0.13], 0.007, water);
  const basinPlant = bot.plant(
    root,
    f.basinPlant.x,
    0.09,
    f.basinPlant.z,
    0.32,
    'fern',
    62,
  );
  basinPlant.name = 'Garden detail / separate basin fern';

  // GARDEN LOUNGE: woven chairs face the table, with drinks and a half-open picnic basket.
  function rug(x: number, z: number, w: number, d: number) {
    const g = group(root, x, 0.087, z);
    box(g, w, 0.013, d, 0, 0, 0, cane, 0.004);
    for (let i = 0; i < 5; i++) {
      const ww = w - 0.12 - i * 0.035,
        dd = d - 0.12 - i * 0.035;
      for (const xx of [-ww / 2, ww / 2])
        box(g, 0.012, 0.004, dd, xx, 0.009, 0, dark, 0.002);
      for (const zz of [-dd / 2, dd / 2])
        box(g, ww, 0.004, 0.012, 0, 0.009, zz, dark, 0.002);
    }
    for (let xx = -w / 2 + 0.18; xx < w / 2; xx += 0.095)
      box(g, 0.012, 0.004, d - 0.2, xx, 0.009, 0, linen, 0.002);
  }
  rug(0.26, -9.14, 4.82, 4.78);
  rug(0.2, 9.03, 5.34, 4.87);
  function wickerChair(loc: typeof f.chairA | typeof f.chairB, id: string) {
    const g = group(root, loc.x, 0, loc.z, 'Woven garden armchair');
    g.rotation.y = loc.yaw;
    for (const x of [-0.45, 0.45])
      for (const z of [-0.41, 0.41])
        rod(g, [x, 0.11, z], [x * 0.87, 0.57, z * 0.87], 0.032, dark);
    cyl(g, 0.54, 0.49, 0.1, 0, 0.63, 0, wood);
    for (let i = 0; i < 29; i++) {
      const a = Math.PI * 0.35 + (i * Math.PI * 1.3) / 28,
        top = 1.11 + Math.max(0, -Math.cos(a)) * 0.62;
      rod(
        g,
        [Math.sin(a) * 0.51, 0.54, Math.cos(a) * 0.51],
        [Math.sin(a) * 0.66, top, Math.cos(a) * 0.62],
        0.012,
        cane,
      );
    }
    for (let j = 0; j < 12; j++) {
      const t = j / 11;
      const points = Array.from({ length: 30 }, (_, i) => {
        const a = Math.PI * 0.35 + (i * Math.PI * 1.3) / 29,
          top = 1.11 + Math.max(0, -Math.cos(a)) * 0.62;
        return [
          Math.sin(a) * (0.51 + 0.15 * t),
          0.54 + (top - 0.54) * t,
          Math.cos(a) * (0.51 + 0.11 * t),
        ];
      });
      tube(g, points, j === 11 ? 0.025 : 0.011, cane);
    }
    const seat = pillow(g, 0.98, 0.22, 0.94, 0, 0.79, 0.025, green);
    const points = seat.geometry.getAttribute('position');
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i),
        z = points.getZ(i),
        r = Math.hypot(x / 0.49, z / 0.46);
      if (r > 1) points.setXYZ(i, x / r, points.getY(i), z / r);
    }
    seat.geometry.computeVertexNormals();
    seat.geometry.computeBoundingSphere();
    pillow(g, 0.52, 0.5, 0.15, 0.05, 1.06, -0.36, linen, -0.1);
    attachSeats(k.seats, g, [id]);
    k.interactables.push(g);
    return g;
  }
  wickerChair(f.chairA, 'garden-lounge-1');
  wickerChair(f.chairB, 'garden-lounge-2');
  const lounge = object('gardenLemonade', f.loungeTable.x, f.loungeTable.z);
  roundTable(lounge, 0.86, 0.8);
  const coaster = (x: number, z: number) =>
    cyl(lounge, 0.11, 0.11, 0.009, x, 0.846, z, cane);
  coaster(0.12, 0.31);
  coaster(-0.47, 0.05);
  cup(lounge, -0.47, 0.85, 0.05, true);
  const receiving = cup(lounge, 0.12, 0.85, 0.31, true);
  const drink = cyl(receiving, 0.052, 0.052, 0.1, 0, 0.072, 0, lemon);
  drink.visible = false;
  const jug = group(lounge, 0.34, 0.848, -0.25, 'Tilting lemonade jug');
  mesh(
    jug,
    new T.LatheGeometry(
      [
        [0.1, 0],
        [0.16, 0.04],
        [0.165, 0.28],
        [0.115, 0.43],
        [0.145, 0.48],
        [0.125, 0.48],
        [0.1, 0.43],
      ].map(([x, y]) => new T.Vector2(x, y)),
      24,
    ),
    glass,
  );
  cyl(jug, 0.13, 0.13, 0.25, 0, 0.16, 0, water);
  tube(
    jug,
    [
      [0.14, 0.38, 0],
      [0.28, 0.38, 0],
      [0.27, 0.11, 0],
      [0.15, 0.1, 0],
    ],
    0.017,
    glass,
  );
  for (let i = 0; i < 3; i++) {
    const slice = cyl(
      jug,
      0.077,
      0.077,
      0.012,
      -0.06 + i * 0.052,
      0.1 + i * 0.095,
      0.035,
      lemon,
    );
    slice.rotation.z = 0.22 + i * 0.4;
  }
  const pourLine = mesh(
    lounge,
    new T.CylinderGeometry(0.012, 0.015, 1, 7),
    lemon,
    0,
    0,
    0,
    'Lemonade stream',
  );
  pourLine.visible = false;
  plate(lounge, -0.29, 0.85, -0.38, 0.24);
  for (let i = 0; i < 4; i++) {
    const a = i * 2.4;
    const fruit = ball(
      lounge,
      0.074,
      -0.29 + Math.sin(a) * 0.12,
      0.94,
      -0.38 + Math.cos(a) * 0.1,
      i % 2 ? lemon : ochre,
    );
    fruit.scale.y = 0.78;
  }
  const napkin = group(
    lounge,
    -0.31,
    0.8395,
    0.46,
    'Garden detail / folded table napkin',
  );
  napkin.rotation.y = 0.23;
  pillow(napkin, 0.33, 0.016, 0.29, 0, 0.009, 0, linen);
  for (let i = 0; i < 3; i++)
    rod(
      napkin,
      [-0.14, 0.016, 0.095 + i * 0.012],
      [0.14, 0.016, 0.095 + i * 0.012],
      0.0015,
      green,
    );
  const cart = group(root, f.drinksCart.x, 0, f.drinksCart.z);
  cart.rotation.y = -Math.PI / 2;
  for (const y of [0.27, 0.65, 1.03]) {
    box(cart, 1.5, 0.045, 0.89, 0, y, 0, y > 1 ? craft.stone : wood);
    for (const z of [-0.43, 0.43])
      box(cart, 1.5, 0.06, 0.035, 0, y + 0.04, z, wood);
  }
  for (const x of [-0.65, 0.65])
    for (const z of [-0.33, 0.33]) {
      rod(cart, [x, 0.15, z], [x, 1.2, z], 0.027, brass);
      cyl(cart, 0.06, 0.06, 0.04, x, 0.15, z, charcoal).rotation.x =
        Math.PI / 2;
    }
  for (const x of [-0.65, 0.65])
    rod(cart, [x, 1.2, -0.34], [x, 1.2, 0.34], 0.03, brass);
  for (let i = 0; i < 4; i++) {
    const b = bottle(
      cart,
      -0.47 + i * 0.24,
      1.054,
      -0.16,
      0.067,
      0.32,
      i % 2 ? glass : green,
    );
    cyl(b, 0.03, 0.03, 0.055, 0, 0.34, 0, cane);
  }
  for (let i = 0; i < 3; i++) cup(cart, -0.4 + i * 0.29, 1.054, 0.2, true);
  const cartBasket = group(cart, 0, 0.294, 0);
  wovenBasket(cartBasket, 0.95, 0.57, 0.27);
  volume(cart, 0.6, 0.14, 0.45, 0.05, 0.674, 0, linen, 0.04);
  const basket = group(
    root,
    f.picnicBasket.x,
    0.1,
    f.picnicBasket.z,
    'Garden detail / picnic basket',
  );
  basket.rotation.y = f.picnicBasket.yaw;
  wovenBasket(basket, detail.picnic.width, detail.picnic.depth, 0.54);
  const lid = group(
    basket,
    0,
    0.578,
    detail.picnic.hingeZ,
    'Garden detail / picnic lid',
  );
  lid.rotation.x = detail.picnic.angle;
  box(lid, 1.15, 0.025, 0.7, 0, 0, 0.35, cane);
  for (let i = 0; i < 16; i++)
    rod(
      lid,
      [-0.53 + i * 0.071, 0.018, 0.035],
      [-0.53 + i * 0.071, 0.018, 0.665],
      0.008,
      dark,
    );
  for (const x of [-0.41, 0.41]) {
    rod(
      basket,
      [x - 0.04, 0.567, -0.393],
      [x + 0.04, 0.567, -0.393],
      0.018,
      brass,
    );
  }
  const handle = group(
    basket,
    0,
    0,
    0,
    'Garden detail / outside picnic handle',
  );
  tube(
    handle,
    [
      [-0.615, 0.38, 0.09],
      [-0.615, 0.77, 0.09],
      [-0.34, 1.02, 0.09],
      [0.34, 1.02, 0.09],
      [0.615, 0.77, 0.09],
      [0.615, 0.38, 0.09],
    ],
    0.025,
    cane,
  );
  for (const x of [-0.615, 0.615]) {
    rod(handle, [x - 0.022, 0.38, 0.09], [x + 0.022, 0.38, 0.09], 0.018, brass);
  }
  mesh(
    basket,
    edgeDrapeGeometry(0.38, 0.055, 0.26),
    linen,
    0.25,
    0.573,
    0.393,
    'Garden detail / picnic rim cloth',
  );
  const picnicBottle = bottle(basket, -0.3, 0.043, -0.03, 0.085, 0.43, green);
  picnicBottle.name = 'Garden detail / picnic bottle';
  volume(basket, 0.36, 0.15, 0.26, 0.14, 0.043, -0.1, paper, 0.07);
  bot.plant(root, f.southPalm.x, 0.09, f.southPalm.z, 1.34, 'broad', 90);
  for (const [i, z] of [-8.5, -3, 2, 7, 10.7].entries()) {
    const g = group(east, z, 2.63, 0.22);
    rod(g, [0, 0, 0], [0, -0.13, 0.27], 0.026, brass);
    cyl(g, 0.11, 0.18, 0.12, 0, -0.16, 0.27, brass);
    ball(g, 0.065, 0, -0.24, 0.27, glow);
    if (i === 0 || i === 4)
      label(
        west,
        -z < 0 ? '慢慢长大 · GROW' : '坐一会儿 · STAY',
        1.3,
        -z,
        2.1,
        0.12,
        0.2,
      );
  }
  const lights: T.PointLight[] = [];
  for (const z of [-9, -2, 5, 10]) {
    const l = new T.PointLight('#ffe2ae', 2.2, 9, 1.6);
    l.position.set(1.1, 3.1, z);
    root.add(l);
    lights.push(l);
  }
  // Merge static siblings; moving pages, liquid, labels, instanced foliage and seat roots stay independent.
  function batch(p: T.Object3D) {
    for (const c of p.children) if (c instanceof T.Group) batch(c);
    const bins = new Map<T.Material, T.Mesh[]>();
    for (const o of p.children)
      if (
        o instanceof T.Mesh &&
        !(o instanceof T.InstancedMesh) &&
        !o.userData.independent &&
        !Array.isArray(o.material) &&
        !o.material.transparent
      ) {
        const list = bins.get(o.material) || [];
        list.push(o);
        bins.set(o.material, list);
      }
    for (const [m, list] of bins)
      if (list.length > 3) {
        const copies = list.map((o) => {
          o.updateMatrix();
          return (
            o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
          ).applyMatrix4(o.matrix);
        });
        const geo = mergeGeometries(copies);
        copies.forEach((g) => g.dispose());
        if (geo) {
          for (const o of list) {
            p.remove(o);
            o.geometry.dispose();
          }
          mesh(p, geo, m);
        }
      }
  }
  drink.userData.independent = true;
  batch(root);
  let lamps = true,
    pageStamp = -1,
    domeSlide = 0;
  const dummy = new T.Object3D();
  return {
    snapshot: state.snapshot,
    interact: (id: ObjectId) => state.interact(id),
    setLamp(on: boolean) {
      lamps = on;
    },
    setView(_v: HouseView) {},
    setEnvironment(e: Environment) {
      windows.forEach((w) => w.set(e));
    },
    update(
      t: number,
      dt: number,
      reduced: boolean,
      night: boolean,
      camera: T.Camera,
    ) {
      state.update(dt, reduced);
      const s = state.snapshot();
      if (!root.visible) return;
      windows.forEach((w) => w.update(t, dt, reduced, camera));
      lights.forEach((l) => (l.intensity = lamps ? (night ? 3.4 : 1.65) : 0));
      glow.emissiveIntensity = lamps ? 0.45 : 0;
      if (pageStamp !== s.page) {
        pageStamp = s.page;
        herbarium(albumLeft.cv.getContext('2d')!, albumLeft.cv, s.page);
        herbarium(
          albumRight.cv.getContext('2d')!,
          albumRight.cv,
          (s.page + 1) % 3,
        );
        herbarium(page.cv.getContext('2d')!, page.cv, (s.page + 2) % 3);
        albumLeft.tex.needsUpdate =
          albumRight.tex.needsUpdate =
          page.tex.needsUpdate =
            true;
      }
      pagePivot.visible = s.turning < 1 && !reduced;
      pagePivot.rotation.z = s.turning * Math.PI;
      const watering = s.watering < 1,
        waterArc = Math.sin(Math.PI * s.watering);
      wateringPivot.position.set(
        -1.32 + waterArc * 0.36,
        1.13 + waterArc * 0.74,
        0.35 - waterArc * 0.42,
      );
      wateringPivot.rotation.z = -waterArc * 0.7;
      waterDrops.visible = watering && s.watering > 0.16 && s.watering < 0.84;
      if (waterDrops.visible)
        for (let i = 0; i < 20; i++) {
          const q = (t * 1.6 + i * 0.05) % 1;
          const a = new T.Vector3(0.35, 0.25, 0)
              .applyEuler(wateringPivot.rotation)
              .add(wateringPivot.position),
            b = new T.Vector3(
              -0.75 + Math.sin(i * 2.4) * 0.18,
              1.17,
              -0.1 + Math.cos(i * 2.4) * 0.1,
            );
          dummy.position.copy(a.lerp(b, q));
          dummy.scale.set(1, 1.7, 1);
          dummy.updateMatrix();
          waterDrops.setMatrixAt(i, dummy.matrix);
        }
      waterDrops.instanceMatrix.needsUpdate = true;
      shoots.forEach(
        (g, i) => (g.rotation.z = watering ? Math.sin(t * 6 + i) * 0.025 : 0),
      );
      domeSlide = T.MathUtils.lerp(
        domeSlide,
        s.domeOpen ? 1 : 0,
        reduced ? 1 : 1 - Math.exp(-dt * 5),
      );
      dome.position.set(
        0,
        1.678 - domeSlide * 0.05 + Math.sin(domeSlide * Math.PI) * 0.45,
        domeSlide * 0.72,
      );
      const pour = s.pouring < 1 ? Math.sin(Math.PI * s.pouring) : 0;
      jug.position.set(
        0.34 - pour * 0.14,
        0.848 + pour * 0.52,
        -0.25 + pour * 0.27,
      );
      jug.rotation.x = pour * 0.74;
      drink.visible = s.filled;
      pourLine.visible = s.pouring > 0.18 && s.pouring < 0.8;
      if (pourLine.visible) {
        const a = new T.Vector3(0.04, 0.46, 0.09)
            .applyEuler(jug.rotation)
            .add(jug.position),
          b = new T.Vector3(0.12, 1.0, 0.31),
          mid = a.clone().add(b).multiplyScalar(0.5);
        pourLine.position.copy(mid);
        pourLine.scale.y = a.distanceTo(b);
        pourLine.quaternion.setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          a.sub(b).normalize(),
        );
      }
    },
    dispose() {
      windows.forEach((w) => w.dispose());
    },
  };
}
