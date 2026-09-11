import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { environmentLight } from './room-environment';
import type { Environment } from './environment-data';
import type { RoomId } from './house-data';

// One shared landscape for every exterior aperture. North = -Z, east = +X. No independent invented skies.
export const windowViews = {
  garden: {
    bearing: 90,
    name: '东 · 温室外的花园',
    position: [29.72, 2.13, 6.3],
  },
  library: {
    bearing: 0,
    name: '北 · 林间阅读窗',
    position: [17.22, 2.02, -5.5],
  },
  study: { bearing: 0, name: '北 · 水岸花园', position: [1.12, 1.98, -3.28] },
  living: { bearing: 90, name: '东 · 连廊画廊', position: [11.88, 1.98, 0] },
  bedroom: { bearing: 270, name: '西 · 庭院', position: [-3.88, 1.98, 6.8] },
  cafe: { bearing: 180, name: '南 · 咖啡露台', position: [6, 1.98, 18.08] },
  gallery: { bearing: 90, name: '东 · 连廊画廊', position: [11.88, 1.98, 6.8] },
} as const;

export function createHouseLandscape(renderer: T.WebGLRenderer) {
  const scene = new T.Scene();
  const materials: T.Material[] = [],
    textures: T.Texture[] = [];
  const mat = (color: string, roughness = 0.85, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    materials.push(m);
    return m;
  };
  const gravel = mat('#a9aa97'),
    grass = mat('#72836a'),
    stone = mat('#929384'),
    wood = mat('#70624a'),
    bark = mat('#6d6050'),
    roof = mat('#5a6665'),
    plaster = mat('#d7d2be'),
    ivory = mat('#eae3cb'),
    metal = mat('#3f4c49', 0.44, 0.4);
  const leafMats = ['#607959', '#7d8a5b', '#4c6b52', '#9b8d59'].map((c) =>
    mat(c),
  );
  const nightGlass = mat('#61787a', 0.24, 0.25),
    lampGlass = mat('#e9d6a2', 0.3);
  const water = mat('#819d94', 0.18, 0.32);
  const puddle = mat('#b0c0bf', 0.07, 0.35);
  puddle.transparent = true;
  puddle.opacity = 0;
  puddle.depthWrite = false;
  // Fine, stable mineral grain and wood pores complement the interior's PBR materials.
  function grain(m: T.MeshStandardMaterial, color: string, woodgrain = false) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 3800; i++) {
      const x = seed(i + 8) * 128,
        y = seed(i + 100) * 128;
      ctx.fillStyle = i % 2 ? '#ffffff12' : '#182b2015';
      ctx.fillRect(
        x,
        y,
        woodgrain ? 1 : 1.8,
        woodgrain ? 8 + seed(i) * 32 : 1.8,
      );
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.anisotropy = 4;
    textures.push(tex);
    m.map = tex;
  }
  function seed(i: number) {
    const a = Math.sin(i * 127.1 + 23.78) * 43758.5453;
    return a - Math.floor(a);
  }
  grain(gravel, '#c0c0ae');
  grain(wood, '#b8a282', true);
  grain(bark, '#b6a486', true);
  grain(plaster, '#f2edde');
  grain(stone, '#bdbdad');
  const leafGeo = new T.BufferGeometry();
  leafGeo.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [
        0, 0.16, 0, -0.065, 0.035, 0, 0, -0.09, 0, 0.065, 0.035, 0, 0, 0.035,
        0.027,
      ],
      3,
    ),
  );
  leafGeo.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
  leafGeo.computeVertexNormals();
  leafMats.forEach((m) => (m.side = T.DoubleSide));
  const boxGeo = new T.BoxGeometry(1, 1, 1),
    sphereGeo = new T.IcosahedronGeometry(1, 2),
    cylinderGeo = new T.CylinderGeometry(1, 1, 1, 10);
  function mesh(
    p: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = o.receiveShadow = true;
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
  ) => mesh(p, boxGeo, m, x, y, z, w, h, d);
  function rod(
    p: T.Object3D,
    a: number[],
    b: number[],
    radius: number,
    m: T.Material,
  ) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b);
    const o = mesh(
      p,
      cylinderGeo,
      m,
      ...(from.clone().add(to).multiplyScalar(0.5).toArray() as [
        number,
        number,
        number,
      ]),
      radius,
      from.distanceTo(to),
      radius,
    );
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      to.sub(from).normalize(),
    );
    return o;
  }
  function ellipsoid(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    m: T.Material,
  ) {
    return mesh(p, sphereGeo, m, x, y, z, sx, sy, sz);
  }
  const foliage = new Map<T.Material, T.Matrix4[]>();
  const leafDummy = new T.Object3D();
  function leaves(
    center: T.Vector3,
    radius: T.Vector3,
    count: number,
    index: number,
    scale: number,
    autumn = false,
  ) {
    for (let f = 0; f < count; f++) {
      const angle = seed(index * 97 + f) * Math.PI * 2,
        up = seed(index * 193 + f) * 2 - 1,
        r = Math.sqrt(1 - up * up),
        volume = 0.3 + 0.7 * Math.cbrt(seed(index * 31 + f));
      const normal = new T.Vector3(
        Math.cos(angle) * r,
        up,
        Math.sin(angle) * r,
      );
      const offset = normal.clone().multiply(radius).multiplyScalar(volume);
      leafDummy.position.copy(center).add(offset);
      leafDummy.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
      leafDummy.rotateZ(seed(index + f) * Math.PI * 2);
      leafDummy.scale.setScalar(scale * (0.65 + seed(index + f * 5) * 0.65));
      leafDummy.updateMatrix();
      const m = leafMats[autumn ? 3 : (f + index) % 3],
        list = foliage.get(m) || [];
      list.push(leafDummy.matrix.clone());
      foliage.set(m, list);
    }
  }
  function tree(
    x: number,
    z: number,
    size: number,
    index: number,
    autumn = false,
  ) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    rod(g, [0, 0, 0], [0.12 * size, 2.1 * size, 0], 0.09 * size, bark);
    for (let b = 0; b < 5; b++) {
      const angle = b * 2.399 + index,
        reach = (0.6 + seed(index + b)) * size;
      const end = [
        Math.cos(angle) * reach,
        (2.0 + seed(index + 30 + b) * 1.15) * size,
        Math.sin(angle) * reach,
      ];
      rod(g, [0.06 * size, 1.25 * size, 0], end, 0.035 * size, bark);
      for (let j = 0; j < 4; j++) {
        const center = new T.Vector3(
          end[0] + (seed(j + index * 3) - 0.5) * size,
          end[1] + (seed(j + index * 5) - 0.5) * size * 0.55,
          end[2] + (seed(j + index * 7) - 0.5) * size,
        );
        leaves(
          center.add(new T.Vector3(x, 0, z)),
          new T.Vector3(0.54, 0.48, 0.57).multiplyScalar(size),
          150,
          index * 23 + b * 4 + j,
          size,
          autumn,
        );
      }
    }
  }
  function bush(x: number, z: number, size: number, index = 0) {
    for (let j = 0; j < 5; j++)
      leaves(
        new T.Vector3(
          x + (seed(index + j) - 0.5) * size,
          0.24 * size + seed(index + j + 2) * size * 0.18,
          z + (seed(index + j + 4) - 0.5) * size,
        ),
        new T.Vector3(0.38, 0.28, 0.4).multiplyScalar(size),
        95,
        index * 13 + j,
        0.7 * size,
      );
  }

  function fence(
    x: number,
    z: number,
    length: number,
    rotation = 0,
    tall = 1.15,
  ) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotation;
    scene.add(g);
    for (let i = 0; i <= Math.floor(length / 0.18); i++)
      box(g, 0.1, tall, 0.075, -length / 2 + i * 0.18, tall / 2, 0, wood);
    for (const y of [0.23, tall - 0.22])
      box(g, length, 0.08, 0.09, 0, y, 0.07, wood);
    for (let i = 0; i <= Math.ceil(length / 2); i++)
      box(
        g,
        0.14,
        tall + 0.12,
        0.14,
        -length / 2 + Math.min(i * 2, length),
        (tall + 0.12) / 2,
        0,
        wood,
      );
  }
  box(scene, 180, 0.3, 160, 0, -0.24, 0, grass);
  // North is an open waterside garden, with a clear view across a low planting border.
  fence(1, -8.7, 17, 0, 0.6);
  for (const [x, z, size, i] of [
    [-12, -13, 1.1, 11],
    [12, -16, 1.3, 12],
    [-18, -30, 1.7, 13],
    [20, -32, 1.9, 14],
  ])
    tree(x, z, size, i);
  for (let i = 0; i < 5; i++) bush(-4 + i * 2.5, -7.8, 0.55, i + 70);
  const pondStone = mat('#c1b7a0'),
    flowerClay = mat('#ac7663'),
    petals = mat('#d4ac9a');
  // A long reflecting pool with a walkable perimeter and low, rounded stone coping.
  box(scene, 15.6, 0.18, 6.0, 1.5, 0.04, -14.2, pondStone);
  box(scene, 14.9, 0.03, 5.35, 1.5, 0.15, -14.2, water);
  for (const z of [-17.17, -11.23])
    box(scene, 15.7, 0.16, 0.23, 1.5, 0.2, z, ivory);
  for (const x of [-6.22, 9.22])
    box(scene, 0.23, 0.16, 6, x, 0.2, -14.2, ivory);
  const rippleMaterial = mat('#afc2b2', 0.28);
  for (let i = 0; i < 12; i++) {
    const ripple = mesh(
      scene,
      new T.TorusGeometry(0.18 + i * 0.009, 0.008, 4, 32).rotateX(Math.PI / 2),
      rippleMaterial,
      -4.7 + seed(i) * 12,
      0.173,
      -16.1 + seed(i + 21) * 3.9,
    );
    ripple.scale.z = 0.45;
  }
  for (let i = 0; i < 6; i++) {
    const x = -4.5 + i * 2.15;
    box(scene, 0.78, 0.42, 0.68, x, 0.29, -9.5, flowerClay);
    box(scene, 0.7, 0.018, 0.59, x, 0.512, -9.5, bark);
    for (let j = 0; j < 7; j++) {
      const xx = x + (seed(i * 13 + j) - 0.5) * 0.6,
        zz = -9.5 + (seed(i + j * 19) - 0.5) * 0.45,
        h = 0.72 + seed(i + j) * 0.25;
      rod(scene, [xx, 0.51, zz], [xx, h, zz], 0.009, leafMats[1]);
      for (let k = 0; k < 5; k++)
        ellipsoid(
          scene,
          xx + Math.cos(k * 1.256) * 0.047,
          h,
          zz + Math.sin(k * 1.256) * 0.047,
          0.042,
          0.017,
          0.034,
          petals,
        );
    }
  }
  // Far bank: a pale garden pavilion and a low urban roofline, not a wall of trees.
  const pavilion = new T.Group();
  pavilion.position.set(2, 0, -23.5);
  scene.add(pavilion);
  box(pavilion, 6, 0.22, 3.2, 0, 0.15, 0, pondStone);
  for (const x of [-2.7, 2.7])
    for (const z of [-1.3, 1.3])
      box(pavilion, 0.14, 2.7, 0.14, x, 1.55, z, wood);
  box(pavilion, 6.3, 0.13, 3.6, 0, 2.94, 0, roof);
  for (let i = 0; i < 13; i++)
    box(pavilion, 0.08, 0.1, 3.8, -2.9 + i * 0.48, 3.04, 0, wood);
  box(pavilion, 4.9, 0.09, 0.48, 0, 0.64, -1.1, wood);
  for (const x of [-2, 2])
    box(pavilion, 0.12, 0.55, 0.38, x, 0.34, -1.1, metal);
  // Trail behind the studio, edged by individual granite pavers.
  box(scene, 16, 0.04, 1.15, 1, 0.005, -6, gravel);
  for (let i = 0; i < 24; i++)
    box(scene, 0.58, 0.06, 0.14, -6 + i * 0.62, 0.04, -6.64, stone);
  // A small timber garden store seen to the north-west.
  box(scene, 2.5, 1.65, 1.6, -6, 0.82, -10, wood);
  const shedRoof = box(scene, 2.85, 0.1, 1.95, -6, 1.77, -10, roof);
  shedRoof.rotation.x = 0.12;
  for (let i = 0; i < 16; i++)
    box(scene, 0.018, 1.6, 0.025, -7.1 + i * 0.146, 0.81, -9.19, metal);
  box(scene, 0.72, 1.35, 0.08, -6.4, 0.68, -9.16, wood);
  rod(scene, [-6.18, 0.64, -9.09], [-6.18, 0.8, -9.09], 0.015, metal);
  // West garden: privacy screen, stepping stones, maple, bench and water basin.
  box(scene, 10, 0.07, 10, -9, 0.025, 6.8, gravel);
  fence(-15, 6.8, 11, Math.PI / 2, 1.7);
  fence(-9.5, 12.3, 11, 0, 1.5);
  for (let i = 0; i < 12; i++) {
    const x = -5 - i * 0.73,
      z = 6.2 + Math.sin(i * 0.48) * 1.2;
    const p = ellipsoid(scene, x, 0.095, z, 0.42, 0.09, 0.29, stone);
    p.rotation.y = seed(i) * 2;
  }
  tree(-10.8, 5.1, 1.2, 82, true);
  tree(-13.1, 10.5, 1.3, 71);
  for (let i = 0; i < 6; i++)
    bush(
      -14 + seed(i + 19) * 8,
      3 + seed(i + 38) * 8,
      0.6 + seed(i) * 0.7,
      i + 87,
    );
  box(scene, 2, 0.12, 0.55, -12.7, 0.65, 8.2, wood);
  for (const x of [-13.4, -12])
    for (const z of [8.03, 8.4]) box(scene, 0.1, 0.64, 0.1, x, 0.32, z, metal);
  for (let i = 0; i < 5; i++)
    box(scene, 0.35, 0.028, 0.55, -13.43 + i * 0.365, 0.725, 8.2, wood);
  mesh(
    scene,
    new T.CylinderGeometry(0.48, 0.4, 0.53, 24),
    stone,
    -7.9,
    0.29,
    8.2,
  );
  mesh(
    scene,
    new T.TorusGeometry(0.4, 0.09, 8, 32).rotateX(Math.PI / 2),
    stone,
    -7.9,
    0.57,
    8.2,
  );
  mesh(
    scene,
    new T.CircleGeometry(0.37, 32).rotateX(-Math.PI / 2),
    water,
    -7.9,
    0.55,
    8.2,
  );
  rod(scene, [-8.4, 0.04, 8.2], [-8.4, 1.08, 8.2], 0.025, wood);
  rod(scene, [-8.4, 1.08, 8.2], [-7.96, 1.08, 8.2], 0.027, wood);
  // East lane is shared by both east windows, at their actual 6.8-unit separation.
  box(scene, 4.1, 0.04, 78, 18.5, 0.025, 0, mat('#858b86'));
  for (const x of [16.15, 20.85]) {
    box(scene, 0.48, 0.12, 78, x, 0.04, 0, stone);
    for (let i = 0; i < 88; i++)
      box(scene, 0.47, 0.005, 0.014, x, 0.105, -38 + i * 0.88, metal);
  }
  box(scene, 2.15, 0.045, 78, 14.65, 0.035, 0, gravel);
  fence(13.25, -0.4, 4.4, Math.PI / 2, 0.88);
  fence(13.25, 9.4, 3.2, Math.PI / 2, 0.88);
  for (const z of [-7, 14.8, 25]) {
    tree(15.05, z, 0.85, Math.round(z + 30));
    bush(13.5, z, 0.7, Math.round(z + 50));
  }
  // Ground-floor homes, with pitched tile roofs, recessed glazing, soffits and porches.
  function home(x: number, z: number, index: number, rotation = -Math.PI / 2) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotation;
    scene.add(g);
    const wall = index % 2 ? plaster : mat('#c4c6b1');
    wall.side = T.DoubleSide;
    box(g, 5, 2.75, 3.8, 0, 1.38, 0, wall);
    box(g, 5.18, 0.22, 4, 0, 0.13, 0, stone);
    const slope = Math.atan2(1.05, 2.15),
      roofDepth = Math.hypot(2.15, 1.05);
    for (const side of [-1, 1]) {
      const r = box(g, 5.7, 0.11, roofDepth, 0, 3.24, side * 1.07, roof);
      r.rotation.x = side * slope;
      for (let k = 0; k < 19; k++) {
        const seam = box(
          g,
          0.035,
          0.06,
          roofDepth + 0.03,
          -2.68 + k * 0.298,
          3.3,
          side * 1.07,
          roof,
        );
        seam.rotation.x = side * slope;
      }
    }
    rod(g, [-2.86, 3.79, 0], [2.86, 3.79, 0], 0.09, roof);
    // Gable infill closes the roof instead of leaving an impossible hollow attic.
    const triangle = new T.Shape();
    triangle.moveTo(-1.9, 0);
    triangle.lineTo(1.9, 0);
    triangle.lineTo(0, 1);
    triangle.closePath();
    for (const side of [-1, 1]) {
      const geo = new T.ShapeGeometry(triangle);
      const o = mesh(g, geo, wall, side * 2.5, 2.75, 0);
      o.rotation.y = (side * Math.PI) / 2;
      o.material = wall;
    }
    for (const side of [-1, 1]) {
      rod(g, [-2.8, 2.67, side * 2.17], [2.8, 2.67, side * 2.17], 0.055, metal);
      rod(g, [2.65, 2.67, side * 2.17], [2.65, 0.1, side * 2.17], 0.04, metal);
    }
    for (const x of [-1.4, 1.22]) {
      box(g, 1.5, 1.36, 0.08, x, 1.52, 1.94, wood);
      box(g, 1.28, 1.14, 0.035, x, 1.52, 1.987, nightGlass);
      for (const dx of [-0.65, 0, 0.65])
        box(g, 0.045, 1.2, 0.06, x + dx, 1.52, 2.02, ivory);
      box(g, 1.44, 0.08, 0.25, x, 0.86, 2.03, stone);
      box(g, 1.8, 0.06, 0.4, x, 2.26, 2.1, roof);
    }
    box(g, 0.72, 2.02, 0.06, -0.13, 1.02, 1.96, wood);
    rod(g, [0.1, 0.9, 2.02], [0.1, 1.09, 2.02], 0.016, metal);
    box(g, 0.98, 0.17, 0.74, -0.13, 0.12, 2.27, stone);
    box(g, 1.2, 0.09, 0.95, -0.13, 0.06, 2.46, stone);
    box(g, 0.16, 0.27, 0.1, 0.42, 1.96, 2.03, lampGlass);
    for (let k = 0; k < 7; k++)
      box(g, 0.035, 1.8, 0.018, -0.41 + k * 0.09, 1.0, 2.002, metal);
    const awning = box(g, 1.28, 0.09, 0.84, -0.13, 2.3, 2.18, roof);
    awning.rotation.x = 0.07;
  }
  // The far edge of the water garden has a low boundary and village roofline.
  box(scene, 31, 1.08, 0.26, 1.5, 0.54, -28, plaster);
  box(scene, 31.3, 0.09, 0.4, 1.5, 1.125, -28, ivory);
  for (let i = 0; i < 16; i++)
    box(scene, 0.1, 1.3, 0.36, -13.8 + i * 2.04, 0.65, -28, pondStone);
  tree(-8.2, -23.5, 0.85, 401);
  tree(11, -23.8, 0.95, 402);
  home(-11, -37, 4, 0);
  home(4, -40, 5, 0);
  home(18, -37, 6, 0);
  for (const [x, z, w, h, c] of [
    [-30, -75, 32, 8, '#8da69c'],
    [8, -85, 38, 11, '#a0b1a5'],
    [43, -76, 27, 7, '#8a9f91'],
  ] as const)
    ellipsoid(scene, x, -1, z, w, h, 20, mat(c));
  home(42, -6, 0);
  home(42, 5.8, 1);
  home(42, 18, 2);
  for (const z of [-6, 5.8, 18]) {
    fence(37, z, 6.6, Math.PI / 2, 0.68);
    tree(35.8, z + 3.7, 1.0, Math.round(z + 90));
    bush(36.2, z - 2.7, 1.4, Math.round(z + 100));
  }
  for (let i = 0; i < 8; i++)
    ellipsoid(
      scene,
      17.4 + seed(i) * 2,
      0.051,
      -12 + i * 5.4,
      0.4 + seed(i) * 0.48,
      0.008,
      0.24 + seed(i + 8) * 0.45,
      puddle,
    );
  for (const [x, z, index] of [
    [48, -12, 0],
    [50, 1, 1],
    [48, 14, 2],
    [50, 27, 3],
  ]) {
    const facade = mat(['#c7b8a0', '#c2c9c4', '#d9c4ad', '#c9c0b0'][index]);
    const height = 6.2 + index * 0.65;
    box(scene, 6, height, 7, x, height / 2, z, facade);
    box(scene, 6.3, 0.18, 7.3, x, height + 0.09, z, roof);
    for (let floor = 0; floor < 3; floor++)
      for (let j = 0; j < 3; j++) {
        box(
          scene,
          0.06,
          1.12,
          0.86,
          x - 3.035,
          1.2 + floor * 1.9,
          z - 2.15 + j * 2.05,
          nightGlass,
        );
        box(
          scene,
          0.16,
          0.08,
          1.05,
          x - 3.09,
          0.61 + floor * 1.9,
          z - 2.15 + j * 2.05,
          ivory,
        );
      }
  }
  // One small corner cafe faces the lane opposite the living room.
  const cafe = new T.Group();
  cafe.position.set(42.1, 0, -0.25);
  cafe.rotation.y = -Math.PI / 2;
  scene.add(cafe);
  const cafeWall = mat('#d9b89a'),
    awningCloth = mat('#55776c');
  box(cafe, 4.2, 2.7, 2.7, 0, 1.37, 0, cafeWall);
  box(cafe, 4.5, 0.18, 3, 0, 2.83, 0, roof);
  box(cafe, 3.4, 1.7, 0.05, 0, 1.2, 1.375, nightGlass);
  for (const x of [-1.72, -0.5, 0.65, 1.72])
    box(cafe, 0.055, 1.8, 0.085, x, 1.2, 1.42, wood);
  for (let i = 0; i < 12; i++) {
    const a = box(
      cafe,
      0.34,
      0.07,
      0.83,
      -1.87 + i * 0.34,
      2.22,
      1.68,
      i % 2 ? ivory : awningCloth,
    );
    a.rotation.x = 0.16;
    box(
      cafe,
      0.34,
      0.17,
      0.04,
      -1.87 + i * 0.34,
      2.085,
      2.075,
      i % 2 ? ivory : awningCloth,
    );
  }
  for (const x of [-1.2, 1.2]) {
    mesh(
      cafe,
      new T.CylinderGeometry(0.31, 0.31, 0.035, 32),
      wood,
      x,
      0.7,
      2.63,
    );
    rod(cafe, [x, 0.06, 2.63], [x, 0.68, 2.63], 0.035, metal);
    for (const dx of [-0.4, 0.4]) {
      box(cafe, 0.31, 0.065, 0.32, x + dx, 0.39, 2.63, wood);
      for (const dz of [-0.12, 0.12])
        rod(
          cafe,
          [x + dx, 0.04, 2.63 + dz],
          [x + dx, 0.38, 2.63 + dz],
          0.018,
          metal,
        );
      box(cafe, 0.31, 0.25, 0.035, x + dx, 0.58, 2.78, wood);
    }
  }
  // Road markings, a bicycle stand and parked compact car give the lane a human scale.
  for (let i = 0; i < 5; i++)
    box(scene, 3.4, 0.008, 0.2, 18.5, 0.053, -2.7 + i * 0.46, ivory);
  const car = new T.Group();
  car.position.set(19.4, 0, -16.5);
  scene.add(car);
  const carPaint = mat('#899d99', 0.4, 0.25),
    tire = mat('#303635');
  box(car, 1.55, 0.52, 3.1, 0, 0.66, 0, carPaint);
  box(car, 1.35, 0.52, 1.65, 0, 1.13, -0.05, carPaint);
  box(car, 1.2, 0.35, 0.025, 0, 1.17, 0.79, nightGlass);
  box(car, 1.2, 0.32, 0.025, 0, 1.17, -0.89, nightGlass);
  for (const x of [-0.79, 0.79])
    for (const z of [-1.05, 1.05]) {
      const t = mesh(
        car,
        new T.CylinderGeometry(0.31, 0.31, 0.17, 24),
        tire,
        x,
        0.35,
        z,
      );
      t.rotation.z = Math.PI / 2;
      const h = mesh(
        car,
        new T.CylinderGeometry(0.17, 0.17, 0.175, 20),
        metal,
        x,
        0.35,
        z,
      );
      h.rotation.z = Math.PI / 2;
    }
  for (const x of [-0.52, 0.52])
    box(car, 0.27, 0.13, 0.04, x, 0.72, 1.575, lampGlass);
  // The conservatory looks onto a planted outer garden, beyond the new east wall.
  box(scene, 6.0, 0.06, 25.5, 32.9, 0.06, 6.3, grass);
  box(scene, 0.88, 0.05, 25.5, 30.45, 0.105, 6.3, gravel);
  for (let i = 0; i < 15; i++) {
    box(
      scene,
      0.78,
      0.055,
      0.88,
      31.45 + Math.sin(i * 0.4) * 0.22,
      0.11,
      -5.4 + i * 1.65,
      stone,
    );
    bush(
      33.4 + (i % 2) * 0.85,
      -5.5 + i * 1.65,
      0.68 + (i % 3) * 0.13,
      730 + i,
    );
  }
  for (const [z, i] of [
    [-3.8, 0],
    [4.2, 1],
    [12.3, 2],
  ])
    tree(34.1, z, 0.72, 751 + i);
  box(scene, 6.8, 0.055, 4.5, 26.4, 0.07, -8.0, grass);
  tree(27.7, -8.8, 0.78, 762);
  // The expanded north wing opens onto a small reading garden before the lane.
  box(scene, 9.4, 0.055, 4.2, 18.5, 0.07, -8.2, grass);
  box(scene, 9.4, 0.055, 0.8, 18.5, 0.085, -6.05, gravel);
  box(scene, 7.8, 0.28, 0.78, 18.5, 0.2, -7.05, pondStone);
  box(scene, 7.57, 0.035, 0.57, 18.5, 0.354, -7.05, bark);
  for (let i = 0; i < 9; i++) bush(15.1 + i * 0.85, -7.05, 0.8, 610 + i);
  tree(17.8, -8.65, 0.7, 621);
  tree(21.15, -9.45, 0.85, 622);
  // A low courtyard outside the gallery: brick edging, herbs and a cedar pergola.
  box(scene, 2.4, 0.12, 2.1, 14.15, 0.05, 6.7, stone);
  for (let i = 0; i < 12; i++)
    box(scene, 0.18, 0.12, 2, 13.12 + i * 0.187, 0.15, 6.7, wood);
  for (const z of [5.7, 7.7])
    for (const x of [13, 15.3]) box(scene, 0.11, 2.35, 0.11, x, 1.18, z, wood);
  for (let i = 0; i < 9; i++)
    box(scene, 2.6, 0.1, 0.085, 14.15, 2.39, 5.62 + i * 0.27, wood);
  box(scene, 1.32, 0.3, 0.38, 14.15, 0.23, 7.5, wood);
  for (let i = 0; i < 6; i++) bush(13.65 + i * 0.21, 7.5, 0.4, i + 190);
  // Gallery forecourt: bistro furniture and glazed pottery under the pergola.
  mesh(
    scene,
    new T.CylinderGeometry(0.34, 0.34, 0.045, 32),
    ivory,
    14.2,
    0.76,
    6.6,
  );
  rod(scene, [14.2, 0.19, 6.6], [14.2, 0.74, 6.6], 0.04, metal);
  for (const z of [5.98, 7.12]) {
    box(scene, 0.41, 0.05, 0.39, 14.2, 0.52, z, wood);
    for (const x of [14.05, 14.35])
      for (const zz of [z - 0.12, z + 0.12])
        rod(scene, [x, 0.18, zz], [x, 0.51, zz], 0.014, metal);
    box(
      scene,
      0.43,
      0.32,
      0.04,
      14.2,
      0.72,
      z + (z > 6.6 ? 0.18 : -0.18),
      wood,
    );
  }
  for (const [x, z] of [
    [13.0, 8.7],
    [15.2, 8.8],
  ]) {
    mesh(
      scene,
      new T.CylinderGeometry(0.28, 0.2, 0.42, 28),
      flowerClay,
      x,
      0.31,
      z,
    );
    bush(x, z, 0.48, Math.round(x * 7));
  }
  // Street lamps have bases, diffuser housings and warm night emission.
  for (const z of [-10, 9, 26]) {
    rod(scene, [20.35, 0, z], [20.35, 3.55, z], 0.045, metal);
    box(scene, 0.19, 0.14, 0.19, 20.35, 0.07, z, metal);
    box(scene, 0.43, 0.075, 0.43, 20.35, 3.64, z, metal);
    box(scene, 0.28, 0.3, 0.28, 20.35, 3.46, z, lampGlass);
  }
  // The cafe faces south onto a paved courtyard, beyond the enlarged house footprint.
  box(scene, 17, 0.045, 5.4, 4, 0.04, 21.1, stone);
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 17; col++)
      box(
        scene,
        0.965,
        0.023,
        0.84,
        -4 + col,
        0.076,
        18.85 + row * 0.88,
        (row + col) % 3 === 0 ? ivory : gravel,
      );
  for (const x of [-3, 10.8]) {
    box(scene, 0.9, 0.55, 4, x, 0.3, 21.3, wood);
    for (let i = 0; i < 9; i++) bush(x, 19.7 + i * 0.4, 0.58, 250 + i);
  }
  for (const x of [0.3, 7]) {
    box(scene, 2.1, 0.13, 0.62, x, 0.64, 22.5, wood);
    box(scene, 2.1, 0.5, 0.08, x, 0.92, 22.77, wood);
    for (const side of [-0.8, 0.8])
      box(scene, 0.07, 0.65, 0.52, x + side, 0.34, 22.5, metal);
  }
  tree(-6.5, 22, 3.2, 260);
  tree(14, 24, 3.7, 280);
  box(scene, 16, 0.65, 0.24, 4, 0.35, 24.5, plaster);
  for (let i = 0; i < 8; i++) bush(-3 + i * 2, 25.1, 0.7, 300 + i);
  home(-3, 31, 7, Math.PI);
  home(8, 32, 8, Math.PI);
  for (const x of [-2, 10]) {
    rod(scene, [x, 0.1, 22.8], [x, 2.3, 22.8], 0.035, metal);
    box(scene, 0.34, 0.055, 0.34, x, 2.45, 22.8, metal);
    box(scene, 0.19, 0.3, 0.19, x, 2.27, 22.8, lampGlass);
    box(scene, 0.26, 0.035, 0.26, x, 2.1, 22.8, metal);
  }
  const hemi = new T.HemisphereLight('#e7eff3', '#8b8770', 2.2);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#ffeed5', 3.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -48;
  sun.shadow.camera.right = sun.shadow.camera.top = 48;
  sun.shadow.camera.far = 180;
  sun.shadow.normalBias = 0.06;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  // Collapse static scenery by material; hundreds of details remain only a few draw calls.
  scene.updateMatrixWorld(true);
  const byMaterial = new Map<T.Material, T.BufferGeometry[]>(),
    originals = new Set<T.BufferGeometry>(),
    remove: T.Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof T.Mesh && !Array.isArray(o.material)) {
      const geo = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      delete geo.attributes.uv;
      const list = byMaterial.get(o.material) || [];
      list.push(geo);
      byMaterial.set(o.material, list);
      originals.add(o.geometry);
      remove.push(o);
    }
  });
  // Retain UVs for grain by generating world-scaled planar coordinates per face.
  byMaterial.forEach((list, m) => {
    list.forEach((g) => {
      const p = g.attributes.position,
        n = g.attributes.normal,
        uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)),
          ay = Math.abs(n.getY(i));
        uv[i * 2] = ax > 0.6 ? p.getZ(i) : p.getX(i);
        uv[i * 2 + 1] = ay > 0.6 ? p.getZ(i) : p.getY(i);
      }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    });
    const merged = mergeGeometries(list, false);
    if (merged) {
      const o = new T.Mesh(merged, m);
      o.castShadow = o.receiveShadow = true;
      scene.add(o);
    }
    list.forEach((g) => g.dispose());
  });
  remove.forEach((o) => o.removeFromParent());
  originals.forEach((g) => g.dispose());
  foliage.forEach((matrices, mat) => {
    const instance = new T.InstancedMesh(leafGeo, mat, matrices.length);
    matrices.forEach((m, i) => instance.setMatrixAt(i, m));
    instance.castShadow = instance.receiveShadow = true;
    instance.computeBoundingSphere();
    scene.add(instance);
  });
  foliage.clear();
  type View = {
    room: RoomId;
    width: number;
    height: number;
    parent: T.Group;
    target: T.WebGLRenderTarget;
    camera: T.PerspectiveCamera;
    lastEye: T.Vector3;
    revision: number;
  };
  const views: View[] = [];
  let revision = 0,
    lastRender = -Infinity,
    nextView = 0;
  let state: Environment = { time: 'afternoon', weather: 'clear' };
  function set(value: Environment) {
    state = value;
    revision++;
    const light = environmentLight(value);
    hemi.color.copy(light.hemi);
    hemi.groundColor.copy(light.ground);
    hemi.intensity = light.ambient;
    sun.color.copy(light.sun);
    sun.intensity = light.power;
    sun.position
      .copy(light.position)
      .multiplyScalar(7)
      .add(new T.Vector3(4, 0, 3.4));
    sun.target.position.set(4, 0, 3.4);
    const darkness = value.time === 'night';
    nightGlass.emissive.set(darkness ? '#ffc577' : '#000000');
    nightGlass.emissiveIntensity = darkness ? 0.45 : 0;
    lampGlass.emissive.set('#ffbf72');
    lampGlass.emissiveIntensity = darkness ? 1.6 : 0;
    const wet = value.weather === 'rain' || value.weather === 'storm';
    water.roughness = wet ? 0.07 : 0.18;
    puddle.opacity = wet ? 0.52 : 0;
    gravel.roughness = wet ? 0.45 : 0.85;
    stone.roughness = wet ? 0.35 : 0.85;
    grass.color.set(value.weather === 'snow' ? '#bdc9bb' : '#72836a');
    const fog =
      value.weather === 'fog'
        ? 0.058
        : value.weather === 'rain' ||
            value.weather === 'snow' ||
            value.weather === 'storm'
          ? 0.019
          : 0.007;
    scene.fog = new T.FogExp2(
      value.time === 'night' ? '#263a49' : '#b1c3be',
      fog,
    );
  }
  set(state);
  return {
    register(room: RoomId, parent: T.Group, width = 3.22, height = 2.12) {
      const resolution = window.innerWidth < 760 ? 640 : 1024;
      const target = new T.WebGLRenderTarget(
        resolution,
        Math.round((resolution * height) / width),
        {
          samples: 2,
          minFilter: T.LinearFilter,
          magFilter: T.LinearFilter,
          depthBuffer: true,
        },
      );
      const v = {
        room,
        width,
        height,
        parent,
        target,
        camera: new T.PerspectiveCamera(),
        lastEye: new T.Vector3(Infinity, Infinity, Infinity),
        revision: -1,
      };
      views.push(v);
      return target.texture;
    },
    set,
    update(viewer: T.Camera, t: number) {
      if (t - lastRender < 0.14) return;
      // At most one changing aperture is rendered per frame; static views reuse their texture.
      for (let offset = 0; offset < views.length; offset++) {
        const index = (nextView + offset) % views.length;
        const v = views[index];
        let visible = true;
        for (let o: T.Object3D | null = v.parent; o; o = o.parent)
          if (!o.visible) visible = false;
        if (!visible && v.revision >= 0) continue;
        v.parent.updateWorldMatrix(true, false);
        const eye = viewer.getWorldPosition(new T.Vector3());
        const local = v.parent.worldToLocal(eye.clone());
        if (local.z < 0.15) {
          if (v.revision >= 0) continue;
          local.set(0, 0.1, 3);
          eye.copy(v.parent.localToWorld(local.clone()));
        }
        if (v.revision === revision && eye.distanceToSquared(v.lastEye) < 0.025)
          continue;
        const distance = local.z + 0.13,
          near = Math.max(0.1, distance);
        v.camera.position.copy(eye);
        v.camera.quaternion.copy(
          v.parent.getWorldQuaternion(new T.Quaternion()),
        );
        v.camera.projectionMatrix.makePerspective(
          -v.width / 2 - local.x,
          v.width / 2 - local.x,
          v.height / 2 - local.y,
          -v.height / 2 - local.y,
          near,
          250,
        );
        v.camera.projectionMatrixInverse
          .copy(v.camera.projectionMatrix)
          .invert();
        v.camera.updateMatrixWorld(true);
        const target = renderer.getRenderTarget(),
          color = renderer.getClearColor(new T.Color()),
          alpha = renderer.getClearAlpha(),
          shadowDirty = renderer.shadowMap.needsUpdate;
        renderer.setRenderTarget(v.target);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.needsUpdate = v.revision !== revision;
        renderer.clear();
        renderer.render(scene, v.camera);
        renderer.setRenderTarget(target);
        renderer.setClearColor(color, alpha);
        renderer.shadowMap.needsUpdate = shadowDirty;
        v.lastEye.copy(eye);
        v.revision = revision;
        lastRender = t;
        nextView = (index + 1) % views.length;
        break;
      }
    },
    dispose() {
      const geometries = new Set<T.BufferGeometry>();
      scene.traverse((o) => {
        if (o instanceof T.Mesh) geometries.add(o.geometry);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      views.forEach((v) => v.target.dispose());
      sun.shadow.map?.dispose();
    },
  };
}
export type HouseLandscape = ReturnType<typeof createHouseLandscape>;
