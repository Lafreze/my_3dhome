import * as T from 'three';
import { loadAssetGltf, releaseAssetTexture } from './asset-loading';
import { createVisitorEyelids } from './visitor-eyelids';
import { prepareRestGeometry } from './visitor-rest';
import { prepareMotionGeometry } from './visitor-motion';
import {
  appearanceOptions,
  type Appearance,
  type AppearanceColor,
  type Character,
} from './visitor-appearance';
export type VisitorPart = {
  geometry: T.BufferGeometry;
  material: T.Material | T.Material[];
  matrix: T.Matrix4;
  name: string;
  character: Character;
  tint?: AppearanceColor;
  eyelid?: boolean;
  pose: 'sit' | 'rest';
};
const characterCache = new Map<
  Character,
  { promise: Promise<VisitorPart[]>; references: number }
>();
const tintKeys: Record<string, AppearanceColor> = {
  TintHair: 'hairColor',
  TintEyes: 'eyeColor',
  TintTop: 'topColor',
  TintBottom: 'bottomColor',
};
export function partVisible(
  part: VisitorPart,
  appearance: Appearance,
  posture: 'sit' | 'rest' = 'sit',
) {
  return part.character === appearance.character && part.pose === posture;
}

// Original colors bypass recoloring entirely, preserving the artist's painted texture.
// Both the scene's per-instance color and the editor's uniform color use this same shader.
export function configureVisitorTint(
  material: T.Material,
  character: Character,
  key: AppearanceColor,
) {
  if (!(material instanceof T.MeshStandardMaterial)) return;
  const reference = new T.Color(
    appearanceOptions.characterColors[character][key],
  );
  material.color.copy(reference);
  const ref = `vec3(${reference
    .toArray()
    .map((n) => n.toFixed(8))
    .join(',')})`;
  const embroideryMask =
    character === 'fox' && (key === 'topColor' || key === 'bottomColor')
      ? 'visitorChanged *= 1.0 - smoothstep(1.45, 2.2, diffuseColor.r / max(diffuseColor.b, 0.003));'
      : '';
  material.customProgramCacheKey = () =>
    `visitor-original-v3/${character}/${key}`;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( vec3(1.0), opacity );',
      )
      .replace('#include <color_fragment>', '')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 visitorChoice = diffuse;
        #ifdef USE_COLOR
          visitorChoice = vColor.rgb;
        #endif
        vec3 visitorReference = ${ref};
        float visitorChanged = smoothstep(0.0001, 0.005, distance(visitorChoice, visitorReference));
        ${embroideryMask}
        float visitorLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        float visitorReferenceLuma = max(0.025, dot(visitorReference, vec3(0.2126, 0.7152, 0.0722)));
        vec3 visitorRecolored = visitorChoice * (visitorLuma / visitorReferenceLuma);
        diffuseColor.rgb = mix(diffuseColor.rgb, visitorRecolored, visitorChanged);
      `,
      );
  };
  material.needsUpdate = true;
}
function disposeParts(parts: VisitorPart[]) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  for (const part of parts) {
    geometries.add(part.geometry);
    for (const material of Array.isArray(part.material)
      ? part.material
      : [part.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof T.Texture) textures.add(value);
    }
  }
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach(releaseAssetTexture);
}
async function loadPose(character: Character, pose: 'sit' | 'rest') {
  const { scene } = await loadAssetGltf(`character.${character}.${pose}`);
  const parts: VisitorPart[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    // A single model-space rig also applies to accessories and the eyelid surfaces.
    object.geometry.applyMatrix4(object.matrixWorld);
    prepareMotionGeometry(object.geometry, character);
    const part: VisitorPart = {
      geometry: object.geometry,
      material: object.material,
      matrix: new T.Matrix4(),
      name: object.name,
      character,
      pose,
    };
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      const name = material.name
        .replace(/\.\d+$/, '')
        .replace(`${character}_`, '');
      if (tintKeys[name]) {
        part.tint = tintKeys[name];
        configureVisitorTint(material, character, part.tint);
      }
      if (material instanceof T.MeshStandardMaterial && material.map)
        material.map.anisotropy = 4;
    }
    parts.push(part);
  });
  parts.push(createVisitorEyelids(parts, character));
  parts.forEach((part) => prepareRestGeometry(part.geometry, character));
  return parts;
}
async function loadCharacter(character: Character) {
  const seated = await loadPose(character, 'sit');
  try {
    const standing = await loadPose(character, 'rest');
    // Both exports use byte-identical source artwork (checked by check-visitor-rest).
    // Share GPU textures while keeping each pose's independent mesh and tint materials.
    const key = (name: string) => name.replace(/\.\d+$/, '');
    const sources = new Map(
      seated.flatMap((part) =>
        (Array.isArray(part.material) ? part.material : [part.material]).map(
          (material) => [key(material.name), material] as const,
        ),
      ),
    );
    const redundant = new Set<T.Texture>();
    for (const part of standing)
      for (const material of Array.isArray(part.material)
        ? part.material
        : [part.material]) {
        const source = sources.get(key(material.name));
        if (
          !(material instanceof T.MeshStandardMaterial) ||
          !(source instanceof T.MeshStandardMaterial)
        )
          continue;
        for (const field of [
          'map',
          'normalMap',
          'roughnessMap',
          'metalnessMap',
        ] as const) {
          if (!material[field] || !source[field]) continue;
          redundant.add(material[field]);
          material[field] = source[field];
        }
      }
    redundant.forEach(releaseAssetTexture);
    return [...seated, ...standing];
  } catch (error) {
    disposeParts(seated);
    throw error;
  }
}
// Scene and editor share loaded geometry/textures; the editor owns only material clones.
export async function acquireVisitorModel(
  characters: Character[] = appearanceOptions.characters.map(
    ({ id }) => id as Character,
  ),
) {
  const acquired: { parts: VisitorPart[]; release: () => void }[] = [];
  const results = await Promise.allSettled(
    [...new Set(characters)].map(async (character) => {
      let entry = characterCache.get(character);
      if (!entry) {
        entry = { promise: loadCharacter(character), references: 0 };
        characterCache.set(character, entry);
      }
      entry.references++;
      let parts: VisitorPart[];
      try {
        parts = await entry.promise;
      } catch (error) {
        entry.references--;
        if (characterCache.get(character) === entry)
          characterCache.delete(character);
        throw error;
      }
      let released = false;
      acquired.push({
        parts,
        release() {
          if (released) return;
          released = true;
          if (--entry.references === 0) {
            disposeParts(parts);
            if (characterCache.get(character) === entry)
              characterCache.delete(character);
          }
        },
      });
    }),
  );
  const failure = results.find((r) => r.status === 'rejected');
  if (failure?.status === 'rejected') {
    acquired.forEach((entry) => entry.release());
    throw failure.reason;
  }
  return {
    parts: acquired.flatMap((entry) => entry.parts),
    release: () => acquired.forEach((entry) => entry.release()),
  };
}
