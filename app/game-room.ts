import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addOakFloor } from './house-finishes';
import { drapedLinen } from './bed-linen';
import { rooms, type HouseView } from './house-data';
import { expansionReservations, gameFurniture as f } from './game-layout';
import {
  createArcade,
  paintArcade,
  readGameRecords,
  type GameRecords,
  type Stone,
} from './game-engine';
import type { ObjectId } from './room-data';
import type { WallCutaways } from './wall-cutaway';

type Kit = {
  root: T.Group;
  corridor: T.Group;
  scene: T.Scene;
  cutaways: WallCutaways;
  materials: T.Material[];
  textures: T.Texture[];
  floorMaterials: T.MeshStandardMaterial[];
  oak: T.MeshStandardMaterial;
  paleWood: T.MeshStandardMaterial;
  cream: T.MeshStandardMaterial;
  darkWood: T.MeshStandardMaterial;
  brass: T.MeshStandardMaterial;
  charcoal: T.MeshStandardMaterial;
  textile: (color: string) => T.MeshStandardMaterial;
  groups: Map<ObjectId, T.Group>;
  interactables: T.Object3D[];
};
export function buildGameRoom(k: Kit) {
  const { root, corridor, oak, paleWood, cream, darkWood, brass, charcoal } = k;
  root.name = '06 / Retro arcade & family game corner';
  corridor.name = 'East expansion corridor';
  const mat = (color: string, roughness = 0.75, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    k.materials.push(m);
    return m;
  };
  const forest = mat('#416650'),
    sage = mat('#97a486'),
    rust = mat('#c37e56'),
    gold = mat('#dfb666', 0.35, 0.5),
    ivory = mat('#efe4c8'),
    steel = mat('#b9c4c1', 0.19, 0.9),
    ink = mat('#172b24'),
    leaf = mat('#6a8658');
  const cloth = k.textile('#839172'),
    throwCloth = k.textile('#e3d6b9'),
    cushionCloth = k.textile('#c49e61');
  throwCloth.side = T.DoubleSide;
  const mesh = (
    p: T.Object3D,
    geo: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
    name?: string,
  ) => {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    if (name) {
      o.name = name;
      o.userData.independent = true;
    }
    return o;
  };
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
    name?: string,
  ) =>
    mesh(
      p,
      r
        ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3))
        : new T.BoxGeometry(w, h, d),
      m,
      x,
      y,
      z,
      name,
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
    name?: string,
  ) => mesh(p, new T.CylinderGeometry(rt, rb, h, 24), m, x, y, z, name);
  const ball = (
    p: T.Object3D,
    r: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    name?: string,
  ) => mesh(p, new T.SphereGeometry(r, 16, 10), m, x, y, z, name);
  const group = (p: T.Object3D, x = 0, y = 0, z = 0, name?: string) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    if (name) g.name = name;
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
    const start = new T.Vector3(a[0], a[1], a[2]),
      end = new T.Vector3(b[0], b[1], b[2]),
      mid = start.clone().add(end).multiplyScalar(0.5);
    const o = cyl(p, r, r, start.distanceTo(end), mid.x, mid.y, mid.z, m);
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      end.sub(start).normalize(),
    );
    return o;
  };
  const tube = (
    p: T.Object3D,
    pts: number[][],
    radius: number,
    m: T.Material,
  ) =>
    mesh(
      p,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(pts.map((v) => new T.Vector3(v[0], v[1], v[2]))),
        48,
        radius,
        7,
        false,
      ),
      m,
    );
  function canvasPanel(
    p: T.Object3D,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    name: string,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = Math.round((640 * h) / w);
    paint(canvas.getContext('2d')!);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    k.textures.push(texture);
    const material = new T.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    });
    k.materials.push(material);
    const panel = mesh(p, new T.PlaneGeometry(w, h), material, x, y, z, name);
    panel.castShadow = false;
    return { canvas, texture, panel };
  }
  const label = (
    p: T.Object3D,
    text: string,
    w: number,
    x: number,
    y: number,
    z: number,
    bg = '#e8dec4',
    fg = '#385943',
  ) =>
    canvasPanel(p, w, w / 5, x, y, z, text, (ctx) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = fg;
      ctx.font = '500 49px sans-serif';
      if (ctx.measureText(text).width > 590)
        ctx.font = `500 ${Math.floor((49 * 590) / ctx.measureText(text).width)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(text, 320, ctx.canvas.height * 0.65);
    });
  function plant(p: T.Object3D, x: number, y: number, z: number, s = 1) {
    const g = group(p, x, y, z);
    g.scale.setScalar(s);
    cyl(g, 0.17, 0.12, 0.3, 0, 0.15, 0, rust);
    cyl(g, 0.15, 0.15, 0.018, 0, 0.303, 0, darkWood);
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4,
        yy = 0.5 + i * 0.074,
        xx = Math.cos(a) * 0.24,
        zz = Math.sin(a) * 0.24;
      rod(g, [0, 0.29, 0], [xx, yy, zz], 0.008, forest);
      const l = ball(g, 0.15, xx, yy, zz, i % 2 ? leaf : forest);
      l.scale.set(0.63, 1.25, 0.15);
      l.rotation.set(0.4, a, 0.6);
    }
  }
  const wall = (
    p: T.Group,
    width: number,
    x: number,
    z: number,
    yaw: number,
    room: 'gaming' | 'corridor',
    door?: number,
  ) => {
    const lower = group(p, x, 0, z),
      upper = group(p, x, 0, z);
    lower.rotation.y = upper.rotation.y = yaw;
    const spans =
      door === undefined
        ? [[-width / 2, width / 2]]
        : [
            [-width / 2, door - 0.7],
            [door + 0.7, width / 2],
          ];
    for (const [a, b] of spans)
      if (b > a) {
        box(lower, b - a, 0.73, 0.14, (a + b) / 2, 0.445, 0, cream);
        box(lower, b - a, 0.06, 0.19, (a + b) / 2, 0.84, 0, oak);
        box(lower, b - a, 0.14, 0.19, (a + b) / 2, 0.16, 0, paleWood);
        box(upper, b - a, 2.82, 0.14, (a + b) / 2, 2.21, 0, cream);
      }
    box(upper, width, 0.09, 0.2, 0, 3.67, 0, ivory);
    if (door !== undefined) {
      box(upper, 1.4, 0.95, 0.14, door, 3.175, 0, cream);
      for (const xx of [door - 0.73, door + 0.73])
        box(upper, 0.105, 2.65, 0.24, xx, 1.4, 0, oak);
      box(upper, 1.64, 0.12, 0.26, door, 2.77, 0, oak);
      box(lower, 1.4, 0.025, 0.26, door, 0.09, 0, paleWood);
    }
    const r = rooms[room];
    k.cutaways.add(
      [upper],
      { x: r.x + x, z: r.z + z, nx: Math.sin(yaw), nz: Math.cos(yaw) },
      [room],
    );
    return upper;
  };
  box(root, 9, 0.4, 6.8, 0, -0.23, 0, paleWood, 0.04);
  addOakFloor(root, 8.92, 6.67, k.floorMaterials);
  const north = wall(root, 9, 0, -3.31, 0, 'gaming');
  wall(root, 6.8, 4.41, 0, -Math.PI / 2, 'gaming');
  wall(root, 9, 0, 3.31, Math.PI, 'gaming');
  wall(root, 6.8, -4.5, 0, Math.PI / 2, 'gaming', -2.4);
  const exitDoor = object('gameExitDoor', -4.42, 2.4);
  exitDoor.rotation.y = Math.PI / 2;
  label(exitDoor, 'EAST WALK →', 1.2, 0, 2.35, 0.03);
  k.cutaways.add([exitDoor], { x: 14.08, z: 9.2, nx: 1, nz: 0 }, ['gaming']);
  label(north, 'PLAY A LITTLE · STAY A WHILE', 3.15, 0.1, 3.16, 0.09);
  // A framed miniature pixel landscape above the pinball machine.
  const art = group(root, -4.38, 2.5, -0.9);
  art.rotation.y = Math.PI / 2;
  k.cutaways.add([art], { x: 14.12, z: 5.9, nx: 1, nz: 0 }, ['gaming']);
  box(art, 0.87, 1.12, 0.055, 0, 0, 0, oak);
  canvasPanel(art, 0.75, 0.98, 0, 0, 0.032, 'Forest print', (ctx) => {
    ctx.fillStyle = '#e4d7af';
    ctx.fillRect(0, 0, 640, 840);
    ctx.fillStyle = '#c6915d';
    ctx.beginPath();
    ctx.arc(450, 170, 75, 0, 7);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#74805b' : '#405d48';
      ctx.beginPath();
      ctx.moveTo(-50, 840);
      ctx.lineTo(120 + i * 120, 250 + i * 55);
      ctx.lineTo(710, 840);
      ctx.fill();
    }
  });
  // Two intentionally different cabinets. Screens, stick pivots and every button stay independent.
  const displays: Record<string, ReturnType<typeof canvasPanel>> = {},
    sticks: T.Group[] = [],
    buttons: T.Mesh[] = [];
  for (const [index, id, loc] of [
    [0, 'arcadeBlocks', f.blocks],
    [1, 'arcadeSnake', f.snake],
  ] as const) {
    const g = object(id, loc.x, loc.z),
      color = index ? forest : sage;
    box(g, 1.21, 0.13, 1.08, 0, 0.17, 0, darkWood);
    box(g, 1.13, 1.3, 0.92, 0, 0.87, -0.03, color, 0.05);
    for (const side of [-1, 1]) {
      box(g, 0.09, 2.8, 1.08, side * 0.59, 1.52, 0, cream, 0.04);
      box(g, 0.025, 2.69, 0.027, side * 0.642, 1.53, 0.46, oak);
      const sideArt = group(g, side * 0.642, 1.05, -0.06);
      sideArt.rotation.y = (side * Math.PI) / 2;
      canvasPanel(sideArt, 0.86, 1.42, 0, 0, 0, `${id}/side-art`, (ctx) => {
        const h = ctx.canvas.height;
        ctx.fillStyle = index ? '#335e49' : '#869779';
        ctx.fillRect(0, 0, 640, h);
        ctx.fillStyle = '#d9bd78';
        ctx.beginPath();
        ctx.arc(450, h * 0.22, 66, 0, 7);
        ctx.fill();
        if (!index) {
          for (let j = 0; j < 3; j++) {
            ctx.fillStyle = ['#c9cfa2', '#657f60', '#3b614c'][j];
            ctx.beginPath();
            ctx.moveTo(-50, h);
            ctx.lineTo(130 + j * 170, h * 0.3 + j * 100);
            ctx.lineTo(700, h);
            ctx.fill();
          }
        } else {
          for (let j = 0; j < 7; j++) {
            ctx.fillStyle = j % 2 ? '#92a778' : '#dcc792';
            ctx.fillRect(
              120 + (j % 3) * 100,
              h * 0.36 + Math.floor(j / 3) * 100,
              86,
              86,
            );
          }
        }
      });
    }
    box(g, 1.1, 1.04, 0.14, 0, 2.05, -0.3, ink, 0.055);
    const screenMount = group(g, 0, 2.05, -0.205);
    screenMount.rotation.x = -0.13;
    displays[index ? 'snake' : 'blocks'] = canvasPanel(
      screenMount,
      0.94,
      1.15,
      0,
      0,
      0,
      `${id}/screen`,
      (ctx) => paintArcade(ctx, createArcade(index ? 'snake' : 'blocks'), true),
    );
    box(g, 1.17, 0.35, 0.72, 0, 2.82, -0.1, color, 0.045);
    box(g, 1.04, 0.24, 0.025, 0, 2.82, 0.273, cream);
    label(
      g,
      index ? 'GARDEN  /  02' : 'HILLS  /  01',
      0.96,
      0,
      2.82,
      0.29,
      index ? '#e7dec4' : '#48654e',
      index ? '#48654e' : '#e7dec4',
    );
    const deck = group(g, 0, 1.48, 0.38);
    deck.rotation.x = -0.1;
    box(deck, 1.17, 0.13, 0.51, 0, 0, 0, cream, 0.04);
    const stick = group(deck, -0.3, 0.075, 0.03, `${id}/joystick`);
    cyl(stick, 0.075, 0.075, 0.016, 0, 0, 0, darkWood);
    cyl(stick, 0.016, 0.016, 0.19, 0, 0.09, 0, steel);
    ball(stick, 0.07, 0, 0.205, 0, rust);
    sticks.push(stick);
    for (let j = 0; j < 6; j++) {
      const x = 0.08 + (j % 3) * 0.14,
        z = -0.05 + Math.floor(j / 3) * 0.16;
      cyl(deck, 0.052, 0.052, 0.018, x, 0.075, z, darkWood);
      buttons.push(
        cyl(
          deck,
          0.039,
          0.039,
          0.032,
          x,
          0.093,
          z,
          [gold, forest, rust][j % 3],
          `${id}/button-${j + 1}`,
        ),
      );
    }
    box(g, 0.39, 0.53, 0.035, 0, 0.65, 0.442, darkWood);
    box(g, 0.27, 0.35, 0.018, 0, 0.68, 0.468, charcoal);
    box(g, 0.13, 0.024, 0.02, 0, 0.79, 0.482, steel);
    cyl(g, 0.028, 0.028, 0.02, 0.08, 0.55, 0.488, brass).rotation.x =
      Math.PI / 2;
    for (let j = 0; j < 8; j++)
      box(g, 0.46, 0.012, 0.02, 0, 1.18 + j * 0.023, 0.449, darkWood, 0.003);
    label(g, 'FREE PLAY', 0.51, 0, 0.35, 0.454);
  }
  // Pinball: sloping enclosed playfield, real rails, bumper caps, hinged flippers and a spring plunger.
  const pin = object('gamePinball', f.pinball.x, f.pinball.z);
  for (const x of [-0.5, 0.5])
    for (const z of [-0.78, 0.78]) {
      rod(pin, [x, 0.1, z], [x * 0.95, 0.98, z * 0.95], 0.035, steel);
      cyl(pin, 0.045, 0.045, 0.028, x, 0.092, z, darkWood);
    }
  box(pin, 1.2, 0.42, 1.98, 0, 1.01, 0, forest, 0.04);
  const field = group(pin, 0, 1.26, 0, 'pinball/playfield');
  field.rotation.x = 0.16;
  box(field, 1.1, 0.06, 1.89, 0, 0, 0, oak);
  const fieldArt = canvasPanel(
    field,
    1.04,
    1.8,
    0,
    0.037,
    0,
    'pinball/field-art',
    (ctx) => {
      const h = ctx.canvas.height;
      ctx.fillStyle = '#78916a';
      ctx.fillRect(0, 0, 640, h);
      ctx.strokeStyle = '#ddc787';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.ellipse(290, h * 0.44, 225, h * 0.34, 0, 0, 7);
      ctx.stroke();
      ctx.fillStyle = '#e9d7ac';
      ctx.font = 'bold 68px serif';
      ctx.textAlign = 'center';
      ctx.fillText('FOREST', 320, h * 0.43);
      ctx.font = '30px monospace';
      ctx.fillText('PINBALL CLUB', 320, h * 0.5);
    },
  );
  fieldArt.panel.rotation.x = -Math.PI / 2;
  for (const x of [-0.55, 0.55])
    box(field, 0.045, 0.13, 1.92, x, 0.09, 0, brass);
  for (const z of [-0.95, 0.95]) box(field, 1.13, 0.13, 0.045, 0, 0.09, z, oak);
  const path = [
    [0.44, 0.12, 0.8],
    [0.44, 0.12, -0.55],
    [0.3, 0.12, -0.77],
    [-0.27, 0.12, -0.71],
    [-0.42, 0.12, -0.34],
    [-0.16, 0.12, 0.04],
    [0.27, 0.12, -0.25],
    [0.33, 0.12, 0.23],
    [-0.21, 0.12, 0.37],
    [0.07, 0.12, 0.7],
  ];
  tube(field, path.slice(0, 5), 0.013, steel);
  tube(
    field,
    [
      [-0.47, 0.11, 0.67],
      [-0.48, 0.11, 0.25],
      [-0.45, 0.11, -0.6],
      [-0.2, 0.11, -0.84],
      [0.3, 0.11, -0.81],
      [0.49, 0.11, -0.5],
    ],
    0.014,
    steel,
  );
  for (const [x, z] of [
    [-0.24, -0.37],
    [0.17, -0.49],
    [0.03, -0.04],
  ]) {
    cyl(field, 0.11, 0.12, 0.07, x, 0.08, z, ivory);
    cyl(field, 0.085, 0.085, 0.046, x, 0.14, z, rust);
    cyl(field, 0.04, 0.04, 0.012, x, 0.17, z, gold);
  }
  for (const side of [-1, 1]) {
    const rail = box(field, 0.035, 0.07, 0.47, side * 0.33, 0.1, 0.35, ivory);
    rail.rotation.y = side * 0.4;
  }
  const flippers = [-1, 1].map((side) => {
    const g = group(field, side * 0.23, 0.11, 0.66, `pinball/flipper-${side}`);
    box(
      g,
      0.31,
      0.045,
      0.085,
      -side * 0.09,
      0,
      0,
      rust,
      0.04,
      'independent flipper',
    );
    cyl(g, 0.048, 0.048, 0.06, 0, 0, 0, steel);
    return g;
  });
  const silverBall = ball(
    field,
    0.041,
    0.44,
    0.12,
    0.8,
    steel,
    'pinball/steel-ball',
  );
  const spring = group(pin, 0.47, 1.2, 1.025, 'pinball/plunger');
  const helix = Array.from({ length: 120 }, (_, i) => {
    const t = i / 119;
    return new T.Vector3(
      Math.sin(t * Math.PI * 20) * 0.026,
      Math.cos(t * Math.PI * 20) * 0.026,
      t * 0.18,
    );
  });
  mesh(
    spring,
    new T.TubeGeometry(new T.CatmullRomCurve3(helix), 120, 0.006, 6, false),
    steel,
  );
  rod(spring, [0, 0, 0], [0, 0, 0.25], 0.014, steel);
  cyl(spring, 0.052, 0.052, 0.04, 0, 0, 0.26, rust).rotation.x = Math.PI / 2;
  const glass = new T.MeshPhysicalMaterial({
    color: '#dbe6d2',
    transparent: true,
    opacity: 0.12,
    roughness: 0.09,
    depthWrite: false,
  });
  k.materials.push(glass);
  box(field, 1.03, 0.012, 1.8, 0, 0.24, 0, glass, 0, 'pinball/glass');
  box(pin, 1.2, 0.77, 0.17, 0, 1.9, -0.88, oak);
  const pinScore = label(
    pin,
    'FOREST  /  0000',
    1.04,
    0,
    2.1,
    -0.782,
    '#20392e',
    '#dbc68f',
  );
  label(pin, 'PINBALL CLUB', 0.99, 0, 1.78, -0.78);
  // Round table, separate grid, bowls and individually addressable stones.
  const table = object('gameTable', f.board.x, f.board.z);
  cyl(table, 0.8, 0.8, 0.1, 0, 0.91, 0, oak);
  cyl(table, 0.12, 0.19, 0.71, 0, 0.51, 0, darkWood);
  cyl(table, 0.43, 0.36, 0.09, 0, 0.145, 0, oak);
  const boardGroup = group(table, 0, 0.982, 0, 'gomoku/replaceable-board');
  box(boardGroup, 1.04, 0.038, 1.04, 0, 0, 0, paleWood);
  const spacing = 0.064;
  for (let i = 0; i < 15; i++) {
    box(
      boardGroup,
      0.9,
      0.002,
      0.003,
      0,
      0.022,
      (i - 7) * spacing,
      darkWood,
      0,
    );
    box(
      boardGroup,
      0.003,
      0.002,
      0.9,
      (i - 7) * spacing,
      0.022,
      0,
      darkWood,
      0,
    );
  }
  for (const x of [-4, 0, 4])
    for (const z of [-4, 0, 4])
      cyl(
        boardGroup,
        0.008,
        0.008,
        0.003,
        x * spacing,
        0.024,
        z * spacing,
        darkWood,
      );
  const stones = Array.from({ length: 225 }, (_, i) => {
    const s = ball(
      boardGroup,
      0.027,
      ((i % 15) - 7) * spacing,
      0.045,
      (Math.floor(i / 15) - 7) * spacing,
      ink,
      `gomoku/stone-${i}`,
    );
    s.scale.y = 0.46;
    s.visible = false;
    return s;
  });
  function setBoard(cells: Stone[]) {
    stones.forEach((s, i) => {
      s.visible = !!cells[i];
      s.material = cells[i] === 1 ? ink : ivory;
    });
  }
  const initialBoard = Array<Stone>(225).fill(0);
  [112, 113, 127, 97, 126, 96, 141, 111, 142].forEach(
    (v, i) => (initialBoard[v] = i % 2 ? 2 : 1),
  );
  setBoard(initialBoard);
  for (const side of [-1, 1]) {
    const bowl = group(table, side * 0.61, 0.987, 0.11);
    mesh(
      bowl,
      new T.SphereGeometry(
        0.115,
        20,
        10,
        0,
        Math.PI * 2,
        Math.PI / 2,
        Math.PI / 2,
      ),
      oak,
    );
    for (let i = 0; i < 6; i++)
      ball(
        bowl,
        0.03,
        Math.sin(i * 2.4) * 0.055,
        0.012,
        Math.cos(i * 2.4) * 0.055,
        side < 0 ? ink : ivory,
      ).scale.y = 0.5;
  }
  for (const stool of [f.stoolA, f.stoolB]) {
    const g = group(root, stool.x, 0, stool.z);
    cyl(g, 0.305, 0.3, 0.12, 0, 0.59, 0, cloth);
    cyl(g, 0.3, 0.3, 0.07, 0, 0.495, 0, oak);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2 + 0.7;
      rod(
        g,
        [Math.cos(a) * 0.26, 0.09, Math.sin(a) * 0.26],
        [Math.cos(a) * 0.2, 0.48, Math.sin(a) * 0.2],
        0.037,
        oak,
      );
    }
  }
  // East media cabinet and a north/south sofa facing the screen on the east wall.
  const media = object('gameConsole', f.media.x, f.media.z);
  media.rotation.y = -Math.PI / 2;
  for (const x of [-1.66, 1.66])
    for (const z of [-0.22, 0.22])
      cyl(media, 0.037, 0.048, 0.18, x, 0.17, z, oak);
  for (const y of [0.31, 0.87]) box(media, 3.8, 0.09, 0.72, 0, y, 0, oak);
  for (const x of [-1.86, -0.63, 0.63, 1.86])
    box(media, 0.065, 0.5, 0.69, x, 0.59, 0, oak);
  box(media, 3.7, 0.5, 0.035, 0, 0.58, -0.33, darkWood);
  for (let i = 0; i < 13; i++)
    box(media, 0.048, 0.43, 0.032, 0.76 + i * 0.081, 0.58, 0.365, paleWood);
  box(media, 0.91, 0.11, 0.44, 0, 0.42, 0, ivory);
  box(media, 0.7, 0.07, 0.3, 0, 0.51, -0.02, charcoal);
  for (let i = 0; i < 6; i++)
    box(
      media,
      0.12,
      0.36,
      0.32,
      -1.66 + i * 0.15,
      0.55,
      0.05,
      [forest, ivory, rust][i % 3],
    );
  box(media, 3.68, 2.14, 0.11, 0, 2.23, -0.12, charcoal, 0.055);
  const tv = canvasPanel(
    media,
    3.46,
    1.93,
    0,
    2.23,
    -0.054,
    'console/racing-demo',
    () => {},
  );
  const paintRace = (t: number) => {
    const ctx = tv.canvas.getContext('2d')!,
      w = 640,
      h = tv.canvas.height;
    ctx.fillStyle = '#6a895f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#849e71';
    for (let i = 0; i < 18; i++) {
      const y = ((i * 81 + t * 32) % (h + 80)) - 40;
      ctx.fillRect(i % 2 ? 550 : 40, y, 50, 48);
    }
    ctx.fillStyle = '#4b5651';
    ctx.fillRect(170, 0, 300, h);
    ctx.fillStyle = '#e7dec2';
    for (let i = 0; i < 9; i++) {
      const y = ((i * 72 + t * 65) % (h + 72)) - 36;
      ctx.fillRect(316, y, 8, 32);
      ctx.fillRect(177, y, 5, 37);
      ctx.fillRect(457, y, 5, 37);
    }
    for (let i = 0; i < 3; i++) {
      const x = 228 + i * 74,
        y = (i * 123 + t * (i === 1 ? 22 : 12)) % h;
      ctx.fillStyle = ['#c77655', '#adc9b9', '#d0af65'][i];
      ctx.fillRect(x - 15, y - 26, 30, 52);
      ctx.fillStyle = '#263b34';
      ctx.fillRect(x - 10, y - 13, 20, 18);
      for (const side of [-1, 1])
        ctx.fillRect(x + side * 18 - 3, y - 17, 6, 13);
    }
    ctx.fillStyle = '#efe5c8';
    ctx.font = '16px monospace';
    ctx.fillText('SUNDAY DRIVE  /  DEMO', 18, h - 15);
    tv.texture.needsUpdate = true;
  };
  paintRace(0);
  function controller(p: T.Object3D, x: number, y: number, z: number, s = 1) {
    const g = group(p, x, y, z);
    g.scale.setScalar(s);
    box(g, 0.35, 0.075, 0.17, 0, 0, 0, ivory, 0.05);
    for (const side of [-1, 1]) {
      const grip = ball(g, 0.09, side * 0.13, -0.012, 0.08, ivory);
      grip.scale.set(0.8, 0.5, 1.3);
      cyl(g, 0.035, 0.035, 0.025, side * 0.076, 0.053, 0.047, charcoal);
    }
    for (let i = 0; i < 4; i++)
      cyl(
        g,
        0.012,
        0.012,
        0.012,
        0.109 + Math.sin((i * Math.PI) / 2) * 0.029,
        0.045,
        -0.021 + Math.cos((i * Math.PI) / 2) * 0.029,
        [forest, rust, gold, forest][i],
      );
    box(g, 0.055, 0.012, 0.016, -0.1, 0.047, -0.029, charcoal);
    box(g, 0.016, 0.012, 0.055, -0.1, 0.047, -0.029, charcoal);
    return g;
  }
  box(media, 0.47, 0.055, 0.27, 0.67, 0.95, 0.07, forest);
  controller(media, 0.67, 1.01, 0.07);
  controller(media, 1.28, 0.99, 0.1, 0.8);
  // An open case with an exposed cartridge and illustrated inside cover.
  const openCase = group(media, -1.24, 0.947, 0.06);
  box(openCase, 0.33, 0.024, 0.36, 0, 0, 0, forest);
  box(openCase, 0.16, 0.021, 0.15, 0, 0.025, 0, charcoal);
  const lid = group(openCase, -0.17, 0, 0);
  lid.rotation.z = 0.45;
  box(lid, 0.33, 0.025, 0.36, -0.165, 0, 0, forest);
  box(lid, 0.28, 0.004, 0.3, -0.165, 0.015, 0, ivory);
  const sofa = group(root, f.sofa.x, 0, f.sofa.z);
  sofa.rotation.y = Math.PI / 2;
  box(sofa, 2.85, 0.19, 1.2, 0, 0.38, 0, oak, 0.05);
  for (const x of [-1.22, 1.22])
    for (const z of [-0.44, 0.44])
      cyl(sofa, 0.035, 0.045, 0.19, x, 0.185, z, oak);
  box(sofa, 2.64, 0.7, 0.22, 0, 0.87, -0.46, cloth, 0.1);
  for (const x of [-1.32, 1.32])
    box(sofa, 0.24, 0.65, 1.2, x, 0.74, 0, cloth, 0.1);
  for (const x of [-0.65, 0.65]) {
    box(sofa, 1.19, 0.23, 0.96, x, 0.595, 0.04, cloth, 0.1);
    const back = box(sofa, 1.16, 0.5, 0.19, x, 0.94, -0.29, cloth, 0.075);
    back.rotation.x = -0.1;
  }
  const pillow = box(
    sofa,
    0.43,
    0.43,
    0.16,
    -0.76,
    0.93,
    -0.15,
    cushionCloth,
    0.1,
  );
  pillow.rotation.z = 0.22;
  // Continuous fabric drapes over the south arm, with fringe strands.
  const throwG = group(sofa, -1.32, 1.085, 0);
  throwG.rotation.y = -Math.PI / 2;
  const throwMesh = mesh(
    throwG,
    drapedLinen(0.7, 0.24, 0.64, true),
    throwCloth,
  );
  throwMesh.name = 'Sofa arm / draped blanket';
  for (let i = 0; i < 13; i++)
    rod(
      sofa,
      [-1.5, 0.46, -0.3 + i * 0.05],
      [-1.5 + Math.sin(i) * 0.012, 0.39, -0.3 + i * 0.05],
      0.006,
      throwCloth,
    );
  box(root, 2.76, 0.021, 4.02, 2.55, 0.095, 0.15, throwCloth, 0.035);
  for (const x of [1.26, 3.84])
    box(root, 0.015, 0.004, 3.87, x, 0.108, 0.15, sage, 0);
  const side = group(root, f.sideTable.x, 0, f.sideTable.z);
  cyl(side, 0.35, 0.35, 0.075, 0, 0.69, 0, oak);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094;
    rod(
      side,
      [Math.cos(a) * 0.26, 0.08, Math.sin(a) * 0.26],
      [Math.cos(a) * 0.2, 0.65, Math.sin(a) * 0.2],
      0.03,
      oak,
    );
  }
  controller(side, -0.07, 0.76, 0.12, 0.8);
  mesh(
    side,
    new T.SphereGeometry(
      0.14,
      20,
      10,
      0,
      Math.PI * 2,
      Math.PI / 2,
      Math.PI / 2,
    ),
    ivory,
    0.11,
    0.8,
    -0.11,
  );
  for (let i = 0; i < 15; i++)
    ball(
      side,
      0.026,
      0.11 + Math.sin(i * 2.4) * (0.02 + i * 0.004),
      0.814 + (i % 3) * 0.013,
      -0.11 + Math.cos(i * 2.4) * (0.02 + i * 0.004),
      gold,
    );
  // Headphones hang where the controllers are used, including the coiled cable.
  const headphones = group(root, 4.28, 2.15, 2.31);
  headphones.rotation.y = -Math.PI / 2;
  rod(headphones, [0, 0.2, -0.04], [0, 0.2, 0.1], 0.024, brass);
  tube(
    headphones,
    [
      [-0.15, -0.04, 0],
      [-0.17, 0.2, 0],
      [0, 0.3, 0],
      [0.17, 0.2, 0],
      [0.15, -0.04, 0],
    ],
    0.03,
    charcoal,
  );
  for (const x of [-0.15, 0.15])
    box(headphones, 0.095, 0.2, 0.13, x, -0.025, 0, charcoal, 0.04);
  tube(
    headphones,
    [
      [-0.15, -0.1, 0],
      [-0.14, -0.48, 0.03],
      [0.12, -0.7, 0],
      [0.2, -0.48, 0],
      [0.03, -0.42, 0.01],
      [-0.05, -0.67, 0.01],
    ],
    0.007,
    charcoal,
  );
  // Collection shelf, handhelds, labeled cartridges, board game boxes, woven baskets and brass gears.
  const shelf = object('gameCollection', f.collection.x, f.collection.z);
  for (const x of [-1.16, 1.16]) box(shelf, 0.075, 2.65, 0.59, x, 1.41, 0, oak);
  box(shelf, 2.27, 2.52, 0.035, 0, 1.41, -0.275, darkWood);
  for (const y of [0.16, 0.76, 1.36, 1.96, 2.66])
    box(shelf, 2.4, 0.075, 0.62, 0, y, 0, oak);
  for (const x of [-0.58, 0.58]) {
    box(shelf, 0.96, 0.43, 0.44, x, 0.415, 0.035, ivory, 0.045);
    for (let j = 0; j < 12; j++)
      box(
        shelf,
        0.018,
        0.36,
        0.013,
        x - 0.43 + j * 0.078,
        0.42,
        0.263,
        paleWood,
        0.003,
      );
    for (let j = 0; j < 5; j++)
      box(
        shelf,
        0.9,
        0.012,
        0.016,
        x,
        0.26 + j * 0.075,
        0.271,
        paleWood,
        0.003,
      );
    box(shelf, 0.22, 0.045, 0.018, x, 0.53, 0.285, darkWood);
  }
  for (let j = 0; j < 4; j++) {
    box(
      shelf,
      0.98,
      0.11,
      0.44,
      -0.59,
      0.858 + j * 0.115,
      0.01,
      [forest, rust, sage, ivory][j],
    );
    label(
      shelf,
      ['GO / 五子', 'GARDEN', 'MEMORY', 'BOARD CLUB'][j],
      0.72,
      -0.59,
      0.858 + j * 0.115,
      0.237,
    );
  }
  for (let j = 0; j < 7; j++) {
    box(
      shelf,
      0.12,
      0.36,
      0.31,
      0.18 + j * 0.126,
      0.98,
      0.04,
      [sage, ivory, forest][j % 3],
    );
    box(shelf, 0.061, 0.1, 0.008, 0.18 + j * 0.126, 1.05, 0.2, rust);
  }
  for (const x of [-0.78, 0, 0.73]) {
    const handheld = group(shelf, x, 1.65, 0.07);
    handheld.rotation.x = -0.15;
    box(handheld, 0.3, 0.48, 0.067, 0, 0, 0, ivory, 0.035);
    box(handheld, 0.22, 0.22, 0.013, 0, 0.06, 0.04, charcoal);
    box(handheld, 0.18, 0.17, 0.005, 0, 0.07, 0.048, sage);
    box(handheld, 0.07, 0.019, 0.015, -0.061, -0.109, 0.043, charcoal);
    box(handheld, 0.019, 0.07, 0.015, -0.061, -0.109, 0.043, charcoal);
    for (const side of [-1, 1])
      ball(
        handheld,
        0.018,
        0.058 + side * 0.025,
        -0.109 + side * 0.018,
        0.041,
        rust,
      );
  }
  for (let j = 0; j < 4; j++)
    box(
      shelf,
      0.34,
      0.07,
      0.37,
      -0.8,
      2.04 + j * 0.079,
      0,
      [ivory, sage, rust, forest][j],
    );
  const gears: T.Group[] = [];
  for (const [x, y, r] of [
    [-0.27, 2.29, 0.2],
    [0.09, 2.34, 0.15],
    [0.36, 2.24, 0.12],
  ]) {
    const gear = group(shelf, x, y, 0.08, 'collection/turning-gear');
    gears.push(gear);
    const ring = mesh(gear, new T.TorusGeometry(r, 0.025, 8, 32), brass);
    ring.userData.independent = true;
    for (let j = 0; j < 12; j++) {
      const a = (j * Math.PI) / 6;
      const tooth = box(
        gear,
        0.062,
        0.064,
        0.042,
        Math.cos(a) * r,
        Math.sin(a) * r,
        0,
        brass,
      );
      tooth.rotation.z = a;
    }
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 3;
      rod(gear, [0, 0, 0], [Math.cos(a) * r, Math.sin(a) * r, 0], 0.016, brass);
    }
    ball(gear, 0.035, 0, 0, 0.012, steel);
  }
  plant(root, 3.37, 0, -2.65, 0.95);
  plant(shelf, -0.75, 2.7, -0.02, 0.55);
  // Small trailing leaves reach down beside the handheld shelf.
  tube(
    shelf,
    [
      [-1.03, 2.9, 0.02],
      [-1.27, 2.6, 0.1],
      [-1.29, 2.14, 0.15],
      [-1.23, 1.72, 0.12],
    ],
    0.008,
    forest,
  );
  for (let i = 0; i < 10; i++) {
    const l = ball(
      shelf,
      0.066,
      -1.25 + (i % 2 ? 0.07 : -0.055),
      2.69 - i * 0.1,
      0.15,
      leaf,
    );
    l.scale.set(0.65, 1, 0.22);
    l.rotation.z = i % 2 ? 0.7 : -0.6;
  }
  const trophies: Record<string, T.Group> = {};
  for (const [i, id] of (['blocks', 'snake', 'gomoku'] as const).entries()) {
    const p = id === 'gomoku' ? shelf : media;
    const award = group(
      p,
      id === 'gomoku' ? 0.85 : -0.38 + i * 0.43,
      id === 'gomoku' ? 2.01 : 0.92,
      id === 'gomoku' ? 0.1 : 0.07,
      `reward/${id}`,
    );
    trophies[id] = award;
    box(award, 0.22, 0.07, 0.19, 0, 0.04, 0, darkWood);
    cyl(award, 0.029, 0.045, 0.15, 0, 0.145, 0, brass);
    if (id === 'gomoku') {
      const medal = cyl(award, 0.11, 0.11, 0.035, 0, 0.28, 0, gold);
      medal.rotation.x = Math.PI / 2;
      ball(award, 0.035, 0, 0.28, 0.025, forest);
    } else {
      cyl(award, 0.115, 0.04, 0.15, 0, 0.28, 0, gold);
      for (const side of [-1, 1]) {
        const handle = mesh(
          award,
          new T.TorusGeometry(0.061, 0.012, 7, 20),
          brass,
          side * 0.1,
          0.29,
          0,
        );
        handle.scale.x = 0.7;
      }
    }
    award.visible = false;
  }
  function setRecords(records: GameRecords) {
    for (const id of ['blocks', 'snake', 'gomoku'] as const)
      trophies[id].visible = records[id].wins > 0;
  }
  setRecords(readGameRecords());
  // Corridor uses the same floor and 1.4-unit portals. Future bays are outlines, not occupied rooms.
  box(corridor, 2, 0.4, 21.6, 0, -0.23, 0, paleWood, 0.035);
  addOakFloor(corridor, 1.92, 21.5, k.floorMaterials);
  for (let z = -9.3; z < 10; z += 2.9) {
    box(corridor, 0.045, 0.012, 0.5, 0, 0.094, z, brass);
    const arrow = box(
      corridor,
      0.045,
      0.012,
      0.2,
      -0.065,
      0.094,
      z - 0.2,
      brass,
    );
    arrow.rotation.y = 0.7;
  }
  // The east wall is supplied by the gaming room and the removable reservation panels.
  wall(corridor, 2, 0, 10.71, Math.PI, 'corridor');
  for (const [id, x, z, yaw, text] of [
    ['corridorGameDoor', 1, 9.2, -Math.PI / 2, '06  游戏房 →'],
    ['corridorCafeDoor', -1, 10.95, Math.PI / 2, '05  咖啡厅 →'],
    ['corridorGalleryDoor', -1, 9.2, Math.PI / 2, '04  展示区 →'],
  ] as const) {
    const portal = group(corridor, x, 0, z - rooms.corridor.z, id);
    portal.rotation.y = yaw;
    portal.userData.id = id;
    k.groups.set(id, portal);
    k.interactables.push(portal);
    label(portal, text, 1.25, 0, 2.35, 0.09);
    box(portal, 1.36, 0.025, 0.22, 0, 0.098, 0, paleWood);
  }
  const corridorNorth = group(corridor, 0, 0, -10.71);
  for (const x of [-0.86, 0.86])
    box(corridorNorth, 0.12, 2.8, 0.16, x, 1.48, 0, oak);
  box(corridorNorth, 1.82, 0.12, 0.2, 0, 2.92, 0, oak);
  label(corridorNorth, 'N · 下一段旅程', 1.65, 0, 2.55, 0.08);
  const reservation = new T.Group();
  reservation.name = 'Future expansion footprints';
  k.scene.add(reservation);
  for (const bay of expansionReservations) {
    wall(
      corridor,
      bay.depth,
      1,
      bay.z - rooms.corridor.z,
      -Math.PI / 2,
      'corridor',
    );
    const positions: number[] = [];
    const x0 = bay.x - bay.width / 2,
      x1 = bay.x + bay.width / 2,
      z0 = bay.z - bay.depth / 2,
      z1 = bay.z + bay.depth / 2;
    for (const [a, b] of [
      [
        [x0, z0],
        [x1, z0],
      ],
      [
        [x1, z0],
        [x1, z1],
      ],
      [
        [x1, z1],
        [x0, z1],
      ],
      [
        [x0, z1],
        [x0, z0],
      ],
    ])
      positions.push(a[0], 0.09, a[1], b[0], 0.09, b[1]);
    const gm = new T.BufferGeometry();
    gm.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    const lm = new T.LineDashedMaterial({
      color: '#9caa91',
      dashSize: 0.28,
      gapSize: 0.2,
      transparent: true,
      opacity: 0.65,
    });
    k.materials.push(lm);
    const outline = new T.LineSegments(gm, lm);
    outline.computeLineDistances();
    reservation.add(outline);
    const sign = label(reservation, bay.name, 4, bay.x, 0.13, bay.z);
    sign.panel.rotation.x = -Math.PI / 2;
    // Removable infill at the future individual door locations.
    const infill = group(corridor, 1, 0, bay.doorZ - rooms.corridor.z);
    infill.rotation.y = -Math.PI / 2;
    box(infill, 1.4, 0.65, 0.08, 0, 0.42, 0, sage);
    for (const x of [-0.75, 0.75])
      box(infill, 0.09, 2.7, 0.16, x, 1.43, 0, oak);
    box(infill, 1.6, 0.1, 0.18, 0, 2.81, 0, oak);
    label(infill, 'FUTURE ROOM', 1.2, 0, 1.55, 0.05);
    k.cutaways.add([infill], { x: 14, z: bay.doorZ, nx: -1, nz: 0 }, [
      'corridor',
    ]);
  }
  const light = new T.PointLight('#ffe2ab', 8, 13, 1.8);
  light.position.set(0, 3.22, 0.2);
  root.add(light);
  let lamp = true;
  const ceiling = group(root, 2.8, 3.58, -2.5);
  cyl(ceiling, 0.49, 0.58, 0.15, 0, 0, 0, ivory);
  cyl(ceiling, 0.5, 0.5, 0.015, 0, -0.09, 0, gold);
  const hallLight = new T.PointLight('#ffe5bd', 5, 19, 1.7);
  hallLight.position.set(0, 3.1, 1);
  corridor.add(hallLight);
  // Batch decorative siblings, while interactive controls, displays, flippers and stones keep identity.
  function batch(p: T.Object3D) {
    for (const c of p.children) if (c instanceof T.Group) batch(c);
    const bins = new Map<T.Material, T.Mesh[]>();
    for (const c of p.children)
      if (
        c instanceof T.Mesh &&
        !c.userData.independent &&
        !Array.isArray(c.material) &&
        c.material !== glass
      ) {
        const list = bins.get(c.material) || [];
        list.push(c);
        bins.set(c.material, list);
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
  batch(root);
  batch(corridor);
  const live = new Set<string>();
  let lastFrame = -1,
    now = 0,
    pinStart = -100,
    focused = false,
    currentView: HouseView = 'study';
  const curve = new T.CatmullRomCurve3(
    path.map((v) => new T.Vector3(v[0], v[1], v[2])),
  );
  return {
    snapshot() {
      return {
        stones: stones.filter((s) => s.visible).length,
        trophies: Object.entries(trophies)
          .filter(([, g]) => g.visible)
          .map(([id]) => id),
        screens: Object.keys(displays),
        live: [...live],
        independentButtons: buttons.length,
        independentJoysticks: sticks.length,
        independentFlippers: flippers.length,
        ball: silverBall.position.toArray(),
        gears: gears.map((g) => g.rotation.z),
      };
    },
    setGameScreen(id: 'blocks' | 'snake', source: HTMLCanvasElement | null) {
      if (source) {
        live.add(id);
        const d = displays[id];
        d.canvas
          .getContext('2d')!
          .drawImage(source, 0, 0, d.canvas.width, d.canvas.height);
        d.texture.needsUpdate = true;
      } else live.delete(id);
    },
    setGameBoard: setBoard,
    setGameRecords: setRecords,
    setView(view: HouseView) {
      currentView = view;
      reservation.visible = view === 'plan';
      ceiling.visible = view !== 'plan';
    },
    setFocus(id: ObjectId | null) {
      focused = !!id;
      ceiling.visible = !focused && currentView !== 'plan';
    },
    setLamp(on: boolean) {
      lamp = on;
    },
    interact(id: ObjectId) {
      if (id === 'gamePinball') pinStart = now;
    },
    update(t: number, dt: number, reduced: boolean, night: boolean) {
      now = t;
      light.intensity = T.MathUtils.lerp(
        light.intensity,
        lamp ? (night ? 12 : 8) : 0,
        1 - Math.exp(-dt * 4),
      );
      hallLight.intensity = lamp ? 5 : 0;
      if (!root.visible) return;
      if (!reduced) {
        gears.forEach((g, i) => (g.rotation.z = t * (i % 2 ? -0.18 : 0.13)));
        sticks.forEach((g, i) => {
          g.rotation.z = Math.sin(t * 2 + i) * 0.12;
          g.rotation.x = Math.cos(t * 1.5 + i) * 0.09;
        });
        buttons.forEach(
          (b, i) =>
            (b.position.y = 0.093 - (Math.floor(t * 3) % 12 === i ? 0.009 : 0)),
        );
      }
      if (Math.floor(t * 6) !== lastFrame) {
        lastFrame = Math.floor(t * 6);
        if (!reduced) paintRace(t);
        for (const id of ['blocks', 'snake'] as const) {
          if (live.has(id)) continue;
          const demo = createArcade(id, () => 0.3),
            phase = reduced ? 4 : Math.floor(t * 2) % 12;
          if (id === 'blocks') {
            demo.y = phase;
            demo.x = (phase % 4) + 2;
            for (let y = 14; y < 18; y++)
              for (let x = 0; x < 10; x++)
                demo.board[y][x] = (x + y) % 4 ? ((x + y) % 7) + 1 : 0;
          } else {
            demo.snake = Array.from(
              { length: 9 },
              (_, i) =>
                [3 + ((phase + i) % 10), 5 + Math.floor((phase + i) / 10)] as [
                  number,
                  number,
                ],
            );
            demo.food = [11, 11];
          }
          paintArcade(displays[id].canvas.getContext('2d')!, demo, true);
          displays[id].texture.needsUpdate = true;
        }
      }
      if (!reduced && t - pinStart > 26) pinStart = t;
      const elapsed = t - pinStart;
      const run = elapsed >= 0 && elapsed < 7 && (!reduced || pinStart > 0);
      if (run) {
        silverBall.position.copy(curve.getPointAt(Math.min(1, elapsed / 7)));
        flippers.forEach(
          (g, i) => (g.rotation.y = Math.sin(elapsed * 7 + i) * 0.35),
        );
        spring.position.z =
          1.025 -
          (elapsed < 0.4 ? Math.sin((elapsed / 0.4) * Math.PI) * 0.09 : 0);
      } else {
        silverBall.position.set(0.44, 0.12, 0.8);
        flippers.forEach((g) => (g.rotation.y = 0));
      }
      if (run && Math.floor(elapsed * 4) !== Math.floor((elapsed - dt) * 4)) {
        const ctx = pinScore.canvas.getContext('2d')!;
        ctx.fillStyle = '#20392e';
        ctx.fillRect(0, 0, 640, ctx.canvas.height);
        ctx.fillStyle = '#dbc68f';
        ctx.font = '49px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `FOREST / ${String(Math.floor(elapsed * 120)).padStart(4, '0')}`,
          320,
          ctx.canvas.height * 0.65,
        );
        pinScore.texture.needsUpdate = true;
      }
    },
    dispose() {
      reservation.removeFromParent();
      reservation.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.LineSegments)
          o.geometry.dispose();
      });
    },
  };
}
