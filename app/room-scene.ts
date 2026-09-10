import { createSteamEffect } from './steam-effect';
import {
  createBreeze,
  curtainGeometry,
  interiorAtmosphere,
} from './interior-atmosphere';
import { addOakFloor, oakFloorMaterials } from './house-finishes';
import { createHouseLandscape, windowViews } from './house-landscape';
import { addWindowCraft } from './window-craft';
import { televisionScreen } from './television-screen';
import { createWallCutaways } from './wall-cutaway';
import { attachSeats, createSeatScene, type SeatAnchors } from './seat-scene';
import { seatById, seats } from './seat-data';
import { buildHouse } from './house-rooms';
import {
  rooms,
  roomAt,
  houseBounds,
  roomForObject,
  type HouseView,
} from './house-data';
import type { Environment } from './environment-data';
import { createWindowEnvironment, environmentLight } from './room-environment';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ObjectId, RoomApi } from './room-data';
import { surface, artwork, screenTexture } from './room-textures';
import {
  layout,
  workChairTravel,
  drawerTravel,
  type PlacedId,
} from './room-layout';
import { localPbr } from './room-materials';
import {
  createRoomAssets,
  setAssetRenderer,
  type AssetProgress,
} from './asset-loading';
import { releaseHiddenRoomGpu } from './room-resources';
import type { LifeScene } from './life-scene';
import type { ActorId, CollectionData } from './life-data';
import type { Visitor } from './seat-data';

