import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  curiosities,
  curiosityIds,
  isCuriosity,
  type CuriosityId,
} from './exploration-data';
import { CuriosityMotion } from './curiosity-motion';
import { createCuriosityAudio } from './curiosity-audio';
import { createCollectionStore } from './life-collections';
import type { CollectionData } from './life-data';
import type { ObjectId } from './room-data';
import { rooms, type RoomId, type HouseView } from './house-data';
import type { WallCutaways } from './wall-cutaway';

type Kit = {
  roots: Record<RoomId, T.Group>;
  groups: Map<ObjectId, T.Group>;
  interactables: T.Object3D[];
  materials: T.Material[];
  textures: T.Texture[];
  oak: T.MeshStandardMaterial;
  brass: T.MeshStandardMaterial;
  cutaways: WallCutaways;
  collect: (data: CollectionData, message: string) => void;
  moment: () => void;
  changed: (id: CuriosityId, active: boolean) => void;
};

/** Authored on existing furniture, with real pivots and individually crafted mechanisms. */
export function createExplorationModels(k: Kit) {
  const audio = createCuriosityAudio();
  const soundSteps = new Map<CuriosityId, number>();
  const mat = (color: string, roughness = 0.7, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    k.materials.push(m);
    return m;
  };
  const wood = k.oak,
    brass = k.brass.clone();
  brass.color.set('#c3a366');
  brass.metalness = 0.48;
  brass.roughness = 0.37;
  k.materials.push(brass);
  const dark = mat('#493b2f'),
    paper = mat('#eee4cd', 0.93),
    ink = mat('#354a43');
  const sage = mat('#90a18a'),
    rust = mat('#bf775c'),
    blue = mat('#7296a1');
  const sand = mat('#cfad72', 0.91),
    coffee = mat('#654331', 0.95);
  const glass = mat('#dceae0', 0.16);
  glass.transparent = true;
  glass.opacity = 0.2;
  glass.depthWrite = false;
  glass.side = T.DoubleSide;
  const mesh = (
    p: T.Object3D,
    geo: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = m !== glass;
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
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.014, h / 4, w / 4, d / 4)),
      m,
      x,
      y,
      z,
    );
  const cyl = (
    p: T.Object3D,
    r: number,
    h: number,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => mesh(p, new T.CylinderGeometry(r, r, h, 32), m, x, y, z);
  const ring = (
    p: T.Object3D,
    r: number,
    thickness: number,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const o = mesh(p, new T.TorusGeometry(r, thickness, 6, 48), m, x, y, z);
    o.rotation.x = Math.PI / 2;
    return o;
  };
  const ball = (p: T.Object3D, r: number, m: T.Material, x = 0, y = 0, z = 0) =>
    mesh(p, new T.SphereGeometry(r, 20, 12), m, x, y, z);
  const group = (p: T.Object3D, x = 0, y = 0, z = 0) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    p.add(g);
    return g;
  };
  const rod = (
    p: T.Object3D,
    a: number[],
    b: number[],
    r: number,
    m: T.Material,
  ) => {
    const start = new T.Vector3().fromArray(a),
      end = new T.Vector3().fromArray(b);
    const d = end.clone().sub(start);
    const o = cyl(p, r, d.length(), m);
    o.position.copy(start.add(end).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return o;
  };
  const lathe = (p: T.Object3D, points: number[][], m: T.Material) =>
    mesh(
      p,
      new T.LatheGeometry(
        points.map(([r, y]) => new T.Vector2(r, y)),
        40,
      ),
      m,
    );
  const screw = (p: T.Object3D, x: number, y: number, z: number) => {
    cyl(p, 0.009, 0.004, brass, x, y, z);
    box(p, 0.012, 0.0015, 0.002, dark, x, y + 0.0025, z);
  };
  const gear = (p: T.Object3D, r: number, y: number, teeth: number) => {
    const g = group(p, 0, y);
    cyl(g, r * 0.85, 0.012, brass);
    ring(g, r * 0.57, 0.005, dark, 0, 0.009);
    for (let i = 0; i < teeth; i++) {
      const a = (i * Math.PI * 2) / teeth;
      box(
        g,
        r * 0.18,
        0.013,
        r * 0.16,
        brass,
        Math.cos(a) * r * 0.88,
        0,
        Math.sin(a) * r * 0.88,
      ).rotation.y = -a;
    }
    return g;
  };
  const print = (
    p: T.Object3D,
    w: number,
    h: number,
    draw: (c: CanvasRenderingContext2D) => void,
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#eee4cd';
    c.fillRect(0, 0, 512, 384);
    c.strokeStyle = '#b4a182';
    c.lineWidth = 2;
    c.strokeRect(20, 20, 472, 344);
    draw(c);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    k.textures.push(texture);
    const m = mat('#ffffff', 0.9);
    m.map = texture;
    const o = mesh(p, new T.PlaneGeometry(w, h), m);
    o.castShadow = false;
    return o;
  };
  const label = (
    p: T.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w = 0.23,
  ) => {
    const o = print(p, w, w * 0.4, (c) => {
      c.fillStyle = '#4f5c4b';
      c.textAlign = 'center';
      c.font = '32px Georgia';
      c.fillText(text, 256, 217);
    });
    o.position.set(x, y, z);
    return o;
  };
  const register = (
    id: CuriosityId,
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
  ) => {
    const g = group(p, x, y, z);
    g.name = `Handcrafted / ${id}`;
    g.userData.id = id;
    g.userData.curiosity = true;
    k.groups.set(id, g);
    k.interactables.push(g);
    return g;
  };
  const draws = {} as Record<CuriosityId, (m: CuriosityMotion) => void>;
  const tau = Math.PI * 2;
  const smooth = (v: number) => {
    const p = T.MathUtils.clamp(v, 0, 1);
    return p * p * (3 - 2 * p);
  };
  const spin = (p: number, turns: number) =>
    tau * turns * (1 - Math.pow(1 - p, 3));

  // Orrery: stepped walnut base, toothed gears, brass orbit rails and independent planets.
  const orrery = register(
    'studyOrrery',
    k.groups.get('shelf')!,
    0.68,
    1.326,
    0.02,
  );
  cyl(orrery, 0.225, 0.031, wood, 0, 0.016);
  cyl(orrery, 0.201, 0.012, dark, 0, 0.037);
  ring(orrery, 0.191, 0.003, brass, 0, 0.045);
  const driver = gear(orrery, 0.085, 0.073, 18);
  cyl(orrery, 0.012, 0.22, brass, 0, 0.16);
  ball(orrery, 0.055, brass, 0, 0.3);
  const orbits = [0.1, 0.154, 0.204].map((r, i) => {
    ring(orrery, r, 0.0025, brass, 0, 0.195 + i * 0.027);
    const axis = group(orrery, 0, 0.195 + i * 0.027);
    rod(axis, [0, 0, 0], [r, 0, 0], 0.004, brass);
    ball(axis, 0.018 + i * 0.007, [rust, blue, sage][i], r);
    if (i === 2) ring(axis, 0.039, 0.0035, brass, r).rotation.z = 0.3;
    return axis;
  });
  for (const x of [-0.15, 0.15]) screw(orrery, x, 0.048, 0);
  draws.studyOrrery = (m) => {
    const turn = spin(m.progress, 2);
    driver.rotation.y = -turn * 2;
    orbits.forEach((axis, i) => {
      axis.rotation.y =
        turn / (i + 1) +
        i * 2.2 +
        (Math.max(0, m.runs - 1) * tau * 2) / (i + 1);
    });
  };

  // Metronome: tapered wooden case, recessed scale, pivot, movable brass weight and winding key.
  const metro = register('livingMetronome', k.roots.living, -0.14, 0.683, -1.3);
  metro.rotation.y = -0.15;
  cyl(metro, 0.116, 0.018, dark, 0, 0.009);
  const shell = mesh(
    metro,
    new T.CylinderGeometry(0.055, 0.14, 0.39, 4),
    wood,
    0,
    0.217,
  );
  shell.rotation.y = Math.PI / 4;
  box(metro, 0.105, 0.27, 0.012, ink, 0, 0.239, 0.083).rotation.x = -0.16;
  for (let i = 0; i < 10; i++)
    box(
      metro,
      i % 3 ? 0.038 : 0.065,
      0.002,
      0.003,
      paper,
      0,
      0.14 + i * 0.022,
      0.109 - i * 0.0035,
    );
  const pendulum = group(metro, 0, 0.13, 0.119);
  box(pendulum, 0.009, 0.25, 0.009, brass, 0, 0.11);
  box(pendulum, 0.055, 0.036, 0.021, brass, 0, 0.17);
  ball(pendulum, 0.018, brass);
  const key = group(metro, 0.113, 0.08);
  ring(key, 0.021, 0.006, brass).rotation.z = Math.PI / 2;
  label(metro, 'LENTO', 0, 0.066, 0.134, 0.08);
  draws.livingMetronome = (m) => {
    pendulum.rotation.z = m.active
      ? Math.sin(m.progress * Math.PI * 16) *
        0.37 *
        Math.min(1, (1 - m.progress) * 5)
      : 0;
  };

  // A real hollow music box: mitered walls, pin hinges, comb teeth, winding barrel and moon.
  const music = register(
    'bedroomMusicBox',
    k.roots.bedroom,
    -2.78,
    0.739,
    -2.15,
  );
  music.scale.setScalar(0.72);
  box(music, 0.34, 0.033, 0.29, wood, 0, 0.017);
  for (const x of [-0.159, 0.159])
    box(music, 0.023, 0.117, 0.29, wood, x, 0.088);
  for (const z of [-0.134, 0.134])
    box(music, 0.295, 0.117, 0.023, wood, 0, 0.088, z);
  box(music, 0.29, 0.008, 0.24, ink, 0, 0.038);
  box(music, 0.036, 0.053, 0.014, brass, 0, 0.112, 0.15);
  for (const x of [-0.1, 0.1])
    cyl(music, 0.009, 0.057, brass, x, 0.151, -0.135).rotation.z = Math.PI / 2;
  const lid = group(music, 0, 0.149, -0.134);
  box(lid, 0.347, 0.024, 0.298, wood, 0, 0.009, 0.136);
  const stars = print(lid, 0.296, 0.248, (c) => {
    c.fillStyle = '#354b50';
    c.fillRect(23, 23, 466, 338);
    for (let i = 0; i < 36; i++) {
      c.fillStyle = '#e7cf8c';
      c.beginPath();
      c.arc(
        40 + ((i * 137) % 432),
        40 + ((i * 73) % 305),
        i % 5 ? 2 : 4,
        0,
        tau,
      );
      c.fill();
    }
    c.fillStyle = '#d4b573';
    c.beginPath();
    c.arc(260, 176, 61, 0, tau);
    c.fill();
    c.fillStyle = '#354b50';
    c.beginPath();
    c.arc(290, 154, 57, 0, tau);
    c.fill();
  });
  stars.rotation.x = Math.PI / 2;
  stars.position.set(0, -0.004, 0.136);
  const barrel = group(music, -0.058, 0.085, 0);
  cyl(barrel, 0.033, 0.12, brass).rotation.z = Math.PI / 2;
  for (let i = 0; i < 12; i++)
    ball(
      barrel,
      0.003,
      paper,
      -0.05 + i * 0.009,
      Math.sin(i * 2.3) * 0.034,
      Math.cos(i * 2.3) * 0.034,
    );
  for (let i = 0; i < 13; i++)
    box(music, 0.006, 0.005, 0.052, brass, -0.12 + i * 0.009, 0.067, 0.068);
  const moon = group(music, 0.087, 0.066);
  cyl(moon, 0.046, 0.012, brass);
  const crescent = mesh(
    moon,
    new T.TorusGeometry(0.038, 0.008, 8, 28, Math.PI * 1.5),
    brass,
    0,
    0.063,
  );
  crescent.rotation.z = 0.65;
  draws.bedroomMusicBox = (m) => {
    const open =
      m.runs === 0
        ? 0
        : m.opened
          ? smooth(m.progress * 4)
          : 1 - smooth(m.progress * 4);
    lid.rotation.x = -open * 1.9;
    barrel.rotation.x = spin(m.progress, 3);
    moon.rotation.y = spin(m.progress, 2);
  };

  // Flipbook on a shallow wall-mounted shelf, clear of artwork, seats and visitor paths.
  const flip = register('galleryFlipbook', k.roots.gallery, -3.71, 1.24, -1.65);
  flip.rotation.y = Math.PI / 2;
  box(flip, 0.59, 0.045, 0.48, wood, 0, -0.023);
  for (const x of [-0.21, 0.21]) {
    box(flip, 0.022, 0.26, 0.021, brass, x, -0.16, -0.19);
    rod(flip, [x, -0.27, -0.19], [x, -0.046, 0.16], 0.009, brass);
  }
  const reel = group(flip, 0, 0.3);
  for (const x of [-0.24, 0.24]) {
    box(flip, 0.024, 0.29, 0.22, dark, x, 0.145);
    cyl(flip, 0.02, 0.028, brass, x, 0.3).rotation.z = Math.PI / 2;
  }
  rod(flip, [-0.26, 0.3, 0], [0.29, 0.3, 0], 0.008, brass);
  Array.from({ length: 10 }, (_, i) => {
    const pivot = group(reel);
    const leaf = print(pivot, 0.42, 0.26, (c) => {
      c.fillStyle = '#d4b070';
      c.beginPath();
      c.arc(285, 260 - Math.sin((i / 10) * Math.PI) * 155, 36, 0, tau);
      c.fill();
      for (let j = 0; j < 3; j++) {
        c.fillStyle = ['#b4bda2', '#839881', '#536e61'][j];
        c.beginPath();
        c.moveTo(21, 363);
        c.lineTo(21, 280 + j * 15);
        c.bezierCurveTo(
          170,
          180 + j * 35,
          290,
          330 - j * 10,
          491,
          260 + j * 15,
        );
        c.lineTo(491, 363);
        c.fill();
      }
      c.fillStyle = '#485c4c';
      c.font = '20px Georgia';
      c.fillText(`SUN STUDY / ${String(i + 1).padStart(2, '0')}`, 43, 59);
    });
    // Texture on both faces so a turning leaf has no disappearing back.
    (leaf.material as T.MeshStandardMaterial).side = T.DoubleSide;
    leaf.position.y = 0.137;
    pivot.rotation.x = (-i * tau) / 10;
    return pivot;
  });
  const crank = group(flip, 0.29, 0.3);
  rod(crank, [0, 0, 0], [0, 0.07, 0], 0.007, brass);
  cyl(crank, 0.015, 0.06, wood, 0.03, 0.07).rotation.z = Math.PI / 2;
  draws.galleryFlipbook = (m) => {
    reel.rotation.x = -spin(m.progress, 2);
    crank.rotation.x = reel.rotation.x;
  };
  k.cutaways.add(
    [flip],
    { x: rooms.gallery.x - 3.87, z: rooms.gallery.z - 1.65, nx: 1, nz: 0 },
    ['gallery'],
  );

  // Hand grinder: open hopper, bean seams, drive handle and a drawer with visible grounds.
  const grinder = register('cafeGrinder', k.roots.cafe, -5.5, 1.441, -3.38);
  box(grinder, 0.31, 0.028, 0.3, dark, 0, 0.014);
  for (const x of [-0.14, 0.14]) box(grinder, 0.026, 0.21, 0.27, wood, x, 0.13);
  box(grinder, 0.26, 0.21, 0.025, wood, 0, 0.13, -0.122);
  box(grinder, 0.255, 0.066, 0.024, wood, 0, 0.211, 0.122);
  box(grinder, 0.31, 0.024, 0.3, wood, 0, 0.247);
  const hopper = group(grinder, 0, 0.26);
  lathe(
    hopper,
    [
      [0.028, 0],
      [0.029, 0.04],
      [0.12, 0.12],
      [0.12, 0.128],
      [0.108, 0.126],
      [0.023, 0.04],
    ],
    brass,
  );
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4,
      r = 0.012 + i * 0.005;
    const bean = group(
      hopper,
      Math.cos(a) * r,
      0.07 + r * 0.35,
      Math.sin(a) * r,
    );
    ball(bean, 0.015, coffee).scale.set(0.65, 0.7, 1);
    box(bean, 0.0015, 0.001, 0.018, dark, 0, 0.011);
    bean.rotation.y = a;
  }
  cyl(grinder, 0.01, 0.21, brass, 0, 0.369);
  const handle = group(grinder, 0, 0.477);
  box(handle, 0.19, 0.013, 0.023, brass, 0.084);
  cyl(handle, 0.022, 0.074, dark, 0.172, 0.035);
  const grounds = group(grinder, 0, 0.036);
  box(grounds, 0.24, 0.019, 0.23, dark, 0, 0.01);
  box(grounds, 0.252, 0.135, 0.024, wood, 0, 0.07, 0.128);
  for (const x of [-0.114, 0.114])
    box(grounds, 0.012, 0.09, 0.22, wood, x, 0.047);
  box(grounds, 0.23, 0.09, 0.013, wood, 0, 0.047, -0.109);
  ball(grounds, 0.013, brass, 0, 0.072, 0.151);
  const powder = box(grounds, 0.21, 0.018, 0.2, coffee, 0, 0.033);
  label(grinder, 'SLOW', 0, 0.206, 0.142, 0.12);
  draws.cafeGrinder = (m) => {
    handle.rotation.y = spin(Math.min(1, m.progress / 0.78), 5);
    grounds.position.z = m.runs ? 0.12 * smooth((m.progress - 0.77) / 0.23) : 0;
    powder.visible = m.runs > 0 && m.progress > 0.4;
  };

  // Wind chime: wall bracket, cap, five independently suspended hollow tubes and paper sail.
  const chime = register('corridorChime', k.roots.corridor, 0.64, 2.83, -10.95);
  rod(chime, [0.24, 0.04, 0], [0, 0.04, 0], 0.015, brass);
  rod(chime, [0, 0.04, 0], [0, -0.04, 0], 0.005, brass);
  box(chime, 0.028, 0.17, 0.12, wood, 0.245);
  cyl(chime, 0.125, 0.018, wood, 0, -0.04);
  const tubes = Array.from({ length: 5 }, (_, i) => {
    const a = (i * tau) / 5,
      g = group(chime, Math.cos(a) * 0.092, -0.045, Math.sin(a) * 0.092);
    rod(g, [0, 0, 0], [0, -0.075, 0], 0.0025, dark);
    const h = 0.23 + i * 0.029;
    const tube = lathe(
      g,
      [
        [0.015, 0],
        [0.015, -h],
        [0.011, -h],
        [0.011, 0],
        [0.015, 0],
      ],
      brass,
    );
    tube.position.y = -0.075;
    return g;
  });
  const sail = group(chime, 0, -0.055);
  rod(sail, [0, 0, 0], [0, -0.51, 0], 0.0025, dark);
  ball(sail, 0.033, wood, 0, -0.25);
  const tag = label(sail, 'SLOW DOWN', 0, -0.59, 0, 0.16);
  tag.scale.y = 2.5;
  (tag.material as T.MeshStandardMaterial).side = T.DoubleSide;
  draws.corridorChime = (m) => {
    const amp = m.active ? Math.pow(1 - m.progress, 2) : 0;
    tubes.forEach((g, i) => {
      g.rotation.z = Math.sin(m.progress * 28 + i) * amp * 0.13;
      g.rotation.x = Math.sin(m.progress * 23 + i * 1.7) * amp * 0.09;
    });
    sail.rotation.z = Math.sin(m.progress * 25) * amp * 0.25;
  };
  k.cutaways.add([chime], { x: 13.94, z: -4.65, nx: -1, nz: 0 }, ['corridor']);

  // Hourglass: continuous open-neck glass, two sand volumes, stream, trunnions and frame.
  const hourglass = register(
    'libraryHourglass',
    k.groups.get('libraryDesk')!,
    1.17,
    1.265,
    0.54,
  );
  cyl(hourglass, 0.157, 0.023, wood, 0, 0.012);
  const glassAxis = group(hourglass, 0, 0.258);
  for (const x of [-0.128, 0.128]) {
    rod(hourglass, [x, 0.024, 0], [x, 0.257, 0], 0.012, brass);
    ball(hourglass, 0.018, brass, x, 0.258);
  }
  const hourBody = group(glassAxis, 0, -0.215);
  for (const y of [0.014, 0.416]) {
    cyl(hourBody, 0.112, 0.028, wood, 0, y);
    ring(hourBody, 0.1, 0.004, brass, 0, y + 0.016);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i * tau) / 3;
    rod(
      hourBody,
      [Math.cos(a) * 0.104, 0.027, Math.sin(a) * 0.104],
      [Math.cos(a) * 0.104, 0.402, Math.sin(a) * 0.104],
      0.005,
      brass,
    );
  }
  lathe(
    hourBody,
    [
      [0.07, 0.03],
      [0.085, 0.057],
      [0.087, 0.105],
      [0.066, 0.149],
      [0.013, 0.205],
      [0.01, 0.215],
      [0.013, 0.225],
      [0.066, 0.281],
      [0.087, 0.325],
      [0.085, 0.373],
      [0.07, 0.4],
    ],
    glass,
  );
  // Sand remains vertical while the empty frame turns; pouring starts after the half turn.
  const sandRoot = group(hourglass, 0, 0.043);
  const topSand = mesh(
    sandRoot,
    new T.ConeGeometry(0.069, 0.13, 32),
    sand,
    0,
    0.288,
  );
  topSand.rotation.z = Math.PI;
  const bottomSand = mesh(
    sandRoot,
    new T.ConeGeometry(0.074, 0.11, 32),
    sand,
    0,
    0.082,
  );
  const stream = cyl(sandRoot, 0.0025, 0.18, sand, 0, 0.2);
  for (const part of [topSand, bottomSand, stream])
    part.userData.curiosityDynamic = true;
  draws.libraryHourglass = (m) => {
    const turning = m.active && m.progress < 0.15;
    glassAxis.rotation.z = m.runs
      ? Math.PI * (m.runs - 1 + smooth(m.progress / 0.15))
      : 0;
    sandRoot.visible = !turning;
    const amount = m.runs
      ? T.MathUtils.clamp((m.progress - 0.15) / 0.85, 0, 1)
      : 0;
    const top = Math.cbrt(1 - amount),
      bottom = Math.cbrt(amount);
    topSand.scale.setScalar(Math.max(0.001, top));
    topSand.position.y = 0.222 + 0.065 * top;
    bottomSand.scale.setScalar(Math.max(0.001, bottom));
    bottomSand.position.y = 0.029 + 0.055 * bottom;
    stream.visible = m.active && !turning;
  };

  // Painted spinning top in a recessed turned tray; its point stays on the tray when wobbling.
  const top = register(
    'gamingTop',
    k.groups.get('gameCollection')!,
    0.6,
    2.699,
    0.045,
  );
  lathe(
    top,
    [
      [0, 0],
      [0.18, 0],
      [0.187, 0.03],
      [0.18, 0.047],
      [0.165, 0.045],
      [0.159, 0.024],
      [0, 0.024],
    ],
    wood,
  );
  ring(top, 0.153, 0.0025, brass, 0, 0.026);
  const wobble = group(top, 0, 0.026);
  const spinning = group(wobble);
  lathe(
    spinning,
    [
      [0, 0],
      [0.012, 0.015],
      [0.027, 0.046],
      [0.094, 0.099],
      [0.098, 0.125],
      [0.082, 0.145],
      [0.021, 0.17],
    ],
    rust,
  );
  for (const [r, y, m] of [
    [0.062, 0.073, paper],
    [0.091, 0.1, blue],
    [0.097, 0.125, sage],
  ] as const)
    ring(spinning, r, 0.005, m, 0, y);
  cyl(spinning, 0.014, 0.1, dark, 0, 0.21);
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8;
    ball(
      spinning,
      0.006,
      paper,
      Math.cos(a) * 0.064,
      0.155,
      Math.sin(a) * 0.064,
    );
  }
  draws.gamingTop = (m) => {
    spinning.rotation.y = spin(m.progress, 13);
    const tilt =
      m.runs === 0 ? 0.42 : smooth((m.progress - 0.66) / 0.34) * 0.42;
    wobble.rotation.z = m.active ? Math.cos(m.progress * 42) * tilt : tilt;
    wobble.rotation.x = m.active ? Math.sin(m.progress * 42) * tilt : 0;
  };

  // Coasters are two-sided printed cork, in a brass-edged walnut holder.
  const coasters = register('barCoasters', k.roots.bar, -0.43, 1.59, -0.73);
  box(coasters, 0.34, 0.018, 0.29, wood, 0, 0.009);
  for (const x of [-0.155, 0.155])
    box(coasters, 0.009, 0.048, 0.27, brass, x, 0.033);
  for (let i = 0; i < 3; i++)
    cyl(coasters, 0.116, 0.013, sand, 0, 0.024 + i * 0.016);
  const coaster = group(coasters, 0, 0.087);
  cyl(coaster, 0.116, 0.013, sand);
  for (const side of [-1, 1]) {
    const face = print(coaster, 0.159, 0.159, (c) => {
      c.fillStyle = side < 0 ? '#536b58' : '#ae7554';
      c.textAlign = 'center';
      c.font = '40px Georgia';
      c.fillText(side < 0 ? 'STAY AWHILE' : 'AMBER', 256, 180);
      c.font = '21px Georgia';
      c.fillText(
        side < 0 ? 'you have done enough today' : 'a seat is waiting for you',
        256,
        228,
      );
    });
    face.rotation.x = (-side * Math.PI) / 2;
    if (side < 0) face.rotation.z = Math.PI;
    face.position.y = side * 0.007;
  }
  draws.barCoasters = (m) => {
    coaster.position.y = 0.087 + Math.sin(m.progress * Math.PI) * 0.21;
    coaster.rotation.z = m.runs
      ? (m.runs - 1 + smooth(m.progress)) * Math.PI
      : 0;
  };

  // Folded paper blades have front/back colours, a folded ridge, hub washer and a planted stem.
  const pinwheel = register(
    'gardenPinwheel',
    k.groups.get('gardenWorkbench')!,
    -1.4,
    1.128,
    -0.47,
  );
  lathe(
    pinwheel,
    [
      [0.047, 0],
      [0.074, 0.13],
      [0.08, 0.135],
      [0.08, 0.15],
      [0.067, 0.15],
      [0.062, 0.027],
      [0.038, 0.025],
    ],
    rust,
  );
  cyl(pinwheel, 0.063, 0.012, coffee, 0, 0.126);
  rod(pinwheel, [0, 0.04, 0], [0.01, 0.55, 0], 0.006, wood);
  const wheel = group(pinwheel, 0.01, 0.53, 0.02);
  for (let i = 0; i < 4; i++) {
    const blade = group(wheel);
    blade.rotation.z = (i * Math.PI) / 2;
    const geo = new T.BufferGeometry();
    geo.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [
          0, 0, 0, 0.16, 0.02, 0, 0.15, 0.15, 0.015, 0, 0, 0, 0.15, 0.15, 0.015,
          0.045, 0.096, 0.062,
        ],
        3,
      ),
    );
    geo.computeVertexNormals();
    const material = [sage, paper, rust, blue][i].clone();
    material.side = T.DoubleSide;
    k.materials.push(material);
    mesh(blade, geo, material);
    rod(blade, [0, 0, 0.002], [0.15, 0.15, 0.017], 0.0016, paper);
  }
  ball(wheel, 0.015, brass, 0, 0, 0.038);
  ring(wheel, 0.022, 0.003, brass, 0, 0, 0.024).rotation.x = 0;
  draws.gardenPinwheel = (m) => {
    wheel.rotation.z = spin(m.progress, 6);
  };

  // Batch only sibling meshes: pivots, glass and textured illustrations keep their own geometry.
  function batch(p: T.Object3D) {
    const buckets = new Map<T.Material, T.Mesh[]>();
    for (const child of p.children) {
      if (
        child instanceof T.Mesh &&
        !child.userData.curiosityDynamic &&
        child.geometry.attributes.uv &&
        !Array.isArray(child.material) &&
        !child.material.transparent
      ) {
        const bucket = buckets.get(child.material) ?? [];
        bucket.push(child);
        buckets.set(child.material, bucket);
      } else batch(child);
    }
    for (const [material, children] of buckets) {
      if (children.length < 2) continue;
      const transformed = children.map((o) => {
        o.updateMatrix();
        const g = o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone();
        return g.applyMatrix4(o.matrix);
      });
      const combined = mergeGeometries(transformed);
      transformed.forEach((g) => g.dispose());
      if (!combined) continue;
      children.forEach((o) => {
        p.remove(o);
        o.geometry.dispose();
      });
      mesh(p, combined, material);
    }
  }
  const motions = Object.fromEntries(
    curiosityIds.map((id) => [
      id,
      new CuriosityMotion(curiosities[id].duration),
    ]),
  ) as Record<CuriosityId, CuriosityMotion>;
  curiosityIds.forEach((id) => {
    draws[id](motions[id]);
    batch(k.groups.get(id)!);
  });
  const store = createCollectionStore((id, data, saved) =>
    k.collect(
      data,
      `拾光收藏 · ${curiosities[curiosityIds.find((key) => curiosities[key].collection === id)!].title}${saved ? '' : ' · 本次访问有效'}`,
    ),
  );
  return {
    interact(id: ObjectId) {
      if (!isCuriosity(id) || !motions[id].start()) return false;
      audio.unlock();
      soundSteps.set(id, -1);
      k.changed(id, true);
      k.moment();
      return true;
    },
    update(dt: number, paused: boolean, reduced: boolean, view: HouseView) {
      if (paused) {
        audio.stop();
        return;
      }
      for (const id of curiosityIds) {
        const m = motions[id];
        if (
          !m.active ||
          paused ||
          (view !== curiosities[id].room && view !== 'overview')
        )
          continue;
        const done = m.update(dt, false, reduced);
        draws[id](m);
        const step = Math.min(15, Math.floor(m.progress * 16));
        if (
          !reduced &&
          m.active &&
          soundSteps.get(id) !== step &&
          (id !== 'bedroomMusicBox' || m.opened)
        ) {
          audio.tick(id, step);
          soundSteps.set(id, step);
        }
        if (done) {
          k.changed(id, false);
          store.collect(
            curiosities[id].collection,
            'house',
            curiosities[id].room,
          );
        }
      }
    },
    snapshot: () =>
      Object.fromEntries(
        curiosityIds.map((id) => [
          id,
          {
            room: curiosities[id].room,
            active: motions[id].active,
            progress: motions[id].progress,
            runs: motions[id].runs,
            position: k.groups
              .get(id)!
              .getWorldPosition(new T.Vector3())
              .toArray(),
          },
        ]),
      ),
    dispose: () => audio.dispose(),
  };
}
