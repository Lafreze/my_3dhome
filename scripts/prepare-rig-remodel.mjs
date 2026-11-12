import { unifySkinSeams } from './lib/rig-seams.mjs';
// Reproducible skin binding for the approved, separated-limb Hi3D A/T poses.
// Sources remain in ignored output/rig-remodel; deliverables include a real glTF skin.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  prune,
  weld,
  simplify,
  draco,
  textureCompress,
  transformMesh,
  transformPrimitive as transformMeshPrimitive,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { Matrix4, Vector3, Quaternion, Euler } from 'three';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sampleRigLeg, rigCycleDistance } from '../app/rig-gait.mjs';
await Promise.all([MeshoptSimplifier.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.decoder': MeshoptDecoder,
  });
const ids = process.argv.slice(2);
const specs = JSON.parse(await readFile('config/character-rigs.json', 'utf8'));
const catalog = JSON.parse(await readFile('config/asset-catalog.json', 'utf8'));
const tasks = JSON.parse(
  await readFile('output/rig-remodel/tasks.json', 'utf8'),
);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
for (const id of ids) {
  const spec = specs[id],
    raw = await readFile(`output/rig-remodel/${id}/source.glb`),
    doc = await io.readBinary(raw);
  const primitives = () =>
    doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives());
  const triangles = () =>
    primitives().reduce(
      (n, p) =>
        n +
        (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) /
          3,
      0,
    );
  const before = triangles();
  await doc.transform(
    dedup(),
    weld(),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: Math.min(1, 42000 / before),
      error: 0.0005,
    }),
    prune(),
  );
  // Bake original scene transforms before binding an identity-axis skeleton.
  for (const n of doc.getRoot().listNodes())
    if (n.getMesh()) {
      transformMesh(n.getMesh(), n.getWorldMatrix());
      n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    }
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (const p of primitives()) {
    const a = p.getAttribute('POSITION');
    for (let i = 0; i < a.getCount(); i++) {
      const v = a.getElement(i, []);
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], v[k]);
        hi[k] = Math.max(hi[k], v[k]);
      }
    }
  }
  const height = spec.height ?? 1.3,
    scale = height / (hi[1] - lo[1]);
  const waist = [];
  if (!spec.animal)
    for (const p of primitives()) {
      const a = p.getAttribute('POSITION');
      for (let i = 0; i < a.getCount(); i++) {
        const v = a.getElement(i, []);
        if (
          Math.abs((v[0] - (lo[0] + hi[0]) / 2) * scale) < 0.07 &&
          (v[1] - lo[1]) * scale > spec.hip + 0.04 &&
          (v[1] - lo[1]) * scale < spec.shoulder - 0.04
        )
          waist.push(v[2]);
      }
    }
  waist.sort((a, b) => a - b);
  const centerZ = waist.length
    ? (waist[Math.floor(waist.length * 0.1)] +
        waist[Math.floor(waist.length * 0.9)]) /
      2
    : (lo[2] + hi[2]) / 2;
  const matrix = new Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new Matrix4().makeRotationY(spec.yaw ?? 0))
    .multiply(
      new Matrix4().makeTranslation(-(lo[0] + hi[0]) / 2, -lo[1], -centerZ),
    );
  for (const m of doc.getRoot().listMeshes()) transformMesh(m, matrix.elements);
  if (spec.animal) fitAnimal(primitives(), spec);
  for (const p of primitives()) smoothNormals(p, doc);
  const scene = doc.getRoot().listScenes()[0],
    buffer = doc.getRoot().listBuffers()[0];
  const root = doc.createNode('RigRoot');
  scene.addChild(root);
  const defs = spec.joints,
    bones = [],
    points = [],
    byName = {};
  for (const [name, parent, pos] of defs) {
    const node = doc.createNode(name);
    const pp = parent ? points[byName[parent]] : [0, 0, 0];
    node.setTranslation(pos.map((v, k) => v - pp[k]));
    (parent ? bones[byName[parent]] : root).addChild(node);
    byName[name] = bones.length;
    bones.push(node);
    points.push(pos);
  }
  const inverses = new Float32Array(bones.length * 16);
  points.forEach((p, i) =>
    inverses.set(
      new Matrix4().makeTranslation(-p[0], -p[1], -p[2]).elements,
      i * 16,
    ),
  );
  const skin = doc
    .createSkin(`${id} articulated skeleton`)
    .setSkeleton(bones[0])
    .setInverseBindMatrices(
      doc.createAccessor().setType('MAT4').setArray(inverses).setBuffer(buffer),
    );
  bones.forEach((b) => skin.addJoint(b));
  for (const n of doc.getRoot().listNodes())
    if (n.getMesh()) {
      scene.removeChild(n);
      root.addChild(n);
      n.setSkin(skin);
    }
  const weightFor = spec.animal ? animalWeights : humanWeights;
  for (const p of primitives()) {
    const regions = spec.animal ? null : classifyRegions(p, spec);
    const texture = p.getMaterial()?.getBaseColorTexture(),
      uv = p.getAttribute('TEXCOORD_0');
    const pixels = texture
      ? await sharp(texture.getImage())
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
      : null;
    const colorAt = (i) => {
      if (!pixels || !uv) return [0, 0, 0];
      const v = uv.getElement(i, []),
        px = Math.min(
          pixels.info.width - 1,
          Math.max(0, Math.floor(v[0] * pixels.info.width)),
        ),
        py = Math.min(
          pixels.info.height - 1,
          Math.max(0, Math.floor(v[1] * pixels.info.height)),
        ),
        o = (py * pixels.info.width + px) * 4;
      return [...pixels.data.subarray(o, o + 3)].map((x) => x / 255);
    };
    const a = p.getAttribute('POSITION'),
      joints = new Uint16Array(a.getCount() * 4),
      weights = new Float32Array(a.getCount() * 4),
      tints = new Float32Array(a.getCount() * 4);
    for (let i = 0; i < a.getCount(); i++) {
      const color = colorAt(i),
        point = a.getElement(i, []);
      if (!spec.animal) tints.set(tintFor(point, color, spec), i * 4);
      const list = weightFor(point, spec, byName, color, regions?.[i])
          .filter((v) => v[1] > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4),
        sum = list.reduce((n, v) => n + v[1], 0);
      if (!sum) throw new Error(`Unweighted ${id} vertex ${i}`);
      list.forEach(([j, w], k) => {
        joints[i * 4 + k] = j;
        weights[i * 4 + k] = w / sum;
      });
    }
    p.setAttribute(
      '_AVATAR_TINT',
      doc.createAccessor().setType('VEC4').setArray(tints).setBuffer(buffer),
    );
    p.setAttribute(
      'JOINTS_0',
      doc.createAccessor().setType('VEC4').setArray(joints).setBuffer(buffer),
    );
    p.setAttribute(
      'WEIGHTS_0',
      doc.createAccessor().setType('VEC4').setArray(weights).setBuffer(buffer),
    );
  }
  unifySkinSeams(primitives());
  root.setExtras({
    rig: spec,
    cycleDistance: rigCycleDistance,
    source: 'Hi3D approved remodel 2026-11-10',
  });
  // Named animation clips also make the deliverable usable in a normal glTF viewer.
  const times = new Float32Array(Array.from({ length: 31 }, (_, i) => i / 30));
  for (const mode of spec.animal
    ? ['idle', 'walk']
    : ['idle', 'walk', 'sit', 'rest']) {
    const animation = doc.createAnimation(mode);
    for (const property of ['translation', 'rotation']) {
      const size = property === 'translation' ? 3 : 4,
        values = new Float32Array(times.length * size);
      times.forEach((t, i) => {
        if (property === 'rotation')
          values.set(
            new Quaternion()
              .setFromEuler(new Euler(mode === 'rest' ? -Math.PI / 2 : 0, 0, 0))
              .toArray(),
            i * size,
          );
        else
          values.set(
            [
              0,
              mode === 'rest'
                ? 0.16
                : mode === 'sit' && !spec.animal
                  ? -(spec.hip - 0.045)
                  : mode === 'walk'
                    ? -(
                        spec.animal
                          ? sampleRigLeg(
                              t * spec.cycle,
                              1,
                              0,
                              spec.legTop - spec.knee,
                              spec.knee - spec.ankle,
                              spec.cycle,
                              0.012,
                              0.018,
                            )
                          : sampleRigLeg(
                              t * rigCycleDistance,
                              1,
                              0,
                              spec.hip - spec.knee,
                              spec.knee - spec.ankle,
                            )
                      ).drop
                    : 0,
              mode === 'rest' ? 0.58 : 0,
            ],
            i * size,
          );
      });
      const sampler = doc
        .createAnimationSampler()
        .setInput(
          doc
            .createAccessor()
            .setType('SCALAR')
            .setArray(times)
            .setBuffer(buffer),
        )
        .setOutput(
          doc
            .createAccessor()
            .setType(size === 3 ? 'VEC3' : 'VEC4')
            .setArray(values)
            .setBuffer(buffer),
        );
      animation
        .addSampler(sampler)
        .addChannel(
          doc
            .createAnimationChannel()
            .setTargetNode(root)
            .setTargetPath(property)
            .setSampler(sampler),
        );
    }
    for (let b = 0; b < bones.length; b++) {
      const values = new Float32Array(times.length * 4),
        name = defs[b][0];
      times.forEach((t, i) => {
        const r = rotationFor(name, spec, mode, t);
        values.set(
          new Quaternion().setFromEuler(new Euler(...r)).toArray(),
          i * 4,
        );
      });
      const sampler = doc
        .createAnimationSampler()
        .setInput(
          doc
            .createAccessor()
            .setType('SCALAR')
            .setArray(times)
            .setBuffer(buffer),
        )
        .setOutput(
          doc
            .createAccessor()
            .setType('VEC4')
            .setArray(values)
            .setBuffer(buffer),
        );
      animation
        .addSampler(sampler)
        .addChannel(
          doc
            .createAnimationChannel()
            .setTargetNode(bones[b])
            .setTargetPath('rotation')
            .setSampler(sampler),
        );
    }
  }
  await doc.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [1024, 1024],
      quality: 90,
    }),
    draco({ quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14 }),
  );
  await mkdir('public/models/rigged', { recursive: true });
  const bytes = await io.writeBinary(doc),
    source = `public/models/rigged/${id}.glb`;
  await writeFile(source, bytes);
  const model = tasks.find((t) => t.id === id).model;
  const record = {
    id: `character.rigged.${id}`,
    name: `${id} / articulated Hi3D`,
    source,
    path: `models/rigged/${id}.glb`,
    type: 'model',
    room: 'shared',
    rooms: [
      'study',
      'living',
      'bedroom',
      'cafe',
      'gallery',
      'gaming',
      'bar',
      'library',
      'garden',
      'corridor',
    ],
    license: 'Hi3D private generation; owner-authorized use in this project',
    author: 'SATORI / Hi3D',
    sourceUrl: model.model_page_url,
    modifications:
      'Separated-limb remake, fitted skeleton with normalized anatomical skin weights, distance-driven gait, seated and rest poses; 1K PBR and Draco',
    approval: 'approved',
    delivery: 'origin',
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const index = catalog.assets.findIndex((a) => a.id === record.id);
  if (index < 0) catalog.assets.push(record);
  else catalog.assets[index] = record;
  console.log(
    JSON.stringify({
      id,
      bytes: bytes.length,
      triangles: triangles(),
      sourceTriangles: before,
      bones: bones.length,
    }),
  );
}
await writeFile(
  'config/asset-catalog.json',
  JSON.stringify(catalog, null, 2) + '\n',
);
await writeFile(
  'config/character-rigs.json',
  JSON.stringify(specs, null, 2) + '\n',
);
function humanWeights([x, y, z], s, b, rgb, region) {
  // The resident's short leather apron ends at the hips. Binding its lower
  // edge to separate thighs tears the continuous hem during steps and sitting.
  // Keep this garment with the pelvis; trousers underneath retain their rig.
  if (
    s.id === 'resident' &&
    y > 0.48 &&
    y < 0.72 &&
    Math.abs(x) < 0.16 &&
    rgb[0] > rgb[1] * 1.5 &&
    rgb[0] > rgb[2] * 1.8
  )
    return [[b.pelvis, 1]];
  if (region === 2) return [[b[x < 0 ? 'hairL' : 'hairR'] ?? b.head, 1]];
  if (s.id === 'fox' && z < -0.15 && y < 0.64) return [[b.tail, 1]];

  const hip = s.hip,
    knee = s.knee,
    ankle = s.ankle,
    shoulder = s.shoulder,
    neck = s.neck,
    side = x < 0 ? 'L' : 'R',
    out = [];
  const add = (n, w) => out.push([b[n], w]);
  const upper = s.joints.find((j) => j[0] === `upperArm${side}`)[2],
    elbow = s.joints.find((j) => j[0] === `forearm${side}`)[2],
    hand = s.joints.find((j) => j[0] === `hand${side}`)[2];
  const segmentDistance = (a, c) => {
    const dx = c[0] - a[0],
      dy = c[1] - a[1],
      t = Math.max(
        0,
        Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)),
      );
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
  };
  const d = Math.min(
    segmentDistance(upper, elbow),
    segmentDistance(elbow, hand),
  );
  const limbWidth = s.id === 'fox' ? 0.2 : 0.145;
  const headGate =
    s.id === 'rose' && Math.abs(x) < 0.29
      ? 1 - smooth(0.84, 0.87, y)
      : 1 - smooth(neck + 0.01, neck + 0.06, y);
  const arm =
    region === 3
      ? 0
      : smooth(s.bodyWidth, s.bodyWidth + 0.055, Math.abs(x)) *
        headGate *
        (region === 1
          ? 1
          : smooth(hand[1] - 0.22, hand[1] - 0.17, y) *
            (s.armDown > 1 ? 1 : 1 - smooth(limbWidth - 0.04, limbWidth, d)));
  const along = (v, a, c) => {
    const d = c.map((n, k) => n - a[k]);
    return (
      v.reduce((n, q, k) => n + (q - a[k]) * d[k], 0) /
      d.reduce((n, q) => n + q * q, 0)
    );
  };
  const lower = smooth(0.78, 1.16, along([x, y, z], upper, elbow)),
    palm = smooth(0.7, 1.12, along([x, y, z], elbow, hand));
  add(`upperArm${side}`, arm * (1 - lower));
  add(`forearm${side}`, arm * lower * (1 - palm));
  add(`hand${side}`, arm * lower * palm);
  const body = 1 - arm,
    leg =
      (1 - smooth(hip - 0.035, hip + 0.015, y)) *
      (s.skirt ? 1 - smooth(s.hem - 0.025, s.hem + 0.015, y) : 1),
    head = smooth(neck - 0.035, neck + 0.02, y);
  const shin = 1 - smooth(knee - 0.03, knee + 0.03, y),
    foot = 1 - smooth(ankle - 0.025, ankle + 0.03, y);
  add(`thigh${side}`, body * leg * (1 - shin));
  add(`shin${side}`, body * leg * shin * (1 - foot));
  add(`foot${side}`, body * leg * shin * foot);
  const spine = smooth(hip, shoulder - 0.08, y);
  add('pelvis', body * (1 - leg) * (1 - head) * (1 - spine));
  add('spine', body * (1 - leg) * (1 - head) * spine);
  add('head', body * (1 - leg) * head);
  const hair =
    s.id === 'rose' && y > 0.8 && Math.abs(x) > 0.15 && Math.abs(x) < 0.3
      ? smooth(0.23, 0.4, (rgb[0] + rgb[1] + rgb[2]) / 3)
      : 0;
  return hair
    ? [
        ...out.map(([j, w]) => [j, w * (1 - hair)]),
        [b[x < 0 ? 'hairL' : 'hairR'] ?? b.head, hair],
      ]
    : out;
}
function animalWeights([x, y, z], s, b) {
  const nearest = s.joints
    .filter((j) => /Foot/.test(j[0]))
    .reduce((best, j) =>
      Math.hypot(x - j[2][0], z - j[2][2]) <
      Math.hypot(x - best[2][0], z - best[2][2])
        ? j
        : best,
    );
  const side = nearest[0].endsWith('L') ? 'L' : 'R',
    end = nearest[0].startsWith('Front') ? 'Front' : 'Back',
    radial = Math.hypot(x - nearest[2][0], z - nearest[2][2]),
    leg =
      (1 - smooth(s.knee + 0.005, s.legTop - 0.01, y)) *
      (1 - smooth(0.05, 0.085, radial)),
    shin = 1 - smooth(s.knee - 0.025, s.knee + 0.025, y),
    foot = 1 - smooth(s.ankle - 0.012, s.ankle + 0.025, y);
  const head =
    smooth(s.headZ - 0.05, s.headZ + 0.01, z) *
    smooth(s.neck - 0.04, s.neck + 0.025, y) *
    (1 - leg);
  const tail =
    (1 - smooth(s.tailZ - 0.02, s.tailZ + 0.025, z)) *
    smooth(s.legTop + 0.04, s.legTop + 0.08, y) *
    (1 - leg) *
    (1 - head);
  return [
    [b[`${end}Leg${side}`], leg * (1 - shin)],
    [b[`${end}Shin${side}`], leg * shin * (1 - foot)],
    [b[`${end}Foot${side}`], leg * shin * foot],
    [b.head, head],
    [b.tail, tail],
    [b.pelvis, (1 - leg) * (1 - head) - tail],
  ];
}

