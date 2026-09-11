import * as T from 'three';

/** Keep clothing and skin softly lit while retaining the source's painted detail. */
export function configureCharacterSurface(material: T.Material) {
  if (!(material instanceof T.MeshStandardMaterial)) return;
  const eyes = material.name.includes('TintEyes');
  const cloth = /TintTop|TintBottom/.test(material.name);
  const floor = eyes ? 0.22 : cloth ? 0.58 : 0.4;
  material.metalness = Math.min(material.metalness, eyes ? 0.05 : 0.32);
  material.envMapIntensity = 0.8;
  if (material.map) material.map.anisotropy = 4;
  const previous = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, ${floor.toFixed(2)});`,
    );
  };
  material.customProgramCacheKey = () => `${key}/soft-figure-v1/${floor}`;
}

/** Repair lighting seams across UV/material splits without rounding hard creases. */
export function smoothCharacterNormals(
  geometries: T.BufferGeometry[],
  positionName = 'position',
  normalName = 'normal',
) {
  type Vertex = {
    attribute: T.BufferAttribute | T.InterleavedBufferAttribute;
    index: number;
    normal: T.Vector3;
  };
  const groups = new Map<string, Vertex[]>();
  for (const geometry of geometries) {
    const position = geometry.getAttribute(positionName),
      normal = geometry.getAttribute(normalName);
    if (!position || !normal) continue;
    for (let i = 0; i < position.count; i++) {
      const key = [position.getX(i), position.getY(i), position.getZ(i)]
        .map((v) => Math.round(v * 100000))
        .join(',');
      const vertices = groups.get(key) ?? [];
      vertices.push({
        attribute: normal,
        index: i,
        normal: new T.Vector3().fromBufferAttribute(normal, i),
      });
      groups.set(key, vertices);
    }
  }
  const sum = new T.Vector3();
  for (const vertices of groups.values()) {
    if (vertices.length < 2) continue;
    for (const vertex of vertices) {
      sum.set(0, 0, 0);
      for (const neighbor of vertices)
        if (vertex.normal.dot(neighbor.normal) > 0.8) sum.add(neighbor.normal);
      if (sum.lengthSq() > 0) {
        sum.normalize();
        vertex.attribute.setXYZ(vertex.index, sum.x, sum.y, sum.z);
      }
    }
  }
}
