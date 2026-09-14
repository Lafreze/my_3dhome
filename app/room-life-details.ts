import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fitTimberGrain, interiorMaterial } from './house-finishes';
import { localPbr } from './room-materials';
import type { RoomAssets } from './asset-loading';
import type { RoomId } from './house-data';
import type { ObjectId } from './room-data';
import type { WallCutaways } from './wall-cutaway';

/** Small still lifes sit on existing furniture; no new floor obstacles or occupied cushions. */
export function addRoomLifeDetails(k: {
  roots: Record<RoomId, T.Group>;
  groups: Map<ObjectId, T.Group>;
  materials: T.Material[];
  textures: T.Texture[];
  assets: RoomAssets;
  cutaways: WallCutaways;
  oak: T.MeshStandardMaterial;
  brass: T.MeshStandardMaterial;
}) {
  const mat = (color: string, roughness = 0.65, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    k.materials.push(m);
    return m;
  };
  const finish = (
    kind: Parameters<typeof interiorMaterial>[0],
    color: string,
  ) => interiorMaterial(kind, color, k.materials, k.textures);
  const ivory = finish('glaze', '#e5dbca'),
    paper = mat('#e9dec5', 0.92),
    ink = mat('#344640'),
    rust = finish('clay', '#b57b63'),
    amber = mat('#ae7539', 0.24),
    sage = finish('glaze', '#8b9690'),
    blue = finish('glaze', '#7b909b'),
    gold = k.brass,
    wood = k.oak;
  const cloth = mat('#fff8e6', 0.92);
  Object.assign(
    cloth,
    localPbr(k.assets, k.textures, 'book_pattern', new T.Vector2(1.7, 1.7)),
  );
  cloth.normalScale.set(0.24, 0.24);
  cloth.name = 'CC0 / Poly Haven Book Pattern / woven bookcloth';
  const mesh = (
    p: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    fitTimberGrain(g, m);
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    p.add(o);
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
  ) =>
    mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.018, h / 3, d / 4, w / 4)),
      m,
      x,
      y,
      z,
    );
  const cyl = (
    p: T.Object3D,
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => mesh(p, new T.CylinderGeometry(r, r, h, 24), m, x, y, z);
  const ring = (
    p: T.Object3D,
    r: number,
    t: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => {
    const o = mesh(p, new T.TorusGeometry(r, t, 6, 28), m, x, y, z);
    o.rotation.x = -Math.PI / 2;
    return o;
  };
  const sphere = (
    p: T.Object3D,
    r: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => mesh(p, new T.SphereGeometry(r, 16, 10), m, x, y, z);
  const stills: T.Group[] = [];
  const group = (
    p: T.Object3D,
    name: string,
    x: number,
    y: number,
    z: number,
    yaw = 0,
  ) => {
    const g = new T.Group();
    g.name = name;
    g.userData.roomDetail = name;
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    p.add(g);
    stills.push(g);
    return g;
  };
  const vessel = (
    p: T.Object3D,
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => {
    const profile = [
      [0, 0],
      [0.7, 0],
      [0.92, 0.13],
      [1, 0.6],
      [0.78, 0.84],
      [0.68, 1],
      [0.55, 1],
      [0.62, 0.84],
      [0.84, 0.6],
      [0.73, 0.16],
      [0, 0.16],
    ];
    return mesh(
      p,
      new T.LatheGeometry(
        profile.map(([a, b]) => new T.Vector2(a * r, b * h)),
        24,
      ),
      m,
      x,
      y,
      z,
    );
  };
  const card = (
    p: T.Object3D,
    title: string,
    subtitle: string,
    color: string,
    w: number,
    d: number,
    x: number,
    y: number,
    z: number,
    yaw = 0,
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 256;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#eee2c8';
    c.fillRect(0, 0, 384, 256);
    c.strokeStyle = color;
    c.lineWidth = 4;
    c.strokeRect(14, 14, 356, 228);
    c.fillStyle = color;
    c.font = 'bold 28px serif';
    c.fillText(title, 32, 65);
    c.font = '16px monospace';
    c.fillText(subtitle, 32, 98);
    c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(32, 140 + i * 20);
      c.lineTo(320 - i * 18, 140 + i * 20);
      c.stroke();
    }
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 8;
    k.textures.push(tex);
    const m = mat('#ffffff', 0.94);
    m.map = tex;
    const o = mesh(p, new T.PlaneGeometry(w, d), m, x, y, z);
    o.rotation.set(-Math.PI / 2, 0, yaw);
    o.castShadow = false;
  };

  // Study: archive box, an architect's rolled drawing and a small mechanical model.
  const archive = group(
    k.groups.get('shelf')!,
    'Study / drafting archive',
    -0.02,
    2.922,
    0,
    -0.06,
  );
  box(archive, 0.6, 0.28, 0.39, 0, 0.14, 0, cloth);
  box(archive, 0.63, 0.035, 0.42, 0, 0.293, 0, cloth);
  box(archive, 0.22, 0.08, 0.013, 0, 0.17, 0.205, gold);
  box(archive, 0.17, 0.046, 0.015, 0, 0.17, 0.214, paper);
  const scroll = cyl(archive, 0.05, 0.49, 0.05, 0.371, 0.04, paper);
  scroll.rotation.z = Math.PI / 2;
  const band = ring(archive, 0.052, 0.009, 0.05, 0.371, 0.04, gold);
  band.rotation.z = Math.PI / 2;
  const model = group(
    k.groups.get('shelf')!,
    'Study / small wooden sailboat',
    0.97,
    2.922,
    0.01,
  );
  model.scale.setScalar(0.52);
  const hull = box(model, 0.56, 0.08, 0.2, 0, 0.05, 0, wood);
  hull.rotation.y = -0.12;
  cyl(model, 0.011, 0.32, 0, 0.24, 0, gold);
  const sailGeo = new T.BufferGeometry().setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [0.01, 0.39, 0, 0.01, 0.11, 0, 0.21, 0.11, 0],
      3,
    ),
  );
  sailGeo.computeVertexNormals();
  const sail = ivory.clone();
  sail.side = T.DoubleSide;
  k.materials.push(sail);
  mesh(model, sailGeo, sail);

  // Living room: listening notes below the coffee table and a single glazed bud vase.
  const listening = group(
    k.roots.living,
    'Living / listening journal',
    0.18,
    0.319,
    -1.05,
    0.13,
  );
  box(listening, 0.51, 0.07, 0.35, 0, 0.035, 0, paper);
  box(listening, 0.53, 0.013, 0.37, 0, 0.079, 0, cloth);
  card(
    listening,
    'SIDE B',
    'LISTENING NOTES',
    '#596958',
    0.4,
    0.28,
    0,
    0.087,
    0,
  );
  const vase = group(
    k.roots.living,
    'Living / glazed bud vase',
    1.18,
    0.681,
    -1.3,
  );
  vessel(vase, 0.067, 0.18, 0, 0, 0, blue);
  cyl(vase, 0.005, 0.2, 0, 0.22, 0, sage);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const petal = sphere(
      vase,
      0.026,
      Math.cos(a) * 0.028,
      0.329,
      Math.sin(a) * 0.028,
      rust,
    );
    petal.scale.y = 0.5;
  }
  sphere(vase, 0.014, 0, 0.34, 0, gold);

  // Bedroom: bedside water and an amber reed diffuser, away from lamps and pillows.
  const water = group(
    k.roots.bedroom,
    'Bedroom / bedside water',
    1.29,
    0.743,
    -1.7,
  );
  cyl(water, 0.088, 0.012, 0, 0.006, 0, wood);
  vessel(water, 0.058, 0.14, 0, 0.012, 0, sage);
  const diffuser = group(
    k.roots.bedroom,
    'Bedroom / reed diffuser',
    -2.32,
    0.743,
    -2.17,
  );
  vessel(diffuser, 0.065, 0.12, 0, 0, 0, amber);
  for (let i = 0; i < 5; i++) {
    const reed = cyl(diffuser, 0.003, 0.23, (i - 2) * 0.008, 0.2, 0, wood);
    reed.rotation.z = (i - 2) * 0.1;
  }

  // Exhibition leaflets are attached to the plinth faces, outside rotating displays.
  const leaflet = group(
    k.groups.get('galleryCase')!,
    'Gallery / exhibition leaflet pocket',
    0,
    0.52,
    0.595,
  );
  box(leaflet, 0.35, 0.21, 0.04, 0, 0, 0, wood);
  for (let i = 0; i < 3; i++) {
    const sheet = box(
      leaflet,
      0.29,
      0.22,
      0.008,
      (i - 1) * 0.013,
      0.06,
      0.025 + i * 0.012,
      paper,
    );
    sheet.rotation.z = (i - 1) * 0.025;
  }
  const label = group(leaflet, 'Gallery / edition card', 0, 0.11, 0.066);
  label.rotation.x = Math.PI / 2;
  card(
    label,
    'EDITION 03',
    'OBJECTS & STORIES',
    '#877056',
    0.25,
    0.16,
    0,
    0,
    0,
  );

  // Cafe: an order bell with a handwritten receipt pad on the free end of the counter.
  const orders = group(
    k.roots.cafe,
    'Cafe / order bell and receipts',
    -7.07,
    1.552,
    -0.76,
  );
  cyl(orders, 0.095, 0.023, 0, 0.012, 0, ink);
  const dome = sphere(orders, 0.077, 0, 0.035, 0, gold);
  dome.scale.y = 0.62;
  cyl(orders, 0.015, 0.026, 0, 0.09, 0, gold);
  cyl(orders, 0.034, 0.009, 0, 0.108, 0, gold);
  box(orders, 0.18, 0.026, 0.23, 0.25, 0.013, 0, paper);
  card(
    orders,
    'ORDER',
    '027  /  FILTER',
    '#896142',
    0.17,
    0.215,
    0.25,
    0.028,
    0,
    -0.05,
  );
  const pencil = cyl(orders, 0.008, 0.19, 0.38, 0.012, 0.015, wood);
  pencil.rotation.z = Math.PI / 2;
  pencil.rotation.y = 0.17;

  // Game cabinet: a portable console pouch, cartridges and a spare charging cable.
  const games = group(
    k.groups.get('gameConsole')!,
    'Gaming / cartridge travel kit',
    -1.42,
    0.915,
    0.08,
    0.08,
  );
  box(games, 0.47, 0.075, 0.25, 0, 0.038, 0, cloth);
  for (let i = 0; i < 2; i++) {
    box(
      games,
      0.1,
      0.021,
      0.13,
      0.09 + i * 0.12,
      0.091,
      -0.025,
      [rust, blue][i],
    );
    box(games, 0.072, 0.003, 0.052, 0.09 + i * 0.12, 0.103, -0.04, paper);
    for (let j = 0; j < 4; j++)
      box(
        games,
        0.007,
        0.003,
        0.015,
        0.055 + i * 0.12 + j * 0.021,
        0.103,
        0.021,
        gold,
      );
  }
  ring(games, 0.055, 0.005, -0.13, 0.089, 0, ink);
  box(games, 0.023, 0.016, 0.029, -0.075, 0.092, 0.04, ink);

  // Bar: citrus prep on the short return, leaving all four stools and the mixing spot free.
  const citrus = group(
    k.roots.bar,
    'Bar / citrus preparation',
    -3.96,
    1.59,
    -2.65,
    -0.12,
  );
  box(citrus, 0.48, 0.025, 0.39, 0, 0.013, 0, wood);
  for (let i = 0; i < 2; i++) {
    cyl(citrus, 0.072, 0.015, -0.1 + i * 0.17, 0.035, -0.035, rust);
    cyl(citrus, 0.06, 0.017, -0.1 + i * 0.17, 0.037, -0.035, ivory);
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 3;
      const pulp = box(
        citrus,
        0.045,
        0.018,
        0.026,
        -0.1 + i * 0.17 + Math.sin(a) * 0.026,
        0.044,
        -0.035 + Math.cos(a) * 0.026,
        amber,
      );
      pulp.rotation.y = a;
    }
  }
  box(citrus, 0.17, 0.009, 0.021, 0.015, 0.037, 0.118, gold);
  box(citrus, 0.085, 0.018, 0.035, 0.136, 0.042, 0.118, ink);
  const peel = mesh(
    citrus,
    new T.TorusGeometry(0.085, 0.009, 6, 26, Math.PI * 1.6),
    rust,
    0.12,
    0.054,
    -0.12,
  );
  peel.rotation.x = -Math.PI / 2;

  // Library: inkwell, blotting cloth and a small dated borrowing card beside the open book.
  const writing = group(
    k.groups.get('libraryDesk')!,
    'Library / writing implements',
    -0.99,
    1.27,
    0.32,
    0.06,
  );
  box(writing, 0.32, 0.018, 0.32, 0, 0.009, 0, cloth);
  box(writing, 0.09, 0.085, 0.09, -0.073, 0.061, -0.06, blue);
  cyl(writing, 0.034, 0.022, -0.073, 0.112, -0.06, gold);
  card(
    writing,
    'EX LIBRIS',
    'READ & RETURN',
    '#536754',
    0.17,
    0.23,
    0.061,
    0.021,
    0.01,
    0.07,
  );
  box(writing, 0.018, 0.003, 0.16, -0.038, 0.023, 0.084, rust);

  // Garden: replace one duplicate empty pot with a fabric seed wallet and distinct packets.
  const seeds = group(
    k.roots.garden,
    'Garden / seed wallet',
    2.94,
    0.28,
    -0.85,
    -Math.PI / 2,
  );
  box(seeds, 0.38, 0.055, 0.29, 0, 0.029, 0, cloth);
  for (let i = 0; i < 2; i++) {
    box(seeds, 0.15, 0.012, 0.2, (i - 0.5) * 0.17, 0.067, i * 0.04, paper);
    card(
      seeds,
      i ? 'VIOLA' : 'COSMOS',
      i ? 'AUTUMN  /  09' : 'SPRING  /  03',
      i ? '#756386' : '#ba735b',
      0.14,
      0.19,
      (i - 0.5) * 0.17,
      0.075,
      i * 0.04,
      i * 0.08,
    );
  }

  // Corridor: shallow letter and key rack, between doorways and above the walking space.
  const post = group(
    k.roots.corridor,
    'Corridor / letters and keys',
    -0.87,
    1.57,
    6.85,
    Math.PI / 2,
  );
  box(post, 0.67, 0.34, 0.048, 0, 0, 0, wood);
  box(post, 0.35, 0.14, 0.09, -0.1, -0.035, 0.059, wood);
  for (let i = 0; i < 2; i++) {
    const envelope = box(
      post,
      0.26,
      0.15,
      0.009,
      -0.11 + i * 0.016,
      0.025,
      0.055 + i * 0.017,
      paper,
    );
    envelope.rotation.z = 0.05 - i * 0.08;
    box(
      post,
      0.042,
      0.03,
      0.002,
      -0.03 + i * 0.016,
      0.075,
      0.062 + i * 0.017,
      i ? blue : rust,
    );
  }
  cyl(post, 0.012, 0.058, 0.23, -0.02, 0.05, gold).rotation.x = Math.PI / 2;
  const keyring = ring(post, 0.031, 0.005, 0.23, -0.06, 0.089, gold);
  keyring.rotation.x = 0;
  box(post, 0.012, 0.082, 0.009, 0.23, -0.121, 0.087, gold);
  box(post, 0.032, 0.015, 0.012, 0.241, -0.152, 0.087, gold);
  k.cutaways.add([post], { x: 12.13, z: 13.15, nx: 1, nz: 0 }, ['corridor']);

  // Merge only decorative siblings. Shared furniture, doors and live devices keep their identities.
  for (const g of stills) {
    const bins = new Map<T.Material, T.Mesh[]>();
    for (const child of g.children)
      if (child instanceof T.Mesh && !Array.isArray(child.material)) {
        const list = bins.get(child.material) || [];
        list.push(child);
        bins.set(child.material, list);
      }
    for (const [m, list] of bins) {
      if (list.length < 3) continue;
      const copies = list.map((o) => {
        o.updateMatrix();
        return (
          o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
        ).applyMatrix4(o.matrix);
      });
      const geometry = mergeGeometries(copies);
      copies.forEach((o) => o.dispose());
      if (!geometry) continue;
      mesh(g, geometry, m);
      for (const o of list) {
        g.remove(o);
        o.geometry.dispose();
      }
    }
  }
}