function rotationFor(name, s, mode, t) {
  if (name.startsWith('hair')) return [mode === 'rest' ? -0.6 : 0, 0, 0];
  if (name === 'tail' && !s.animal)
    return [0, mode === 'rest' ? Math.PI / 2 : 0, 0];
  if (s.animal) {
    const side = name.endsWith('L') ? 0 : 1,
      end = name.startsWith('Back') ? 'Back' : 'Front',
      distance = (t + (end === 'Back' ? 0.25 : 0)) * s.cycle;
    const leg = sampleRigLeg(
      distance,
      mode === 'walk' ? 1 : 0,
      side,
      s.legTop - s.knee,
      s.knee - s.ankle,
      s.cycle,
      0.012,
      0.018,
    );
    if (name.includes('Leg')) return [leg.hip, 0, 0];
    if (name.includes('Shin')) return [leg.knee, 0, 0];
    if (name.includes('Foot')) return [leg.ankle, 0, 0];
    if (name === 'tail') return [0, Math.sin(t * Math.PI * 2) * 0.12, 0];
    return [0, 0, 0];
  }
  const side = name.endsWith('L') ? -1 : 1,
    leg = sampleRigLeg(
      t * rigCycleDistance,
      mode === 'walk' ? 1 : 0,
      side < 0 ? 0 : 1,
      s.hip - s.knee,
      s.knee - s.ankle,
    );
  if (name.startsWith('thigh'))
    return [mode === 'sit' ? -Math.PI / 2 : leg.hip, 0, 0];
  if (name.startsWith('shin'))
    return [mode === 'sit' ? Math.PI / 2 : leg.knee, 0, 0];
  if (name.startsWith('foot')) return [mode === 'sit' ? 0 : leg.ankle, 0, 0];
  if (name.startsWith('upperArm'))
    return [
      mode === 'walk' ? Math.sin(t * Math.PI * 2) * side * 0.2 : 0,
      0,
      -side * s.armDown,
    ];
  return [0, 0, 0];
}