type Options = {
  onLifeBubble: (text: string) => void;
  onCollections: (data: CollectionData, message: string) => void;
  onAssetProgress: (progress: AssetProgress) => void;
  onSeatSelect: (id: string) => void;
  onSelect: (id: ObjectId | null) => void;
  onHover: (id: ObjectId | null, x: number, y: number) => void;
  onReady: () => void;
  onView: (view: HouseView) => void;
};
export function createRoom(host: HTMLElement, options: Options): RoomApi {
  const breeze = createBreeze();
  const assets = createRoomAssets(options.onAssetProgress);
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  setAssetRenderer(renderer);
  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2,
    ),
  );
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute(
    'aria-label',
    '可互动的三维小屋。拖动旋转，滚轮缩放，也可以使用探索物件列表。',
  );
  const camera = new T.PerspectiveCamera(36, 1, 0.1, 100);
  const initial = new T.Vector3(10.6, 8.3, 12.6);
  const target = new T.Vector3(0, 1.35, 0);
  camera.position.copy(initial);
  let activeView: HouseView = 'study';
  let focusedObject: ObjectId | null = null;
  const controls = new OrbitControls(camera, host);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.panSpeed = 0.6;
  controls.touches.TWO = T.TOUCH.DOLLY_PAN;
  controls.minDistance = 5;
  controls.maxDistance = 65;
  controls.minPolarAngle = Math.PI / 9;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.65;
  const root = new T.Group();
  scene.add(root);
  const groups = new Map<ObjectId, T.Group>();
  const interactables: T.Object3D[] = [];
  const seatAnchors: SeatAnchors = new Map();
  function group(id: ObjectId, x = 0, y = 0, z = 0) {
    const g = new T.Group();
    g.position.set(x, y, z);
    g.userData.id = id;
    root.add(g);
    if (!groups.has(id)) groups.set(id, g);
    interactables.push(g);
    return g;
  }
  function placed(id: PlacedId) {
    const spec = layout[id];
    const g = group(id, spec.x, 0, spec.z);
    g.rotation.y = spec.yaw;
    return g;
  }
  const materials: T.Material[] = [];
  const mat = (color: T.ColorRepresentation, roughness = 0.8) => {
    const m = new T.MeshStandardMaterial({ color, roughness });
    materials.push(m);
    return m;
  };
  const oak = mat('#785337'),
    edge = mat('#b48a5e'),
    paleWood = mat('#bb956c'),
    darkWood = mat('#503626');
  const cream = mat('#eee5d4'),
    white = mat('#fffae9'),
    ceramic = mat('#f1e8d7', 0.26),
    darkGreen = mat('#254f43');
  const terra = mat('#ae5d3f'),
    brass = mat('#b59a57', 0.28),
    charcoal = mat('#292c29');
  brass.metalness = 0.72;
  const textures: T.Texture[] = [];
  const woodTex = surface('wood'),
    linenTex = surface('linen'),
    plasterTex = surface('plaster'),
    leatherTex = surface('leather');
  textures.push(woodTex, linenTex, plasterTex, leatherTex);
  for (const m of [oak, edge, paleWood, darkWood]) {
    m.map = woodTex;
    m.bumpMap = woodTex;
    m.bumpScale = 0.025;
  }
  cream.map = plasterTex;
  cream.bumpMap = plasterTex;
  cream.bumpScale = 0.018;
  darkGreen.color.set('#e4dbca');
  darkGreen.map = plasterTex;
  darkGreen.bumpMap = plasterTex;
  darkGreen.bumpScale = 0.035;
  const fabric = (m: T.MeshStandardMaterial) => {
    m.map = linenTex;
    m.bumpMap = linenTex;
    m.bumpScale = 0.025;
    return m;
  };
  const walnutMaps = localPbr(
    assets,
    textures,
    'fine_grained_wood',
    new T.Vector2(0.8, 0.65),
    false,
  );
  for (const m of [oak, paleWood, darkWood]) {
    Object.assign(m, walnutMaps);
    m.bumpMap = null;
    m.normalScale.set(0.22, 0.22);
    m.roughness = 0.75;
  }
  oak.color.setRGB(1.35, 1.28, 1.18);
  paleWood.color.setRGB(1.8, 1.73, 1.6);
  darkWood.color.setRGB(0.95, 0.9, 0.8);
  const clothMaps = localPbr(
    assets,
    textures,
    'fabric_pattern_07',
    new T.Vector2(2.4, 2.4),
    false,
  );
  const leatherMaps = localPbr(
    assets,
    textures,
    'brown_leather',
    new T.Vector2(1.7, 1.7),
  );
  const wallMaps = localPbr(
    assets,
    textures,
    'white_plaster_02',
    new T.Vector2(3, 2),
    false,
  );
  for (const m of [cream, darkGreen]) {
    Object.assign(m, wallMaps);
    m.map = plasterTex;
    m.bumpMap = null;
    m.normalScale.set(0.1, 0.1);
  }
  const textile = (color: string) => {
    const m = fabric(mat(color));
    Object.assign(m, clothMaps);
    m.normalScale.set(0.23, 0.23);
    m.bumpMap = null;
    return m;
  };
  const artMaps = [artwork(0), artwork(1), artwork(2)];
  textures.push(...artMaps);
  const artMats = artMaps.map((map) => {
    const m = new T.MeshStandardMaterial({ map, roughness: 0.92 });
    materials.push(m);
    return m;
  });

  function mesh(
    geometry: T.BufferGeometry,
    material: T.Material,
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
  ) {
    const m = new T.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(
    parent: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: T.Material,
    r = 0.025,
  ) {
    const geometry = new RoundedBoxGeometry(
      w,
      h,
      d,
      5,
      Math.min(r, w / 3, h / 3, d / 3),
    );
    if (material === oak || material === paleWood || material === darkWood) {
      const uv = geometry.attributes.uv,
        pos = geometry.attributes.position,
        n = geometry.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        const px = pos.getX(i),
          py = pos.getY(i),
          pz = pos.getZ(i),
          nx = Math.abs(n.getX(i)),
          ny = Math.abs(n.getY(i)),
          nz = Math.abs(n.getZ(i));
        if (h > w && h > d) uv.setXY(i, (nx > nz ? pz : px) * 0.9, py * 0.9);
        else if (w > d) uv.setXY(i, (ny > nz ? pz : py) * 0.9, px * 0.9);
        else uv.setXY(i, (ny > nx ? px : py) * 0.9, pz * 0.9);
      }
    }
    return mesh(geometry, material, parent, x, y, z);
  }
  function cylinder(
    parent: T.Object3D,
    rt: number,
    rb: number,
    h: number,
    x: number,
    y: number,
    z: number,
    material: T.Material,
  ) {
    return mesh(
      new T.CylinderGeometry(rt, rb, h, 32),
      material,
      parent,
      x,
      y,
      z,
    );
  }
  function sphere(
    parent: T.Object3D,
    r: number,
    x: number,
    y: number,
    z: number,
    material: T.Material,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    const m = mesh(new T.SphereGeometry(r, 24, 16), material, parent, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  }
  function rod(
    parent: T.Object3D,
    a: T.Vector3,
    b: T.Vector3,
    r: number,
    material: T.Material,
  ) {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const o = cylinder(
      parent,
      r,
      r,
      a.distanceTo(b),
      mid.x,
      mid.y,
      mid.z,
      material,
    );
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    return o;
  }
  function tube(
    parent: T.Object3D,
    points: number[][],
    radius: number,
    material: T.Material,
    closed = false,
  ) {
    const curve = new T.CatmullRomCurve3(
      points.map((p) => new T.Vector3(...(p as [number, number, number]))),
      closed,
      'centripetal',
    );
    return mesh(
      new T.TubeGeometry(
        curve,
        Math.max(24, points.length * 7),
        radius,
        8,
        closed,
      ),
      material,
      parent,
      0,
      0,
      0,
    );
  }
  function seamLoop(
    parent: T.Object3D,
    w: number,
    d: number,
    y: number,
    material: T.Material,
    r = 0.06,
  ) {
    // Ordered rounded-rectangle contour, clockwise viewed from above.
    const shape = new T.Shape();
    shape.moveTo(-w / 2 + r, -d / 2);
    shape.lineTo(w / 2 - r, -d / 2);
    shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    shape.lineTo(w / 2, d / 2 - r);
    shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    shape.lineTo(-w / 2 + r, d / 2);
    shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    shape.lineTo(-w / 2, -d / 2 + r);
    shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    return tube(
      parent,
      shape.getPoints(12).map((v) => [v.x, y, v.y]),
      0.006,
      material,
      true,
    );
  }
  function cushion(
    parent: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: T.Material,
    r = 0.09,
  ) {
    const geo = new RoundedBoxGeometry(w, h, d, 5, Math.min(r, h * 0.45));
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const xx = positions.getX(i),
        yy = positions.getY(i),
        zz = positions.getZ(i);
      const upper = Math.max(0, yy / (h / 2));
      const dent =
        Math.exp(-((xx / w) ** 2 + (zz / d) ** 2) * 16) * 0.023 * upper;
      positions.setY(i, yy - dent);
    }
    geo.computeVertexNormals();
    const m = mesh(geo, material, parent, x, y, z);
    return m;
  }
  function lathe(
    parent: T.Object3D,
    profile: number[][],
    x: number,
    y: number,
    z: number,
    material: T.Material,
  ) {
    return mesh(
      new T.LatheGeometry(
        profile.map((v) => new T.Vector2(v[0], v[1])),
        64,
      ),
      material,
      parent,
      x,
      y,
      z,
    );
  }
  function screw(parent: T.Object3D, x: number, y: number, z: number) {
    const head = sphere(parent, 0.013, x, y, z, brass, 1, 1, 0.35);
    box(head, 0.015, 0.002, 0.002, 0, 0, 0.005, charcoal, 0.001);
  }
  function paperBook(
    parent: T.Object3D,
    w: number,
    d: number,
    h: number,
    x: number,
    y: number,
    z: number,
    cover: T.Material,
  ) {
    const g = new T.Group();
    parent.add(g);
    g.position.set(x, y, z);
    box(g, w, h * 0.78, d, 0, h / 2, 0, white, 0.004);
    for (const yy of [0.006, h - 0.006])
      box(g, w + 0.018, 0.012, d + 0.018, 0, yy, 0, cover, 0.006);
    box(g, 0.019, h, d + 0.015, -w / 2, h / 2, 0, cover, 0.006);
    for (let i = 1; i < 7; i++)
      box(g, w - 0.016, 0.001, d - 0.01, 0.005, (h * i) / 7, 0, cream, 0.001);
    return g;
  }
  const hemi = new T.HemisphereLight('#eef5f0', '#a3886a', 2.4);
  // Approximate the ceiling lights bouncing off the room's plaster and floor.
  const indoorBounce = new T.AmbientLight('#ffe8cc', 0.3);
  scene.add(indoorBounce);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff0cf', 4.2);
  sun.position.set(-1, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  sun.shadow.normalBias = 0.03;
  sun.shadow.bias = -0.0001;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const fill = new T.DirectionalLight('#f7eedf', 1.3);
  fill.position.set(4, 6, 8);
  scene.add(fill);
  const lampLight = new T.PointLight('#ffb75b', 7, 5, 2);
  lampLight.position.set(-0.6, 1.82, -1.9);
  root.add(lampLight);
  const screenLight = new T.PointLight('#9dcce3', 0.1, 3);
  screenLight.position.set(1.2, 1.8, -1.6);
  scene.add(screenLight);
  const shadowMat = new T.ShadowMaterial({ opacity: 0.12 });
  materials.push(shadowMat);
  const ground = mesh(
    new T.PlaneGeometry(200, 200),
    shadowMat,
    scene,
    0,
    -0.48,
    0,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  const floor = group('floor');
  box(floor, 8, 0.4, 6.8, 0, -0.23, 0, edge, 0.1);
  box(floor, 7.95, 0.09, 6.75, 0, -0.015, 0, paleWood, 0.03);
  const floorMaterials = oakFloorMaterials(materials, textures);
  for (const [m, color] of [
    [oak, '#ac8052'],
    [paleWood, '#c29b6a'],
    [darkWood, '#654b35'],
  ] as const) {
    m.map = floorMaterials[0].map;
    m.color.set(color);
    m.roughness = 0.66;
  }
  addOakFloor(floor, 7.92, 6.67, floorMaterials);
  const wall = group('wall');
  box(wall, 0.17, 3.65, 6.8, -3.91, 1.83, 0, cream, 0.035);
  // Build the back wall around a real opening, so sunlight can enter.
  box(wall, 3.5, 3.65, 0.17, -2.25, 1.83, -3.31, darkGreen);
  box(wall, 1.17, 3.65, 0.17, 3.4, 1.83, -3.31, darkGreen);
  box(wall, 3.29, 0.91, 0.17, 1.13, 0.46, -3.31, darkGreen);
  box(wall, 3.29, 0.61, 0.17, 1.13, 3.35, -3.31, darkGreen);
  box(wall, 0.2, 0.13, 6.7, -3.8, 0.15, 0, paleWood);
  box(wall, 7.7, 0.13, 0.13, 0, 0.15, -3.18, paleWood);
  box(wall, 0.24, 0.09, 6.88, -3.91, 3.68, 0, white);
  box(wall, 8, 0.09, 0.23, 0, 3.68, -3.31, darkGreen);
  const win = group('window', 1.12, 1.98, -3.28);
  const landscape = createHouseLandscape(renderer);
  const windowEnvironment = createWindowEnvironment(win, 'study', landscape);
  addWindowCraft(win, paleWood, brass, materials);
  for (const x of [-1.67, 1.67]) box(win, 0.14, 2.35, 0.23, x, 0, 0.04, edge);
  for (const y of [-1.13, 1.13]) box(win, 3.5, 0.14, 0.25, 0, y, 0.04, edge);
  box(win, 0.075, 2.2, 0.1, 0, 0, 0.1, white);
  box(win, 3.25, 0.075, 0.1, 0, -0.05, 0.1, white);
  box(win, 3.65, 0.12, 0.45, 0, -1.18, 0.13, paleWood);
  const curtain = fabric(mat('#e8e0cf'));
  curtain.side = T.DoubleSide;
  breeze.add(curtain, true);
  rod(
    win,
    new T.Vector3(-1.94, 1.32, 0.14),
    new T.Vector3(1.94, 1.32, 0.14),
    0.035,
    brass,
  );
  for (const side of [-1, 1])
    mesh(curtainGeometry(), curtain, win, side * 1.82, 0.03, 0.2);
  // Sofa: feet, load-bearing rails, individually upholstered cushions, piping and soft throw.
  const bed = placed('bed');
  attachSeats(seatAnchors, bed, ['study-sofa-1', 'study-sofa-2']);
  const bedding = textile('#929e7f'),
    seam = mat('#657454');
  for (const x of [-1.28, 1.28])
    for (const z of [-0.46, 0.46]) {
      rod(
        bed,
        new T.Vector3(x, 0.4, z),
        new T.Vector3(x * 1.025, 0.1, z * 1.07),
        0.053,
        oak,
      );
      cylinder(bed, 0.049, 0.049, 0.025, x * 1.025, 0.09, z * 1.07, charcoal);
    }
  box(bed, 2.94, 0.16, 1.22, 0, 0.39, 0, oak, 0.045);
  for (const x of [-1.48, 1.48])
    box(bed, 0.15, 0.61, 1.32, x, 0.76, 0, bedding, 0.07);
  box(bed, 2.87, 0.7, 0.19, 0, 0.87, -0.58, bedding, 0.08);
  const studySofaSeats: T.Object3D[] = [];
  for (const x of [-0.71, 0.71]) {
    const seat = cushion(bed, 1.38, 0.23, 1.12, x, 0.61, 0.055, bedding, 0.1);
    studySofaSeats.push(seat);
    seamLoop(seat, 1.31, 1.055, 0.064, seam);
    const back = cushion(bed, 1.38, 0.61, 0.23, x, 1.0, -0.37, bedding, 0.1);
    back.rotation.x = -0.13;
    const stitch = seamLoop(back, 1.27, 0.49, 0.115, seam);
    stitch.rotation.x = Math.PI / 2;
    stitch.position.set(0, 0, 0.008);
  }
  for (const [x, angle, color] of [
    [-1.03, -0.17, '#bd7455'],
    [1.05, 0.22, '#e0d5bb'],
  ] as const) {
    const p = cushion(
      bed,
      0.45,
      0.46,
      0.2,
      x,
      0.94,
      -0.1,
      textile(color),
      0.09,
    );
    p.rotation.set(-0.12, 0, angle);
    const piping = seamLoop(p, 0.38, 0.39, 0.1, cream, 0.06);
    piping.rotation.x = Math.PI / 2;
  }
  const throwMat = textile('#d4c39c');
  throwMat.side = T.DoubleSide;
  const throwGeo = new T.PlaneGeometry(0.58, 1.18, 18, 34);
  const tp = throwGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i),
      v = (tp.getY(i) + 0.59) / 1.18;
    const zz = -0.42 + v * 1.18;
    const fall = Math.max(0, zz - 0.59);
    tp.setXYZ(
      i,
      x,
      0.742 - fall * 2.65 + Math.sin(x * 44 + v * 3) * 0.01,
      Math.min(zz, 0.625) + Math.sin(x * 37) * 0.008,
    );
  }
  throwGeo.computeVertexNormals();
  mesh(throwGeo, throwMat, bed, 0.56, 0, 0);
  for (let i = 0; i < 20; i++)
    tube(
      bed,
      [
        [0.28 + i * 0.029, 0.287, 0.631],
        [0.28 + i * 0.029, 0.235, 0.639],
        [0.284 + i * 0.029, 0.21, 0.632],
      ],
      0.004,
      throwMat,
    );
  const lamp = placed('lamp');
  box(lamp, 0.7, 0.07, 0.68, 0, 0.72, 0, paleWood, 0.035);
  for (const x of [-0.28, 0.28])
    for (const z of [-0.23, 0.23])
      box(lamp, 0.05, 0.61, 0.05, x, 0.385, z, oak);
  box(lamp, 0.63, 0.12, 0.52, 0, 0.27, 0, cream);
  cylinder(lamp, 0.19, 0.22, 0.08, 0, 0.76, 0, terra);
  cylinder(lamp, 0.045, 0.06, 0.43, 0, 1.0, 0, terra);
  const shade = mat('#e6ab6c');
  shade.emissive.set('#ffad50');
  shade.emissiveIntensity = 0.45;
  const cap = mesh(
    new T.SphereGeometry(0.35, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    shade,
    lamp,
    0,
    1.19,
    0,
  );
  cap.scale.y = 0.73;
  cylinder(lamp, 0.35, 0.35, 0.035, 0, 1.19, 0, shade);
  lampLight.position.set(layout.lamp.x, 1.3, layout.lamp.z);
  tube(
    lamp,
    [
      [0, 0.76, -0.03],
      [0.15, 0.73, -0.21],
      [0.25, 0.5, -0.29],
      [0.28, 0.1, -0.28],
    ],
    0.009,
    charcoal,
  );
  const desk = placed('desk');
  box(desk, 2.75, 0.1, 1.1, 0, 1.22, 0, paleWood, 0.035);
  box(desk, 2.54, 0.13, 0.05, 0, 1.1, -0.43, oak, 0.01);
  for (const x of [-1.22, 1.22])
    box(desk, 0.05, 0.13, 0.86, x, 1.1, 0, oak, 0.01);
  for (const x of [-1.15, 1.15])
    for (const z of [-0.35, 0.35])
      rod(
        desk,
        new T.Vector3(x, 1.16, z),
        new T.Vector3(x * 1.025, 0.078, z * 1.04),
        0.043,
        oak,
      );
  for (const x of [0.62, 1.18])
    box(desk, 0.04, 0.7, 0.76, x, 0.8, 0, paleWood, 0.012);
  for (const y of [0.46, 1.14])
    box(desk, 0.56, 0.035, 0.76, 0.9, y, 0, paleWood, 0.008);
  box(desk, 0.54, 0.66, 0.025, 0.9, 0.8, -0.365, darkWood, 0.003);
  const drawer = group('drawer', 0.9, 0.99, 0);
  desk.add(drawer);
  box(drawer, 0.54, 0.18, 0.025, 0, 0, 0.39, paleWood);
  box(drawer, 0.48, 0.035, 0.65, 0, -0.07, 0.02, oak);
  for (const x of [-0.24, 0.24])
    box(drawer, 0.025, 0.12, 0.64, x, 0, 0.02, paleWood);
  box(drawer, 0.17, 0.024, 0.045, 0, 0, 0.422, brass);
  box(drawer, 0.31, 0.016, 0.36, 0, -0.04, 0.09, cream).rotation.y = 0.14;
  box(drawer, 0.47, 0.12, 0.025, 0, 0, -0.3, paleWood, 0.004);
  for (const x of [-0.255, 0.255]) {
    box(drawer, 0.009, 0.023, 0.5, x, -0.016, -0.01, brass, 0.003);
    for (let i = 0; i < 4; i++)
      box(
        drawer,
        0.012,
        0.013,
        0.018,
        x,
        0.042 - i * 0.025,
        0.351,
        darkWood,
        0.001,
      );
  }
  for (let i = 0; i < 3; i++)
    box(
      drawer,
      0.26,
      0.003,
      0.33,
      -0.025,
      -0.021 + i * 0.004,
      0.04,
      white,
      0.001,
    ).rotation.y = 0.1;
  tube(
    drawer,
    [
      [0.12, 0.003, -0.02],
      [0.15, 0.003, 0.13],
      [0.16, 0.003, 0.15],
    ],
    0.009,
    charcoal,
  );

  for (let i = 0; i < 2; i++) {
    box(desk, 0.55, 0.19, 0.025, 0.9, 0.565 + i * 0.21, 0.39, paleWood);
    box(desk, 0.16, 0.02, 0.04, 0.9, 0.565 + i * 0.21, 0.41, brass);
  }

  const pc = group('computer', -0.39, 1.29, -0.14);
  desk.add(pc);
  box(pc, 0.6, 0.035, 0.3, 0, 0, 0.05, charcoal);
  box(pc, 0.065, 0.24, 0.075, 0, 0.13, -0.08, charcoal);
  box(pc, 1.23, 0.78, 0.065, 0, 0.6, -0.08, charcoal, 0.04);
  let display = screenTexture();
  textures.push(display);
  const screenMat = new T.MeshStandardMaterial({
    map: display,
    emissiveMap: display,
    emissive: '#ffffff',
    emissiveIntensity: 0.35,
    roughness: 0.36,
  });
  materials.push(screenMat);
  const computerPanel = mesh(
    new T.PlaneGeometry(1.13, 0.67),
    screenMat,
    pc,
    0,
    0.61,
    -0.033,
  );
  const computerOff = new T.MeshBasicMaterial({ color: '#111714' });
  materials.push(computerOff);
  let computerPowered = true;
  sphere(pc, 0.008, 0, 0.966, -0.04, charcoal);
  box(pc, 0.79, 0.038, 0.27, -0.06, 0.025, 0.48, cream, 0.022);
  const keyCanvas = document.createElement('canvas');
  keyCanvas.width = 1024;
  keyCanvas.height = 320;
  const keysCtx = keyCanvas.getContext('2d')!;
  const rows = [
    ['esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫'],
    ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '↵'],
    ['⇧', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '⇧'],
    ['ctrl', 'alt', '⌘', 'space', '⌘', '←', '↓', '→'],
  ];
  keysCtx.fillStyle = '#5e645e';
  keysCtx.textAlign = 'center';
  keysCtx.textBaseline = 'middle';
  keysCtx.font = '17px sans-serif';
  rows.forEach((row, r) => {
    let x = -0.435;
    const weights = row.map((k) =>
      k === 'space' ? 4 : k.length > 1 ? 1.25 : 1,
    );
    const unit = 0.75 / weights.reduce((a, b) => a + b, 0);
    row.forEach((key, i) => {
      const w = unit * weights[i],
        xx = x + w / 2;
      box(
        pc,
        w - 0.008,
        0.012,
        0.043,
        xx,
        0.049,
        0.388 + r * 0.056,
        white,
        0.004,
      );
      if (key !== 'space')
        keysCtx.fillText(
          key,
          ((xx + 0.445) / 0.78) * 1024,
          ((r * 0.056 + 0.027) / 0.23) * 320,
        );
      x += w;
    });
  });
  const keyTexture = new T.CanvasTexture(keyCanvas);
  keyTexture.colorSpace = T.SRGBColorSpace;
  textures.push(keyTexture);
  const keyInk = new T.MeshStandardMaterial({
    map: keyTexture,
    transparent: true,
    roughness: 0.8,
    depthWrite: false,
  });
  materials.push(keyInk);
  const legends = mesh(
    new T.PlaneGeometry(0.78, 0.23),
    keyInk,
    pc,
    -0.055,
    0.0555,
    0.472,
  );
  legends.rotation.x = -Math.PI / 2;
  legends.castShadow = false;
  for (let i = 0; i < 17; i++)
    box(
      pc,
      0.035,
      0.003,
      0.003,
      -0.38 + i * 0.047,
      0.38,
      -0.115,
      charcoal,
      0.001,
    );
  box(pc, 0.035, 0.055, 0.003, 0.47, 0.38, -0.115, brass, 0.003);
  sphere(pc, 0.09, 0.56, 0.065, 0.46, cream, 0.7, 0.32, 1.2);
  const stool = placed('stool');
  attachSeats(seatAnchors, stool, ['study-work']);
  const workSeat = textile('#79856c');
  for (const x of [-0.29, 0.29])
    for (const z of [-0.28, 0.28]) {
      rod(
        stool,
        new T.Vector3(x, 0.65, z),
        new T.Vector3(x * 1.22, 0.085, z * 1.25),
        0.027,
        oak,
      );
      cylinder(stool, 0.03, 0.03, 0.022, x * 1.22, 0.089, z * 1.25, charcoal);
    }
  for (const x of [-0.28, 0.28])
    rod(
      stool,
      new T.Vector3(x, 0.36, -0.29),
      new T.Vector3(x, 0.36, 0.29),
      0.018,
      oak,
    );
  box(stool, 0.76, 0.08, 0.76, 0, 0.61, 0, oak, 0.07);
  const workCushion = cushion(
    stool,
    0.77,
    0.13,
    0.73,
    0,
    0.704,
    -0.014,
    workSeat,
    0.055,
  );
  seamLoop(workCushion, 0.71, 0.67, 0.025, seam);
  const backShape = new T.Shape();
  backShape.moveTo(-0.41, 0.29);
  backShape.quadraticCurveTo(0, 0.5, 0.41, 0.29);
  backShape.lineTo(0.41, 0.34);
  backShape.quadraticCurveTo(0, 0.56, -0.41, 0.34);
  backShape.closePath();
  const bentBack = mesh(
    new T.ExtrudeGeometry(backShape, {
      depth: 0.37,
      steps: 1,
      bevelEnabled: true,
      bevelSize: 0.017,
      bevelThickness: 0.017,
      bevelSegments: 4,
      curveSegments: 24,
    }),
    paleWood,
    stool,
    0,
    1.35,
    0,
  );
  bentBack.rotation.x = Math.PI / 2;
  for (const x of [-0.29, 0.29]) {
    tube(
      stool,
      [
        [x, 0.6, 0.27],
        [x, 0.88, 0.35],
        [x, 1.12, 0.39],
      ],
      0.024,
      oak,
    );
    screw(stool, x, 1.08, 0.337);
    screw(stool, x, 1.27, 0.337);
  }
  const rug = group('rug', -0.7, 0.085, 1.16);
  const rugMat = textile('#d8cead');
  box(rug, 4.9, 0.027, 3.15, 0, 0, 0, rugMat, 0.025);
  const border = mat('#777d67');
  for (const x of [-2.32, 2.32])
    box(rug, 0.025, 0.004, 2.94, x, 0.017, 0, border, 0.001);
  for (const z of [-1.46, 1.46])
    box(rug, 4.66, 0.004, 0.025, 0, 0.017, z, border, 0.001);
  for (const z of [-1.6, 1.6])
    for (let i = 0; i < 88; i++)
      rod(
        rug,
        new T.Vector3(-2.38 + i * 0.055, 0.006, z),
        new T.Vector3(-2.38 + i * 0.055, 0.005, z + Math.sign(z) * 0.09),
        0.004,
        cream,
      );
  const coffee = placed('coffee');
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    rod(
      coffee,
      new T.Vector3(Math.cos(a) * 0.4, 0.57, Math.sin(a) * 0.36),
      new T.Vector3(Math.cos(a) * 0.51, 0.09, Math.sin(a) * 0.46),
      0.055,
      oak,
    );
  }
  const top = cylinder(coffee, 0.72, 0.72, 0.11, 0, 0.67, 0, paleWood);
  top.scale.set(1.028, 1, 0.875);
  const apron = cylinder(coffee, 0.63, 0.63, 0.05, 0, 0.603, 0, oak);
  apron.scale.z = 0.85;
  box(coffee, 0.37, 0.048, 0.47, -0.2, 0.752, -0.05, darkGreen).rotation.y =
    0.2;
  box(coffee, 0.33, 0.025, 0.43, -0.2, 0.784, -0.05, cream).rotation.y = 0.2;
  const porcelain = mat('#efe9da', 0.22);
  lathe(
    coffee,
    [
      [0, 0],
      [0.11, 0],
      [0.14, 0.011],
      [0.15, 0.025],
      [0.145, 0.033],
      [0.106, 0.024],
      [0, 0.019],
    ],
    0.3,
    0.724,
    0.15,
    porcelain,
  );
  lathe(
    coffee,
    [
      [0, 0],
      [0.062, 0],
      [0.069, 0.01],
      [0.083, 0.14],
      [0.091, 0.17],
      [0.089, 0.177],
      [0.079, 0.177],
      [0.075, 0.15],
      [0.062, 0.027],
      [0, 0.027],
    ],
    0.3,
    0.749,
    0.15,
    porcelain,
  );
  tube(
    coffee,
    [
      [0.377, 0.902, 0.15],
      [0.44, 0.911, 0.15],
      [0.455, 0.855, 0.15],
      [0.432, 0.797, 0.15],
      [0.371, 0.79, 0.15],
    ],
    0.014,
    porcelain,
  );
  const coffeeLiquid = mat('#302319', 0.12);
  cylinder(coffee, 0.075, 0.075, 0.002, 0.3, 0.899, 0.15, coffeeLiquid);
  const crema = mesh(
    new T.TorusGeometry(0.071, 0.0025, 6, 40),
    mat('#9b7148'),
    coffee,
    0.3,
    0.901,
    0.15,
  );
  crema.rotation.x = -Math.PI / 2;
  rod(
    coffee,
    new T.Vector3(0.5, 0.733, 0.02),
    new T.Vector3(0.56, 0.733, 0.28),
    0.007,
    brass,
  );
  sphere(coffee, 0.028, 0.495, 0.734, 0.0, brass, 0.68, 0.18, 1.35);
  const coffeeSteam = createSteamEffect({
    count: 9,
    height: 0.4,
    width: 0.095,
    seed: 3,
  });
  coffeeSteam.root.position.set(0.3, 0.905, 0.15);
  coffee.add(coffeeSteam.root);
  const chair = placed('chair');
  attachSeats(seatAnchors, chair, ['study-reading']);
  const chairMat = mat('#dcaf86', 0.88);
  Object.assign(chairMat, leatherMaps);
  chairMat.normalScale.set(0.4, 0.4);
  const leatherSeam = mat('#5d3b27');
  for (const x of [-0.46, 0.46]) {
    tube(
      chair,
      [
        [x, 0.1, 0.45],
        [x, 0.43, 0.37],
        [x, 0.81, -0.3],
        [x, 1.24, -0.48],
      ],
      0.043,
      oak,
    );
    tube(
      chair,
      [
        [x, 0.1, -0.48],
        [x, 0.52, -0.34],
        [x, 0.74, 0.2],
      ],
      0.037,
      oak,
    );
    box(chair, 0.13, 0.068, 1.13, x, 0.88, -0.025, paleWood, 0.032).rotation.x =
      -0.055;
    for (const z of [-0.48, 0.45])
      cylinder(chair, 0.043, 0.043, 0.022, x, 0.085, z, charcoal);
  }
  for (const z of [-0.36, 0.34])
    rod(
      chair,
      new T.Vector3(-0.48, 0.52, z),
      new T.Vector3(0.48, 0.52, z),
      0.035,
      oak,
    );
  box(chair, 1.01, 0.1, 0.96, 0, 0.55, 0.05, oak, 0.05);
  const loungeSeat = cushion(
    chair,
    0.95,
    0.22,
    1.0,
    0,
    0.71,
    0.025,
    chairMat,
    0.09,
  );
  loungeSeat.rotation.x = 0.055;
  seamLoop(loungeSeat, 0.89, 0.93, 0.057, leatherSeam);
  box(chair, 1.03, 0.72, 0.095, 0, 1.02, -0.43, oak, 0.04).rotation.x = -0.15;
  const loungeBack = cushion(
    chair,
    0.94,
    0.66,
    0.21,
    0,
    1.055,
    -0.35,
    chairMat,
    0.085,
  );
  loungeBack.rotation.x = -0.15;
  const backPiping = seamLoop(loungeBack, 0.86, 0.58, 0.11, leatherSeam);
  backPiping.rotation.x = Math.PI / 2;
  for (const x of [-0.22, 0.22])
    sphere(loungeBack, 0.016, x, 0.08, 0.11, leatherSeam, 1, 1, 0.5);
  const readingBook = paperBook(
    chair,
    0.32,
    0.42,
    0.045,
    0.05,
    0.83,
    0.08,
    mat('#d6ba7e'),
  );
  readingBook.rotation.y = -0.16;
  readingBook.name = 'Seat reading book';
  const shelf = placed('shelf');
  for (const x of [-1.06, 1.06])
    for (const z of [-0.22, 0.22])
      cylinder(shelf, 0.033, 0.033, 0.15, x, 0.153, z, brass);
  box(shelf, 2.34, 0.075, 0.63, 0, 0.26, 0, oak, 0.012);
  box(shelf, 2.34, 0.075, 0.63, 0, 2.88, 0, oak, 0.012);
  for (const x of [-1.13, 1.13])
    box(shelf, 0.075, 2.62, 0.63, x, 1.57, 0, paleWood, 0.015);
  box(shelf, 2.2, 2.53, 0.026, 0, 1.57, -0.292, darkWood, 0.003);
  for (const y of [1.0, 1.83])
    box(shelf, 2.24, 0.055, 0.6, 0, y, 0, paleWood, 0.012);
  box(shelf, 0.055, 2.56, 0.58, 0.23, 1.57, 0, paleWood, 0.01);
  const bookMats = ['#657565', '#c4ad7a', '#914f3c', '#ded5ba', '#334e4b'].map(
    (c) => mat(c),
  );
  for (let level = 0; level < 3; level++) {
    const base = [0.3, 1.03, 1.86][level];
    for (let i = 0; i < 7 - level; i++) {
      const w = 0.11 + (i % 3) * 0.018,
        h = 0.4 + (i % 4) * 0.055,
        x = -0.98 + i * 0.155;
      const book = new T.Group();
      shelf.add(book);
      book.position.set(x, base, 0);
      box(book, w, h, 0.36, 0, h / 2, 0.07, bookMats[(i + level) % 5], 0.009);
      box(book, w - 0.022, h - 0.027, 0.323, 0, h / 2, 0.079, cream, 0.004);
      box(book, w, h, 0.025, 0, h / 2, 0.253, bookMats[(i + level) % 5], 0.006);
      for (const y of [0.065, h - 0.065])
        box(book, w * 0.78, 0.012, 0.002, 0, y, 0.268, brass, 0.001);
      for (let j = 0; j < 3; j++)
        box(
          book,
          w * 0.57,
          0.006,
          0.002,
          0,
          h * 0.55 - j * 0.026,
          0.269,
          white,
          0.001,
        );
    }
    if (level === 1) {
      for (let i = 0; i < 3; i++)
        paperBook(
          shelf,
          0.57,
          0.4,
          0.095,
          0.68,
          base + i * 0.1,
          0.02,
          bookMats[i + 1],
        );
    } else {
      const linenBox = textile(level === 0 ? '#a0a18a' : '#b8ab8c');
      box(shelf, 0.66, 0.4, 0.47, 0.67, base + 0.2, 0.02, linenBox, 0.025);
      box(shelf, 0.15, 0.05, 0.018, 0.67, base + 0.27, 0.262, darkWood, 0.009);
      box(shelf, 0.12, 0.022, 0.02, 0.67, base + 0.27, 0.27, brass, 0.004);
    }
  }
  const leafMat = mat('#416547', 0.58),
    leafBack = mat('#63815a', 0.7),
    veinMat = mat('#80926a', 0.8),
    soil = mat('#392e24', 1);
  const plants = new Map<ObjectId, T.Group>();
  function plant(
    x: number,
    y: number,
    z: number,
    size = 1,
    id: ObjectId = 'plant',
  ) {
    const p = group(id, x, y, z);
    plants.set(id, p);
    p.scale.setScalar(size);
    lathe(
      p,
      [
        [0, 0],
        [0.13, 0],
        [0.155, 0.008],
        [0.17, 0.07],
        [0.215, 0.345],
        [0.23, 0.36],
        [0.23, 0.395],
        [0.208, 0.402],
        [0.196, 0.369],
        [0.166, 0.085],
        [0.14, 0.064],
        [0, 0.064],
      ],
      0,
      0,
      0,
      terra,
    );
    cylinder(p, 0.185, 0.185, 0.016, 0, 0.345, 0, soil);
    for (let i = 0; i < 26; i++) {
      const a = i * 2.399,
        r = 0.16 * Math.sqrt((i + 0.5) / 26);
      sphere(
        p,
        0.009 + (i % 3) * 0.004,
        Math.cos(a) * r,
        0.358,
        Math.sin(a) * r,
        soil,
        1,
        0.6,
        1,
      );
    }
    for (let i = 0; i < 8; i++) {
      const a = i * 2.399,
        h = 0.6 + (i % 4) * 0.2;
      const ex = Math.cos(a) * 0.24,
        ez = Math.sin(a) * 0.24;
      tube(
        p,
        [
          [0, 0.33, 0],
          [ex * 0.26, h * 0.77, ez * 0.26],
          [ex, h, ez],
        ],
        0.009,
        leafMat,
      );
      const geo = new T.PlaneGeometry(0.34, 0.52, 10, 20),
        pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const v = (pos.getY(k) + 0.26) / 0.52,
          u = pos.getX(k) / 0.17;
        const width = Math.pow(Math.sin(v * Math.PI), 0.78);
        pos.setXYZ(
          k,
          u * 0.17 * width,
          v * 0.52,
          0.065 * Math.sin(v * Math.PI) - u * u * 0.048 * width,
        );
      }
      geo.computeVertexNormals();
      const material = i % 2 ? leafMat : leafBack;
      material.side = T.DoubleSide;
      const leaf = mesh(geo, material, p, ex, h, ez);
      leaf.rotation.set(Math.sin(a) * 0.55, -a, -Math.cos(a) * 0.72);
      tube(
        leaf,
        [
          [0, 0, 0.001],
          [0, 0.16, 0.055],
          [0, 0.36, 0.056],
          [0, 0.52, 0.001],
        ],
        0.0025,
        veinMat,
      );
      for (const v of [0.24, 0.45, 0.66])
        for (const side of [-1, 1])
          tube(
            leaf,
            [
              [0, v * 0.52, 0.065 * Math.sin(v * Math.PI) + 0.002],
              [side * 0.073, v * 0.52 + 0.036, 0.028],
              [side * 0.125 * Math.sin(v * Math.PI), v * 0.52 + 0.053, 0.018],
            ],
            0.0013,
            veinMat,
          );
    }
    return p;
  }
  const bigPlant = plant(layout.plant.x, 0.078, layout.plant.z, 1.02);
  plant(-3.0, 2.93, -2.83, 0.42, 'shelfPlant');
  const deskPlant = plant(1.03, 1.275, -0.28, 0.32, 'deskPlant');
  desk.add(deskPlant);
  const record = placed('record');
  for (const x of [-0.73, 0.73])
    for (const z of [-0.24, 0.24])
      cylinder(record, 0.035, 0.028, 0.2, x, 0.18, z, brass);
  for (const y of [0.31, 0.99])
    box(record, 1.72, 0.07, 0.7, 0, y, 0, paleWood, 0.02);
  for (const x of [-0.825, 0.825])
    box(record, 0.07, 0.65, 0.68, x, 0.65, 0, oak, 0.015);
  box(record, 1.6, 0.62, 0.035, 0, 0.65, -0.327, oak, 0.004);
  box(record, 0.045, 0.62, 0.64, 0.13, 0.65, 0, oak, 0.005);
  const speakerFabric = textile('#484938');
  box(record, 0.6, 0.55, 0.035, 0.48, 0.65, 0.327, speakerFabric, 0.01);
  for (let i = 0; i < 14; i++)
    box(
      record,
      0.012,
      0.53,
      0.012,
      0.205 + i * 0.042,
      0.65,
      0.352,
      paleWood,
      0.003,
    );
  for (let i = 0; i < 8; i++) {
    const sleeve = box(
      record,
      0.044,
      0.49,
      0.47,
      -0.67 + i * 0.085,
      0.59,
      0.02,
      bookMats[i % 5],
      0.003,
    );
    sleeve.rotation.z = i === 7 ? -0.1 : 0;
    box(sleeve, 0.036, 0.045, 0.005, 0, 0.13, 0.24, cream, 0.001);
  }
  const deck = new T.Group();
  record.add(deck);
  deck.position.set(-0.31, 1.04, 0);
  for (const x of [-0.4, 0.4])
    for (const z of [-0.23, 0.23])
      cylinder(deck, 0.031, 0.031, 0.023, x, 0, z, charcoal);
  box(deck, 0.94, 0.11, 0.57, 0, 0.07, 0, oak, 0.024);
  box(deck, 0.88, 0.009, 0.51, 0, 0.13, 0, charcoal, 0.015);
  cylinder(deck, 0.225, 0.225, 0.021, -0.12, 0.15, 0, brass);
  const vinyl = cylinder(deck, 0.215, 0.215, 0.012, -0.12, 0.171, 0, charcoal);
  cylinder(vinyl, 0.058, 0.058, 0.002, 0, 0.007, 0, cream);
  box(vinyl, 0.011, 0.002, 0.045, 0.013, 0.009, 0.008, terra, 0.001);
  const grooveMat = mat('#474541', 0.28);
  for (let i = 0; i < 18; i++) {
    const g = mesh(
      new T.TorusGeometry(0.072 + i * 0.0077, 0.001, 4, 64),
      grooveMat,
      vinyl,
      0,
      0.008,
      0,
    );
    g.rotation.x = -Math.PI / 2;
  }
  cylinder(deck, 0.028, 0.028, 0.022, 0.35, 0.143, 0.19, brass);
  sphere(deck, 0.008, 0.37, 0.143, 0.1, mat('#d59954'), 1, 0.4, 1);
  const tonearm = new T.Group();
  deck.add(tonearm);
  tonearm.position.set(0.31, 0.17, -0.18);
  cylinder(tonearm, 0.035, 0.035, 0.06, 0, 0, 0, charcoal);
  rod(
    tonearm,
    new T.Vector3(0, 0.02, 0),
    new T.Vector3(-0.3, 0.02, 0.28),
    0.013,
    brass,
  );
  box(tonearm, 0.036, 0.023, 0.065, -0.3, 0.017, 0.28, charcoal, 0.006);

  const frame = group('frame', -3.775, 2.52, 0.67);
  frame.rotation.y = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.96;
    box(frame, 0.86, 1.22, 0.06, x, 0, 0, darkWood, 0.012);
    box(frame, 0.79, 1.15, 0.009, x, 0, 0.038, white, 0.001);
    box(frame, 0.685, 0.94, 0.006, x, 0.015, 0.045, artMats[i], 0.001);
    box(frame, 0.22, 0.036, 0.018, x, -0.67, 0.01, brass, 0.003);
    for (const side of [-1, 1])
      box(frame, 0.012, 1.19, 0.012, x + side * 0.411, 0, 0.034, brass, 0.002);
  }
  const rail = new T.Group();
  wall.add(rail);
  rail.position.set(-3.7, 3.37, 0.67);
  rail.rotation.y = Math.PI / 2;
  box(rail, 3.02, 0.026, 0.034, 0, 0, 0, charcoal, 0.004);
  for (const x of [-0.96, 0, 0.96]) {
    tube(
      rail,
      [
        [x, 0, 0],
        [x, -0.09, 0.08],
        [x, -0.14, 0.2],
      ],
      0.014,
      brass,
    );
    const head = cylinder(rail, 0.045, 0.05, 0.13, x, -0.16, 0.21, brass);
    head.rotation.x = 0.6;
  }
  const about = group('about', -1.04, 1.315, 0.25);
  desk.add(about);
  about.rotation.x = -0.09;
  box(about, 0.3, 0.37, 0.025, 0, 0.14, 0, darkWood, 0.008);
  box(about, 0.25, 0.32, 0.008, 0, 0.14, 0.02, cream, 0.001);
  sphere(about, 0.062, 0, 0.2, 0.027, charcoal, 1, 1, 0.12);
  sphere(about, 0.1, 0, 0.07, 0.027, charcoal, 1, 0.7, 0.12);
  tube(
    about,
    [
      [0, 0.23, -0.02],
      [0, -0.043, -0.13],
      [0, -0.043, 0.005],
    ],
    0.009,
    oak,
  );
  const cameraObject = group('camera', 0.78, 1.28, 0.17);
  desk.add(cameraObject);
  cameraObject.rotation.y = 0.3;
  for (const x of [-0.11, 0.11])
    cylinder(cameraObject, 0.016, 0.016, 0.012, x, -0.001, 0, charcoal);
  for (let i = 0; i < 26; i++) {
    const a = (i * Math.PI * 2) / 26;
    const grip = box(
      cameraObject,
      0.007,
      0.018,
      0.012,
      Math.cos(a) * 0.087,
      0.11 + Math.sin(a) * 0.087,
      0.16,
      brass,
      0.001,
    );
    grip.rotation.z = a;
  }

  box(cameraObject, 0.34, 0.2, 0.16, 0, 0.1, 0, charcoal, 0.025);
  box(cameraObject, 0.34, 0.04, 0.16, 0, 0.21, 0, brass, 0.01);
  const lens = cylinder(
    cameraObject,
    0.085,
    0.09,
    0.15,
    0,
    0.11,
    0.12,
    charcoal,
  );
  lens.rotation.x = Math.PI / 2;
  const lensGlass = mat('#22413f', 0.12);
  lensGlass.metalness = 0.7;
  const glass = cylinder(
    cameraObject,
    0.061,
    0.061,
    0.005,
    0,
    0.11,
    0.198,
    lensGlass,
  );
  glass.rotation.x = Math.PI / 2;
  mesh(
    new T.TorusGeometry(0.076, 0.006, 8, 32),
    brass,
    cameraObject,
    0,
    0.11,
    0.199,
  );
  cylinder(cameraObject, 0.03, 0.03, 0.025, 0.12, 0.246, 0, charcoal);
  box(cameraObject, 0.075, 0.045, 0.02, -0.1, 0.18, 0.086, white);
  const strap = new T.CatmullRomCurve3([
    new T.Vector3(-0.17, 0.16, 0),
    new T.Vector3(-0.26, 0.03, 0.18),
    new T.Vector3(0.21, 0.03, 0.28),
    new T.Vector3(0.18, 0.16, 0),
  ]);
  mesh(
    new T.TubeGeometry(strap, 30, 0.011, 5, false),
    darkWood,
    cameraObject,
    0,
    0,
    0,
  );
  const sculpture = group('sculpture', 0.56, 1.025, 0);
  record.add(sculpture);
  sculpture.scale.setScalar(0.59);
  cylinder(sculpture, 0.25, 0.25, 0.04, 0, 0.025, 0, cream);
  cylinder(sculpture, 0.18, 0.22, 0.026, 0, 0.058, 0, darkWood);
  const sculptSpin = new T.Group();
  sculpture.add(sculptSpin);
  const sculptMat = mat('#bf784d', 0.37);
  sculptMat.metalness = 0.28;
  const torus = mesh(
    new T.TorusGeometry(0.23, 0.065, 16, 64, Math.PI * 1.65),
    sculptMat,
    sculptSpin,
    0,
    0.31,
    0,
  );
  torus.rotation.z = -0.5;
  sphere(sculptSpin, 0.12, 0.12, 0.53, 0, brass);
  // Pen cup, desk mat and bound notebook.
  box(desk, 1.28, 0.009, 0.59, -0.2, 1.295, 0.07, fabric(mat('#6d7664')), 0.03);
  cylinder(desk, 0.07, 0.057, 0.18, -1.12, 1.39, -0.13, cream);
  for (let i = 0; i < 5; i++)
    rod(
      desk,
      new T.Vector3(-1.12 + i * 0.014, 1.34, -0.13),
      new T.Vector3(-1.15 + i * 0.02, 1.63 + (i % 2) * 0.035, -0.13),
      0.007,
      i % 2 ? oak : charcoal,
    );
  paperBook(desk, 0.26, 0.33, 0.037, 0.62, 1.275, -0.28, terra).rotation.y =
    -0.12;
  const taskLamp = group('taskLamp');
  desk.add(taskLamp);
  taskLamp.position.set(-1.09, 1.28, -0.27);
  // Counterweighted articulated lamp: every arm meets a real hinge, and the
  // shade, lining and light share one local transform so they cannot separate.
  cylinder(taskLamp, 0.133, 0.142, 0.026, 0, 0.015, 0, charcoal);
  cylinder(taskLamp, 0.128, 0.134, 0.022, 0, 0.039, 0, brass);
  cylinder(taskLamp, 0.035, 0.048, 0.063, 0, 0.075, 0, brass);
  const joints = [
    new T.Vector3(0, 0.11, 0),
    new T.Vector3(-0.1, 0.36, 0.01),
    new T.Vector3(0.035, 0.59, 0.18),
  ];
  for (let i = 0; i < 2; i++) {
    for (const offset of [-0.022, 0.022])
      rod(
        taskLamp,
        joints[i].clone().add(new T.Vector3(offset, 0, 0)),
        joints[i + 1].clone().add(new T.Vector3(offset, 0, 0)),
        0.009,
        brass,
      );
  }
  for (const point of joints) {
    const hinge = cylinder(
      taskLamp,
      0.027,
      0.027,
      0.07,
      point.x,
      point.y,
      point.z,
      brass,
    );
    hinge.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      const screw = cylinder(
        taskLamp,
        0.014,
        0.014,
        0.004,
        point.x + side * 0.038,
        point.y,
        point.z,
        charcoal,
      );
      screw.rotation.z = Math.PI / 2;
      box(
        taskLamp,
        0.002,
        0.003,
        0.016,
        point.x + side * 0.041,
        point.y,
        point.z,
        brass,
        0.0005,
      );
    }
  }
  const head = new T.Group();
  taskLamp.add(head);
  head.position.copy(joints[2]);
  head.rotation.x = -0.28;
  cylinder(head, 0.03, 0.035, 0.048, 0, -0.007, 0, brass);
  const shell = brass.clone();
  shell.side = T.DoubleSide;
  shell.roughness = 0.43;
  materials.push(shell);
  lathe(
    head,
    [
      [0.118, -0.2],
      [0.125, -0.195],
      [0.123, -0.183],
      [0.105, -0.14],
      [0.04, -0.023],
      [0.028, 0],
      [0.021, 0],
      [0.033, -0.032],
      [0.099, -0.146],
      [0.115, -0.185],
      [0.112, -0.195],
      [0.118, -0.2],
    ],
    0,
    0,
    0,
    shell,
  );
  const lining = mat('#f2e6c9', 0.76);
  lining.side = T.DoubleSide;
  lathe(
    head,
    [
      [0.109, -0.18],
      [0.095, -0.14],
      [0.034, -0.027],
    ],
    0,
    0,
    0,
    lining,
  );
  const bulb = mat('#fff0cf', 0.52);
  bulb.emissive.set('#ffd39a');
  bulb.emissiveIntensity = 1.2;
  cylinder(head, 0.1, 0.1, 0.008, 0, -0.169, 0, bulb);
  const deskLight = new T.PointLight('#ffcf92', 0.7, 2.6, 2);
  head.add(deskLight);
  deskLight.position.set(0, -0.209, 0);
  const cablePoints = joints.map((p) => [p.x + 0.005, p.y, p.z - 0.018]);
  tube(taskLamp, [[0.1, 0.038, -0.04], ...cablePoints], 0.004, charcoal);
  tube(
    taskLamp,
    [
      [0.1, 0.038, -0.04],
      [0.13, 0.012, -0.1],
      [0.15, -0.02, -0.2],
      [0.14, -0.13, -0.29],
    ],
    0.005,
    charcoal,
  );
  tube(
    desk,
    [
      [-0.39, 1.72, -0.255],
      [-0.39, 1.29, -0.43],
      [0.3, 1.26, -0.5],
      [0.3, 0.6, -0.55],
      [0.3, 0.32, -0.865],
    ],
    0.011,
    charcoal,
  );
  box(desk, 1.15, 0.065, 0.2, 0.1, 1.1, -0.38, charcoal, 0.008);
  box(wall, 0.22, 0.14, 0.018, 1.62, 0.32, -3.205, white, 0.01);
  for (const x of [1.57, 1.67]) {
    box(wall, 0.009, 0.035, 0.004, x, 0.325, -3.193, charcoal, 0.001);
  }
  box(wall, 0.018, 0.14, 0.22, -3.794, 0.3, 2.78, white, 0.01);
  tube(
    lamp,
    [
      [0.27, 0.11, -0.27],
      [-0.34, 0.086, -0.29],
      [-0.82, 0.1, -0.22],
      [-0.87, 0.28, 0],
    ],
    0.009,
    charcoal,
  );
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const ring = mesh(
        new T.TorusGeometry(0.062, 0.006, 7, 20),
        brass,
        win,
        side * (1.65 + i * 0.075),
        1.278,
        0.15,
      );
      ring.rotation.y = Math.PI / 2;
    }
  // Slatted joinery gives the open architectural edges a finished profile.
  for (let i = 0; i < 28; i++)
    box(
      floor,
      0.022,
      0.19,
      0.012,
      -3.75 + i * 0.277,
      -0.24,
      3.407,
      darkWood,
      0.002,
    );
  const clock = new T.Group();
  wall.add(clock);
  clock.position.set(-0.68, 2.98, -3.17);
  const clockFace = cylinder(clock, 0.22, 0.22, 0.055, 0, 0, 0, brass);
  clockFace.rotation.x = Math.PI / 2;
  const face = cylinder(clock, 0.195, 0.195, 0.012, 0, 0, 0.037, white);
  face.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const tick = box(
      clock,
      0.007,
      0.019,
      0.004,
      Math.sin(a) * 0.166,
      Math.cos(a) * 0.166,
      0.047,
      charcoal,
      0.001,
    );
    tick.rotation.z = -a;
  }
  tube(
    clock,
    [
      [0, 0.02, 0.05],
      [0.08, 0.08, 0.05],
    ],
    0.006,
    charcoal,
  );
  tube(
    clock,
    [
      [0, 0, 0.051],
      [-0.03, -0.11, 0.051],
    ],
    0.004,
    charcoal,
  );
  sphere(clock, 0.013, 0, 0, 0.053, brass, 1, 1, 0.3);
  // Soft contact patches anchor furniture while avoiding expensive postprocessing.
  const contactTexture = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(40,29,16,0.24)');
    gradient.addColorStop(1, 'rgba(40,29,16,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(c);
  })();
  const contactMat = new T.MeshBasicMaterial({
    map: contactTexture,
    transparent: true,
    depthWrite: false,
  });
  materials.push(contactMat);
  for (const id of [
    'bed',
    'chair',
    'desk',
    'coffee',
    'shelf',
    'record',
    'lamp',
    'stool',
  ] as const) {
    const item = layout[id];
    const patch = mesh(
      new T.PlaneGeometry(item.width * 1.12, item.depth * 1.12),
      contactMat,
      root,
      item.x,
      0.079,
      item.z,
    );
    patch.rotation.set(-Math.PI / 2, 0, -item.yaw);
    patch.castShadow = false;
  }
  const cutaways = createWallCutaways();
  const studyWest = new T.Group(),
    studyNorth = new T.Group();
  for (const child of wall.children.slice())
    (child.position.x < -3.6 ? studyWest : studyNorth).add(child);
  wall.add(studyWest, studyNorth);
  cutaways.add([studyWest, frame], { x: -3.91, z: 0, nx: 1, nz: 0 }, ['study']);
  cutaways.add([studyNorth, win], { x: 0, z: -3.31, nx: 0, nz: 1 }, ['study']);
  const houseCenter = new T.Vector3(
    (houseBounds.minX + houseBounds.maxX) / 2,
    0,
    (houseBounds.minZ + houseBounds.maxZ) / 2,
  );
  const house = buildHouse({
    assets,
    floorMaterials,
    contactMaterial: contactMat,
    breeze,
    seats: seatAnchors,
    cutaways,
    landscape,
    onModelReady: () => refreshShadows(),
    scene,
    study: root,
    groups,
    interactables,
    materials,
    textures,
    oak,
    paleWood,
    darkWood,
    cream,
    white,
    ceramic,
    brass,
    charcoal,
    textile,
  });
  const atmosphere = interiorAtmosphere(
    house.roots,
    groups,
    materials,
    textures,
  );
  let life: LifeScene | undefined,
    lifePaused = false,
    lifeAudio: AudioContext | null = null,
    lifeVisitors: Visitor[] = [];
  breeze.add(leafMat);
  house.setView('study');
  if (seatAnchors.size !== seats.length)
    throw new Error('座位模型与座位目录不一致');
  const visitors = createSeatScene(
    scene,
    seatAnchors,
    interactables,
    () => refreshShadows(),
    assets,
  );
  const tvScreen = televisionScreen(host, house.screen);
  const televisionTint = new T.Color('#a3bbc7');
  const computerScreen = televisionScreen(host, computerPanel, {
    width: 1.13,
    height: 0.67,
    pixelsWidth: 1280,
    pixelsHeight: 760,
  });
  const raycaster = new T.Raycaster();
  const mouse = new T.Vector2();
  let downX = 0,
    downY = 0;
  const activePointers = new Set<number>();
  let multiTouch = false;

  const pick = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    const pickedHits = raycaster.intersectObjects(
      interactables.filter((o) => {
        let node: T.Object3D | null = o;
        while (node) {
          if (!node.visible) return false;
          node = node.parent;
        }
        return true;
      }),
      true,
    );
    const hit = pickedHits.find(({ object }) => {
      for (let node: T.Object3D | null = object; node; node = node.parent)
        if (!node.visible) return false;
      return true;
    });
    if (!hit) return null;
    const seatId = visitors.pick(hit);
    if (seatId) return { seatId, id: null };
    let o: T.Object3D | null = hit.object;
    let actor: T.Object3D | null = hit.object;
    while (actor && !actor.userData.actorId) actor = actor.parent;
    if (actor?.userData.actorId)
      return {
        id: null,
        seatId: null,
        actorId: actor.userData.actorId as ActorId,
      };
    while (o && !o.userData.id) o = o.parent;
    return o?.userData.id
      ? { id: o.userData.id as ObjectId, seatId: null }
      : null;
  };
  const pointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.tv-native-screen')) return;
    activePointers.add(e.pointerId);
    if (activePointers.size > 1) multiTouch = true;
    downX = e.clientX;
    downY = e.clientY;
  };
  const pointerMove = (e: PointerEvent) => {
    const hit = pick(e);
    host.style.cursor = hit ? 'pointer' : 'grab';
    visitors.hover(hit?.seatId || null);
    options.onHover(hit?.id || null, e.clientX, e.clientY);
  };
  const pointerLeave = () => {
    visitors.hover(null);
    options.onHover(null, 0, 0);
  };
  const pointerCancel = () => {
    activePointers.clear();
    multiTouch = false;
  };
  const pointerUp = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.tv-native-screen')) return;
    activePointers.delete(e.pointerId);
    const wasMulti = multiTouch;
    if (activePointers.size === 0) multiTouch = false;
    if (
      wasMulti ||
      e.button !== 0 ||
      Math.hypot(e.clientX - downX, e.clientY - downY) > 6
    )
      return;
    if (activeView === 'plan') {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const point = raycaster.ray.intersectPlane(
        new T.Plane(new T.Vector3(0, 1, 0), -0.08),
        new T.Vector3(),
      );
      const hitRoom = point ? roomAt(point.x, point.z) : undefined;
      if (hitRoom) {
        api.setView(hitRoom);
        options.onSelect(null);
      }
      return;
    }
    const hit = pick(e);
    if (hit && 'actorId' in hit && hit.actorId) {
      life?.click(hit.actorId);
      return;
    }
    if (hit?.seatId) {
      api.focusSeat(hit.seatId);
      options.onSeatSelect(hit.seatId);
    } else if (hit?.id) {
      api.focus(hit.id);
      options.onSelect(hit.id);
    }
  };
  host.addEventListener('pointerdown', pointerDown);
  host.addEventListener('pointermove', pointerMove);
  host.addEventListener('pointerleave', pointerLeave);
  host.addEventListener('pointerup', pointerUp);
  host.addEventListener('pointercancel', pointerCancel);
  let tween: {
    from: T.Vector3;
    to: T.Vector3;
    targetFrom: T.Vector3;
    targetTo: T.Vector3;
    start: number;
  } | null = null;
  const motionPreference = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );
  let reduced = motionPreference.matches;
  const motionChanged = () => {
    reduced = motionPreference.matches;
    if (reduced && tween) {
      camera.position.copy(tween.to);
      controls.target.copy(tween.targetTo);
      tween = null;
    }
  };
  motionPreference.addEventListener('change', motionChanged);
  function moveTo(to: T.Vector3, look: T.Vector3) {
    if (reduced) {
      camera.position.copy(to);
      controls.target.copy(look);
      return;
    }
    tween = {
      from: camera.position.clone(),
      to,
      targetFrom: controls.target.clone(),
      targetTo: look,
      start: performance.now(),
    };
  }
  const stopTween = () => {
    tween = null;
  };
  controls.addEventListener('start', stopTween);
  let night = false,
    lit = true,
    masterLight = true,
    music = false,
    bedColor = 0,
    chairColor = 0,
    rugColor = 0;
  const wateringUntil = new Map<ObjectId, number>();
  let steamUntil = 0,
    taskLit = true;
  let drawerOpen = false,
    sculptAngle = 0,
    chairPulled = false,
    disposed = false;
  const waterMat = mat('#9ecee5');
  const wateringEffects = new Map<ObjectId, T.Group>();
  for (const [id, p] of plants) {
    const drops = new T.Group();
    p.add(drops);
    drops.visible = false;
    wateringEffects.set(id, drops);
    for (let i = 0; i < 8; i++)
      sphere(
        drops,
        0.022,
        Math.sin(i * 3) * 0.19,
        1.1 + i * 0.1,
        Math.cos(i * 3) * 0.19,
        waterMat,
        0.7,
        1.7,
        0.7,
      );
  }
  function frameTelevision() {
    const center = house.screen.getWorldPosition(new T.Vector3());
    const horizontalTangent =
      Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const distance = Math.max(5.7, 4.65 / (2 * horizontalTangent));
    controls.maxPolarAngle = Math.PI / 2;
    moveTo(center.clone().add(new T.Vector3(0, 0.04, distance)), center);
  }
  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h);
    tvScreen.resize(w, h);
    computerScreen.resize(w, h);
    camera.aspect = w / h;
    camera.fov = T.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(T.MathUtils.degToRad(18)) * Math.max(1, 1.05 / (w / h)),
        ),
    );
    camera.updateProjectionMatrix();
    if (focusedObject === 'television') frameTelevision();
    if (activeView === 'plan') queueMicrotask(() => api.setView('plan'));
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let frameId = 0;
  let shadowsUntil = 0,
    lastShadow = -Infinity;
  function refreshShadows(duration = 1400) {
    shadowsUntil = performance.now() + duration;
    renderer.shadowMap.needsUpdate = true;
  }
  let environment: Environment = { time: 'sunset', weather: 'clear' };
  let lightTarget = environmentLight(environment);
  const start = performance.now();
  let last = performance.now();
  function animate(now: number) {
    frameId = requestAnimationFrame(animate);
    if (document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = (now - start) / 1000;
    if (tween) {
      const p = Math.min((now - tween.start) / 850, 1),
        s = 1 - Math.pow(1 - p, 3);
      camera.position.lerpVectors(tween.from, tween.to, s);
      controls.target.lerpVectors(tween.targetFrom, tween.targetTo, s);
      if (p === 1) tween = null;
    }
    // Static views reuse the shadow map; animated furniture and lighting refresh it at 20 Hz.
    if (
      now - lastShadow >
      (now < shadowsUntil ||
      (!motionPreference.matches && visitors.hasVisibleVisitors())
        ? 50
        : 400)
    ) {
      renderer.shadowMap.needsUpdate = true;
      lastShadow = now;
    }
    const a = 1 - Math.exp(-dt * 3);
    hemi.intensity = T.MathUtils.lerp(hemi.intensity, lightTarget.ambient, a);
    indoorBounce.intensity = T.MathUtils.lerp(
      indoorBounce.intensity,
      masterLight ? (night ? 0.22 : 0.12) : 0,
      a,
    );
    hemi.color.lerp(lightTarget.hemi, a);
    hemi.groundColor.lerp(lightTarget.ground, a);
    sun.intensity = T.MathUtils.lerp(sun.intensity, lightTarget.power, a);
    const centre =
      activeView === 'overview' || activeView === 'plan'
        ? houseCenter.clone()
        : new T.Vector3(rooms[activeView].x, 0, rooms[activeView].z);
    sun.target.position.lerp(centre, a);
    sun.position.lerp(lightTarget.position.clone().add(centre), a);
    sun.color.lerp(lightTarget.sun, a);
    fill.intensity = T.MathUtils.lerp(fill.intensity, lightTarget.fill, a);
    fill.color.lerp(lightTarget.hemi, a);
    shadowMat.opacity = T.MathUtils.lerp(
      shadowMat.opacity,
      environment.weather === 'clear' ? 0.12 : 0.025,
      a,
    );
    windowEnvironment.update(t, dt, reduced, camera);
    studySofaSeats.forEach((seat, i) => {
      const occupied = occupiedStudySeats.has(`study-sofa-${i + 1}`);
      seat.scale.y = T.MathUtils.lerp(seat.scale.y, occupied ? 0.86 : 1, a);
      seat.position.y = T.MathUtils.lerp(
        seat.position.y,
        occupied ? 0.594 : 0.61,
        a,
      );
      const id = `study-sofa-${i + 1}`,
        anchor = seatAnchors.get(id);
      if (anchor)
        anchor.position.y =
          seatById.get(id)!.offset[1] +
          seat.position.y -
          0.61 +
          (seat.scale.y - 1) * 0.115;
    });
    breeze.update(t, reduced);
    life?.setView(activeView);
    life?.setReduced(motionPreference.matches);
    life?.update(dt, environment);
    atmosphere.setView(activeView);
    atmosphere.update(t, dt, reduced, environment);
    house.update(t, dt, reduced, night, camera);
    visitors.update(t, motionPreference.matches);
    if (cutaways.update(activeView, camera.position)) refreshShadows();
    lampLight.intensity = T.MathUtils.lerp(
      lampLight.intensity,
      masterLight && lit ? (night ? 12 : 5) : 0,
      a,
    );
    shade.emissiveIntensity = T.MathUtils.lerp(
      shade.emissiveIntensity,
      masterLight && lit ? 0.75 : 0,
      a,
    );
    screenLight.intensity = T.MathUtils.lerp(
      screenLight.intensity,
      computerPowered && activeView === 'study' ? (night ? 1.8 : 0.1) : 0,
      a,
    );
    deskLight.intensity = T.MathUtils.lerp(
      deskLight.intensity,
      masterLight && taskLit ? (night ? 1.7 : 0.45) : 0,
      a,
    );
    bulb.emissiveIntensity = masterLight && taskLit ? 1.2 : 0;
    if (music && !reduced) vinyl.rotation.y += dt * 1.5;
    tonearm.rotation.z = T.MathUtils.lerp(
      tonearm.rotation.z,
      music ? 0 : -0.09,
      1 - Math.exp(-dt * 1.3),
    );
    tonearm.rotation.y = T.MathUtils.lerp(
      tonearm.rotation.y,
      music ? 0.05 : -0.55,
      a,
    );
    drawer.position.z = T.MathUtils.lerp(
      drawer.position.z,
      drawerOpen ? drawerTravel : 0,
      a,
    );
    sculptSpin.rotation.y = T.MathUtils.lerp(
      sculptSpin.rotation.y,
      sculptAngle,
      a,
    );
    stool.position.z = T.MathUtils.lerp(
      stool.position.z,
      layout.stool.z + (chairPulled ? workChairTravel : 0),
      a,
    );

    if (!reduced) bigPlant.rotation.z = Math.sin(t * 0.7) * 0.01;
    for (const [id, drops] of wateringEffects) {
      drops.visible = now < (wateringUntil.get(id) || 0);
      if (drops.visible)
        drops.children.forEach((drop, i) => {
          drop.position.y = 1.4 - ((t * 0.7 + i * 0.11) % 1);
        });
    }
    coffeeSteam.update(
      dt,
      now < steamUntil ? 1.3 : 0.7,
      reduced,
      ['study', 'overview'].includes(activeView),
    );
    controls.update();
    // Keep panning bounded around the current room or whole house, preserving camera distance.
    const panCenter =
      activeView === 'overview' || activeView === 'plan'
        ? houseCenter
        : new T.Vector3(rooms[activeView].x, 0, rooms[activeView].z);
    const panRange =
      activeView === 'overview' || activeView === 'plan'
        ? 22
        : activeView === 'cafe'
          ? 9
          : 5;
    const unclamped = controls.target.clone();
    controls.target.x = T.MathUtils.clamp(
      controls.target.x,
      panCenter.x - panRange,
      panCenter.x + panRange,
    );
    controls.target.z = T.MathUtils.clamp(
      controls.target.z,
      panCenter.z - panRange,
      panCenter.z + panRange,
    );
    controls.target.y = T.MathUtils.clamp(controls.target.y, 0.15, 4.5);
    camera.position.add(controls.target.clone().sub(unclamped));
    landscape.update(camera, t);
    tvScreen.update(camera);
    if (!tvScreen.sampleColor(televisionTint, t)) televisionTint.set('#a3bbc7');
    house.setTVTint(televisionTint);
    computerScreen.update(camera, focusedObject === 'computer');
    renderer.render(scene, camera);
  }
  const occupiedStudySeats = new Set<string>();
  const api: RoomApi = {
    setCameraMode(mode) {
      controls.mouseButtons.LEFT =
        mode === 'pan' ? T.MOUSE.PAN : T.MOUSE.ROTATE;
      controls.touches.ONE = mode === 'pan' ? T.TOUCH.PAN : T.TOUCH.ROTATE;
    },
    setLifePaused(paused) {
      lifePaused = paused;
      life?.setPaused(paused);
    },
    setLifeAudio(context) {
      lifeAudio = context;
      life?.setAudio(context);
    },
    greetResident() {
      life?.click('resident');
    },
    lifeSnapshot: () => life?.snapshot(),
    setProjects: (projects) => house.setProjects(projects),
    retryAssets: () => {
      assets.retry();
      visitors.retry();
    },
    setVisitors: (people, me) => {
      lifeVisitors = people;
      life?.setVisitors(people);
      visitors.setVisitors(people, me);
      const ids = people.map((p) => p.seatId);
      house.setOccupied(ids);
      atmosphere.setOccupied(ids);
      occupiedStudySeats.clear();
      ids.forEach((id) => occupiedStudySeats.add(id));
    },
    focusSeat(id) {
      const seat = seatById.get(id),
        anchor = seatAnchors.get(id);
      if (!seat || !anchor) return;
      if (activeView !== seat.room) api.setView(seat.room);
      focusedObject = null;
      if (id === 'study-work') chairPulled = true;
      house.setSeatFocus();
      anchor.updateWorldMatrix(true, false);
      const center = anchor
        .getWorldPosition(new T.Vector3())
        .add(new T.Vector3(0, 0.55, 0));
      const angle = anchor.getWorldQuaternion(new T.Quaternion());
      const offset = new T.Vector3(2.4, 1.8, 4.4).applyQuaternion(angle);
      controls.minDistance = 1.2;
      moveTo(center.clone().add(offset), center);
      refreshShadows();
    },
    setView(view) {
      refreshShadows();
      activeView = view;
      focusedObject = null;
      house.setView(view);
      assets.activate(view);
      visitors.refreshVisible();
      releaseHiddenRoomGpu(scene);
      options.onView(view);
      const all = view === 'overview' || view === 'plan';
      controls.minPolarAngle = view === 'plan' ? 0.001 : Math.PI / 9;
      controls.maxPolarAngle = view === 'plan' ? 0.001 : Math.PI / 2.15;
      controls.enableRotate = view !== 'plan';
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      controls.minDistance = all ? 18 : 5;
      sun.shadow.camera.left = sun.shadow.camera.bottom = all
        ? -23
        : view === 'cafe'
          ? -13
          : -8;
      sun.shadow.camera.right = sun.shadow.camera.top = all
        ? 23
        : view === 'cafe'
          ? 13
          : 8;
      sun.shadow.camera.updateProjectionMatrix();
      if (view === 'plan') {
        const height =
          (houseBounds.maxZ - houseBounds.minZ + 8.5) /
          (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)));
        const width =
          (houseBounds.maxX - houseBounds.minX + 2) /
          (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
        moveTo(
          houseCenter
            .clone()
            .add(new T.Vector3(0, Math.max(height, width), 0.04)),
          houseCenter.clone(),
        );
      } else if (view === 'overview')
        moveTo(
          houseCenter.clone().add(new T.Vector3(22, 33, 30)),
          houseCenter.clone().add(new T.Vector3(0, 1, 0)),
        );
      else {
        const offset = new T.Vector3(rooms[view].x, 0, rooms[view].z);
        const vantage =
          view === 'cafe'
            ? new T.Vector3(10, 12, 21)
            : view === 'bedroom'
              ? new T.Vector3(2, 9.2, 15.5)
              : initial.clone();

        if (view === 'cafe' && camera.aspect < 1) vantage.multiplyScalar(1.12);
        moveTo(vantage.add(offset), target.clone().add(offset));
      }
    },
    setTelevision(on, source) {
      house.setTelevision(on, source);
    },
    setComputerPower(on) {
      computerPowered = on;
      computerScreen.setBaseMaterial(on ? screenMat : computerOff);
    },
    setComputerScreen(element) {
      computerScreen.set(element);
    },
    setWallPictures(pictures) {
      house.setWallPictures(pictures);
    },
    setTVScreen(element) {
      tvScreen.set(element);
    },
    reset() {
      this.setView(activeView);
    },
    zoom(direction) {
      const delta = camera.position.clone().sub(controls.target);
      delta.multiplyScalar(direction > 0 ? 0.83 : 1.2);
      delta.clampLength(controls.minDistance, controls.maxDistance);
      moveTo(controls.target.clone().add(delta), controls.target.clone());
    },
    focus(id) {
      const room = roomForObject(id);
      const entering = activeView !== room;
      if (activeView !== room && id !== 'floor' && id !== 'wall')
        this.setView(room);
      const g = groups.get(id);
      if (!g) return;
      focusedObject = id;
      house.setFocus(id);
      if (id === 'floor' || id === 'wall') {
        this.reset();
        return;
      }
      if (id === 'window' || id.endsWith('Window')) {
        const aperture = windowViews[room],
          bearing = T.MathUtils.degToRad(aperture.bearing);
        const center = new T.Vector3(...aperture.position);
        const inside = new T.Vector3(-Math.sin(bearing), 0, Math.cos(bearing));
        const right = new T.Vector3(Math.cos(bearing), 0, Math.sin(bearing));
        const eye = center
          .clone()
          .addScaledVector(inside, 4.5)
          .addScaledVector(right, 0.65);
        eye.y = 2.65;
        moveTo(eye, center.clone().add(new T.Vector3(0, 0.08, 0)));
        return;
      }
      if (/^(livingArt[12]|galleryArt[123])$/.test(id)) {
        const center = new T.Box3().setFromObject(g).getCenter(new T.Vector3());
        controls.minDistance = 2.4;
        const normal = id.startsWith('living')
          ? new T.Vector3(1, 0.06, 0.1)
          : new T.Vector3(0.1, 0.06, 1);
        moveTo(center.clone().addScaledVector(normal, 4.6), center);
        return;
      }
      if (id === 'computer') {
        const center = computerPanel.getWorldPosition(new T.Vector3());
        controls.minDistance = 1.5;
        controls.maxPolarAngle = Math.PI / 2;
        moveTo(center.clone().add(new T.Vector3(0.1, 0.08, 2.4)), center);
        return;
      }
      if (id === 'television') {
        frameTelevision();
        return;
      }
      controls.maxPolarAngle = Math.PI / 2.15;
      const smallDetail = [
        'livingCup',
        'livingRemote',
        'bedroomClock',
        'controller',
      ].includes(id);
      controls.minDistance = smallDetail ? 0.7 : 2.4;
      const bounds = new T.Box3().setFromObject(g);
      const center = bounds.getCenter(new T.Vector3());
      if (smallDetail)
        g.getWorldPosition(center).add(
          new T.Vector3(
            0,
            id === 'bedroomClock' ? 0.21 : id === 'livingCup' ? 0.12 : 0.025,
            0,
          ),
        );
      const dir = (
        id === 'cafeEspresso'
          ? new T.Vector3(0.6, 0.48, -1)
          : id === 'cafePourOver'
            ? new T.Vector3(0.45, 0.38, 1)
            : id === 'livingWindow' || id === 'galleryWindow'
              ? new T.Vector3(-1, 0.5, 0.65)
              : id === 'wardrobe'
                ? new T.Vector3(-1, 0.5, 0.65)
                : [
                      'television',
                      'switch',
                      'console',
                      'mediaDrawer',
                      'livingSpeakers',
                      'bedroomClock',
                    ].includes(id)
                  ? new T.Vector3(0, 0.38, 1)
                  : id === 'chair' || id === 'record' || id === 'sculpture'
                    ? new T.Vector3(-1, 0.72, 0.64)
                    : entering
                      ? new T.Vector3(1, 0.85, 1.2)
                      : camera.position.clone().sub(controls.target)
      ).normalize();
      const distance = smallDetail
        ? id === 'bedroomClock'
          ? 1.65
          : 1.3
        : id === 'frame'
          ? 9
          : Math.max(
              4.5,
              Math.min(8, bounds.getSize(new T.Vector3()).length() * 1.65),
            );
      moveTo(center.clone().add(dir.multiplyScalar(distance)), center);
    },
    setEnvironment(value) {
      refreshShadows(2500);
      environment = value;
      night = value.time === 'night';
      lightTarget = environmentLight(value);
      windowEnvironment.set(value);
      landscape.set(value);
      house.setEnvironment(value);
    },
    setLamp(value) {
      masterLight = value;
      house.setLamp(value);
    },
    setMusic(value) {
      music = value;
      house.setMusic(value);
    },
    setAppearance(value) {
      bedColor = value.bed;
      chairColor = value.chair;
      rugColor = value.rug;
      bedding.color.set(['#74856b', '#b8816b', '#7b91a2'][bedColor]);
      chairMat.color.set(['#cf966a', '#7f9479', '#9d8287'][chairColor]);
      rugMat.color.set(['#e5d8b8', '#b1bdac', '#d7bda4'][rugColor]);
      house.setAppearance(value);
      refreshShadows();
    },
    interact(id, detail) {
      refreshShadows();
      if (['cafeEspresso', 'cafePourOver'].includes(id)) life?.claimCoffee();
      house.interact(id, detail);
      if (id === 'bed')
        bedding.color.set(['#74856b', '#b8816b', '#7b91a2'][++bedColor % 3]);
      if (id === 'chair')
        chairMat.color.set(['#cf966a', '#7f9479', '#9d8287'][++chairColor % 3]);
      if (id === 'rug')
        rugMat.color.set(['#e5d8b8', '#b1bdac', '#d7bda4'][++rugColor % 3]);
      if (plants.has(id)) wateringUntil.set(id, performance.now() + 3200);
      if (id === 'lamp') lit = !lit;
      if (id === 'taskLamp') taskLit = !taskLit;
      if (id === 'coffee') steamUntil = performance.now() + 6000;
      if (id === 'stool') chairPulled = !chairPulled;
      if (id === 'drawer') drawerOpen = !drawerOpen;
      if (id === 'sculpture') sculptAngle += Math.PI / 2;
    },
    setArtwork(images) {
      const refreshScreen = () => {
        const previous = display;
        display = screenTexture(
          artMats.map((m) => m.map!.image as CanvasImageSource),
        );
        screenMat.map = display;
        screenMat.emissiveMap = display;
        screenMat.needsUpdate = true;
        const oldIndex = textures.indexOf(previous);
        if (oldIndex >= 0) textures.splice(oldIndex, 1);
        previous.dispose();
        textures.push(display);
      };
      Array.from({ length: 3 }, (_, i) => images[i] || '').forEach((url, i) => {
        const m = artMats[i];
        if (m.userData.url === url) return;
        m.userData.url = url;
        const replaceMap = (next: T.Texture) => {
          const previous = m.map;
          m.map = next;
          m.needsUpdate = true;
          refreshScreen();
          if (previous && previous !== artMaps[i] && previous !== next) {
            const old = textures.indexOf(previous);
            if (old >= 0) textures.splice(old, 1);
            previous.dispose();
          }
        };
        if (!url) {
          replaceMap(artMaps[i]);
          return;
        }
        // Private user artwork stays on its data/blob URL and never enters the public catalog.
        new T.TextureLoader().load(url, (t) => {
          if (disposed || m.userData.url !== url) {
            t.dispose();
            return;
          }
          t.colorSpace = T.SRGBColorSpace;
          t.anisotropy = 8;
          textures.push(t);
          replaceMap(t);
        });
      });
    },
    dispose() {
      coffeeSteam.dispose();
      disposed = true;
      life?.dispose();
      assets.dispose();
      setAssetRenderer(undefined);
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      motionPreference.removeEventListener('change', motionChanged);
      host.removeEventListener('pointerdown', pointerDown);
      host.removeEventListener('pointermove', pointerMove);
      host.removeEventListener('pointerleave', pointerLeave);
      host.removeEventListener('pointerup', pointerUp);
      host.removeEventListener('pointercancel', pointerCancel);
      windowEnvironment.dispose();
      computerScreen.dispose();
      tvScreen.dispose();
      house.dispose();
      visitors.dispose();
      landscape.dispose();
      const geometries = new Set<T.BufferGeometry>();
      scene.traverse((o) => {
        if (o instanceof T.Mesh) geometries.add(o.geometry);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      contactTexture.dispose();
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  controls.update();
  renderer.render(scene, camera);
  frameId = requestAnimationFrame(animate);
  assets.activate('study');
  options.onReady();
  // Let the basic room render first. This optional module never gates the house loading state.
  setTimeout(() => {
    if (disposed) return;
    void import('./life-scene')
      .then(async ({ createLifeScene, loadLifeSession }) => {
        const session = await loadLifeSession();
        if (disposed) return;
        life = createLifeScene(
          {
            assets,
            renderer,
            groups,
            scene,
            roots: house.roots,
            camera,
            interactables,
            seats: seatAnchors,
            visitors: lifeVisitors,
            cat: atmosphere,
            coffee: () => house.interact('cafeEspresso'),
            aroma: (room) => {
              if (room === 'study') steamUntil = performance.now() + 8000;
              else house.aroma(room);
            },
            bubble: options.onLifeBubble,
            collections: options.onCollections,
          },
          session,
        );
        life.setPaused(lifePaused);
        life.setAudio(lifeAudio);
        life.setVisitors(lifeVisitors);
      })
      .catch(() =>
        options.onLifeBubble('小屋伙伴暂时在休息，其余空间仍可探索。'),
      );
  }, 700);
  return api;
}
