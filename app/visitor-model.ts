import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createVisitorEyelids } from './visitor-eyelids';
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
};
let cache: Promise<VisitorPart[]> | undefined;
let references = 0;
const tintKeys: Record<string, AppearanceColor> = {
  TintHair: 'hairColor',
  TintEyes: 'eyeColor',
  TintTop: 'topColor',
  TintBottom: 'bottomColor',
};
export function partVisible(part: VisitorPart, appearance: Appearance) {
  return part.character === appearance.character;
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
  textures.forEach((texture) => texture.dispose());
}
async function loadCharacter(character: Character) {
  const { scene } = await new GLTFLoader().loadAsync(
    `/models/studio-visitor-${character}-v4.glb`,
  );
  const parts: VisitorPart[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    // A single model-space rig also applies to accessories and the eyelid surfaces.
    object.geometry.applyMatrix4(object.matrixWorld);
    const geometry = object.geometry;
    for (const [kind, target] of [
      ['position', 'visitorRestPosition'],
      ['normal', 'visitorRestNormal'],
    ] as const) {
      const base = geometry.getAttribute(kind),
        morph = geometry.morphAttributes[kind]?.[0];
      if (!morph) throw new Error(`Missing ${character} rest shape`);
      const data = new Float32Array(base.count * 3);
      for (let i = 0; i < base.count; i++)
        for (let j = 0; j < 3; j++)
          data[i * 3 + j] =
            morph.getComponent(i, j) +
            (geometry.morphTargetsRelative ? base.getComponent(i, j) : 0);
      geometry.setAttribute(target, new T.BufferAttribute(data, 3));
    }
    // Instancing uses our per-person pose attributes, not the global glTF morph weight.
    geometry.morphAttributes = {};
    prepareMotionGeometry(object.geometry, character);
    const part: VisitorPart = {
      geometry: object.geometry,
      material: object.material,
      matrix: new T.Matrix4(),
      name: object.name,
      character,
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
  return parts;
}
// Scene and editor share loaded geometry/textures; the editor owns only material clones.
export async function acquireVisitorModel() {
  references++;
  cache ??= Promise.allSettled(
    appearanceOptions.characters.map(({ id }) =>
      loadCharacter(id as Character),
    ),
  )
    .then((results) => {
      const parts = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      );
      const failure = results.find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') {
        disposeParts(parts);
        throw failure.reason;
      }
      return parts;
    })
    .catch((error) => {
      cache = undefined;
      throw error;
    });
  let parts: VisitorPart[];
  try {
    parts = await cache;
  } catch (error) {
    references--;
    throw error;
  }
  let released = false;
  return {
    parts,
    release: () => {
      if (released) return;
      released = true;
      if (--references === 0) {
        disposeParts(parts);
        cache = undefined;
      }
    },
  };
}