function tintFor([x, y, z], [r, g, b], s) {
  const luma = (r + g + b) / 3,
    front = z > 0.04,
    face = front && Math.abs(x) < 0.17 && y < s.neck + 0.32;
  const hair =
    y > s.neck + 0.04 && !face && (s.id === 'bear' ? luma < 0.38 : true);
  const eye =
    front &&
    y > s.neck + 0.12 &&
    y < s.neck + 0.25 &&
    Math.abs(x) > 0.045 &&
    Math.abs(x) < 0.14 &&
    r > g * 1.45 &&
    r > 0.15;
  const skin = r > g * 1.04 && g > b * 1.06 && luma > 0.4;
  const top =
    y > s.hip + 0.015 &&
    y < s.shoulder + 0.06 &&
    Math.abs(x) < s.bodyWidth + 0.015 &&
    !skin;
  const bottom =
    y > 0.12 && y < s.hip + 0.01 && luma < 0.4 && Math.abs(x) < 0.18;
  return [hair ? 1 : 0, eye ? 1 : 0, top ? 1 : 0, bottom ? 1 : 0];
}

// Follow connected surfaces through UV seams: a braid behind a sleeve must remain
// attached to the head even when it overlaps the arm in a frontal projection.
function classifyRegions(prim, s) {
  const p = prim.getAttribute('POSITION'),
    idx = prim.getIndices().getArray(),
    parent = Array.from({ length: p.getCount() }, (_, i) => i),
    active = [],
    lookup = new Map(),
    result = new Uint8Array(p.getCount());
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i]))),
    merge = (i, j) => (parent[find(i)] = find(j));
  for (let i = 0; i < p.getCount(); i++) {
    const v = p.getElement(i, []);
    active[i] =
      Math.abs(v[0]) > s.bodyWidth + 0.01 && v[1] < s.neck + 0.07 && v[1] > 0.3;
    if (!active[i]) continue;
    const key = v.map((x) => Math.round(x * 1e4)).join(',');
    if (lookup.has(key)) merge(i, lookup.get(key));
    else lookup.set(key, i);
  }
  for (let i = 0; i < idx.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const a = idx[i + k],
        b = idx[i + ((k + 1) % 3)];
      if (active[a] && active[b]) merge(a, b);
    }
  const groups = new Map();
  for (let i = 0; i < p.getCount(); i++)
    if (active[i]) {
      const key = find(i),
        arr = groups.get(key) || [];
      arr.push(i);
      groups.set(key, arr);
    }
  const hands = s.joints
    .filter((j) => j[0].startsWith('hand'))
    .map((j) => j[2]);
  for (const a of groups.values()) {
    let minY = 9,
      maxY = -9,
      hand = 9;
    for (const i of a) {
      const v = p.getElement(i, []);
      minY = Math.min(minY, v[1]);
      maxY = Math.max(maxY, v[1]);
      for (const h of hands)
        hand = Math.min(hand, Math.hypot(...h.map((x, k) => x - v[k])));
    }
    const type =
      hand < 0.095 && minY > (s.skirt ? s.hem - 0.01 : s.hip - 0.02)
        ? 1
        : maxY > s.neck - 0.03 && minY > s.hip + 0.025
          ? 2
          : 3;
    for (const i of a) result[i] = type;
  }
  return result;
}

