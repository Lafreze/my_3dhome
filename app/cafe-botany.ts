import type { InteriorBreeze } from './interior-atmosphere';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cafeFloorPlants } from './cafe-layout';

type BotanyKit = {
  breeze: InteriorBreeze;
  root: T.Group;
  north: T.Group;
  west: T.Group;
  front: T.Group;
  materials: T.Material[];
  textures: T.Texture[];
};
type Leaf = {
  base: T.Vector3;
  direction: T.Vector3;
  length: number;
  width: number;
  roll?: number;
};
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const random = (i: number) =>
  T.MathUtils.euclideanModulo(Math.sin(i * 137.13 + 7.9) * 41731.93, 1);

/** Original café planting. Each installation belongs to its wall's cutaway group. */
export function addCafeBotany({
  breeze,
  root,
  north,
  west,
  front,
  materials,
  textures,
}: BotanyKit) {
  const material = (color: string, roughness = 0.82, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    m.name = `cafe/botany/${color}`;
    materials.push(m);
    return m;
  };
  const terracotta = material('#b16d47'),
    ivory = material('#ddd4bb', 0.6),
    sage = material('#69745a', 0.5);
  const stem = material('#455331'),
    bark = material('#6e5840'),
    soil = material('#322820');
  const brass = material('#8d7447', 0.43, 0.65),
    shelf = material('#68513a'),
    flower = material('#eee1b6', 0.7),
    pollen = material('#c2a04a');
  // Hand-drawn midrib and secondary veins follow a curved, solid leaf silhouette.
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 256, 0);
  gradient.addColorStop(0, '#536835');
  gradient.addColorStop(0.46, '#9ca75c');
  gradient.addColorStop(0.53, '#7e9049');
  gradient.addColorStop(1, '#496039');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 1300; i++) {
    ctx.fillStyle = i % 2 ? '#e6d8a10b' : '#2033160b';
    ctx.fillRect(random(i) * 256, random(i + 42) * 512, 1, 2);
  }
  ctx.strokeStyle = '#e4d29855';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(128, 510);
  ctx.quadraticCurveTo(124, 280, 128, 0);
  ctx.stroke();
  for (let y = 70; y < 480; y += 42) {
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = '#c9ca8160';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(128, y);
      ctx.quadraticCurveTo(128 + side * 46, y - 8, 128 + side * 124, y - 61);
      ctx.stroke();
    }
  }
  const leafMap = new T.CanvasTexture(canvas);
  leafMap.colorSpace = T.SRGBColorSpace;
  leafMap.anisotropy = 8;
  textures.push(leafMap);
  const leafMaterial = material('#ffffff', 0.69);
  leafMaterial.map = leafMap;
  leafMaterial.bumpMap = leafMap;
  leafMaterial.bumpScale = 0.002;
  leafMaterial.side = T.DoubleSide;
  breeze.add(leafMaterial);
  const leafGeo = new T.BufferGeometry(),
    positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= 14; j++) {
    const t = j / 14,
      span = Math.pow(Math.sin(Math.PI * t), 0.72) * (1 - 0.25 * t);
    for (let i = 0; i <= 4; i++) {
      const u = i / 2 - 1;
      positions.push(
        u * span * 0.5,
        t,
        Math.sin(Math.PI * t) * (0.085 + u * u * 0.095),
      );
      uvs.push(i / 4, t);
      if (i < 4 && j < 14) {
        const a = j * 5 + i;
        indices.push(a, a + 1, a + 5, a + 1, a + 6, a + 5);
      }
    }
  }
  leafGeo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  leafGeo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  leafGeo.setIndex(indices);
  leafGeo.computeVertexNormals();
  const installations: T.Group[] = [];
  function group(
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    name: string,
  ) {
    const g = new T.Group();
    g.position.set(x, y, z);
    g.name = name;
    parent.add(g);
    installations.push(g);
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
  ) {
    return mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.012, h / 3)),
      m,
      x,
      y,
      z,
    );
  }
  function branch(
    p: T.Object3D,
    points: T.Vector3[],
    radius = 0.009,
    m: T.Material = stem,
  ) {
    return mesh(
      p,
      new T.TubeGeometry(new T.CatmullRomCurve3(points), 16, radius, 5, false),
      m,
    );
  }
  function foliage(p: T.Object3D, leaves: Leaf[], seed = 0) {
    const inst = new T.InstancedMesh(leafGeo, leafMaterial, leaves.length);
    const dummy = new T.Object3D(),
      up = v(0, 1, 0),
      roll = new T.Quaternion();
    leaves.forEach((l, i) => {
      dummy.position.copy(l.base);
      dummy.quaternion.setFromUnitVectors(up, l.direction.clone().normalize());
      dummy.quaternion.multiply(
        roll.setFromAxisAngle(up, l.roll ?? random(i + seed) * Math.PI * 2),
      );
      dummy.scale.set(l.width, l.length, l.length);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(
        i,
        new T.Color().setHSL(
          0.19 + random(i + seed + 23) * 0.08,
          0.23 + random(i + seed) * 0.17,
          0.52 + random(i + seed + 4) * 0.19,
        ),
      );
    });
    inst.castShadow = inst.receiveShadow = true;
    inst.name = 'curved-veined-leaves';
    inst.computeBoundingSphere();
    p.add(inst);
  }
  function pot(p: T.Object3D, radius: number, height: number, m: T.Material) {
    const profile = [
      [radius * 0.65, 0.022],
      [radius * 0.7, 0.045],
      [radius * 0.88, height * 0.82],
      [radius, height * 0.95],
      [radius, height],
      [radius * 0.91, height * 1.025],
      [radius * 0.86, height * 0.96],
      [radius * 0.77, height * 0.2],
    ];
    mesh(
      p,
      new T.LatheGeometry(
        profile.map(([x, y]) => new T.Vector2(x, y)),
        40,
      ),
      m,
    );
    mesh(
      p,
      new T.CylinderGeometry(radius * 0.84, radius * 0.84, 0.02, 40),
      soil,
      0,
      height * 0.88,
      0,
    );
    mesh(
      p,
      new T.LatheGeometry(
        [
          [radius * 0.62, 0],
          [radius * 0.98, 0.006],
          [radius, 0.045],
          [radius * 0.94, 0.052],
          [radius * 0.9, 0.021],
          [radius * 0.6, 0.019],
        ].map(([x, y]) => new T.Vector2(x, y)),
        40,
      ),
      m,
    );
    const rim = mesh(
      p,
      new T.TorusGeometry(radius * 0.955, radius * 0.035, 8, 40),
      m,
      0,
      height * 0.99,
      0,
    );
    rim.rotation.x = Math.PI / 2;
    // Small irregular drainage grit remains visible between the stems.
    const grit = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.014, 0),
      shelf,
      18,
    );
    const dummy = new T.Object3D();
    for (let i = 0; i < 18; i++) {
      const a = i * 2.4,
        r = radius * 0.77 * Math.sqrt(random(i + 20));
      dummy.position.set(Math.cos(a) * r, height * 0.92, Math.sin(a) * r);
      dummy.scale.set(1 + random(i), 0.55, 0.7 + random(i + 42));
      dummy.updateMatrix();
      grit.setMatrixAt(i, dummy.matrix);
    }
    grit.castShadow = grit.receiveShadow = true;
    p.add(grit);
  }
  function fern(p: T.Object3D, y: number, spread: number, seed: number) {
    const leaves: Leaf[] = [];
    for (let f = 0; f < 15; f++) {
      const a = f * 2.4 + seed,
        reach = spread * (0.62 + random(f + seed) * 0.38),
        rise = spread * (0.48 + random(f + seed + 5) * 0.46);
      const point = (t: number) =>
        v(
          Math.cos(a) * reach * t,
          y + Math.sin(t * Math.PI * 0.78) * rise,
          Math.sin(a) * reach * t,
        );
      branch(p, [point(0), point(0.33), point(0.67), point(1)], 0.0035);
      for (let n = 1; n < 11; n++)
        for (const side of [-1, 1]) {
          const t = n / 11,
            base = point(t),
            length = spread * 0.27 * Math.sin(t * Math.PI) + 0.028;
          const angle = a + side * 1.06;
          leaves.push({
            base,
            direction: v(Math.cos(angle), 0.24 - t * 0.2, Math.sin(angle)),
            length,
            width: length * 0.28,
            roll: 0.5,
          });
        }
      leaves.push({
        base: point(0.96),
        direction: v(Math.cos(a), -0.4, Math.sin(a)),
        length: spread * 0.15,
        width: spread * 0.04,
      });
    }
    foliage(p, leaves, seed);
  }
  function trailing(p: T.Object3D, y: number, length: number, seed: number) {
    const leaves: Leaf[] = [];
    for (let f = 0; f < 7; f++) {
      const a = f * 0.89 + seed,
        run = length * (0.6 + random(f + seed) * 0.4);
      const point = (t: number) =>
        v(
          Math.cos(a) * (0.035 + 0.12 * t) + Math.sin(t * 8 + f) * 0.028,
          y + 0.05 * Math.sin(t * 5) - run * t * t,
          0.08 + 0.19 * Math.sin(t * 1.9) + Math.sin(a) * 0.09,
        );
      branch(
        p,
        [point(0), point(0.2), point(0.5), point(0.75), point(1)],
        0.004,
      );
      for (let i = 0; i < 12; i++) {
        const t = i / 12;
        leaves.push({
          base: point(t),
          direction: v(i % 2 ? -0.7 : 0.7, 0.18 - t * 0.35, 0.55),
          length: 0.11 + random(i + f) * 0.065,
          width: 0.1 + random(i + f + 3) * 0.04,
          roll: (i % 3) * 0.7,
        });
      }
    }
    for (let i = 0; i < 15; i++)
      leaves.push({
        base: v(0, y, 0),
        direction: v(Math.sin(i * 2.4), 0.5 + random(i), Math.cos(i * 2.4)),
        length: 0.18 + random(i + 3) * 0.09,
        width: 0.13,
      });
    foliage(p, leaves, seed);
  }
  function herb(
    p: T.Object3D,
    y: number,
    height: number,
    seed: number,
    flowers = false,
  ) {
    const leaves: Leaf[] = [];
    const petals: T.Matrix4[] = [],
      centers: T.Vector3[] = [],
      dummy = new T.Object3D();
    for (let i = 0; i < 13; i++) {
      const a = i * 2.4,
        reach = height * 0.42 * (0.3 + random(i + seed)),
        top = v(
          Math.sin(a) * reach,
          y + height * (0.57 + random(i + seed + 42) * 0.43),
          Math.cos(a) * reach,
        );
      const base = v(0, y, 0);
      branch(p, [base, top.clone().lerp(base, 0.45), top], 0.003);
      for (let n = 1; n < 6; n++) {
        const t = n / 6,
          side = n % 2 ? 1 : -1;
        leaves.push({
          base: base.clone().lerp(top, t),
          direction: v(Math.cos(a) * side, 0.4, -Math.sin(a) * side),
          length: height * 0.22,
          width: height * 0.09,
        });
      }
      if (flowers && i % 2 === 0) {
        centers.push(top);
        for (let j = 0; j < 5; j++) {
          const angle = (j * Math.PI * 2) / 5;
          dummy.position
            .copy(top)
            .add(v(Math.sin(angle) * 0.025, 0, Math.cos(angle) * 0.025));
          dummy.rotation.set(
            0.12 * Math.sin(angle),
            angle,
            0.12 * Math.cos(angle),
          );
          dummy.scale.set(0.018, 0.008, 0.031);
          dummy.updateMatrix();
          petals.push(dummy.matrix.clone());
        }
      }
    }
    foliage(p, leaves, seed);
    if (petals.length) {
      const petalMesh = new T.InstancedMesh(
        new T.SphereGeometry(1, 8, 6),
        flower,
        petals.length,
      );
      petals.forEach((m, i) => petalMesh.setMatrixAt(i, m));
      petalMesh.castShadow = true;
      p.add(petalMesh);
      for (const c of centers)
        mesh(
          p,
          new T.SphereGeometry(0.012, 8, 6),
          pollen,
          c.x,
          c.y + 0.009,
          c.z,
        );
    }
  }

  // North shelf occupies the solid wall between the two room doors, away from food preparation.
  const display = group(north, 2.1, 2.39, -3.56, 'botanical-wall-shelf');
  box(display, 4.8, 0.08, 0.43, 0, 0, 0, shelf);
  for (const x of [-1.8, 0, 1.8]) {
    box(display, 0.035, 0.32, 0.035, x, -0.14, -0.24, brass);
    branch(
      display,
      [v(x, -0.27, -0.24), v(x, -0.13, -0.11), v(x, -0.045, 0.16)],
      0.01,
      brass,
    );
  }
  const shelfPots = [
    { x: -2.02, radius: 0.16, h: 0.24, kind: 'vine' },
    { x: -0.95, radius: 0.18, h: 0.26, kind: 'fern' },
    { x: 0.3, radius: 0.15, h: 0.28, kind: 'herb' },
    { x: 1.94, radius: 0.2, h: 0.3, kind: 'vine' },
  ];
  shelfPots.forEach((s, i) => {
    const g = group(display, s.x, 0.045, 0, `shelf-${s.kind}`);
    pot(g, s.radius, s.h, [terracotta, ivory, sage, ivory][i]);
    if (s.kind === 'vine') trailing(g, s.h * 0.9, i === 0 ? 0.72 : 1.04, i + 9);
    else if (s.kind === 'fern') {
      const fronds = group(g, 0, s.h * 0.9, 0, 'shelf-fern-fronds');
      fronds.scale.z = 0.65;
      fern(fronds, 0, 0.32, 2);
    } else herb(g, s.h * 0.9, 0.42, 5, true);
  });
  // A supported corner pot frames the back bar without hanging above the espresso worktop.
  const corner = group(west, -7.63, 2.96, -2.5, 'west-trailing-planter');
  box(corner, 0.43, 0.075, 0.46, 0, 0, 0, shelf);
  box(corner, 0.035, 0.3, 0.035, -0.18, -0.12, 0, brass);
  branch(
    corner,
    [v(-0.18, -0.27, 0), v(-0.08, -0.13, 0), v(0.18, -0.045, 0)],
    0.011,
    brass,
  );
  const hanging = group(corner, 0.025, 0.04, 0, 'corner-pothos');
  hanging.rotation.y = Math.PI / 2;
  pot(hanging, 0.18, 0.25, terracotta);
  trailing(hanging, 0.23, 0.82, 3);

  // Indoor window boxes have brackets below the sill, with planting clear of the entrance.
  for (const [i, x] of [-4.8, 2.4].entries()) {
    const trough = group(front, x, 0.48, 3.58, `window-herbs-${i}`);
    box(trough, 1.55, 0.075, 0.31, 0, 0.035, 0, sage);
    for (const z of [-0.155, 0.155])
      box(trough, 1.59, 0.25, 0.035, 0, 0.145, z, sage);
    for (const side of [-1, 1]) {
      box(trough, 0.035, 0.25, 0.31, side * 0.775, 0.145, 0, sage);
      branch(
        trough,
        [
          v(side * 0.5, -0.22, 0.26),
          v(side * 0.5, -0.02, 0.26),
          v(side * 0.5, -0.02, -0.11),
        ],
        0.013,
        brass,
      );
    }
    box(trough, 1.49, 0.018, 0.27, 0, 0.22, 0, soil);
    for (let j = 0; j < 5; j++) {
      const g = group(trough, -0.6 + j * 0.3, 0, 0, 'window-botanical');
      g.scale.z = 0.6;
      herb(
        g,
        0.22,
        0.26 + random(j + i * 21) * 0.1,
        j + i * 31,
        (i + j) % 2 === 0,
      );
    }
  }

  const fernSpot = cafeFloorPlants.fern;
  const floorFern = group(
    root,
    fernSpot.x,
    0.04,
    fernSpot.z,
    'floor-boston-fern',
  );
  pot(floorFern, fernSpot.width / 2, 0.55, ivory);
  fern(floorFern, 0.5, 0.44, 18);
  const treeSpot = cafeFloorPlants.ficus;
  const tree = group(root, treeSpot.x, 0.04, treeSpot.z, 'floor-ficus');
  pot(tree, treeSpot.width / 2, 0.51, terracotta);
  branch(
    tree,
    [
      v(0, 0.45, 0),
      v(-0.07, 1.13, 0.025),
      v(0.04, 1.83, 0),
      v(-0.04, 2.43, 0.015),
    ],
    0.034,
    bark,
  );
  const treeLeaves: Leaf[] = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4,
      y = 1.33 + i * 0.073,
      radius = 0.22 + Math.sin((i / 14) * Math.PI) * 0.12;
    const start = v(0.01, y, 0),
      end = v(Math.sin(a) * radius, y + 0.22, Math.cos(a) * radius);
    branch(
      tree,
      [
        start,
        start
          .clone()
          .lerp(end, 0.55)
          .add(v(0, 0.04, 0)),
        end,
      ],
      0.007,
      bark,
    );
    for (let j = 0; j < 4; j++) {
      const t = 0.35 + j * 0.2;
      treeLeaves.push({
        base: start.clone().lerp(end, t),
        direction: v(Math.sin(a + j * 0.65), 0.3, Math.cos(a + j * 0.65)),
        length: 0.24 + random(i + j) * 0.09,
        width: 0.14 + random(i + j + 8) * 0.05,
        roll: 0.7,
      });
    }
  }
  foliage(tree, treeLeaves, 31);
  const flowerSpot = cafeFloorPlants.flowers;
  const flowers = group(
    root,
    flowerSpot.x,
    0.04,
    flowerSpot.z,
    'floor-chamomile',
  );
  pot(flowers, flowerSpot.width / 2, 0.34, sage);
  herb(flowers, 0.3, 0.41, 91, true);

  // Batch stems and pottery per installation; leaves remain instanced to keep the room responsive.
  for (const parent of installations.reverse()) {
    const bins = new Map<T.Material, T.Mesh[]>();
    for (const o of parent.children) {
      if (
        !(o instanceof T.Mesh) ||
        o instanceof T.InstancedMesh ||
        Array.isArray(o.material)
      )
        continue;
      const list = bins.get(o.material) || [];
      list.push(o);
      bins.set(o.material, list);
    }
    for (const [m, objects] of bins) {
      if (objects.length < 2) continue;
      const copies = objects.map((o) => {
        o.updateMatrix();
        return (
          o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
        ).applyMatrix4(o.matrix);
      });
      const merged = mergeGeometries(copies);
      copies.forEach((g) => g.dispose());
      if (!merged) continue;
      mesh(parent, merged, m);
      objects.forEach((o) => {
        parent.remove(o);
        o.geometry.dispose();
      });
    }
  }
}
