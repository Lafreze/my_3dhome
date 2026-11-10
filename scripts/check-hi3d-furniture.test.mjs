import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

void test('all ten approved room replacements decode with embedded PBR and stay within runtime budgets', async () => {
  const plan = JSON.parse(await readFile('config/hi3d-furniture.json', 'utf8'));
  const catalog = JSON.parse(
    await readFile('config/asset-catalog.json', 'utf8'),
  );
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });
  assert.equal(plan.assets.length, 10);
  assert.equal(new Set(plan.assets.map((a) => a.room)).size, 10);
  assert.equal(plan.assets.filter((a) => a.version === 'v3.0').length, 6);
  assert.equal(plan.assets.filter((a) => a.version === 'v2.1').length, 4);
  for (const a of plan.assets) {
    const entry = catalog.assets.find((e) => e.id === `furniture.hi3d.${a.id}`);
    assert(entry, a.id);
    assert.equal(entry.approval, 'approved');
    assert.equal(entry.delivery, 'origin');
    assert.equal(entry.sourceUrl, a.modelPage);
    const bytes = await readFile(entry.source);
    assert(bytes.length < 1500000, `${a.id}: download budget`);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      entry.sourceSha256,
    );
    const doc = await io.readBinary(bytes),
      root = doc.getRoot();
    let triangles = 0;
    for (const mesh of root.listMeshes())
      for (const p of mesh.listPrimitives()) {
        const positions = p.getAttribute('POSITION');
        assert(positions.getCount() > 0, a.id);
        assert(
          positions.getArray().every(Number.isFinite),
          `${a.id}: finite geometry`,
        );
        triangles += (p.getIndices()?.getCount() ?? positions.getCount()) / 3;
        const material = p.getMaterial();
        assert(material?.getBaseColorTexture(), `${a.id}: base color`);
        assert(material.getMetallicRoughnessTexture(), `${a.id}: PBR`);
      }
    assert(
      triangles > 1000 && triangles <= (a.version === 'v3.0' ? 56000 : 40000),
      `${a.id}: triangle budget`,
    );
    for (const texture of root.listTextures()) {
      assert(texture.getImage()?.length > 0, `${a.id}: embedded texture`);
      const metadata = await sharp(texture.getImage()).metadata();
      assert(
        metadata.width <= 1024 && metadata.height <= 1024,
        `${a.id}: texture budget`,
      );
    }
  }
});
