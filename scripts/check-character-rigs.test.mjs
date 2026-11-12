import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import specs from '../config/character-rigs.json' with { type: 'json' };
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco.createDecoderModule(),
  });
for (const [id, s] of Object.entries(specs))
  void test(`${id}: skinned, animated and normalized production asset`, async () => {
    const doc = await io.read(`public/models/rigged/${id}.glb`),
      skins = doc.getRoot().listSkins();
    assert.equal(skins.length, 1);
    const skin = skins[0],
      joints = skin.listJoints();
    assert.ok(joints.length >= 15);
    assert.equal(new Set(joints.map((j) => j.getName())).size, joints.length);
    const clips = doc.getRoot().listAnimations();
    for (const name of s.animal
      ? ['idle', 'walk']
      : ['idle', 'walk', 'sit', 'rest'])
      assert.ok(clips.some((c) => c.getName() === name));
    let vertices = 0;
    const influenced = Array.from({ length: joints.length }, () => 0);
    for (const mesh of doc.getRoot().listMeshes())
      for (const p of mesh.listPrimitives()) {
        const a = p.getAttribute('POSITION'),
          n = p.getAttribute('NORMAL'),
          w = p.getAttribute('WEIGHTS_0'),
          j = p.getAttribute('JOINTS_0');
        assert.ok(n && w && j);
        vertices += a.getCount();
        const seams = new Map();
        for (let i = 0; i < a.getCount(); i++) {
          const ws = w.getElement(i, []),
            js = j.getElement(i, []);
          js.forEach((bone, k) => {
            if (ws[k] > 0.2) influenced[bone]++;
          });
          assert.ok(Math.abs(ws.reduce((a, b) => a + b, 0) - 1) < 1 / 4096);
          assert.ok(
            ws.every(Number.isFinite) &&
              a.getElement(i, []).every(Number.isFinite),
          );
          assert.ok(
            js.every((v) => Number.isInteger(v) && v >= 0 && v < joints.length),
          );
          const key = a
            .getElement(i, [])
            .map((v) => Math.round(v * 1e5))
            .join(',');
          const blend = {};
          js.forEach((bone, k) => (blend[bone] = (blend[bone] || 0) + ws[k]));
          const prior = seams.get(key);
          if (prior)
            for (const bone of Object.keys({ ...prior, ...blend }))
              assert.ok(
                Math.abs((prior[bone] || 0) - (blend[bone] || 0)) < 1 / 4096,
                'UV seam separates during animation',
              );
          seams.set(key, blend);
          const legs = js
            .filter((_, k) => ws[k] > 0.01)
            .map((v) => joints[v].getName())
            .filter((n) => /thigh|shin|foot/.test(n));
          assert.ok(
            !(
              legs.some((n) => n.endsWith('L')) &&
              legs.some((n) => n.endsWith('R'))
            ),
            'opposite legs share a vertex',
          );
        }
      }
    assert.ok(vertices > 1000);
    if (id === 'resident')
      for (const [i, joint] of joints.entries())
        assert.ok(
          influenced[i] > 20,
          `${joint.getName()} must deform its mesh; low A-pose hands must not be classified as clothing`,
        );
    for (const clip of clips)
      for (const sampler of clip.listSamplers()) {
        const t = sampler.getInput(),
          v = sampler.getOutput();
        assert.ok(t.getCount() > 2);
        assert.equal(t.getCount(), v.getCount());
        const first = v.getElement(0, []),
          last = v.getElement(v.getCount() - 1, []);
        assert.ok(
          first.every((n, i) => Math.abs(n - last[i]) < 0.00001),
          'loop jumps at its boundary',
        );
      }
  });
