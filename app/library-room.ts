import { createSpineAtlas, bindingColors } from './book-spines';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addOakFloor, galleryPrint } from './house-finishes';
import { drapedLinen, pillowGeometry } from './bed-linen';
import { attachSeats, type SeatAnchors } from './seat-scene';
import { rooms, type HouseView } from './house-data';
import { createWindowEnvironment } from './room-environment';
import { libraryFurniture as f } from './library-layout';
import {
  createLibraryState,
  libraryBooks,
  type LibraryBookId,
  type LibraryCommand,
} from './library-state';
import type { HouseLandscape } from './house-landscape';
import type { WallCutaways } from './wall-cutaway';
import type { ObjectId } from './room-data';
import type { Environment } from './environment-data';
type Kit = {
  root: T.Group;
  seats: SeatAnchors;
  cutaways: WallCutaways;
  landscape: HouseLandscape;
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
export function buildLibrary(k: Kit) {
  const { root, brass, charcoal } = k;
  root.name = '08 / The library — a room for unhurried reading';
  const state = createLibraryState();
  const mat = (color: string, roughness = 0.8, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    k.materials.push(m);
    return m;
  };
  const oak = k.oak.clone();
  oak.color.set('#866440');
  k.materials.push(oak);
  const dark = k.darkWood.clone();
  dark.color.set('#60452f');
  k.materials.push(dark);
  const plaster = k.cream.clone();
  plaster.color.set('#e4dbc6');
  k.materials.push(plaster);
  const ivory = mat('#e7d9b4'),
    paper = mat('#eee4c9'),
    green = k.textile('#687052'),
    linen = k.textile('#d2bea0'),
    rust = k.textile('#89724f'),
    leaf = mat('#647b46');
  linen.side = T.DoubleSide;
  const bindings = bindingColors.map((c) => mat(c));
  const glass = new T.MeshPhysicalMaterial({
    color: '#e5ece4',
    transparent: true,
    opacity: 0.18,
    roughness: 0.08,
    side: T.DoubleSide,
  });
  k.materials.push(glass);
  const glow = mat('#ffe2a5', 0.3);
  glow.emissive.set('#ffd082');
  glow.emissiveIntensity = 0.6;
  function mesh(
    p: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
    name?: string,
  ) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    if (name) {
      o.name = name;
      o.userData.independent = true;
    }
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
    r = 0.015,
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
  ) => mesh(p, new T.CylinderGeometry(rt, rb, h, 20), m, x, y, z);
  const ball = (
    p: T.Object3D,
    r: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => mesh(p, new T.SphereGeometry(r, 16, 12), m, x, y, z);
  function group(p: T.Object3D, x = 0, y = 0, z = 0, name = '') {
    const g = new T.Group();
    g.position.set(x, y, z);
    g.name = name;
    p.add(g);
    return g;
  }
  function object(id: ObjectId, p: T.Object3D = root, x = 0, y = 0, z = 0) {
    const g = group(p, x, y, z, id);
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
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      mid = start.clone().add(end).multiplyScalar(0.5);
    const o = cyl(p, r, r, start.distanceTo(end), mid.x, mid.y, mid.z, m);
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      end.sub(start).normalize(),
    );
    return o;
  }
  function tube(p: T.Object3D, points: number[][], r: number, m: T.Material) {
    return mesh(
      p,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((v) => new T.Vector3(...v))),
        32,
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
    draw: (c: CanvasRenderingContext2D, cv: HTMLCanvasElement) => void,
  ) {
    const cv = document.createElement('canvas');
    cv.width = 768;
    cv.height = Math.round((768 * h) / w);
    draw(cv.getContext('2d')!, cv);
    const texture = new T.CanvasTexture(cv);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    k.textures.push(texture);
    const m = new T.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      side: T.DoubleSide,
    });
    k.materials.push(m);
    const o = mesh(p, new T.PlaneGeometry(w, h), m, x, y, z, 'Printed detail');
    o.castShadow = false;
    return { cv, texture, mesh: o, material: m };
  }
  function label(
    p: T.Object3D,
    text: string,
    w: number,
    x: number,
    y: number,
    z: number,
    h = 0.2,
  ) {
    return panel(p, w, h, x, y, z, (c, cv) => {
      c.fillStyle = '#374937';
      c.fillRect(0, 0, cv.width, cv.height);
      c.strokeStyle = '#c6b180';
      c.lineWidth = 3;
      c.strokeRect(8, 8, cv.width - 16, cv.height - 16);
      c.fillStyle = '#ead7a6';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `500 ${cv.height * 0.47}px Georgia,serif`;
      c.fillText(text, cv.width / 2, cv.height / 2, cv.width * 0.92);
    });
  }
  function plant(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    trailing = false,
  ) {
    cyl(p, 0.12, 0.09, 0.21, x, y + 0.105, z, ivory);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4,
        xx = x + Math.sin(a) * 0.17,
        zz = z + Math.cos(a) * 0.13;
      rod(
        p,
        [x, y + 0.17, z],
        [xx, y + 0.34 + (i % 3) * 0.055, zz],
        0.006,
        leaf,
      );
      const l = ball(p, 0.076, xx, y + 0.34 + (i % 3) * 0.055, zz, leaf);
      l.scale.set(0.7, 1.55, 0.3);
      l.rotation.z = Math.sin(a) * 0.7;
    }
    if (trailing)
      for (let i = 0; i < 9; i++) {
        const xx = x + Math.sin(i * 1.3) * 0.12,
          yy = y - 0.09 - i * 0.095;
        const l = ball(p, 0.065, xx, yy, z + 0.11, leaf);
        l.scale.set(0.65, 1, 0.27);
        rod(p, [x, yy + 0.1, z + 0.1], [xx, yy, z + 0.11], 0.005, leaf);
      }
  }
  function picture(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    index: number,
    w = 0.43,
    h = 0.56,
  ) {
    const g = group(p, x, y, z);
    box(g, w + 0.08, h + 0.08, 0.05, 0, 0, 0, dark);
    box(g, w, h, 0.012, 0, 0, 0.03, ivory);
    const m = new T.MeshStandardMaterial({
      map: galleryPrint(index, k.textures),
      roughness: 0.9,
    });
    k.materials.push(m);
    mesh(g, new T.PlaneGeometry(w - 0.055, h - 0.065), m, 0, 0, 0.04);
  }
  const spineAtlas = createSpineAtlas(k.textures, k.materials);
  let bookSerial = 0;
  function book(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    index: number,
    depth = 0.28,
  ) {
    const serial = bookSerial++,
      m = bindings[(serial * 7 + index) % bindings.length];
    h *= 0.84 + (serial % 7) * 0.025;
    z += ((serial % 5) - 2) * 0.009;
    box(p, w, h, depth, x, y + h / 2, z, m, 0.008);
    box(
      p,
      w * 0.87,
      0.017,
      depth * 0.88,
      x,
      y + h - 0.028,
      z + 0.008,
      paper,
      0.002,
    );
    const spine = mesh(
      p,
      spineAtlas.geometry(w * 0.96, h * 0.95, serial),
      spineAtlas.material,
      x,
      y + h / 2,
      z + depth / 2 + 0.006,
    );
    spine.castShadow = false;
  }

  function stack(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    index: number,
  ) {
    for (let i = 0; i < 3; i++) {
      box(
        p,
        0.44 - i * 0.016,
        0.065,
        0.29,
        x + (i % 2) * 0.02,
        y + 0.035 + i * 0.073,
        z,
        bindings[(index + i) % bindings.length],
        0.007,
      );
      box(
        p,
        0.4 - i * 0.016,
        0.039,
        0.294,
        x + (i % 2) * 0.02,
        y + 0.035 + i * 0.073,
        z,
        paper,
        0.002,
      );
    }
  }
  function bust(p: T.Object3D, x: number, y: number, z: number) {
    box(p, 0.21, 0.05, 0.18, x, y + 0.025, z, ivory);
    cyl(p, 0.08, 0.12, 0.1, x, y + 0.1, z, ivory);
    const shoulders = ball(p, 0.105, x, y + 0.17, z, ivory);
    shoulders.scale.set(1.25, 0.65, 0.7);
    cyl(p, 0.035, 0.04, 0.07, x, y + 0.23, z, ivory);
    const head = ball(p, 0.075, x, y + 0.3, z, ivory);
    head.scale.y = 1.2;
    ball(p, 0.014, x, y + 0.3, z + 0.072, ivory);
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
    angle = 0,
  ) {
    const o = mesh(p, pillowGeometry(w, h, d), m, x, y, z);
    o.rotation.z = angle;
    return o;
  }
  // A continuous room shell, with the only exterior aperture on the north wall.
  box(root, 9, 0.4, 9, 0, -0.23, 0, oak, 0.035);
  addOakFloor(root, 8.86, 8.86, k.floorMaterials);
  function wall(
    width: number,
    x: number,
    z: number,
    yaw: number,
    door?: number,
    windowBay = false,
  ) {
    const lower = group(root, x, 0, z),
      upper = group(root, x, 0, z);
    lower.rotation.y = upper.rotation.y = yaw;
    const stops = [
      -width / 2,
      width / 2,
      ...(door === undefined ? [] : [door - 0.7, door + 0.7]),
      ...(windowBay ? [-2.8, 0.24] : []),
    ].sort((a, b) => a - b);
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1],
        b = stops[i],
        mid = (a + b) / 2,
        w = b - a;
      if (door !== undefined && Math.abs(mid - door) < 0.7) continue;
      box(lower, w, 0.64, 0.16, mid, 0.4, 0, plaster);
      box(lower, w, 0.07, 0.22, mid, 0.755, 0, oak);
      box(lower, w, 0.1, 0.2, mid, 0.15, 0.01, dark);
      if (windowBay && mid > -2.8 && mid < 0.24) {
        box(upper, w, 0.34, 0.16, mid, 0.94, 0, plaster);
        box(upper, w, 0.7, 0.16, mid, 3.34, 0, plaster);
      } else box(upper, w, 2.9, 0.16, mid, 2.19, 0, plaster);
      box(upper, w, 0.13, 0.24, mid, 3.64, 0, dark);
    }
    if (door !== undefined) {
      box(upper, 1.4, 0.92, 0.16, door, 3.18, 0, plaster);
      for (const dx of [-0.75, 0.75])
        box(upper, 0.1, 2.65, 0.24, door + dx, 1.42, 0, oak);
      box(upper, 1.62, 0.1, 0.24, door, 2.8, 0, oak);
    }
    k.cutaways.add(
      [upper],
      {
        x: rooms.library.x + x,
        z: rooms.library.z + z,
        nx: Math.sin(yaw),
        nz: Math.cos(yaw),
      },
      ['library'],
    );
    return upper;
  }
  const northWall = wall(9, 0, -4.41, 0, undefined, true);
  wall(9, 4.41, 0, -Math.PI / 2, 3.25);
  const gardenExit = object('libraryGardenDoor', root, 4.3, 0, 3.25);
  gardenExit.rotation.y = -Math.PI / 2;
  label(gardenExit, 'BOTANICAL GARDEN', 1.3, 0, 3.02, 0);
  k.cutaways.add([gardenExit], { x: 22.8, z: 2.15, nx: -1, nz: 0 }, [
    'library',
  ]);
  wall(9, 0, 4.41, Math.PI);
  const westWall = wall(9, -4.41, 0, Math.PI / 2, -2.85);
  const exit = object('libraryExitDoor', root, -4.3, 0, 2.85);
  exit.rotation.y = Math.PI / 2;
  label(exit, '← EAST WALK · 连廊', 1.27, 0, 3.04, 0);
  for (const x of [-0.76, 0.76]) box(exit, 0.09, 2.65, 0.08, x, 1.42, 0, oak);
  box(root, 0.25, 0.02, 1.38, -4.41, 0.091, 2.85, oak);
  k.cutaways.add([exit], { x: 14.1, z: 1.75, nx: 1, nz: 0 }, ['library']);
  const windowRoot = group(
    northWall,
    -1.28,
    2.02,
    0.04,
    'North reading window',
  );
  const view = createWindowEnvironment(windowRoot, 'library', k.landscape, {
    width: 2.78,
    height: 1.78,
  });
  for (const x of [-1.45, 1.45])
    box(windowRoot, 0.11, 1.96, 0.24, x, 0, 0, oak);
  for (const y of [-0.93, 0.93])
    box(windowRoot, 3.02, 0.12, 0.25, 0, y, 0, oak);
  for (const x of [-0.46, 0.46])
    box(windowRoot, 0.05, 1.8, 0.09, x, 0, 0.08, oak);
  box(windowRoot, 2.8, 0.05, 0.09, 0, 0, 0.08, oak);
  box(windowRoot, 2.77, 1.77, 0.01, 0, 0, 0.05, glass);
  box(windowRoot, 3.02, 0.08, 0.48, 0, -0.99, 0.09, oak);
  // Shelving wraps around the room; the window seat is built into the north book wall.
  const shelves = object('libraryShelf');
  function bookcase(
    p: T.Object3D,
    width: number,
    bays: number,
    decorate = true,
    reserveBooks = false,
    reserveGlobe = false,
  ) {
    box(p, width, 0.77, 0.63, 0, 0.505, 0, dark);
    box(p, width, 0.06, 0.72, 0, 0.91, 0, oak);
    box(p, width, 2.55, 0.07, 0, 2.15, -0.28, dark);
    box(p, width + 0.08, 0.13, 0.72, 0, 3.55, 0, oak);
    const bay = width / bays;
    for (let i = 0; i <= bays; i++)
      box(p, 0.1, 2.61, 0.64, -width / 2 + i * bay, 2.19, 0, oak);
    for (let i = 0; i < bays; i++) {
      const x = -width / 2 + (i + 0.5) * bay;
      box(p, bay - 0.15, 0.61, 0.032, x, 0.52, 0.33, oak);
      box(p, bay - 0.26, 0.49, 0.025, x, 0.52, 0.354, dark);
      cyl(
        p,
        0.018,
        0.018,
        0.018,
        x + bay * 0.26,
        0.55,
        0.38,
        brass,
      ).rotation.x = Math.PI / 2;
      const arch = Array.from({ length: 17 }, (_, q) => {
        const a = (Math.PI * q) / 16;
        return [
          x - (Math.cos(a) * (bay - 0.17)) / 2,
          3.29 + Math.sin(a) * 0.2,
          0.335,
        ];
      });
      tube(p, arch, 0.026, oak);
      for (let row = 0; row < 5; row++) {
        const y = 0.94 + row * 0.49;
        if (!(reserveGlobe && i === 1 && row === 3))
          box(p, bay - 0.09, 0.045, 0.62, x, y, 0, oak);
        if (
          (reserveBooks && i === 0 && row < 3) ||
          (reserveGlobe && i === 1 && (row === 2 || row === 3))
        )
          continue;
        const special = decorate && (i + row) % 6 === 0;
        if (special) {
          if (row % 3 === 0) stack(p, x - 0.08, y + 0.025, 0.03, i);
          else if (row % 3 === 1) bust(p, x, y + 0.025, 0.03);
          else picture(p, x, y + 0.24, 0.15, (i + row) % 5);
        } else
          for (let j = 0; j < Math.floor((bay - 0.22) / 0.145); j++) {
            const xx = x - bay / 2 + 0.19 + j * 0.145,
              h = 0.29 + ((i * 7 + j * 3 + row) % 7) * 0.022;
            book(
              p,
              xx,
              y + 0.025,
              0.065,
              0.105 + (j % 3) * 0.009,
              h,
              j + i + row,
            );
          }
      }
    }
  }
  const left = group(shelves, f.northLeft.x, 0, f.northLeft.z);
  bookcase(left, f.northLeft.width, 1, true, true);
  const right = group(shelves, f.northRight.x, 0, f.northRight.z);
  bookcase(right, f.northRight.width, 3);
  const east = group(shelves, f.eastShelves.x, 0, f.eastShelves.z);
  east.rotation.y = -Math.PI / 2;
  bookcase(east, f.eastShelves.depth, 5, true, false, true);
  const bridge = group(shelves, -1.28, 0, -4.03);
  box(bridge, 3, 0.065, 0.63, 0, 3.02, 0, oak);
  box(bridge, 3, 0.14, 0.68, 0, 3.55, 0, oak);
  box(bridge, 3, 0.54, 0.07, 0, 3.29, -0.28, dark);
  for (let i = 0; i < 19; i++)
    book(
      bridge,
      -1.36 + i * 0.148,
      3.055,
      0.05,
      0.11,
      0.34 + (i % 3) * 0.04,
      i,
    );
  label(bridge, 'SATORI · 藏书室', 1.72, 0, 3.59, 0.355, 0.16);
  plant(shelves, -3.83, 3.61, -4.02, true);
  plant(shelves, 0.54, 3.61, -4.03, true);
  plant(east, 2.65, 3.61, 0.02, true);
  // Every readable volume has its own shelf position and individually animated spine.
  const selectedBooks = {} as Record<LibraryBookId, T.Group>;
  const bookIds = Object.keys(libraryBooks) as LibraryBookId[];
  for (const [i, id] of bookIds.entries()) {
    const objectId = (
      {
        forest: 'libraryBookForest',
        journey: 'libraryBookJourney',
        house: 'libraryBookHouse',
        stars: 'libraryBookStars',
        kitchen: 'libraryBookKitchen',
        mystery: 'libraryBookMystery',
        architecture: 'libraryBookArchitecture',
        music: 'libraryBookMusic',
        botany: 'libraryBookBotany',
      } as const
    )[id];
    const y = 0.965 + Math.floor(i / 3) * 0.49;
    const g = object(objectId, left, ((i % 3) - 1) * 0.26, y, 0.19);
    g.userData.shelfY = y;
    book(g, 0, 0, 0, 0.21, 0.43, i);
    label(
      g,
      libraryBooks[id].title,
      0.38,
      0,
      0.245,
      0.155,
      0.15,
    ).mesh.rotation.z = Math.PI / 2;
    selectedBooks[id] = g;
  }
  // Window bench: four pillows stay away from the two seating anchors.
  const bench = group(
    root,
    f.windowSeat.x,
    0,
    f.windowSeat.z,
    'Window reading bench',
  );
  box(bench, 2.86, 0.57, 0.86, 0, 0.435, 0, oak);
  box(bench, 2.9, 0.07, 0.92, 0, 0.735, 0, dark);
  cushion(bench, 2.76, 0.23, 0.79, 0, 0.825, 0.03, green);
  for (const x of [-1.2, 1.2])
    cushion(
      bench,
      0.37,
      0.46,
      0.19,
      x,
      1.14,
      -0.22,
      x < 0 ? linen : rust,
      x < 0 ? -0.16 : 0.12,
    );
  for (const x of [-0.7, 0.7]) {
    box(bench, 1.18, 0.39, 0.025, x, 0.43, 0.445, oak);
    box(bench, 0.19, 0.025, 0.02, x, 0.58, 0.466, brass);
  }
  const throwOnBench = mesh(
    bench,
    drapedLinen(0.24, 0.52, 0.4, true),
    linen,
    1.24,
    0.95,
    0.02,
  );
  throwOnBench.rotation.y = 0.07;
  attachSeats(k.seats, bench, ['library-window-1', 'library-window-2']);
  k.interactables.push(bench);
  // Soft patterned rug, separated from the ladder's wooden rolling track.
  const rug = panel(root, 4.9, 4.9, -0.55, 0.084, 0.98, (c, cv) => {
    c.fillStyle = '#596148';
    c.fillRect(0, 0, cv.width, cv.height);
    for (const [n, color] of [
      [13, '#b59965'],
      [27, '#7a6546'],
      [44, '#d3bb88'],
      [61, '#93764a'],
    ] as const) {
      c.strokeStyle = color;
      c.lineWidth = 8;
      c.strokeRect(n, n, cv.width - n * 2, cv.height - n * 2);
    }
    c.lineWidth = 3;
    for (let y = 96; y < 690; y += 50)
      for (let x = 96; x < 690; x += 50) {
        c.strokeStyle = (x + y) % 3 ? '#9e895b' : '#cab37d';
        c.beginPath();
        c.moveTo(x, y - 14);
        c.lineTo(x + 10, y);
        c.lineTo(x, y + 14);
        c.lineTo(x - 10, y);
        c.closePath();
        c.stroke();
      }
  });
  rug.mesh.rotation.x = -Math.PI / 2;
  const desk = object('libraryDesk', root, f.desk.x, 0, f.desk.z);
  box(desk, 2.73, 0.12, 1.47, 0, 1.2, 0, oak, 0.045);
  box(desk, 2.53, 0.28, 1.3, 0, 1.02, 0, dark);
  for (const x of [-1.08, 1.08])
    for (const z of [-0.49, 0.49]) {
      const points = [
        [0.075, 0],
        [0.1, 0.07],
        [0.055, 0.22],
        [0.047, 0.52],
        [0.087, 0.65],
        [0.06, 0.78],
        [0.065, 0.96],
      ].map(([r, y]) => new T.Vector2(r, y));
      mesh(desk, new T.LatheGeometry(points, 16), oak, x, 0.1, z);
    }
  for (const x of [-0.82, 0, 0.82]) {
    box(desk, 0.73, 0.22, 0.03, x, 1.01, 0.667, oak);
    tube(
      desk,
      [
        [x - 0.085, 1.04, 0.692],
        [x - 0.07, 0.99, 0.72],
        [x + 0.07, 0.99, 0.72],
        [x + 0.085, 1.04, 0.692],
      ],
      0.012,
      brass,
    );
  }
  const chair = group(root, f.deskChair.x, 0, f.deskChair.z, 'Desk chair');
  chair.rotation.y = Math.PI;
  for (const x of [-0.31, 0.31])
    for (const z of [-0.29, 0.29])
      rod(chair, [x, 0.11, z], [x * 0.8, 0.67, z * 0.8], 0.034, oak);
  box(chair, 0.78, 0.09, 0.77, 0, 0.7, 0, oak);
  cushion(chair, 0.7, 0.16, 0.68, 0, 0.79, 0.035, green);
  for (const x of [-0.31, 0.31])
    box(chair, 0.05, 0.86, 0.06, x, 1.04, -0.315, oak);
  box(chair, 0.73, 0.15, 0.11, 0, 1.49, -0.315, oak, 0.04);
  for (const x of [-0.2, 0, 0.2])
    box(chair, 0.035, 0.52, 0.035, x, 1.12, -0.315, oak);
  attachSeats(k.seats, chair, ['library-desk']);
  k.interactables.push(chair);
  const deskLamp = group(desk, -0.93, 1.265, -0.43);
  cyl(deskLamp, 0.13, 0.16, 0.05, 0, 0.025, 0, brass);
  rod(deskLamp, [0, 0.04, 0], [0, 0.4, 0], 0.025, brass);
  tube(
    deskLamp,
    [
      [0, 0.39, 0],
      [0, 0.49, 0.04],
      [0, 0.49, 0.16],
    ],
    0.02,
    brass,
  );
  box(deskLamp, 0.51, 0.14, 0.23, 0, 0.47, 0.14, bindings[0], 0.065);
  box(deskLamp, 0.4, 0.012, 0.18, 0, 0.397, 0.14, glow, 0.03);
  stack(desk, 0.83, 1.27, -0.4, 2);
  cyl(desk, 0.065, 0.055, 0.13, 1.06, 1.33, 0.03, brass);
  for (let i = 0; i < 3; i++)
    rod(
      desk,
      [1.04 + i * 0.025, 1.32, 0.03],
      [1.02 + i * 0.035, 1.6, 0.02],
      0.009,
      charcoal,
    );
  const pen = group(desk, 0.83, 1.28, 0.41, 'Fountain pen');
  pen.rotation.y = 0.55;
  rod(pen, [-0.18, 0, 0], [0.15, 0, 0], 0.017, charcoal);
  rod(pen, [0.15, 0, 0], [0.2, 0, 0], 0.013, brass);
  cyl(pen, 0.02, 0.02, 0.045, -0.1, 0, 0, brass).rotation.z = Math.PI / 2;
  const magnifier = group(desk, 0.85, 1.287, 0.19, 'Magnifying glass');
  const rim = mesh(magnifier, new T.TorusGeometry(0.105, 0.011, 8, 36), brass);
  rim.rotation.x = Math.PI / 2;
  const lens = cyl(magnifier, 0.095, 0.095, 0.009, 0, 0, 0, glass);
  lens.userData.independent = true;
  rod(magnifier, [0, 0, 0.1], [0.025, 0, 0.29], 0.017, charcoal);
  // An open book has independent covers, text surfaces and a flexible page hinged at the spine.
  const openBook = group(desk, -0.08, 1.269, 0.08, 'Open reading book');
  openBook.rotation.y = -0.05;
  const cover = mat('#56664a');
  for (const x of [-0.278, 0.278]) {
    box(openBook, 0.55, 0.025, 0.81, x, 0.014, 0, cover);
    box(openBook, 0.51, 0.055, 0.765, x, 0.052, 0, paper, 0.006);
  }
  box(openBook, 0.045, 0.072, 0.81, 0, 0.035, 0, cover);
  function pagePaint(
    c: CanvasRenderingContext2D,
    cv: HTMLCanvasElement,
    title: string,
    content: string,
    leftPage = false,
  ) {
    c.fillStyle = '#f1e7cb';
    c.fillRect(0, 0, cv.width, cv.height);
    c.strokeStyle = '#c5ad78';
    c.lineWidth = 2;
    c.strokeRect(36, 42, cv.width - 72, cv.height - 84);
    c.fillStyle = '#576144';
    c.font = '36px serif';
    c.textAlign = 'center';
    c.fillText(title, cv.width / 2, 112, cv.width - 100);
    c.strokeStyle = '#b49c6b';
    c.beginPath();
    c.moveTo(90, 150);
    c.lineTo(cv.width - 90, 150);
    c.stroke();
    if (leftPage) {
      c.save();
      c.translate(cv.width / 2, cv.height * 0.53);
      for (let i = 0; i < 7; i++) {
        c.rotate(0.8);
        c.fillStyle = i % 2 ? '#81926c' : '#a5ab81';
        c.beginPath();
        c.ellipse(50, 0, 65, 20, 0.4, 0, 7);
        c.fill();
      }
      c.restore();
      c.fillStyle = '#7a785f';
      c.font = '24px serif';
      c.fillText('给安静留一页', cv.width / 2, cv.height - 116);
      return;
    }
    c.textAlign = 'left';
    c.fillStyle = '#615b49';
    c.font = '25px serif';
    let line = '',
      y = 202;
    for (const ch of content.replace(/\n/g, ' ')) {
      if (c.measureText(line + ch).width > cv.width - 130) {
        c.fillText(line, 65, y);
        y += 44;
        line = ch;
      } else line += ch;
      if (y > cv.height - 80) break;
    }
    if (y < cv.height - 65) c.fillText(line, 65, y);
  }
  const leftPage = panel(openBook, 0.514, 0.765, -0.278, 0.084, 0, (c, cv) =>
    pagePaint(c, cv, '阅读手记', '', true),
  );
  leftPage.mesh.rotation.x = -Math.PI / 2;
  const rightPage = panel(openBook, 0.514, 0.765, 0.278, 0.084, 0, (c, cv) =>
    pagePaint(c, cv, '翻开新的一页', '挑一本喜欢的书，坐下来慢慢读。'),
  );
  rightPage.mesh.rotation.x = -Math.PI / 2;
  const turning = group(openBook, 0, 0.09, 0, 'Turning page hinge');
  const turnPanel = panel(turning, 0.514, 0.765, 0, 0, 0, (c, cv) =>
    pagePaint(c, cv, '阅读手记', ''),
  );
  turnPanel.mesh.geometry.dispose();
  const pageGeometry = new T.PlaneGeometry(0.514, 0.765, 20, 12);
  pageGeometry.rotateX(-Math.PI / 2);
  pageGeometry.translate(0.514 / 2, 0, 0);
  turnPanel.mesh.geometry = pageGeometry;
  turnPanel.mesh.castShadow = true;
  turning.visible = false;
  let pageStamp = '';
  // Armchair, footstool and book trolley form a separate, usable reading corner.
  const arm = group(root, f.armchair.x, 0, f.armchair.z, 'Library armchair');
  for (const x of [-0.46, 0.46])
    for (const z of [-0.46, 0.46]) cyl(arm, 0.028, 0.04, 0.26, x, 0.23, z, oak);
  box(arm, 1.18, 0.28, 1.14, 0, 0.5, 0, oak, 0.055);
  cushion(arm, 0.97, 0.23, 0.97, 0, 0.725, 0.09, green);
  cushion(arm, 1.09, 0.83, 0.28, 0, 1.11, -0.46, green);
  for (const x of [-0.55, 0.55]) {
    box(arm, 0.2, 0.54, 1.1, x, 0.72, 0, green, 0.085);
    cushion(arm, 0.23, 0.17, 1.07, x, 0.995, 0.01, green);
  }
  cushion(arm, 0.46, 0.43, 0.15, 0.2, 1.04, -0.25, rust, 0.14);
  const throwOnArm = mesh(
    arm,
    drapedLinen(0.24, 0.59, 0.48, true),
    linen,
    -0.59,
    1.09,
    0.08,
  );
  throwOnArm.rotation.z = 0.05;
  attachSeats(k.seats, arm, ['library-armchair']);
  k.interactables.push(arm);
  const ottoman = group(root, f.ottoman.x, 0, f.ottoman.z);
  for (const x of [-0.34, 0.34])
    for (const z of [-0.23, 0.23])
      cyl(ottoman, 0.025, 0.035, 0.25, x, 0.225, z, oak);
  box(ottoman, 0.92, 0.15, 0.74, 0, 0.4, 0, oak);
  cushion(ottoman, 0.96, 0.23, 0.79, 0, 0.585, 0, green);
  const side = group(root, f.sideTable.x, 0, f.sideTable.z);
  cyl(side, 0.21, 0.21, 0.05, 0, 0.72, 0, oak);
  cyl(side, 0.045, 0.07, 0.6, 0, 0.4, 0, oak);
  cyl(side, 0.18, 0.23, 0.04, 0, 0.12, 0, dark);
  cyl(side, 0.055, 0.045, 0.085, 0.05, 0.787, 0.075, ivory);
  cyl(side, 0.058, 0.058, 0.01, 0.05, 0.834, 0.075, charcoal);
  cyl(side, 0.085, 0.085, 0.015, 0.05, 0.754, 0.075, ivory);
  const floorLamp = group(side, -0.08, 0.755, -0.07);
  cyl(floorLamp, 0.065, 0.095, 0.025, 0, 0.012, 0, brass);
  rod(floorLamp, [0, 0.02, 0], [0, 1.02, 0], 0.019, brass);
  cyl(floorLamp, 0.11, 0.23, 0.28, 0, 0.98, 0, linen);
  cyl(floorLamp, 0.21, 0.21, 0.008, 0, 0.835, 0, glow);
  const cart = group(root, f.cart.x, 0, f.cart.z, 'Rolling book trolley');
  for (const x of [-0.45, 0.45])
    for (const z of [-0.23, 0.23]) {
      const wheel = cyl(cart, 0.055, 0.055, 0.035, x, 0.143, z, charcoal);
      wheel.rotation.x = Math.PI / 2;
      rod(cart, [x, 0.16, z], [x, 0.3, z], 0.018, brass);
    }
  for (const y of [0.28, 0.7, 1.11]) {
    box(cart, 1.1, 0.045, 0.63, 0, y, 0, oak);
    for (const z of [-0.29, 0.29])
      box(cart, 1.12, 0.085, 0.035, 0, y + 0.057, z, oak);
  }
  for (const x of [-0.5, 0.5]) {
    for (const z of [-0.25, 0.25])
      box(cart, 0.045, 0.92, 0.045, x, 0.72, z, oak);
    tube(
      cart,
      [
        [x, 1.04, -0.25],
        [x, 1.27, -0.25],
        [x, 1.27, 0.25],
        [x, 1.04, 0.25],
      ],
      0.026,
      oak,
    );
  }
  for (let i = 0; i < 6; i++) {
    book(cart, -0.38 + i * 0.145, 0.33, 0.03, 0.1, 0.3 + (i % 3) * 0.035, i);
    book(
      cart,
      -0.38 + i * 0.145,
      0.75,
      0.03,
      0.11,
      0.26 + (i % 3) * 0.02,
      i + 2,
    );
  }
  stack(cart, -0.13, 1.15, 0.02, 3);
  // A rail-mounted leaning ladder: the complete swept footprint is reserved for navigation.
  const ladder = object('libraryLadder', root, 3.72, 0, -0.85);
  ladder.rotation.y = -Math.PI / 2;
  for (const x of [-0.33, 0.33]) {
    rod(ladder, [x, 0.13, 1.03], [x, 3.23, 0.06], 0.044, oak);
    tube(
      ladder,
      [
        [x, 3.16, 0.09],
        [x, 3.36, 0.06],
        [x, 3.36, -0.07],
        [x, 3.22, -0.09],
      ],
      0.021,
      brass,
    );
    const wheel = cyl(ladder, 0.065, 0.065, 0.055, x, 0.14, 1.03, charcoal);
    wheel.rotation.z = Math.PI / 2;
  }
  for (let i = 0; i < 9; i++) {
    const y = 0.33 + i * 0.31,
      z = 1.03 - ((y - 0.13) * 0.97) / 3.1;
    box(ladder, 0.66, 0.052, 0.19, 0, y, z, oak, 0.01);
  }
  rod(root, [3.76, 3.24, -3.2], [3.76, 3.24, 1.8], 0.026, brass);
  for (const z of [-3.1, -1.4, 0.3, 1.7])
    rod(root, [4.08, 3.24, z], [3.76, 3.24, z], 0.022, brass);
  for (const x of [2.66, 3.68])
    box(root, 0.025, 0.007, 4.95, x, 0.086, -0.725, dark);
  // A softly aged globe with hand-drawn continent silhouettes and brass meridian.
  const globe = object('libraryGlobe', root, 3.96, 1.975, -2.096);
  globe.rotation.y = -Math.PI / 2;
  box(globe, 0.38, 0.055, 0.33, 0, 0.027, 0, oak);
  cyl(globe, 0.045, 0.11, 0.15, 0, 0.11, 0, brass);
  const meridian = mesh(
    globe,
    new T.TorusGeometry(0.303, 0.012, 8, 48),
    brass,
    0,
    0.44,
    0,
  );
  meridian.rotation.z = -0.28;
  const globeCanvas = document.createElement('canvas');
  globeCanvas.width = 1024;
  globeCanvas.height = 512;
  const gc = globeCanvas.getContext('2d')!;
  gc.fillStyle = '#bea36e';
  gc.fillRect(0, 0, 1024, 512);
  gc.strokeStyle = '#927f57';
  gc.lineWidth = 1;
  for (let x = 0; x < 1024; x += 1024 / 12) {
    gc.beginPath();
    gc.moveTo(x, 0);
    gc.lineTo(x, 512);
    gc.stroke();
  }
  for (let y = 0; y < 512; y += 512 / 6) {
    gc.beginPath();
    gc.moveTo(0, y);
    gc.lineTo(1024, y);
    gc.stroke();
  }
  const continents = [
    [
      [55, 104],
      [107, 55],
      [197, 58],
      [253, 98],
      [205, 156],
      [161, 178],
      [174, 208],
      [125, 185],
      [96, 154],
    ],
    [
      [202, 220],
      [251, 223],
      [289, 273],
      [262, 326],
      [239, 395],
      [216, 439],
      [201, 365],
      [181, 297],
    ],
    [
      [433, 110],
      [464, 79],
      [496, 99],
      [511, 146],
      [471, 164],
      [454, 145],
    ],
    [
      [457, 176],
      [529, 171],
      [574, 226],
      [551, 291],
      [518, 328],
      [479, 284],
      [453, 235],
    ],
    [
      [513, 92],
      [621, 53],
      [736, 66],
      [845, 114],
      [865, 177],
      [796, 204],
      [772, 254],
      [729, 230],
      [701, 176],
      [667, 215],
      [644, 244],
      [620, 190],
      [566, 168],
    ],
    [
      [801, 326],
      [860, 305],
      [918, 343],
      [898, 382],
      [829, 388],
    ],
    [
      [0, 471],
      [176, 458],
      [356, 470],
      [564, 461],
      [737, 471],
      [1024, 466],
      [1024, 512],
      [0, 512],
    ],
  ];
  gc.fillStyle = '#677255';
  for (const points of continents) {
    gc.beginPath();
    points.forEach(([x, y], i) => (i ? gc.lineTo(x, y) : gc.moveTo(x, y)));
    gc.closePath();
    gc.fill();
    gc.stroke();
  }
  const globeTexture = new T.CanvasTexture(globeCanvas);
  globeTexture.colorSpace = T.SRGBColorSpace;
  k.textures.push(globeTexture);
  const globeMat = new T.MeshStandardMaterial({
    map: globeTexture,
    roughness: 0.65,
  });
  k.materials.push(globeMat);
  const globeAxis = group(globe, 0, 0.44, 0);
  globeAxis.rotation.z = -0.28;
  const sphere = mesh(
    globeAxis,
    new T.SphereGeometry(0.27, 40, 24),
    globeMat,
    0,
    0,
    0,
    'Rotating globe',
  );
  rod(globe, [0.084, 0.15, 0], [-0.084, 0.73, 0], 0.011, brass);
  // Picture lights and reading lights add warmth without hanging over circulation.
  picture(westWall, -0.45, 2.2, 0.13, 4, 0.8, 1.03);
  label(westWall, '留一段时间，给一本书。', 1.55, -0.45, 1.5, 0.14, 0.19);
  for (const [p, x] of [
    [left, 0],
    [right, -0.7],
    [east, 0.7],
  ] as const) {
    box(p, 0.43, 0.035, 0.15, x, 3.08, 0.48, brass);
    box(p, 0.34, 0.018, 0.1, x, 3.055, 0.49, glow);
    rod(p, [x, 3.08, 0.27], [x, 3.08, 0.46], 0.012, brass);
  }
  const lights: T.PointLight[] = [];
  for (const [x, y, z, power] of [
    [-0.62, 2.42, -0.75, 3],
    [-2.9, 2.3, 1.3, 2],
    [2.9, 3.25, -2.8, 4],
  ]) {
    const light = new T.PointLight('#ffdda6', power, 8, 1.7);
    light.position.set(x, y, z);
    root.add(light);
    lights.push(light);
  }
  // Preserve every moving group and seat anchor while batching static decorative meshes.
  function batch(p: T.Object3D) {
    for (const c of p.children) if (c instanceof T.Group) batch(c);
    const bins = new Map<T.Material, T.Mesh[]>();
    for (const o of p.children)
      if (
        o instanceof T.Mesh &&
        !o.userData.independent &&
        !Array.isArray(o.material) &&
        !o.material.transparent
      ) {
        const b = bins.get(o.material) || [];
        b.push(o);
        bins.set(o.material, b);
      }
    for (const [m, list] of bins)
      if (list.length > 3) {
        const copies = list.map((o) => {
          o.updateMatrix();
          return (
            o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
          ).applyMatrix4(o.matrix);
        });
        const geometry = mergeGeometries(copies);
        copies.forEach((g) => g.dispose());
        if (geometry) {
          for (const o of list) {
            p.remove(o);
            o.geometry.dispose();
          }
          mesh(p, geometry, m);
        }
      }
  }
  batch(root);
  let lamp = true,
    globeAngle = 0;
  return {
    snapshot: () => state.snapshot(),
    command: (command: LibraryCommand) => state.command(command),
    setFocus(_id: ObjectId | null) {},
    setView(_view: HouseView) {},
    setLamp(on: boolean) {
      lamp = on;
    },
    setEnvironment(value: Environment) {
      view.set(value);
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
      ladder.position.z = s.ladderPosition;
      for (const [id, g] of Object.entries(selectedBooks)) {
        const selected = id === s.book;
        g.visible = !selected || s.phase !== 'reading';
        g.position.z =
          0.19 +
          (selected
            ? s.phase === 'taking'
              ? Math.min(1, s.age / 0.7) * 0.38
              : s.phase === 'returning'
                ? (1 - Math.min(1, s.age / 0.7)) * 0.38
                : 0
            : 0);
      }
      if (s.globeSpinning && !reduced) globeAngle += dt * 0.23;
      sphere.rotation.y = globeAngle;
      if (!root.visible) return;
      view.update(t, dt, reduced, camera);
      lights.forEach(
        (l, i) =>
          (l.intensity = lamp
            ? [night ? 4 : 2.5, night ? 3 : 1.7, night ? 5 : 3][i]
            : 0),
      );
      glow.emissiveIntensity = lamp ? 0.75 : 0;
      const stamp = `${s.phase === 'shelved' ? 'shelf' : s.book}:${s.page}`;
      if (pageStamp !== stamp) {
        pageStamp = stamp;
        const b = libraryBooks[s.book],
          entry = b.pages[s.page];
        cover.color.set(s.phase === 'shelved' ? '#56664a' : b.color);
        pagePaint(
          leftPage.cv.getContext('2d')!,
          leftPage.cv,
          s.phase === 'shelved' ? '阅读手记' : b.title,
          '',
          true,
        );
        leftPage.texture.needsUpdate = true;
        pagePaint(
          rightPage.cv.getContext('2d')!,
          rightPage.cv,
          s.phase === 'shelved' ? '翻开新的一页' : entry.title,
          s.phase === 'shelved' ? '挑一本喜欢的书，坐下来慢慢读。' : entry.text,
        );
        rightPage.texture.needsUpdate = true;
        const old = b.pages[s.previousPage];
        pagePaint(
          turnPanel.cv.getContext('2d')!,
          turnPanel.cv,
          old.title,
          old.text,
        );
        turnPanel.texture.needsUpdate = true;
      }
      turning.visible = s.turn < 1 && !reduced;
      turning.rotation.z = (s.direction === 1 ? s.turn : 1 - s.turn) * Math.PI;
      if (turning.visible) {
        const p = pageGeometry.getAttribute('position');
        for (let i = 0; i < p.count; i++)
          p.setY(
            i,
            Math.sin((p.getX(i) / 0.514) * Math.PI) *
              Math.sin(s.turn * Math.PI) *
              0.065,
          );
        pageGeometry.computeVertexNormals();
        p.needsUpdate = true;
      }
    },
    dispose() {
      view.dispose();
    },
  };
}
