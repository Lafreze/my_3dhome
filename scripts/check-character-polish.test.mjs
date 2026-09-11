import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import {
  prepareResidentSeated,
  residentSeatedPoint,
} from '../app/resident-pose.ts';
import { refineVisitorSeated } from '../app/visitor-seat-fit.ts';
import {
  configureCharacterSurface,
  smoothCharacterNormals,
} from '../app/character-surface.ts';

function meshes(file) {
  const b = readFileSync('public/models/' + file + '.glb'),
    length = b.readUInt32LE(12),
    j = JSON.parse(b.toString('utf8', 20, 20 + length)),
    start = 28 + length,
    out = [];
  function attr(id) {
    const a = j.accessors[id],
      v = j.bufferViews[a.bufferView],
      size = { VEC2: 2, VEC3: 3, SCALAR: 1 }[a.type],
      bytes = { 5126: 4, 5125: 4, 5123: 2 }[a.componentType],
      values = [];
    for (let i = 0; i < a.count; i++)
      for (let k = 0; k < size; k++) {
        const at =
          start +
          (v.byteOffset || 0) +
          (a.byteOffset || 0) +
          i * (v.byteStride || bytes * size) +
          k * bytes;
        values.push(
          a.componentType === 5126
            ? b.readFloatLE(at)
            : a.componentType === 5125
              ? b.readUInt32LE(at)
              : b.readUInt16LE(at),
        );
      }
    return new T.BufferAttribute(
      a.componentType === 5126
        ? new Float32Array(values)
        : new Uint32Array(values),
      size,
    );
  }
  function visit(id, parent = new T.Matrix4()) {
    const n = j.nodes[id],
      m = parent
        .clone()
        .multiply(
          n.matrix
            ? new T.Matrix4().fromArray(n.matrix)
            : new T.Matrix4().compose(
                new T.Vector3(...(n.translation || [0, 0, 0])),
                new T.Quaternion(...(n.rotation || [0, 0, 0, 1])),
                new T.Vector3(...(n.scale || [1, 1, 1])),
              ),
        );
    if (n.mesh !== undefined)
      for (const p of j.meshes[n.mesh].primitives) {
        const g = new T.BufferGeometry();
        g.setAttribute('position', attr(p.attributes.POSITION));
        if (p.attributes.NORMAL !== undefined)
          g.setAttribute('normal', attr(p.attributes.NORMAL));
        if (p.indices !== undefined) g.setIndex(attr(p.indices));
        g.applyMatrix4(m);
        out.push(g);
      }
    for (const c of n.children || []) visit(c, m);
  }
  for (const n of j.scenes[j.scene || 0].nodes) visit(n);
  return out;
}
void test('resident tailored sit retains the complete upper body and round leg sections', () => {
  const geos = meshes('resident-hi3d');
  let unchanged = 0;
  const contacts = [];
  for (const g of geos) {
    const p = g.getAttribute('position');
    contacts.push(...prepareResidentSeated(g));
    const target = g.morphAttributes.position[0],
      normal = g.morphAttributes.normal[0];
    for (let i = 0; i < p.count; i++) {
      const a = new T.Vector3().fromBufferAttribute(p, i),
        b = new T.Vector3().fromBufferAttribute(target, i);
      assert(b.toArray().every(Number.isFinite));
      if (a.y >= 0.56) {
        assert(a.distanceTo(b) < 1e-6);
        unchanged++;
      }
      assert(new T.Vector3().fromBufferAttribute(normal, i).length() > 0.95);
    }
    g.dispose();
  }
  assert(unchanged > 10000);
  assert(contacts.length > 100);
  contacts.sort((a, b) => a - b);
  const contact = contacts[Math.floor(contacts.length * 0.02)];
  assert(contact > 0.25 && contact < 0.5);
  for (const y of [0.12, 0.24, 0.35, 0.45]) {
    const a = residentSeatedPoint(0.1, y, -0.06),
      b = residentSeatedPoint(0.1, y, 0.1);
    assert(
      Math.abs(a.distanceTo(b) - 0.16) < 1e-6,
      'Leg thickness survives the bend',
    );
  }
  // Knees go forward of the hips, shins turn down, head and collar stay upright.
  const hip = residentSeatedPoint(0.1, 0.55, 0.02),
    knee = residentSeatedPoint(0.1, 0.28, 0.02),
    ankle = residentSeatedPoint(0.1, 0.07, 0.02);
  assert(knee.z < hip.z - 0.15);
  assert(ankle.y < knee.y - 0.1);
  assert(ankle.z < knee.z);
});
void test('every visitor preserves standing data, upper silhouette, topology and finite seated normals', () => {
  for (const kind of ['bear', 'cat', 'fox', 'noir', 'rose']) {
    const geometries = meshes('studio-visitor-' + kind + '-v3');
    for (const g of geometries) {
      g.setAttribute(
        'visitorStandPosition',
        g.getAttribute('position').clone(),
      );
      g.setAttribute('visitorStandNormal', g.getAttribute('normal').clone());
    }
    const before = geometries.map((g) =>
      g.getAttribute('position').array.slice(),
    );
    refineVisitorSeated(
      geometries.map((g) => ({ character: kind, geometry: g, pose: 'sit' })),
    );
    smoothCharacterNormals(geometries);
    for (const [j, g] of geometries.entries()) {
      const p = g.getAttribute('position'),
        n = g.getAttribute('normal'),
        source = before[j],
        stand = g.getAttribute('visitorStandPosition');
      assert.deepEqual(stand.array, source);
      for (let i = 0; i < p.count; i++) {
        assert([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite));
        assert.equal(p.getX(i), source[i * 3]);
        if (source[i * 3 + 1] > 0.15)
          assert(
            Math.abs(p.getY(i) - source[i * 3 + 1]) < 1e-6,
            'Do not pull hands, collars or faces',
          );
        const normal = new T.Vector3().fromBufferAttribute(n, i);
        assert(normal.length() > 0.95);
      }
      g.dispose();
    }
  }
});
void test('surface polish joins small shading seams but preserves sharp creases and original colors', () => {
  const geos = [
    [0, 1, 0],
    [0.08, 0.9968, 0],
    [1, 0, 0],
  ].map((normal) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0], 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(normal, 3));
    return g;
  });
  smoothCharacterNormals(geos);
  assert(
    Math.abs(
      geos[0].getAttribute('normal').getX(0) -
        geos[1].getAttribute('normal').getX(0),
    ) < 1e-6,
  );
  assert.equal(geos[2].getAttribute('normal').getX(0), 1);
  const m = new T.MeshStandardMaterial({ color: '#614c3b', metalness: 1 });
  m.name = 'bear_TintTop';
  const color = m.color.clone();
  configureCharacterSurface(m);
  assert(m.color.equals(color));
  assert(m.metalness <= 0.32);
  const shader = {
    fragmentShader: '#include <roughnessmap_fragment>',
    uniforms: {},
    vertexShader: '',
  };
  m.onBeforeCompile(shader, {});
  assert(shader.fragmentShader.includes('max(roughnessFactor, 0.58)'));
  m.dispose();
  geos.forEach((g) => g.dispose());
});
