import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function kit() {
  const root = new T.Group(),
    geometries: T.BufferGeometry[] = [],
    materials: T.Material[] = [];
  const mat = (color: string, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness: 0.55, metalness });
    materials.push(m);
    return m;
  };
  const mesh = (
    p: T.Object3D,
    geometry: T.BufferGeometry,
    material: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    geometries.push(geometry);
    const m = new T.Mesh(geometry, material);
    m.position.set(x, y, z);
    p.add(m);
    return m;
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
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.012, h / 3)),
      m,
      x,
      y,
      z,
    );
  return {
    root,
    mat,
    mesh,
    box,
    dispose() {
      root.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
export function attachRobotHardware(parent: T.Group) {
  const k = kit(),
    rubber = k.mat('#242c28'),
    metal = k.mat('#8c9286', 0.4),
    bristle = k.mat('#554f42');
  parent.add(k.root);
  k.root.name = 'robot/wheels-and-brush';
  const wheels: T.Group[] = [];
  for (const side of [-1, 1]) {
    const axle = new T.Group();
    axle.position.set(side * 0.206, 0.035, 0);
    k.root.add(axle);
    wheels.push(axle);
    const wheel = k.mesh(
      axle,
      new T.CylinderGeometry(0.04, 0.04, 0.035, 20),
      rubber,
    );
    wheel.rotation.z = Math.PI / 2;
    k.box(axle, 0.002, 0.052, 0.008, metal, side * 0.019, 0, 0);
  }
  const brush = new T.Group();
  brush.name = 'robot/side-brush';
  brush.position.set(-0.15, 0.011, -0.12);
  k.root.add(brush);
  for (let i = 0; i < 3; i++) {
    const arm = new T.Group();
    arm.rotation.y = (i * Math.PI * 2) / 3;
    brush.add(arm);
    k.box(arm, 0.057, 0.004, 0.012, bristle, 0.025, 0, 0);
  }
  const rim = k.mesh(
    k.root,
    new T.TorusGeometry(0.239, 0.005, 5, 48),
    metal,
    0,
    0.12,
  );
  rim.rotation.x = Math.PI / 2;
  const led = k.mat('#8eaf95');
  led.emissive.set('#7dad82');
  k.box(k.root, 0.036, 0.003, 0.012, led, 0.065, 0.174, -0.085);
  let spin = 0;
  return {
    update(
      distance: number,
      moving: boolean,
      charging: boolean,
      dt: number,
      reduced: boolean,
    ) {
      if (!reduced) {
        wheels.forEach((w) => (w.rotation.x = -distance / 0.04));
        if (moving) spin += dt * 5;
        brush.rotation.y = spin;
      }
      led.emissiveIntensity = charging ? 0.35 : 0.06;
    },
    dispose: () => k.dispose(),
  };
}
export function createRobotDock() {
  const k = kit(),
    shell = k.mat('#68786b'),
    dark = k.mat('#323a33'),
    contact = k.mat('#b7b096', 0.7);
  k.root.name = 'robot/charging-station';
  k.box(k.root, 0.62, 0.018, 0.58, dark, 0, 0.003, 0.08);
  k.box(k.root, 0.46, 0.29, 0.13, shell, 0, 0.154, 0.36);
  for (const x of [-0.11, 0.11])
    k.box(k.root, 0.055, 0.045, 0.045, contact, x, 0.078, 0.274);
  const led = k.mat('#a0b79a');
  led.emissive.set('#93be83');
  k.box(k.root, 0.09, 0.008, 0.005, led, 0, 0.22, 0.292);
  let time = 0;
  return {
    root: k.root,
    update(charging: boolean, dt: number, reduced: boolean) {
      if (!reduced) time += dt;
      led.emissiveIntensity = charging
        ? reduced
          ? 0.25
          : 0.25 + Math.sin(time * 1.7) * 0.1
        : 0.025;
    },
    dispose: () => k.dispose(),
  };
}
