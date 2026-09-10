import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Sliding leaves open before approaching actors reach the existing 1.4-unit portal. */
export function createInteriorDoor(
  parent: T.Group,
  center: number,
  oak: T.Material,
  brass: T.Material,
  materials: T.Material[],
) {
  const door = new T.Group();
  door.name = 'Oak and reeded glass sliding door';
  door.position.x = center;
  parent.add(door);
  const edge = new T.MeshStandardMaterial({
    color: '#493e30',
    roughness: 0.52,
    metalness: 0.08,
  });
  const glass = new T.MeshPhysicalMaterial({
    color: '#d9e3db',
    roughness: 0.3,
    metalness: 0,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    clearcoat: 0.8,
    ior: 1.46,
    side: T.DoubleSide,
  });
  materials.push(edge, glass);
  const box = (
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    r = 0.009,
  ) => {
    const mesh = new T.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)),
      m,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = m !== glass;
    mesh.receiveShadow = true;
    p.add(mesh);
    return mesh;
  };
  // Jamb depth, stepped architrave, dark reveal, and a quiet brass floor guide.
  for (const side of [-1, 1]) {
    box(door, 0.105, 2.64, 0.245, side * 0.73, 1.4, 0, oak);
    for (const face of [-1, 1])
      box(door, 0.15, 2.7, 0.028, side * 0.75, 1.42, face * 0.139, oak);
    box(door, 0.018, 2.59, 0.04, side * 0.671, 1.395, 0, edge, 0.004);
  }
  box(door, 1.64, 0.13, 0.3, 0, 2.77, 0, oak);
  const side = center > 0 ? -1 : 1;
  box(door, 2.8, 0.095, 0.08, side * 0.69, 2.67, 0.15, oak);
  const leaf = new T.Group();
  leaf.position.set(0, 0, 0);
  door.add(leaf);
  for (const x of [-0.59, 0.59]) box(leaf, 0.11, 2.48, 0.066, x, 1.35, 0, oak);
  for (const [y, h] of [
    [0.165, 0.11],
    [0.9, 0.09],
    [2.535, 0.11],
  ])
    box(leaf, 1.27, h, 0.066, 0, y, 0, oak);
  box(leaf, 1.05, 0.64, 0.041, 0, 0.535, 0, oak);
  box(leaf, 1.06, 1.54, 0.025, 0, 1.715, 0, glass, 0.005);
  // Fine reeding catches oblique light; no tiled noisy texture or transmission render pass.
  for (let i = -9; i <= 9; i++)
    box(leaf, 0.009, 1.52, 0.031, i * 0.054, 1.715, 0, glass, 0.003);
  for (const face of [-1, 1]) {
    box(leaf, 0.031, 0.29, 0.028, -side * 0.43, 1.23, face * 0.065, brass);
    for (const y of [1.1, 1.36])
      box(leaf, 0.034, 0.025, 0.047, -side * 0.43, y, face * 0.046, brass);
  }
  for (const x of [-0.43, 0.43]) {
    box(leaf, 0.042, 0.12, 0.024, x, 2.61, 0.009, edge);
    const wheel = new T.Mesh(
      new T.CylinderGeometry(0.04, 0.04, 0.025, 16),
      brass,
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 2.68, 0.02);
    leaf.add(wheel);
  }
  const centerWorld = new T.Vector3();
  let hold = 0;
  return {
    root: door,
    update(dt: number, reduced: boolean, passers: T.Vector3[]) {
      door.getWorldPosition(centerWorld);
      if (
        passers.some(
          (p) => Math.hypot(p.x - centerWorld.x, p.z - centerWorld.z) < 2.15,
        )
      )
        hold = 2.5;
      else hold = Math.max(0, hold - dt);
      leaf.position.x = T.MathUtils.lerp(
        leaf.position.x,
        hold > 0 ? side * 1.46 : 0,
        reduced ? 1 : 1 - Math.exp(-dt * 5),
      );
    },
  };
}