function smoothNormals(p, doc) {
  const a = p.getAttribute('POSITION'),
    index = p.getIndices().getArray(),
    sum = new Map(),
    keys = [];
  for (let i = 0; i < a.getCount(); i++) {
    const key = a
      .getElement(i, [])
      .map((x) => Math.round(x * 1e5))
      .join(',');
    keys.push(key);
    if (!sum.has(key)) sum.set(key, new Vector3());
  }
  const v = [new Vector3(), new Vector3(), new Vector3()],
    cross = new Vector3();
  for (let i = 0; i < index.length; i += 3) {
    for (let k = 0; k < 3; k++) v[k].fromArray(a.getElement(index[i + k], []));
    cross.crossVectors(v[1].sub(v[0]), v[2].sub(v[0]));
    for (let k = 0; k < 3; k++) sum.get(keys[index[i + k]]).add(cross);
  }
  const normals = new Float32Array(a.getCount() * 3);
  for (let i = 0; i < a.getCount(); i++)
    sum
      .get(keys[i])
      .normalize()
      .toArray(normals, i * 3);
  p.setAttribute(
    'NORMAL',
    doc
      .createAccessor()
      .setType('VEC3')
      .setArray(normals)
      .setBuffer(doc.getRoot().listBuffers()[0]),
  );
}

