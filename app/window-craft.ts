import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Fixed casement joinery, rubber weather seals, hinge barrels and brushed brass hardware.
export function addWindowCraft(
  parent: T.Group,
  wood: T.Material,
  brass: T.Material,
  materials: T.Material[],
) {
  const g = new T.Group();
  parent.add(g);
  const seal = new T.MeshStandardMaterial({
      color: '#40463e',
      roughness: 0.94,
    }),
    screw = new T.MeshStandardMaterial({
      color: '#665f49',
      roughness: 0.45,
      metalness: 0.6,
    });
  const glass = new T.MeshPhysicalMaterial({
    color: '#e0efea',
    roughness: 0.14,
    metalness: 0.05,
    transparent: true,
    opacity: 0.035,
    depthWrite: false,
  });
  materials.push(seal, screw, glass);
  const b = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    r = 0.004,
  ) => {
    const o = new T.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)),
      m,
    );
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    g.add(o);
    return o;
  };
  const c = (
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => {
    const o = new T.Mesh(new T.CylinderGeometry(r, r, h, 12), m);
    o.position.set(x, y, z);
    g.add(o);
    return o;
  };
  for (const x of [-1.596, 1.596]) b(0.022, 2.1, 0.038, x, 0, 0.098, seal);
  for (const y of [-1.045, 1.045]) b(3.17, 0.021, 0.038, 0, y, 0.098, seal);
  for (const x of [-1.565, 1.565]) b(0.014, 2.06, 0.022, x, 0, 0.13, wood);
  for (const y of [-1.015, 1.015]) b(3.12, 0.014, 0.022, 0, y, 0.13, wood);
  for (const side of [-1, 1]) {
    b(1.52, 2.02, 0.012, side * 0.802, 0, 0.015, glass, 0);
    b(0.084, 0.192, 0.027, side * 0.118, -0.52, 0.159, brass, 0.014);
    const axle = c(0.022, 0.067, side * 0.118, -0.52, 0.19, brass);
    axle.rotation.x = Math.PI / 2;
    b(0.032, 0.17, 0.035, side * 0.118, -0.594, 0.233, brass, 0.013);
    for (const y of [-0.593, -0.445]) {
      const head = c(0.012, 0.006, side * 0.118, y, 0.177, screw);
      head.rotation.x = Math.PI / 2;
      b(0.014, 0.002, 0.001, side * 0.118, y, 0.181, seal, 0.0003);
    }
    for (const y of [-0.72, 0.7]) {
      c(0.017, 0.16, side * 1.568, y, 0.16, brass);
      for (const dy of [-0.051, 0.051])
        c(0.019, 0.012, side * 1.568, y + dy, 0.16, screw);
      b(0.057, 0.142, 0.011, side * 1.546, y, 0.143, brass);
    }
    // Mitred corner inlays, sill end grain and discrete drainage slots.
    for (const y of [-1.075, 1.075]) {
      const joint = b(0.06, 0.004, 0.003, side * 1.623, y, 0.159, seal, 0.001);
      joint.rotation.z = (side * Math.sign(y) * Math.PI) / 4;
    }
    b(0.12, 0.011, 0.008, side * 1.3, -1.167, 0.345, seal, 0.003);
  }
  for (const z of [0.2, 0.24])
    b(3.15, 0.006, 0.008, 0, -1.114, z, screw, 0.001);
  g.updateMatrixWorld(true);
  // Merge in parent-local space so each aperture adds only four draws.
  g.updateMatrix();
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  const old: T.Mesh[] = [];
  for (const o of g.children) {
    if (o instanceof T.Mesh) {
      o.updateMatrix();
      const geo = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      geo.applyMatrix4(o.matrix);
      const list = batches.get(o.material as T.Material) || [];
      list.push(geo);
      batches.set(o.material as T.Material, list);
      old.push(o);
    }
  }
  old.forEach((o) => {
    o.removeFromParent();
    o.geometry.dispose();
  });
  batches.forEach((list, m) => {
    const geo = mergeGeometries(list, false);
    list.forEach((x) => x.dispose());
    if (geo) {
      const mesh = new T.Mesh(geo, m);
      mesh.castShadow = m !== glass;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
  });
}
