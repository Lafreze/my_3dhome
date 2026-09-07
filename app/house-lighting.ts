import * as T from 'three';
import type { RoomId } from './house-data';
// Roofs are cut away for navigation; each fixture is mounted at the real ceiling height.
export function houseLighting(
  roots: Record<RoomId, T.Group>,
  materials: T.Material[],
) {
  const fixtures: T.Group[] = [],
    lights: T.PointLight[] = [],
    diffusers: T.MeshStandardMaterial[] = [];
  for (const [index, id] of (
    ['study', 'living', 'bedroom', 'gallery'] as RoomId[]
  ).entries()) {
    const group = new T.Group();
    group.name = `${id}/ceiling-fixture`;
    roots[id].add(group);
    fixtures.push(group);
    const body = new T.MeshStandardMaterial({
      color: ['#b59358', '#42483e', '#bda17a', '#343938'][index],
      roughness: 0.48,
      metalness: index === 2 ? 0.1 : 0.65,
    });
    const diffuser = new T.MeshStandardMaterial({
      color: '#faf0d4',
      emissive: ['#ffd79b', '#ffe5b4', '#ffd9a4', '#fff0d3'][index],
      emissiveIntensity: 0.7,
      roughness: 0.8,
    });
    materials.push(body, diffuser);
    diffusers.push(diffuser);
    const mesh = (
      geo: T.BufferGeometry,
      material: T.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new T.Mesh(geo, material);
      m.position.set(x, y, z);
      group.add(m);
      return m;
    };
    // Study: opal flush disk. Living: twin offset rings. Bedroom: pleated linen drum.
    // Gallery: long recessed luminous slot. Each is sized clear of circulation and tall furniture.
    if (id === 'study') {
      mesh(
        new T.CylinderGeometry(0.49, 0.49, 0.045, 48),
        body,
        -0.15,
        3.56,
        0.15,
      );
      mesh(
        new T.SphereGeometry(
          0.46,
          40,
          20,
          0,
          Math.PI * 2,
          Math.PI / 2,
          Math.PI / 2,
        ),
        diffuser,
        -0.15,
        3.54,
        0.15,
      ).scale.y = 0.23;
    } else if (id === 'living') {
      for (const [x, z, r] of [
        [0.15, 0.05, 0.65],
        [0.68, 0.33, 0.43],
      ]) {
        const ring = mesh(
          new T.TorusGeometry(r, 0.038, 8, 64),
          body,
          x,
          3.46,
          z,
        );
        ring.rotation.x = Math.PI / 2;
        const glow = mesh(
          new T.TorusGeometry(r, 0.018, 8, 64),
          diffuser,
          x,
          3.435,
          z,
        );
        glow.rotation.x = Math.PI / 2;
        for (const angle of [0, Math.PI])
          mesh(
            new T.CylinderGeometry(0.006, 0.006, 0.18, 8),
            body,
            x + Math.cos(angle) * r,
            3.57,
            z,
          );
      }
    } else if (id === 'bedroom') {
      mesh(
        new T.CylinderGeometry(0.46, 0.49, 0.26, 64, 1, true),
        body,
        -0.2,
        3.43,
        0.65,
      );
      mesh(
        new T.CylinderGeometry(0.46, 0.46, 0.028, 48),
        diffuser,
        -0.2,
        3.3,
        0.65,
      );
      for (let j = 0; j < 56; j++) {
        const a = (j / 56) * Math.PI * 2;
        mesh(
          new T.CylinderGeometry(0.006, 0.007, 0.25, 5),
          diffuser,
          -0.2 + Math.sin(a) * 0.475,
          3.435,
          0.65 + Math.cos(a) * 0.475,
        );
      }
    } else {
      mesh(new T.BoxGeometry(2.25, 0.09, 0.19), body, -0.1, 3.54, -0.2);
      mesh(new T.BoxGeometry(2.12, 0.016, 0.115), diffuser, -0.1, 3.487, -0.2);
      for (const x of [-0.95, 0.75])
        mesh(
          new T.CylinderGeometry(0.009, 0.009, 0.11, 8),
          body,
          x,
          3.64,
          -0.2,
        );
    }
    const light = new T.PointLight(
      ['#ffdda9', '#ffe7bd', '#ffdeb3', '#fff0da'][index],
      0,
      9,
      2,
    );
    light.name = `${id}/ceiling-light`;
    light.position.set(
      id === 'living' ? 0.45 : 0,
      3.13,
      id === 'bedroom' ? 0.65 : 0,
    );
    roots[id].add(light);
    lights.push(light);
  }
  let enabled = true;
  return {
    set(on: boolean) {
      enabled = on;
    },
    setPlan(plan: boolean) {
      fixtures.forEach((g) => (g.visible = !plan));
    },
    update(dt: number, night: boolean) {
      const a = 1 - Math.exp(-dt * 6);
      lights.forEach((l, i) => {
        l.intensity = T.MathUtils.lerp(
          l.intensity,
          enabled ? (night ? [17, 19, 13, 19][i] : [9, 11, 7, 12][i]) : 0,
          a,
        );
      });
      diffusers.forEach(
        (m) =>
          (m.emissiveIntensity = T.MathUtils.lerp(
            m.emissiveIntensity,
            enabled ? 0.9 : 0,
            a,
          )),
      );
    },
  };
}