function fitAnimal(prims, s) {
  const points = [];
  for (const p of prims) {
    const a = p.getAttribute('POSITION');
    for (let i = 0; i < a.getCount(); i++) points.push(a.getElement(i, []));
  }
  const paws = points.filter((p) => p[1] < s.height * 0.11),
    lo = [
      Math.min(...paws.map((p) => p[0])),
      Math.min(...paws.map((p) => p[2])),
    ],
    hi = [
      Math.max(...paws.map((p) => p[0])),
      Math.max(...paws.map((p) => p[2])),
    ];
  let centers = [
    [lo[0], lo[1]],
    [hi[0], lo[1]],
    [lo[0], hi[1]],
    [hi[0], hi[1]],
  ];
  for (let iteration = 0; iteration < 24; iteration++) {
    const sums = centers.map(() => [0, 0, 0]);
    for (const p of paws) {
      let best = 0,
        d = Infinity;
      centers.forEach((c, i) => {
        const v = Math.hypot(p[0] - c[0], p[2] - c[1]);
        if (v < d) {
          best = i;
          d = v;
        }
      });
      sums[best][0] += p[0];
      sums[best][1] += p[2];
      sums[best][2]++;
    }
    centers = centers.map((c, i) =>
      sums[i][2] ? [sums[i][0] / sums[i][2], sums[i][1] / sums[i][2]] : c,
    );
  }
  const bases = centers.map((c) =>
    Math.min(
      ...paws
        .filter((p) =>
          centers.every(
            (other) =>
              Math.hypot(p[0] - c[0], p[2] - c[1]) <=
              Math.hypot(p[0] - other[0], p[2] - other[1]) + 0.00001,
          ),
        )
        .map((p) => p[1]),
    ),
  );
  for (const prim of prims) {
    const a = prim.getAttribute('POSITION');
    for (let i = 0; i < a.getCount(); i++) {
      const v = a.getElement(i, []);
      let nearest = 0;
      centers.forEach((c, k) => {
        if (
          Math.hypot(v[0] - c[0], v[2] - c[1]) <
          Math.hypot(v[0] - centers[nearest][0], v[2] - centers[nearest][1])
        )
          nearest = k;
      });
      if (Number.isFinite(bases[nearest]))
        v[1] -= bases[nearest] * (1 - smooth(s.legTop * 0.65, s.legTop, v[1]));
      a.setElement(i, v);
    }
  }
  const mid = centers.reduce(
    (a, c) => [a[0] + c[0] / 4, a[1] + c[1] / 4],
    [0, 0],
  );
  for (const p of prims)
    transformMeshPrimitive(
      p,
      new Matrix4().makeTranslation(-mid[0], 0, -mid[1]).elements,
    );
  centers = centers.map((c) => [c[0] - mid[0], c[1] - mid[1]]);
  const front = centers.filter((c) => c[1] > 0),
    back = centers.filter((c) => c[1] < 0);
  s.headZ = front.reduce((n, c) => n + c[1] / front.length, 0) - 0.02;
  s.tailZ = back.reduce((n, c) => n + c[1] / back.length, 0) - 0.03;
  s.joints = [
    ['pelvis', null, [0, s.legTop + 0.045, 0]],
    ['head', 'pelvis', [0, s.neck, s.headZ]],
    ['tail', 'pelvis', [0, s.legTop + 0.1, s.tailZ]],
  ];
  for (const [x, z] of centers) {
    const side = x < 0 ? 'L' : 'R',
      end = z > 0 ? 'Front' : 'Back';
    s.joints.push(
      [`${end}Leg${side}`, 'pelvis', [x, s.legTop, z]],
      [`${end}Shin${side}`, `${end}Leg${side}`, [x, s.knee, z]],
      [`${end}Foot${side}`, `${end}Shin${side}`, [x, s.ankle, z]],
    );
  }
  s.radius =
    Math.ceil(
      Math.max(...points.map((p) => Math.hypot(p[0] - mid[0], p[2] - mid[1]))) *
        100,
    ) /
      100 +
    0.01;
}
