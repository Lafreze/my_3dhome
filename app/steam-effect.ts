import * as T from 'three';

/** One small draw call per cup; every wisp curls, expands and fades over its own lifetime. */
export function createSteamEffect(
  options: {
    count?: number;
    height?: number;
    width?: number;
    seed?: number;
  } = {},
) {
  const count = options.count ?? 8,
    height = options.height ?? 0.36,
    width = options.width ?? 0.09;
  const positions = new Float32Array(count * 3),
    phases = new Float32Array(count);
  for (let i = 0; i < count; i++)
    phases[i] = (i / count + (options.seed ?? 0) * 0.137) % 1;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new T.BufferAttribute(phases, 1));
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      clock: { value: options.seed ?? 0 },
      strength: { value: 0.3 },
      height: { value: height },
      width: { value: width },
      viewport: { value: 1000 },
    },
    vertexShader: `
      attribute float phase;
      uniform float clock, strength, height, width, viewport;
      varying float alpha, twist;
      void main() {
        float age = fract(clock * (.19 + phase * .065) + phase);
        float curl = age * age;
        vec3 p = vec3(sin(age * 7. + clock * .8 + phase * 12.) * width * curl,
          age * height, cos(age * 6. + clock * .5 + phase * 8.) * width * .4 * curl);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float scale = length(modelViewMatrix[0].xyz);
        gl_PointSize = clamp((.025 + age * width * 1.4) * scale * viewport * projectionMatrix[1][1] / max(.1, -mv.z), 1., 100.);
        alpha = sin(age * 3.14159265) * strength * .32;
        twist = clock * .35 + phase * 7.;
      }`,
    fragmentShader: `
      varying float alpha, twist;
      void main() {
        vec2 uv = gl_PointCoord - .5;
        float c = cos(twist), s = sin(twist);
        uv = mat2(c, -s, s, c) * uv;
        float soft = exp(-dot(uv * vec2(2.8, 1.8), uv * vec2(2.8, 1.8)) * 3.);
        float edge = 1. - smoothstep(.3, .5, length(uv));
        gl_FragColor = vec4(.98, .97, .94, soft * edge * alpha);
      }`,
  });
  const root = new T.Points(geometry, material);
  root.name = 'coffee/steam';
  root.frustumCulled = false;
  root.raycast = () => {};
  return {
    root,
    update(dt: number, strength = 0.6, reduced = false, visible = true) {
      root.visible = visible && !reduced && strength > 0.005;
      if (!root.visible) return;
      material.uniforms.clock.value += Math.min(dt, 0.1);
      material.uniforms.strength.value = strength;
      material.uniforms.viewport.value =
        window.innerHeight * Math.min(devicePixelRatio, 1.5);
    },
    snapshot: () => ({
      time: material.uniforms.clock.value,
      visible: root.visible,
      strength: material.uniforms.strength.value,
      particles: count,
    }),
    dispose() {
      geometry.dispose();
      material.dispose();
      root.removeFromParent();
    },
  };
}
