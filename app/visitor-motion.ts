import * as T from 'three';
import type { Character } from './visitor-appearance';
import { visitorRestMatrix } from './visitor-rest.ts';
import figures from './visitor-figure-profiles.json' with { type: 'json' };
import { configureCharacterSurface } from './character-surface.ts';
import { visitorArmWeight } from './visitor-arm-pose.ts';

// Metres in the seated model's coordinate system; the cushion is y = 0.
export const motionRig = {
  bear: { neck: 0.303, neckZ: 0.005, headStart: 0.27, headEnd: 0.35 },
  cat: { neck: 0.29, neckZ: 0.012, headStart: 0.245, headEnd: 0.355 },
  fox: { neck: 0.237, neckZ: 0.085, headStart: 0.19, headEnd: 0.3 },
  noir: figures.noir.motionRig,
  rose: figures.rose.motionRig,
  ivory: figures.ivory.motionRig,
  dusk: figures.dusk.motionRig,
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
  const weights = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i++) {
    const [head, chest] = visitorWeights(
      character,
      position.getX(i),
      position.getY(i),
      position.getZ(i),
    );
    weights[i * 4] = head;
    weights[i * 4 + 1] = chest;
  }
  geometry.setAttribute('visitorWeights', new T.BufferAttribute(weights, 4));
  if (!geometry.hasAttribute('visitorBlinkDelta'))
    geometry.setAttribute(
      'visitorBlinkDelta',
      new T.BufferAttribute(new Float32Array(position.count * 3), 3),
    );
}

/** Bind limb influence on the intact pose, so low-hanging hands never inherit the leg stride. */
export function prepareVisitorLimbs(
  geometry: T.BufferGeometry,
  character: Character,
) {
  const p =
    geometry.getAttribute('visitorStandPosition') ||
    geometry.getAttribute('position');
  if (!geometry.hasAttribute('visitorWeights'))
    prepareMotionGeometry(geometry, character);
  const weights = geometry.getAttribute('visitorWeights');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const arm = visitorArmWeight(character, x, y, z);
    const leg =
      (1 - smooth(-0.04, 0.045, y)) *
      smooth(0.012, 0.075, Math.abs(x)) *
      (1 - arm);
    weights.setZ(i, character === 'fox' ? leg * smooth(-0.11, -0.035, z) : leg);
    weights.setW(i, arm * (1 - smooth(0.16, 0.25, y)));
  }
  weights.needsUpdate = true;
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
  configureCharacterSurface(material);
  const previous = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey();
  const rig = motionRig[character];
  const restTransform = { value: visitorRestMatrix(character) };
  material.customProgramCacheKey = () =>
    `${previousKey}/puppet-v6/${character}/${instanced}/${eyelid}`;
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.visitorMotion = state;
    shader.uniforms.visitorRest = resting;
    shader.uniforms.visitorActivity = { value: new T.Vector4() };
    shader.uniforms.visitorRestTransform = restTransform;
    shader.vertexShader =
      `
      attribute vec4 visitorWeights;
      attribute vec3 visitorStandPosition;
      attribute vec3 visitorStandNormal;
      ${instanced ? 'attribute vec4 visitorInstanceActivity;' : 'uniform vec4 visitorActivity;'}
      vec4 visitorAction() { return ${instanced ? 'visitorInstanceActivity' : 'visitorActivity'}; }
      float visitorStride() {
        vec4 action = visitorAction();
        return action.x * (action.z < -.5 ? action.w : step(.001, abs(action.y)));
      }
      mat3 visitorArmTurn() {
        vec4 action = visitorAction();
        float angle = sin(action.y + (visitorStandPosition.x < 0. ? 3.14159265 : 0.))
          * .13 * visitorWeights.w * visitorStride() * step(.5, -action.z);
        float c = cos(angle), s = sin(angle);
        return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);
      }
      vec3 visitorGait(vec3 p) {
        vec4 action = visitorAction();
        float weight = visitorWeights.z;
        float phase=fract(action.y / 6.2831853 + (p.x < 0. ? .5 : 0.));
        float swing=max(0.,(phase-.6)/.4);
        float stepZ=phase<.6 ? .108-.36*phase : -.108+.216*(swing*swing*(3.-2.*swing));
        float enabled=visitorStride();
        // Negative activity identifies free walking; shared seated activities keep their gentle gait.
        float walking = step(.5, -action.z);
        p.z += stepZ*mix(.12, 1., walking)*weight*enabled;
        p.y += sin(swing*3.14159265)*mix(.008, .045, walking)*weight*enabled;
        vec3 shoulder = vec3(p.x, .22, .015);
        p = shoulder + visitorArmTurn() * (p - shoulder);
        return p;
      }
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
        p = mix(p, visitorStandPosition, visitorAction().x);
        p = visitorGait(p);
        if(visitorResting() > 0.) {
          ${eyelid ? 'p = mix(visitorLidOpen, p, state.x);' : 'p += visitorBlinkDelta * state.x;'}
          p = mix(p, (visitorRestTransform * vec4(p, 1.)).xyz, visitorResting());
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
        objectNormal = normalize(mix(objectNormal, visitorStandNormal, visitorAction().x));
        mat3 visitorNormalTransform = visitorResting() > .5 ? mat3(visitorRestTransform) : visitorTurn(visitorNormalState.y * visitorWeights.x,
          visitorNormalState.w * visitorWeights.x);
        objectNormal = normalize(visitorNormalTransform * visitorArmTurn() * objectNormal);
        #ifdef USE_TANGENT
          objectTangent = normalize(visitorNormalTransform * visitorArmTurn() * objectTangent);
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
