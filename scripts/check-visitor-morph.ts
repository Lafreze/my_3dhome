import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import { prepareStandingMorph } from '../app/visitor-pose-morph.ts';
import type { VisitorPart } from '../app/visitor-model.ts';
function read(character: string, pose: 'sit' | 'rest') {
  const file = `public/models/studio-visitor-${character}-${pose === 'sit' ? 'v3' : 'standing-v5'}.glb`,
    buffer = readFileSync(file),
    len = buffer.readUInt32LE(12),
    j = JSON.parse(buffer.toString('utf8', 20, 20 + len)),
    offset = 28 + len;
  return j.meshes
    .flatMap(
      (m: {
        primitives: { attributes: Record<string, number>; indices: number }[];
      }) => m.primitives,
    )
    .map(
      (primitive: { attributes: Record<string, number>; indices: number }) => {
        const g = new T.BufferGeometry();
        function attr(id: number) {
          const a = j.accessors[id],
            v = j.bufferViews[a.bufferView],
            size = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type as 'VEC3']!;
          const bytes =
            a.componentType === 5126 || a.componentType === 5125 ? 4 : 2;
          const values = new Float32Array(a.count * size);
          for (let i = 0; i < a.count; i++)
            for (let k = 0; k < size; k++) {
              const p =
                offset +
                (v.byteOffset || 0) +
                (a.byteOffset || 0) +
                i * (v.byteStride || size * bytes) +
                k * bytes;
              values[i * size + k] =
                a.componentType === 5126
                  ? buffer.readFloatLE(p)
                  : a.componentType === 5125
                    ? buffer.readUInt32LE(p)
                    : buffer.readUInt16LE(p);
            }
          return new T.BufferAttribute(values, size);
        }
        g.setAttribute('position', attr(primitive.attributes.POSITION));
        g.setAttribute('normal', attr(primitive.attributes.NORMAL));
        g.setAttribute('uv', attr(primitive.attributes.TEXCOORD_0));
        g.setIndex(Array.from(attr(primitive.indices).array));
        return { geometry: g, pose, character, eyelid: false } as VisitorPart;
      },
    );
}
for (const character of ['bear', 'cat', 'fox', 'noir', 'rose']) {
  const parts = [...read(character, 'sit'), ...read(character, 'rest')],
    start = performance.now();
  await prepareStandingMorph(parts);
  let changed = 0,
    vertices = 0,
    spikes = 0,
    neckMax = 0;
  for (const part of parts.filter((p) => p.pose === 'sit')) {
    const g = part.geometry,
      a = g.getAttribute('position'),
      b = g.getAttribute('visitorStandPosition');
    for (let i = 0; i < a.count; i++) {
      const d = Math.hypot(
        a.getX(i) - b.getX(i),
        a.getY(i) - b.getY(i),
        a.getZ(i) - b.getZ(i),
      );
      assert(Number.isFinite(d));
      if (d > 0.015) changed++;
      vertices++;
      if (a.getY(i) > 0.25) neckMax = Math.max(neckMax, d);
    }
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3)
      for (let k = 0; k < 3; k++) {
        const x = idx.getX(i + k),
          y = idx.getX(i + ((k + 1) % 3));
        const before = Math.hypot(
          a.getX(x) - a.getX(y),
          a.getY(x) - a.getY(y),
          a.getZ(x) - a.getZ(y),
        );
        const after = Math.hypot(
          b.getX(x) - b.getX(y),
          b.getY(x) - b.getY(y),
          b.getZ(x) - b.getZ(y),
        );
        if (after > Math.max(0.075, before * 5)) {
          spikes++;
          if (spikes < 4)
            console.log('bad', {
              before,
              after,
              a: [a.getX(x), a.getY(x), a.getZ(x)],
              b: [b.getX(x), b.getY(x), b.getZ(x)],
              other: [b.getX(y), b.getY(y), b.getZ(y)],
            });
        }
      }
  }
  console.log({
    character,
    ms: performance.now() - start,
    vertices,
    changed,
    spikes,
    neckMax,
  });
  assert.equal(spikes, 0, 'UV morph must not tear triangles');
}
