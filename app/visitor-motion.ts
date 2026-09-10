import * as T from 'three';
import type { Character } from './visitor-appearance';
import { visitorRestMatrix } from './visitor-rest.ts';
import figures from './visitor-figure-profiles.json' with { type: 'json' };

// Metres in the seated model's coordinate system; the cushion is y = 0.
export const motionRig = {
  bear: { neck: 0.303, neckZ: 0.005, headStart: 0.27, headEnd: 0.35 },
  cat: { neck: 0.29, neckZ: 0.012, headStart: 0.245, headEnd: 0.355 },
  fox: { neck: 0.237, neckZ: 0.085, headStart: 0.19, headEnd: 0.3 },
  noir: figures.noir.motionRig,
  rose: figures.rose.motionRig,
} satisfies Record<Character, object>;

const smooth = (a: number, b: number, x: number) => {
  const v = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return v * v * (3 - 2 * v);
};
export function visitorSeed(identity: string) {
  let h = 2166136261;
  for (let i = 0; i < identity.length; i++) {
    h ^= identity.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function random(seed: number, cycle: number, salt: number) {
  let n = (seed ^ Math.imul(cycle + salt, 0x45d9f3b)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function blinkPulse(t: number) {
  // Close quickly, briefly meet, reopen more slowly. No sine-wave flutter.
  return smooth(0, 0.068, t) * (1 - smooth(0.096, 0.225, t));
}

/** x: eyelid closure, y: head yaw, z: chest lift, w: head pitch. */
export function sampleVisitorMotion(
  seconds: number,
  seed: number,
  reduced: boolean,
  result = new T.Vector4(),
) {
  if (reduced) return result.set(0, 0, 0, 0);
  const t = Math.max(0, seconds) + random(seed, 0, 31) * 37;
  const blinkPeriod = 4.0 + random(seed, 0, 5) * 2.4;
  const cycle = Math.floor(t / blinkPeriod);
  const blinkT = (t % blinkPeriod) - (0.45 + random(seed, cycle, 7) * 1.3);
  const blink = Math.max(
    blinkPulse(blinkT),
    random(seed, cycle, 11) < 0.22 ? blinkPulse(blinkT - 0.36) : 0,
  );
  const lookPeriod = 11 + random(seed, 0, 13) * 6;
  const lookCycle = Math.floor(t / lookPeriod);
  const lookT = (t % lookPeriod) - 2.2;
  const turn = smooth(0, 1.4, lookT) * (1 - smooth(3.6, 5.5, lookT));
  const yaw =
    turn *
    (random(seed, lookCycle, 17) < 0.5 ? -1 : 1) *
    (0.09 + random(seed, lookCycle, 19) * 0.065);
  const breath =
    Math.sin(t * ((2 * Math.PI) / (4.1 + random(seed, 0, 23)))) * 0.0024;
  const pitch = turn * (random(seed, lookCycle, 29) - 0.5) * 0.042;
  return result.set(blink, yaw, breath, pitch);
}

/** One scalar weight field keeps the original continuous surface intact. */
export function visitorWeights(
  character: Character,
  x: number,
  y: number,
  z: number,
) {
  const rig = motionRig[character];
  // The kitsune's rear tail fan belongs to the hips, not to the head.
  const tailExclusion = character === 'fox' ? smooth(-0.1, -0.055, z) : 1;
  const head = smooth(rig.headStart, rig.headEnd, y) * tailExclusion;
  const chest = smooth(0.055, rig.neck, y) * tailExclusion;
  return [head, chest] as const;
}

export function prepareMotionGeometry(
  geometry: T.BufferGeometry,
  character: Character,
) {
  const position = geometry.getAttribute('position');
  const weights = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const [head, chest] = visitorWeights(
      character,
      position.getX(i),
      position.getY(i),
      position.getZ(i),
    );
    weights[i * 2] = head;
    weights[i * 2 + 1] = chest;
  }
  geometry.setAttribute('visitorWeights', new T.BufferAttribute(weights, 2));
  if (!geometry.hasAttribute('visitorBlinkDelta'))
    geometry.setAttribute(
      'visitorBlinkDelta',
      new T.BufferAttribute(new Float32Array(position.count * 3), 3),
    );
}

// Shared by the color, shadow and preview passes. Motion is per instance, not per mesh.
export function configureVisitorMotion(
  material: T.Material,
  character: Character,
  state: { value: T.Vector4 },
  instanced: boolean,
  eyelid = false,
  resting: { value: number } = { value: 0 },
) {
  const previous = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey();
  const rig = motionRig[character];
  const restTransform = { value: visitorRestMatrix(character) };
  material.customProgramCacheKey = () =>
    `${previousKey}/idle-v3/${character}/${instanced}/${eyelid}`;
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.visitorMotion = state;
    shader.uniforms.visitorRest = resting;
    shader.uniforms.visitorRestTransform = restTransform;
    shader.vertexShader =
      `
      attribute vec2 visitorWeights;
      attribute vec3 visitorBlinkDelta;
      uniform mat4 visitorRestTransform;
      ${instanced ? 'attribute float visitorInstanceRest;' : 'uniform float visitorRest;'}
      ${instanced ? 'attribute vec4 visitorInstanceMotion;' : 'uniform vec4 visitorMotion;'}
      ${eyelid ? 'attribute vec3 visitorLidOpen;' : ''}
      vec4 visitorState() { return ${instanced ? 'visitorInstanceMotion' : 'visitorMotion'}; }
      float visitorResting() {return ${instanced ? 'visitorInstanceRest' : 'visitorRest'};}
      mat3 visitorTurn(float yaw, float pitch) {
        float c = cos(yaw), s = sin(yaw), cp = cos(pitch), sp = sin(pitch);
        return mat3(c,0.,-s, 0.,1.,0., s,0.,c) * mat3(1.,0.,0., 0.,cp,sp, 0.,-sp,cp);
      }
      vec3 visitorPose(vec3 p) {
        vec4 state = visitorState();
        if(visitorResting() > .5) {
          ${eyelid ? 'p = mix(visitorLidOpen, p, state.x);' : 'p += visitorBlinkDelta * state.x;'}
          p = (visitorRestTransform * vec4(p, 1.)).xyz;
          p.y += state.z * visitorWeights.y * (1. - visitorWeights.x);
          return p;
        }
        ${
          eyelid
            ? `p = mix(visitorLidOpen, p, state.x);
        p.z += sin(state.x * 3.14159265) * 0.003;`
            : 'p += visitorBlinkDelta * state.x;'
        }
        vec3 pivot = vec3(0., ${rig.neck.toFixed(5)}, ${rig.neckZ.toFixed(5)});
        mat3 turn = visitorTurn(state.y * visitorWeights.x, state.w * visitorWeights.x);
        p = pivot + turn * (p - pivot);
        p.y += state.z * visitorWeights.y;
        p.z += state.z * visitorWeights.y * 0.32 * (1. - visitorWeights.x);
        return p;
      }
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <begin_vertex>',
        'vec3 transformed = visitorPose(position);',
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vec4 visitorNormalState = visitorState();
        mat3 visitorNormalTransform = visitorResting() > .5 ? mat3(visitorRestTransform) : visitorTurn(visitorNormalState.y * visitorWeights.x,
          visitorNormalState.w * visitorWeights.x);
        objectNormal = normalize(visitorNormalTransform * objectNormal);
        #ifdef USE_TANGENT
          objectTangent = normalize(visitorNormalTransform * objectTangent);
        #endif`,
      );
  };
  material.needsUpdate = true;
}

export function visitorShadowMaterials(
  character: Character,
  state: { value: T.Vector4 },
  instanced: boolean,
  eyelid: boolean,
  resting: { value: number } = { value: 0 },
) {
  const depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
  const distance = new T.MeshDistanceMaterial();
  configureVisitorMotion(depth, character, state, instanced, eyelid, resting);
  configureVisitorMotion(
    distance,
    character,
    state,
    instanced,
    eyelid,
    resting,
  );
  return { depth, distance };
}
