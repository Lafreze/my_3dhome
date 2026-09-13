import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeSurface } from './house-finishes';
import type { ObjectId } from './room-data';
import type { HouseView } from './house-data';

export function createLivedInDetails(k: {
  roots: Record<string, T.Group>;
  groups: Map<ObjectId, T.Group>;
  interactables: T.Object3D[];
  materials: T.Material[];
  textures: T.Texture[];
  bubble: (text: string) => void;
}) {
  const mat = (color: string, roughness = 0.8, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    k.materials.push(m);
    return m;
  };
  const sage = mat('#798b75', 0.43),
    cream = mat('#e3ddcc'),
    dark = mat('#393d35', 0.52),
    brass = mat('#b99b63', 0.38, 0.65),
    wood = mat('#8f7255'),
    paper = mat('#e9dfca'),
    cotton = mat('#b7b5a2'),
    rust = mat('#a56f55'),
    steel = mat('#b8bcb1', 0.32, 0.83);
  Object.assign(wood, makeSurface('ash', k.textures));
  Object.assign(cotton, makeSurface('cotton', k.textures));
  cotton.side = T.DoubleSide;
  const mesh = (
    p: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.receiveShadow = true;
    p.add(o);
    return o;
  };
  const box = (
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) =>
    mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.012, w / 3, h / 3, d / 3)),
      m,
      x,
      y,
      z,
    );
  const group = (p: T.Object3D, x = 0, y = 0, z = 0) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    p.add(g);
    return g;
  };
  const cyl = (
    p: T.Object3D,
    r: number,
    h: number,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => mesh(p, new T.CylinderGeometry(r, r, h, 24), m, x, y, z);
  const tube = (
    p: T.Object3D,
    points: number[][],
    radius: number,
    m: T.Material,
  ) =>
    mesh(
      p,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(
          points.map((v) => new T.Vector3(...(v as [number, number, number]))),
        ),
        24,
        radius,
        6,
        false,
      ),
      m,
    );
  const lathe = (p: T.Object3D, points: number[][], m: T.Material) =>
    mesh(
      p,
      new T.LatheGeometry(
        points.map((v) => new T.Vector2(...(v as [number, number]))),
        32,
      ),
      m,
    );
  const register = (g: T.Group, id: ObjectId) => {
    g.name = id;
    g.userData.id = id;
    k.groups.set(id, g);
    k.interactables.push(g);
  };
  // Merge fixed subassemblies, keeping each real pivot separate.
  const batch = (g: T.Group) => {
    const bins = new Map<T.Material, T.BufferGeometry[]>();
    g.updateMatrixWorld(true);
    for (const o of g.children.slice())
      if (o instanceof T.Mesh && !Array.isArray(o.material)) {
        const copy = (
          o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
        ).applyMatrix4(o.matrix);
        const list = bins.get(o.material) || [];
        list.push(copy);
        bins.set(o.material, list);
        o.geometry.dispose();
        g.remove(o);
      }
    for (const [m, pieces] of bins) {
      const combined = mergeGeometries(pieces);
      if (combined) mesh(g, combined, m);
      pieces.forEach((g) => g.dispose());
    }
  };
  const desk = k.groups.get('desk')!;
  const fan = group(desk, -1.08, 1.27, 0.31);
  fan.scale.setScalar(0.88);
  register(fan, 'deskFan');
  box(fan, 0.23, 0.035, 0.23, sage, 0, 0.018);
  box(fan, 0.065, 0.28, 0.055, sage, 0, 0.17, -0.035);
  cyl(fan, 0.018, 0.02, brass, 0.067, 0.045, 0.064);
  const head = group(fan, 0, 0.38, 0),
    rotor = group(head, 0, 0, 0.008);
  head.name = 'fan-head-pivot';
  rotor.name = 'fan-blade-pivot';
  for (const z of [-0.06, 0.068]) {
    for (const radius of [0.065, 0.12, 0.179])
      mesh(head, new T.TorusGeometry(radius, 0.0035, 5, 40), dark, 0, 0, z);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      tube(
        head,
        [
          [Math.cos(a) * 0.025, Math.sin(a) * 0.025, z + 0.013],
          [Math.cos(a) * 0.095, Math.sin(a) * 0.095, z + 0.008],
          [Math.cos(a) * 0.179, Math.sin(a) * 0.179, z],
        ],
        0.0028,
        dark,
      );
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    tube(
      head,
      [
        [Math.cos(a) * 0.179, Math.sin(a) * 0.179, -0.06],
        [Math.cos(a) * 0.187, Math.sin(a) * 0.187, 0],
        [Math.cos(a) * 0.179, Math.sin(a) * 0.179, 0.068],
      ],
      0.008,
      sage,
    );
  }
  const blade = new T.Shape();
  blade.moveTo(0.02, 0);
  blade.bezierCurveTo(0.06, 0.017, 0.19, 0.015, 0.149, 0.077);
  blade.bezierCurveTo(0.116, 0.11, 0.042, 0.044, 0.02, 0);
  for (let i = 0; i < 3; i++) {
    const b = mesh(
      rotor,
      new T.ExtrudeGeometry(blade, {
        depth: 0.004,
        bevelEnabled: false,
        curveSegments: 12,
      }),
      sage,
    );
    b.rotation.z = (i * Math.PI * 2) / 3;
  }
  mesh(head, new T.SphereGeometry(0.024, 16, 10), brass, 0, 0, 0.082);
  tube(
    fan,
    [
      [0, 0.04, -0.1],
      [0.035, 0.025, -0.14],
      [0.12, 0.025, -0.17],
    ],
    0.005,
    dark,
  );
  batch(head);
  batch(rotor);
  batch(fan);

  // Case, dial and pendulum all attach to the north wall's existing cutaway group.
  const clock = group(
    k.roots.cafe.getObjectByName('cafe/north-wall') || k.roots.cafe,
    1.45,
    1.77,
    -3.81,
  );
  register(clock, 'cafePendulum');
  box(clock, 0.59, 1.01, 0.13, wood);
  box(clock, 0.5, 0.9, 0.025, dark, 0, 0, 0.073);
  const dial = mesh(
    clock,
    new T.CircleGeometry(0.202, 48),
    paper,
    0,
    0.228,
    0.092,
  );
  const border = mesh(
    clock,
    new T.TorusGeometry(0.212, 0.014, 6, 48),
    brass,
    0,
    0.228,
    0.099,
  );
  border.name = 'clock-bezel';
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const tick = box(
      clock,
      0.012,
      i % 3 ? 0.025 : 0.04,
      0.002,
      dark,
      Math.sin(a) * 0.173,
      0.228 + Math.cos(a) * 0.173,
      0.095,
    );
    tick.rotation.z = -a;
  }
  const hour = group(clock, 0, 0.228, 0.101),
    minute = group(clock, 0, 0.228, 0.106);
  hour.name = 'clock-hour-pivot';
  minute.name = 'clock-minute-pivot';
  box(hour, 0.018, 0.12, 0.005, dark, 0, 0.044);
  box(minute, 0.01, 0.168, 0.004, dark, 0, 0.071);
  const pendulum = group(clock, 0, 0.032, 0.12);
  pendulum.name = 'clock-pendulum-pivot';
  box(pendulum, 0.013, 0.29, 0.014, brass, 0, -0.145);
  mesh(pendulum, new T.SphereGeometry(1, 24, 12), brass, 0, -0.325).scale.set(
    0.092,
    0.092,
    0.022,
  );
  for (const x of [-0.231, 0.231])
    box(clock, 0.018, 0.46, 0.04, wood, x, -0.22, 0.121);
  box(clock, 0.47, 0.02, 0.04, wood, 0, -0.452, 0.121);
  dial.name = 'clock-dial';
  batch(clock);
  batch(pendulum);

  const deskThings = group(desk);
  deskThings.name = 'desk-used-details';
  // Lens cap and reading glasses belong beside the camera and notebook, within the desk edge.
  cyl(deskThings, 0.066, 0.015, dark, 1.1, 1.28, 0.27);
  const glasses = group(deskThings, 1.12, 1.286, 0.005);
  glasses.rotation.y = -0.16;
  for (const side of [-1, 1]) {
    const lens = mesh(
      glasses,
      new T.TorusGeometry(0.038, 0.0035, 6, 28),
      brass,
      side * 0.045,
      0,
      0,
    );
    lens.rotation.x = Math.PI / 2;
    tube(
      glasses,
      [
        [side * 0.079, 0, 0],
        [side * 0.083, 0.025, -0.047],
        [side * 0.05, 0.033, -0.08],
      ],
      0.003,
      brass,
    );
  }
  tube(
    glasses,
    [
      [-0.007, 0, 0],
      [0, 0.005, 0.004],
      [0.007, 0, 0],
    ],
    0.003,
    brass,
  );
  tube(
    deskThings,
    [
      [-0.2, 1.28, -0.38],
      [-0.27, 1.28, -0.46],
      [-0.49, 1.28, -0.46],
      [-0.57, 1.2, -0.54],
      [-0.57, 1.02, -0.53],
    ],
    0.007,
    dark,
  );
  for (let i = 0; i < 2; i++)
    box(deskThings, 0.023, 0.01, 0.014, sage, -0.32 - i * 0.1, 1.29, -0.46);
  batch(glasses);
  batch(deskThings);

  // Tools occupy the free end of the existing coffee counter, leaving pickup and checkout clear.
  const tools = group(k.roots.cafe, -7.08, 1.535, -1.06);
  tools.name = 'coffee-tools';
  box(tools, 0.62, 0.014, 0.61, dark, 0, 0.007);
  const pitcher = group(tools, -0.15, 0.015, -0.12);
  lathe(
    pitcher,
    [
      [0, 0],
      [0.09, 0],
      [0.103, 0.2],
      [0.094, 0.2],
      [0.081, 0.015],
      [0, 0.015],
    ],
    steel,
  );
  tube(
    pitcher,
    [
      [0.095, 0.17, 0],
      [0.15, 0.17, 0],
      [0.15, 0.04, 0],
      [0.09, 0.04, 0],
    ],
    0.009,
    steel,
  );
  const tamp = group(tools, 0.17, 0.016, 0.16);
  cyl(tamp, 0.065, 0.026, steel, 0, 0.013);
  cyl(tamp, 0.025, 0.09, wood, 0, 0.07);
  mesh(tamp, new T.SphereGeometry(1, 16, 8), wood, 0, 0.13).scale.set(
    0.046,
    0.028,
    0.046,
  );
  const knock = group(tools, 0.16, 0.015, -0.13);
  lathe(
    knock,
    [
      [0, 0],
      [0.085, 0],
      [0.089, 0.135],
      [0.079, 0.135],
      [0.077, 0.025],
      [0, 0.025],
    ],
    sage,
  );
  tube(
    knock,
    [
      [-0.086, 0.113, 0],
      [0, 0.113, 0],
      [0.086, 0.113, 0],
    ],
    0.016,
    dark,
  );
  const towel = mesh(
    tools,
    new T.PlaneGeometry(0.25, 0.6, 12, 24),
    cotton,
    -0.16,
    0.022,
    0.32,
  );
  const tp = towel.geometry.getAttribute('position');
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i),
      v = tp.getY(i) + 0.3;
    tp.setXYZ(
      i,
      x,
      Math.sin(x * 36 + v * 8) * 0.007 - Math.max(0, v - 0.34) * 0.95,
      Math.min(v, 0.34) +
        Math.sin(Math.min(Math.max(0, v - 0.34) / 0.03, Math.PI / 2)) * 0.018,
    );
  }
  towel.geometry.computeVertexNormals();
  batch(pitcher);
  batch(tamp);
  batch(knock);
  batch(tools);

  // Only two or three items on each bedside surface; no new floor obstacles.
  const bedside = group(k.roots.bedroom, -2.55, 0.744, -1.94);
  bedside.name = 'bedside-used-details';
  // Keep the spectacle case beside the books, clear of the music-box lid and base.
  box(bedside, 0.19, 0.035, 0.11, rust, -0.235, 0.02, 0.2);
  const water = group(bedside, 0.21, 0, -0.1);
  lathe(
    water,
    [
      [0, 0],
      [0.055, 0],
      [0.058, 0.17],
      [0.049, 0.17],
      [0.045, 0.015],
      [0, 0.015],
    ],
    cream,
  );
  cyl(water, 0.047, 0.003, mat('#a5b4b0', 0.2), 0, 0.125);
  box(bedside, 0.085, 0.012, 0.17, dark, 0.22, 0.012, 0.16);
  tube(
    bedside,
    [
      [0.22, 0.011, 0.25],
      [0.29, 0.01, 0.28],
      [0.32, -0.15, 0.31],
      [0.28, -0.32, 0.3],
    ],
    0.004,
    dark,
  );
  batch(water);
  batch(bedside);

  let clockTime = 0,
    fanTime = 0,
    fanOn = true;
  return {
    interact(id: ObjectId) {
      if (id === 'deskFan') {
        fanOn = !fanOn;
        k.bubble(fanOn ? '风慢慢转起来了。' : '让风也歇一会儿。');
      }
      if (id === 'cafePendulum') k.bubble('钟摆慢慢走着，不必赶时间。');
    },
    update(dt: number, paused: boolean, reduced: boolean, view: HouseView) {
      if (paused) return;
      if (view === 'study' || view === 'overview') {
        if (fanOn && !reduced) {
          fanTime += dt;
          rotor.rotation.z = (fanTime * 12) % (Math.PI * 2);
          head.rotation.y = Math.sin(fanTime * 0.21) * 0.43;
        }
      }
      if (view === 'cafe' || view === 'overview') {
        if (!reduced) clockTime += dt;
        pendulum.rotation.z = reduced
          ? 0
          : Math.sin(clockTime * Math.PI * 1.2) * 0.145;
        const now = new Date();
        minute.rotation.z =
          (-(now.getMinutes() + now.getSeconds() / 60) * Math.PI) / 30;
        hour.rotation.z =
          (-((now.getHours() % 12) + now.getMinutes() / 60) * Math.PI) / 6;
      }
    },
    snapshot: () => ({
      fanOn,
      fanTime,
      head: head.rotation.y,
      rotor: rotor.rotation.z,
      pendulum: pendulum.rotation.z,
    }),
  };
}
