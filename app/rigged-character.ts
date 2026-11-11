import { seatedHipHeight } from './seat-support.mjs';
import * as T from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { loadAssetGltf, releaseAssetTexture } from './asset-loading';
import {
  configureCharacterSurface,
  smoothCharacterNormals,
} from './character-surface';
import { humanScale } from './character-scale.mjs';
import { footLift } from './visitor-travel.mjs';
import { sampleRigLeg } from './rig-gait.mjs';
import {
  appearanceOptions,
  type Appearance,
  type Character,
} from './visitor-appearance';
import rigSpecs from '../config/character-rigs.json';

type RigId = Character | 'resident' | 'shiba' | 'capybara';
type Source = Awaited<ReturnType<typeof loadAssetGltf>>;
const preparedGeometry = new WeakSet<T.BufferGeometry>();
const cache = new Map<RigId, { promise: Promise<Source>; users: number }>();
export type RigPose = {
  time: number;
  distance?: number;
  walk?: number;
  stand?: number;
  rest?: number;
  activity?: number;
  amount?: number;
  reduced?: boolean;
  floorOffset?: number;
  seatBack?: number;
};
export type RiggedCharacter = Awaited<
  ReturnType<typeof acquireRiggedCharacter>
>;
export async function acquireRiggedCharacter(id: RigId) {
  let entry = cache.get(id);
  if (!entry) {
    entry = { promise: loadAssetGltf(`character.rigged.${id}`), users: 0 };
    cache.set(id, entry);
  }
  entry.users++;
  let source: Source;
  try {
    source = await entry.promise;
  } catch (error) {
    if (--entry.users === 0) cache.delete(id);
    throw error;
  }
  const root = new T.Group(),
    pivot = new T.Group(),
    avatar = clone(source.scene);
  root.name = `Articulated ${id}`;
  root.add(pivot);
  pivot.add(avatar);
  const choices = ['hairColor', 'eyeColor', 'topColor', 'bottomColor'] as const;
  const references =
    id in appearanceOptions.characterColors
      ? choices.map(
          (k) =>
            new T.Color(appearanceOptions.characterColors[id as Character][k]),
        )
      : [];
  const colors = references.map((c) => ({ value: c.clone() }));
  const bones = new Map<string, T.Bone>(),
    meshes: T.SkinnedMesh[] = [],
    materials: T.Material[] = [];
  const spec = rigSpecs[id];
  avatar.traverse((o) => {
    if (o instanceof T.Bone) bones.set(o.name, o);
    if (!(o instanceof T.Mesh)) return;
    if (!preparedGeometry.has(o.geometry)) {
      if (o instanceof T.SkinnedMesh) o.normalizeSkinWeights();
      smoothCharacterNormals([o.geometry]);
      preparedGeometry.add(o.geometry);
    }
    const ownedMaterials = (
      Array.isArray(o.material) ? o.material : [o.material]
    ).map((m) => {
      const owned = m.clone();
      configureCharacterSurface(owned);
      if ('animal' in spec && owned instanceof T.MeshStandardMaterial) {
        owned.roughness = 1;
        owned.metalness = 0;
      }
      if (references.length) {
        const previous = owned.onBeforeCompile.bind(owned),
          key = owned.customProgramCacheKey();
        owned.onBeforeCompile = (
          shader: Parameters<T.Material['onBeforeCompile']>[0],
          renderer: T.WebGLRenderer,
        ) => {
          previous(shader, renderer);
          colors.forEach((v, i) => (shader.uniforms[`rigColor${i}`] = v));
          shader.vertexShader =
            'attribute vec4 _avatar_tint; varying vec4 vRigTint;\n' +
            shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvRigTint = _avatar_tint;',
          );
          shader.fragmentShader =
            'varying vec4 vRigTint;\n' +
            colors.map((_, i) => `uniform vec3 rigColor${i};`).join('\n') +
            '\n' +
            shader.fragmentShader;
          const tint = references
            .map((ref, i) => {
              const vec = `vec3(${ref
                .toArray()
                .map((n) => n.toFixed(8))
                .join(',')})`;
              return `diffuseColor.rgb = mix(diffuseColor.rgb, rigColor${i} * dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)) / max(.025,dot(${vec},vec3(.2126,.7152,.0722))), vRigTint[${i}] * smoothstep(.0001,.005,distance(rigColor${i},${vec})));`;
            })
            .join('\n');
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            '#include <map_fragment>\n' + tint,
          );
        };
        owned.customProgramCacheKey = () => `${key}/rig-tint/${id}`;
      }
      materials.push(owned);
      return owned;
    });
    o.material =
      ownedMaterials.length === 1 ? ownedMaterials[0] : ownedMaterials;
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false;
    if (o instanceof T.SkinnedMesh) {
      meshes.push(o);
      o.boundingSphere = new T.Sphere(new T.Vector3(0, 0.6, 0), 1.6);
      o.boundingBox = new T.Box3(
        new T.Vector3(-0.8, -0.5, -1),
        new T.Vector3(0.8, 1.5, 1),
      );
    }
  });
  const elbowAxes = new Map(
    ['L', 'R'].map((side) => {
      const hand = bones.get(`hand${side}`),
        v = hand?.position ?? new T.Vector3(0, -1, 0);
      return [side, new T.Vector3(v.y, -v.x, 0).normalize()];
    }),
  );
  const bendElbow = (side: string, amount: number) =>
    bones
      .get(`forearm${side}`)
      ?.quaternion.setFromAxisAngle(elbowAxes.get(side)!, amount);
  const rests = new Map([...bones].map(([n, b]) => [n, b.position.clone()]));
  let released = false;
  const animal = 'animal' in spec;
  const scale = animal ? 1 : humanScale(id as Character | 'resident');
  root.scale.setScalar(1 / scale); // Existing seat/label anchors retain their authored scales.
  const rotate = (name: string, x = 0, y = 0, z = 0) =>
    bones.get(name)?.rotation.set(x, y, z);
  function pose(p: RigPose) {
    const time = p.reduced ? 0 : p.time,
      walk = p.reduced ? 0 : (p.walk ?? 0),
      distance = p.distance ?? 0;
    for (const [name, b] of bones) {
      b.rotation.set(0, 0, 0);
      b.position.copy(rests.get(name)!);
    }
    pivot.position.set(0, 0, 0);
    pivot.rotation.set(0, 0, 0);
    if ('animal' in spec) {
      const cycle = spec.cycle;
      for (const [sideIndex, side] of ['L', 'R'].entries())
        for (const end of ['Front', 'Back']) {
          const offset = end === 'Back' ? 0.25 : 0;
          const leg = sampleRigLeg(
            distance + offset * cycle,
            walk,
            sideIndex,
            spec.legTop - spec.knee,
            spec.knee - spec.ankle,
            cycle,
            0.012,
            0.018,
          );
          rotate(`${end}Leg${side}`, leg.hip);
          rotate(`${end}Shin${side}`, leg.knee);
          rotate(`${end}Foot${side}`, leg.ankle);
          pivot.position.y = -leg.drop;
        }
      rotate(
        'head',
        Math.sin(time * 0.9) * 0.025 * (1 - walk),
        Math.sin(time * 0.45) * 0.06 * (1 - walk),
      );
      rotate(
        'tail',
        0,
        Math.sin(time * (id === 'shiba' ? 5 : 1.2)) *
          (id === 'shiba' ? 0.18 : 0.04),
        0,
      );
      const pelvis = bones.get('pelvis');
      if (pelvis)
        pelvis.position.y += Math.sin(time * 1.8) * 0.002 * (1 - walk);
    } else {
      const seatHeight = seatedHipHeight[id as keyof typeof seatedHipHeight];
      const stand = p.stand ?? 1,
        rest = p.rest ?? 0,
        sit = (1 - stand) * (1 - rest),
        moving = walk * stand * (1 - rest);
      const floorOffset =
        p.floorOffset ??
        (id === 'resident' ? 0 : footLift[id as Character] * scale);
      pivot.position.y =
        -(spec.hip - seatHeight) * sit -
        floorOffset * stand * (1 - rest) +
        0.16 * rest -
        sampleRigLeg(
          distance,
          moving,
          0,
          spec.hip - spec.knee,
          spec.knee - spec.ankle,
        ).drop;
      pivot.position.z = 0.58 * rest - (p.seatBack ?? 0) * sit;
      pivot.rotation.x = (-Math.PI / 2) * rest;
      for (const [i, side] of ['L', 'R'].entries()) {
        const leg = sampleRigLeg(
          distance,
          moving,
          i,
          spec.hip - spec.knee,
          spec.knee - spec.ankle,
        );
        rotate(`thigh${side}`, leg.hip - (Math.PI / 2) * sit);
        rotate(`shin${side}`, leg.knee + 0.06 * sit);
        rotate(`foot${side}`, leg.ankle + 0.15 * sit);
        const sign = i === 0 ? -1 : 1,
          armSwing =
            Math.sin((distance / 0.52) * Math.PI * 2) * sign * 0.2 * moving;
        rotate(
          `upperArm${side}`,
          armSwing - 0.22 * sit,
          0,
          -sign * spec.armDown,
        );
        bendElbow(side, 0.12 * sit);
        if (p.activity && !rest && !moving) {
          const amount = p.amount ?? 1;
          // Reach from the shoulder and elbow; the hand is never translated off its arm.
          rotate(
            `upperArm${side}`,
            -0.55 * amount,
            0,
            -sign * (spec.armDown - 0.16 * amount),
          );
          bendElbow(side, 0.65 * amount);
        }
      }
      rotate(
        'spine',
        0,
        Math.sin((distance / 0.52) * Math.PI * 2) * 0.025 * moving,
        Math.sin((distance / 0.52) * Math.PI * 2) * 0.014 * moving,
      );
      const seatedTail = bones.get('tail');
      if (seatedTail) seatedTail.rotation.order = 'YXZ';
      rotate(
        'tail',
        (Math.PI / 2) * sit,
        (Math.PI / 2) * (rest + sit) +
          Math.sin(time * 1.1) * 0.025 * (1 - rest),
        0,
      );
      const tail = bones.get('tail');
      if (tail) tail.position.z += 0.14 * rest;
      for (const side of ['L', 'R'])
        rotate(
          `hair${side}`,
          -0.6 * rest +
            Math.sin((distance / 0.52) * Math.PI * 2) * 0.018 * moving,
          0,
          0,
        );
      rotate(
        'head',
        Math.sin(time * 1.2) * 0.012 * (1 - moving),
        Math.sin(time * 0.53) * 0.025 * (1 - moving),
      );
    }
    avatar.updateMatrixWorld(true);
    meshes.forEach((m) => m.skeleton.update());
  }
  pose({ time: 0 });
  return {
    root,
    meshes,
    bones,
    pose,
    setAppearance(a: Appearance) {
      choices.forEach((k, i) => colors[i]?.value.set(a[k]));
    },
    dispose() {
      if (released) return;
      released = true;
      root.removeFromParent();
      materials.forEach((m) => m.dispose());
      new Set(meshes.map((m) => m.skeleton)).forEach((s) => s.dispose());
      if (--entry.users !== 0) return;
      cache.delete(id);
      const textures = new Set<T.Texture>(),
        geometries = new Set<T.BufferGeometry>(),
        owned = new Set<T.Material>();
      source.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          geometries.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            owned.add(m),
          );
        }
      });
      owned.forEach((m) => {
        Object.values(m).forEach((v) => {
          if (v instanceof T.Texture) textures.add(v);
        });
        m.dispose();
      });
      geometries.forEach((g) => g.dispose());
      textures.forEach(releaseAssetTexture);
    },
  };
}
