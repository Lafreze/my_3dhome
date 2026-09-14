// Rebuild from Poly Haven's original 1K glTF downloads; see docs/designer-chairs.md.
import { NodeIO, PropertyType } from '@gltf-transform/core';
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
  // Split disconnected authored parts into finish groups without changing a vertex or UV.
  if (source === 'modern') {
    for (const material of doc.getRoot().listMaterials())
      material.setName(
        material.getName().includes('pillow')
          ? 'Chair upholstery'
          : 'Chair timber',
      );
  } else {
    for (const mesh of doc.getRoot().listMeshes())
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION').getArray(),
          indices = primitive.getIndices().getArray();
        const parents = Array.from(
          { length: position.length / 3 },
          (_, i) => i,
        );
        const root = (i) => {
          while (parents[i] !== i) {
            parents[i] = parents[parents[i]];
            i = parents[i];
          }
          return i;
        };
        const join = (a, b) => {
          parents[root(a)] = root(b);
        };
        const welded = new Map();
        for (let i = 0; i < parents.length; i++) {
          const key = Array.from(position.slice(i * 3, i * 3 + 3))
            .map((v) => Math.round(v * 1e5))
            .join(',');
          if (welded.has(key)) join(i, welded.get(key));
          else welded.set(key, i);
        }
        for (let i = 0; i < indices.length; i += 3) {
          join(indices[i], indices[i + 1]);
          join(indices[i], indices[i + 2]);
        }
        const components = new Map();
        for (let i = 0; i < indices.length; i += 3) {
          const key = root(indices[i]);
          if (!components.has(key))
            components.set(key, {
              indices: [],
              min: [Infinity, Infinity, Infinity],
              max: [-Infinity, -Infinity, -Infinity],
            });
          const part = components.get(key);
          for (let j = 0; j < 3; j++) {
            const index = indices[i + j];
            part.indices.push(index);
            for (let a = 0; a < 3; a++) {
              part.min[a] = Math.min(part.min[a], position[index * 3 + a]);
              part.max[a] = Math.max(part.max[a], position[index * 3 + a]);
            }
          }
        }
        const groups = new Map();
        for (const part of components.values()) {
          const role =
            source === 'dining'
              ? part.min[1] < 0.02
                ? 'timber'
                : 'upholstery'
              : part.max[1] < 0.3
                ? 'metal'
                : part.min[0] < -0.48 || part.min[2] < -0.64
                  ? 'timber'
                  : 'upholstery';
          if (!groups.has(role)) groups.set(role, []);
          groups.get(role).push(...part.indices);
        }
        for (const [role, group] of groups) {
          const part = primitive
            .clone()
            .setMaterial(
              primitive.getMaterial().clone().setName(`Chair ${role}`),
            );
          part.setIndices(
            doc
              .createAccessor()
              .setType('SCALAR')
              .setArray(new Uint16Array(group))
              .setBuffer(primitive.getIndices().getBuffer()),
          );
          mesh.addPrimitive(part);
        }
        mesh.removePrimitive(primitive);
        primitive.dispose();
      }
  }
  // Keep the authored silhouette and UVs; deduplicate shared resources only.
  await doc.transform(
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }),
    prune(),
  );
  await io.write(`public/models/chairs/${name}.glb`, doc);
  console.log(
    name,
    doc
      .getRoot()
      .listMaterials()
      .map((m) => m.getName()),
  );
}
