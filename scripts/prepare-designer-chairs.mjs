// Rebuild from Poly Haven's original 1K glTF downloads; see docs/designer-chairs.md.
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune } from '@gltf-transform/functions';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const io = new NodeIO();
await mkdir('public/models/chairs', { recursive: true });
for (const [source, name] of [
  ['modern', 'oak-armchair'],
  ['dining', 'tufted-dining'],
  ['lounge', 'mid-century-lounge'],
]) {
  const doc = await io.read(`output/chair-upgrade/${source}/source.gltf`);
  for (const texture of doc.getRoot().listTextures()) {
    texture.setImage(
      await sharp(texture.getImage())
        .jpeg({
          quality: texture.getName().includes('nor') ? 92 : 85,
          chromaSubsampling: '4:4:4',
        })
        .toBuffer(),
    );
    texture.setMimeType('image/jpeg');
  }
  // Keep the authored silhouette and UVs; deduplicate shared resources only.
  await doc.transform(dedup(), prune());
  await io.write(`public/models/chairs/${name}.glb`, doc);
  console.log(
    name,
    doc
      .getRoot()
      .listMaterials()
      .map((m) => m.getName()),
  );
}
