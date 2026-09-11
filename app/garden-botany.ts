import * as T from 'three';
import type { InteriorBreeze } from './interior-atmosphere';

export function gardenBotany(
  materials: T.Material[],
  textures: T.Texture[],
  breeze: InteriorBreeze,
) {
  const mat = (color: string) => {
    const m = new T.MeshStandardMaterial({ color, roughness: 0.83 });
    materials.push(m);
    return m;
  };
  const soil = mat('#40342a'),
    bark = mat('#776046'),
    clay = mat('#b87851'),
    moss = mat('#677b42');
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 256;
  const c = cv.getContext('2d')!,
    gradient = c.createLinearGradient(0, 0, 128, 0);
  gradient.addColorStop(0, '#516d36');
  gradient.addColorStop(0.49, '#a7ad67');
  gradient.addColorStop(0.54, '#7d984e');
  gradient.addColorStop(1, '#385f38');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 128, 256);
  c.strokeStyle = '#d9d59d90';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(64, 256);
  c.lineTo(64, 0);
  c.stroke();
  for (let y = 30; y < 250; y += 22)
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(64, y);
      c.quadraticCurveTo(64 + side * 30, y - 7, 64 + side * 60, y - 26);
      c.stroke();
    }
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  textures.push(tex);
  const leavesMat = mat('#b0c191');
  leavesMat.map = tex;
  leavesMat.side = T.DoubleSide;
  breeze.add(leavesMat);
  const geo = new T.BufferGeometry(),
    positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= 10; j++) {
    const t = j / 10,
      span = Math.pow(Math.sin(Math.PI * t), 0.7);
    for (let i = 0; i <= 4; i++) {
      const u = i / 2 - 1;
      positions.push(
        u * span * 0.5,
        t,
        Math.sin(t * Math.PI) * (0.09 + u * u * 0.11),
      );
      uvs.push(i / 4, t);
      if (i < 4 && j < 10) {
        const a = j * 5 + i;
        indices.push(a, a + 1, a + 5, a + 1, a + 6, a + 5);
      }
    }
  }
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const dummy = new T.Object3D(),
    up = new T.Vector3(0, 1, 0);
  const rnd = (i: number) =>
    T.MathUtils.euclideanModulo(Math.sin(i * 137.1 + 5.2) * 41723.1, 1);
  function mesh(
    p: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    p.add(o);
    return o;
  }
  function rod(p: T.Object3D, a: number[], b: number[], r: number, m = bark) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b),
      mid = from.clone().add(to).multiplyScalar(0.5);
    const o = mesh(
      p,
      new T.CylinderGeometry(r * 0.7, r, from.distanceTo(to), 7),
      m,
      mid.x,
      mid.y,
      mid.z,
    );
    o.quaternion.setFromUnitVectors(up, to.sub(from).normalize());
  }
  function foliage(
    p: T.Object3D,
    leaves: {
      x: number;
      y: number;
      z: number;
      dx: number;
      dy: number;
      dz: number;
      l: number;
      w: number;
    }[],
    seed = 0,
  ) {
    const inst = new T.InstancedMesh(geo, leavesMat, leaves.length);
    inst.name = 'Conservatory / curved veined leaves';
    leaves.forEach((a, i) => {
      dummy.position.set(a.x, a.y, a.z);
      dummy.quaternion.setFromUnitVectors(
        up,
        new T.Vector3(a.dx, a.dy, a.dz).normalize(),
      );
      dummy.rotateY(rnd(i + seed) * Math.PI * 2);
      dummy.scale.set(a.w, a.l, a.l);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(
        i,
        new T.Color().setHSL(
          0.18 + rnd(i + seed) * 0.08,
          0.25,
          0.54 + rnd(i + 31) * 0.21,
        ),
      );
    });
    inst.castShadow = inst.receiveShadow = true;
    inst.computeBoundingSphere();
    p.add(inst);
    return inst;
  }
  function pot(p: T.Object3D, r: number, h: number, m: T.Material = clay) {
    const profile = [
      [r * 0.65, 0],
      [r * 0.72, 0.04],
      [r * 0.93, h * 0.84],
      [r, h * 0.91],
      [r, h],
      [r * 0.9, h],
      [r * 0.86, h * 0.84],
      [r * 0.63, 0.05],
    ].map(([x, y]) => new T.Vector2(x, y));
    mesh(p, new T.LatheGeometry(profile, 24), m, 0, 0, 0);
    mesh(
      p,
      new T.CylinderGeometry(r * 0.87, r * 0.87, 0.025, 24),
      soil,
      0,
      h * 0.86,
      0,
    );
  }
  function plant(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    size = 1,
    kind: 'broad' | 'fern' | 'flowers' | 'vine' = 'broad',
    seed = 1,
  ) {
    const g = new T.Group();
    g.position.set(x, y, z);
    p.add(g);
    pot(g, 0.23 * size, 0.34 * size);
    const h = 0.3 * size,
      leaves = [];
    const count = kind === 'fern' ? 8 : kind === 'flowers' ? 13 : 10;
    for (let i = 0; i < count; i++) {
      const a = i * 2.4,
        reach = (kind === 'fern' ? 0.56 : 0.3) * size,
        top = h + (0.35 + rnd(i + seed) * 0.38) * size;
      const xx = Math.sin(a) * reach,
        zz = Math.cos(a) * reach;
      rod(g, [0, h, 0], [xx, top, zz], 0.009 * size);
      if (kind === 'fern') {
        for (let j = 1; j < 8; j++)
          for (const side of [-1, 1]) {
            const t = j / 8;
            leaves.push({
              x: xx * t,
              y: h + (top - h) * t,
              z: zz * t,
              dx: Math.cos(a) * side,
              dy: 0.18,
              dz: -Math.sin(a) * side,
              l: (0.18 - 0.013 * j) * size,
              w: 0.06 * size,
            });
          }
      } else
        leaves.push({
          x: xx * 0.55,
          y: top - 0.17 * size,
          z: zz * 0.55,
          dx: Math.sin(a),
          dy: 0.6,
          dz: Math.cos(a),
          l: 0.4 * size,
          w: 0.22 * size,
        });
      if (kind === 'flowers') {
        const fm = seed % 3 === 0 ? flowerOchre : flowerCream;
        for (let k = 0; k < 5; k++) {
          const o = mesh(
            g,
            new T.SphereGeometry(0.04 * size, 7, 5),
            fm,
            xx + Math.cos(k * 1.256) * 0.057 * size,
            top + 0.045 * size,
            zz + Math.sin(k * 1.256) * 0.057 * size,
          );
          o.scale.y = 0.3;
        }
        mesh(
          g,
          new T.SphereGeometry(0.024 * size, 7, 5),
          moss,
          xx,
          top + 0.055 * size,
          zz,
        );
      }
    }
    if (kind === 'vine')
      for (let i = 0; i < 22; i++) {
        const yy = h - i * 0.049 * size,
          xx = Math.sin(i * 0.75) * 0.14 * size,
          zz = 0.21 * size;
        rod(
          g,
          [Math.sin((i - 1) * 0.75) * 0.14 * size, yy + 0.049 * size, zz],
          [xx, yy, zz],
          0.007 * size,
        );
        leaves.push({
          x: xx,
          y: yy,
          z: zz,
          dx: i % 2 ? 1 : -1,
          dy: -0.5,
          dz: 0.4,
          l: 0.21 * size,
          w: 0.17 * size,
        });
      }
    foliage(g, leaves, seed);
    return g;
  }
  const flowerOchre = mat('#d9b579'),
    flowerCream = mat('#f2e6c4');
  function citrus(p: T.Object3D) {
    mesh(p, new T.CylinderGeometry(0.65, 0.59, 0.42, 32), clay, 0, 0.3, 0);
    mesh(p, new T.CylinderGeometry(0.59, 0.59, 0.035, 32), soil, 0, 0.525, 0);
    rod(p, [0, 0.53, 0], [0.08, 2.45, -0.04], 0.09);
    const leaves = [];
    const lemon = mat('#d9ad3f');
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4,
        xx = Math.sin(a) * (0.55 + rnd(i) * 0.2),
        zz = Math.cos(a) * (0.52 + rnd(i + 11) * 0.18),
        yy = 1.65 + rnd(i + 21) * 0.95;
      rod(p, [0.04, 1.2 + (i % 3) * 0.27, 0], [xx, yy, zz], 0.025);
      for (let j = 0; j < 18; j++) {
        const b = j * 2.4;
        leaves.push({
          x: xx + Math.sin(b) * 0.15,
          y: yy + rnd(i * j + 1) * 0.23,
          z: zz + Math.cos(b) * 0.15,
          dx: Math.sin(b),
          dy: 0.25 + rnd(j),
          dz: Math.cos(b),
          l: 0.34,
          w: 0.18,
        });
      }
      const fruit = mesh(
        p,
        new T.SphereGeometry(0.1, 12, 9),
        lemon,
        xx,
        yy - 0.15,
        zz,
      );
      fruit.scale.set(0.77, 1.15, 0.8);
    }
    foliage(p, leaves, 301);
  }
  return { plant, pot, citrus, foliage, rod, soil, clay, bark, moss };
}
