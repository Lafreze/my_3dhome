import { botanicalSurface, petalGeometry } from './garden-surfaces';
import { interiorMaterial } from './house-finishes';
import { flowerForSeed, gardenSpecies } from './garden-species';
import * as T from 'three';
import type { InteriorBreeze } from './interior-atmosphere';

export function gardenBotany(
  materials: T.Material[],
  textures: T.Texture[],
  breeze: InteriorBreeze,
) {
  const soil = new T.MeshStandardMaterial({
    color: '#79634c',
    ...botanicalSurface('soil', textures),
    roughness: 1,
    bumpScale: 0.016,
  });
  soil.name = 'Conservatory / granular potting compost';
  materials.push(soil);
  const bark = interiorMaterial('walnut', '#74644d', materials, textures),
    clay = interiorMaterial('clay', '#bc8d72', materials, textures),
    moss = interiorMaterial('wool', '#697c4d', materials, textures);
  const leavesMat = new T.MeshPhysicalMaterial({
    color: '#83a563',
    ...botanicalSurface('leaf', textures),
    side: T.DoubleSide,
    roughness: 0.63,
    bumpScale: 0.003,
    clearcoat: 0.1,
    clearcoatRoughness: 0.55,
    sheen: 0.16,
    sheenColor: new T.Color('#b9ca83'),
    sheenRoughness: 0.8,
  });
  leavesMat.name = 'Conservatory / satin leaf cuticle and fine veins';
  materials.push(leavesMat);
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
          0.21 + rnd(i + seed) * 0.045,
          0.16,
          0.77 + rnd(i + 31) * 0.18,
        ),
      );
    });
    inst.castShadow = inst.receiveShadow = true;
    inst.computeBoundingSphere();
    p.add(inst);
    return inst;
  }
  function pot(
    p: T.Object3D,
    r: number,
    h: number,
    m: T.Material = clay,
    filled = true,
  ) {
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
    mesh(p, new T.LatheGeometry(profile, 40), m, 0, 0.012, 0);
    const saucer = new T.LatheGeometry(
      [
        [0, 0],
        [r * 0.86, 0],
        [r * 1.04, 0.018],
        [r * 1.04, 0.04],
        [r * 0.97, 0.04],
        [r * 0.9, 0.016],
        [0, 0.016],
      ].map(([x, y]) => new T.Vector2(x, y)),
      40,
    );
    mesh(p, saucer, m, 0, 0, 0);
    if (filled)
      mesh(
        p,
        new T.CylinderGeometry(r * 0.87, r * 0.87, 0.025, 24),
        soil,
        0,
        h * 0.86 + 0.012,
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
    pot(
      g,
      (kind === 'flowers' && seed % 3 === 0 ? 0.25 : 0.23) * size,
      (kind === 'flowers' && seed % 3 === 0 ? 0.29 : 0.34) * size,
      kind === 'flowers' ? flowerPots[seed % flowerPots.length] : clay,
    );
    if (kind === 'flowers') return bloom(g, size, seed);
    const h = 0.3 * size,
      leaves = [];
    const count = kind === 'fern' ? 8 : 10;
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

  const flowerPots = [
    clay,
    interiorMaterial('glaze', '#ece4d8', materials, textures),
    interiorMaterial('glaze', '#a4b3a7', materials, textures),
    interiorMaterial('clay', '#c7b49b', materials, textures),
  ];
  const petalMaps = botanicalSurface('petal', textures);
  const petals = gardenSpecies.map((s) => {
    const m = new T.MeshPhysicalMaterial({
      color: s.color,
      ...petalMaps,
      side: T.DoubleSide,
      roughness: 0.72,
      bumpScale: 0.0015,
      sheen: 0.35,
      sheenRoughness: 0.85,
      sheenColor: new T.Color(s.color).lerp(new T.Color('#fff1df'), 0.5),
    });
    m.name = `Conservatory / delicate ${s.id} petals`;
    materials.push(m);
    return m;
  });
  const pollen = interiorMaterial('clay', '#d9b050', materials, textures),
    seedHead = interiorMaterial('clay', '#705339', materials, textures);
  function bloom(g: T.Group, size: number, seed: number) {
    const spec = flowerForSeed(seed),
      material = petals[gardenSpecies.indexOf(spec)];
    g.name = `${spec.name} / ${spec.form}`;
    g.userData.species = spec.id;
    const leaves = [];
    function petal(
      p: T.Object3D,
      a: number,
      r: number,
      l: number,
      width: number,
      tilt = 0,
    ) {
      const o = mesh(
        p,
        petalGeometry(),
        material,
        Math.sin(a) * r,
        0,
        Math.cos(a) * r,
      );
      o.scale.set(width, l * 0.8, l);
      o.rotation.set(tilt, a, 0);
      return o;
    }
    for (let i = 0; i < spec.heads; i++) {
      const a = i * 2.399 + seed * 0.3,
        spread = (spec.form === 'cluster' ? 0.19 : 0.22) * size;
      const x = Math.sin(a) * spread * (0.5 + rnd(seed + i) * 0.5),
        z = Math.cos(a) * spread;
      const h =
        0.29 * size + spec.height * size * (0.74 + rnd(seed + i * 3) * 0.26);
      rod(g, [0, 0.26 * size, 0], [x, h, z], 0.006 * size);
      for (const sign of [-1, 1])
        leaves.push({
          x: x * 0.6,
          y: 0.32 * size + (h - 0.3 * size) * 0.36,
          z: z * 0.6,
          dx: Math.sin(a) * sign,
          dy: 0.42,
          dz: Math.cos(a) * sign,
          l: (spec.form === 'cup' ? 0.4 : 0.23) * size,
          w: spec.leafWidth * size,
        });
      const head = new T.Group();
      head.position.set(x, h, z);
      head.rotation.set(Math.sin(i) * 0.12, a * 0.3, Math.cos(i) * 0.1);
      g.add(head);
      if (spec.form === 'spike') {
        rod(head, [0, -0.1 * size, 0], [0, 0.22 * size, 0], 0.004 * size);
        for (let row = 0; row < 7; row++)
          for (let k = 0; k < 4; k++) {
            const angle = (k * Math.PI) / 2 + row * 0.75,
              r = (0.032 - row * 0.003) * size;
            const b = mesh(
              head,
              new T.SphereGeometry(0.025 * size, 7, 5),
              material,
              Math.sin(angle) * r,
              row * 0.033 * size,
              Math.cos(angle) * r,
            );
            b.scale.set(0.7, 1.3, 0.7);
          }
      } else if (spec.form === 'cluster') {
        for (let j = 0; j < 22; j++) {
          const angle = j * 2.399,
            r = Math.sqrt(j / 22) * 0.14 * size,
            y = Math.sqrt(Math.max(0, 1 - j / 25)) * 0.11 * size;
          const fl = new T.Group();
          fl.position.set(Math.sin(angle) * r, y, Math.cos(angle) * r);
          head.add(fl);
          for (let k = 0; k < 4; k++)
            petal(
              fl,
              (k * Math.PI) / 2,
              0.023 * size,
              0.024 * size,
              0.016 * size,
            );
          mesh(
            fl,
            new T.SphereGeometry(0.012 * size, 6, 4),
            pollen,
            0,
            0.005 * size,
            0,
          );
        }
      } else if (spec.form === 'cup' || spec.form === 'bell') {
        if (spec.form === 'bell') head.rotation.x = 2.4;
        for (let k = 0; k < spec.petals; k++) {
          const angle = (k * Math.PI * 2) / spec.petals,
            profile = [
              [0.022, 0],
              [0.048, 0.025],
              [0.068, 0.055],
              [0.08, 0.09],
              [0.084, 0.125],
              [0.079, 0.15],
              [0.076, 0.169],
            ];
          const shape = new T.LatheGeometry(
            profile.map(([r, y]) => new T.Vector2(r * size, y * size)),
            8,
            angle,
            ((Math.PI * 2) / spec.petals) * 1.06,
          );
          const position = shape.getAttribute('position'),
            uv = shape.getAttribute('uv');
          for (let j = 0; j < position.count; j++) {
            const tip = Math.pow(uv.getY(j), 5);
            position.setY(
              j,
              position.getY(j) +
                Math.sin(uv.getX(j) * Math.PI) * 0.013 * size * tip,
            );
          }
          shape.computeVertexNormals();
          mesh(head, shape, material, 0, 0, 0);
        }
        mesh(
          head,
          new T.SphereGeometry(0.028 * size, 8, 5),
          pollen,
          0,
          0.08 * size,
          0,
        );
      } else if (spec.form === 'rosette') {
        for (let j = 0; j < 4; j++)
          for (let k = 0; k < 8; k++) {
            const p = petal(
              head,
              (k * Math.PI) / 4 + j * 0.47,
              (0.011 + j * 0.019) * size,
              (0.028 + j * 0.014) * size,
              (0.026 + j * 0.012) * size,
              -0.65 + j * 0.17,
            );
            p.position.y = (3 - j) * 0.016 * size;
          }
      } else {
        const radius =
          spec.form === 'sun' ? 0.102 : spec.form === 'poppy' ? 0.072 : 0.065;
        for (let k = 0; k < spec.petals; k++) {
          const p = petal(
            head,
            (k * Math.PI * 2) / spec.petals,
            radius * size,
            (spec.form === 'poppy' ? 0.075 : 0.052) * size,
            (spec.form === 'poppy' ? 0.062 : 0.019) * size,
            0.12,
          );
          p.position.y = Math.sin(k * 2) * 0.008 * size;
        }
        const center = mesh(
          head,
          new T.SphereGeometry(
            (spec.form === 'sun' ? 0.071 : 0.032) * size,
            12,
            7,
          ),
          spec.form === 'sun' || spec.form === 'poppy' ? seedHead : pollen,
          0,
          0.019 * size,
          0,
        );
        center.scale.y = 0.4;
        if (spec.form === 'sun')
          for (let j = 0; j < 19; j++)
            mesh(
              head,
              new T.SphereGeometry(0.007 * size, 5, 4),
              pollen,
              Math.sin(j * 2.4) * Math.sqrt(j / 19) * 0.055 * size,
              0.046 * size,
              Math.cos(j * 2.4) * Math.sqrt(j / 19) * 0.055 * size,
            );
      }
    }
    foliage(g, leaves, seed);
    return g;
  }
  function citrus(p: T.Object3D) {
    mesh(p, new T.CylinderGeometry(0.65, 0.59, 0.42, 32), clay, 0, 0.3, 0);
    mesh(p, new T.CylinderGeometry(0.59, 0.59, 0.035, 32), soil, 0, 0.525, 0);
    rod(p, [0, 0.53, 0], [0.08, 2.45, -0.04], 0.09);
    const leaves = [];
    const lemon = interiorMaterial('clay', '#deb949', materials, textures);
    lemon.roughness = 0.61;
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
