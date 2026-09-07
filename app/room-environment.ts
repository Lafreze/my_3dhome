import * as T from 'three';

import { sunFor, type Environment } from './environment-data';
import type { RoomId } from './house-data';
import type { HouseLandscape } from './house-landscape';

const palettes = {
  morning: {
    top: '#88b6c5',
    bottom: '#f7dec1',
    ridge: '#7d9c99',
    near: '#465f56',
    sun: '#ffe2b7',
    hemi: '#d6e6ee',
    ground: '#9b8470',
    power: 3.0,
    ambient: 2.0,
    fill: 1.0,
    position: [-5, 4, -6],
    orb: [0.23, 0.42],
  },
  afternoon: {
    top: '#7cbdce',
    bottom: '#e6eed5',
    ridge: '#84a99d',
    near: '#416554',
    sun: '#fff0cf',
    hemi: '#eef5f0',
    ground: '#a3886a',
    power: 4.2,
    ambient: 2.4,
    fill: 1.3,
    position: [-1, 8, -5],
    orb: [0.75, 0.21],
  },
  sunset: {
    top: '#7f829f',
    bottom: '#f4b27e',
    ridge: '#9e8090',
    near: '#504d63',
    sun: '#ffad70',
    hemi: '#ead0c1',
    ground: '#8e6666',
    power: 2.6,
    ambient: 1.4,
    fill: 0.8,
    position: [6, 2.8, -5],
    orb: [0.83, 0.61],
  },
  night: {
    top: '#101e38',
    bottom: '#49637c',
    ridge: '#344c63',
    near: '#203d43',
    sun: '#94b5ee',
    hemi: '#9bb5e0',
    ground: '#535265',
    power: 0.55,
    ambient: 0.58,
    fill: 0.45,
    position: [-3, 6, -5],
    orb: [0.76, 0.23],
  },
} as const;
export function environmentLight(value: Environment) {
  const solar = sunFor(value),
    altitude = T.MathUtils.degToRad(solar.altitude),
    azimuth = T.MathUtils.degToRad(solar.azimuth);
  const cloud =
    value.cloudCover ??
    (value.weather === 'clear' ? 10 : value.weather === 'cloudy' ? 80 : 98);
  const daylight = T.MathUtils.smoothstep(solar.altitude, -8, 18);
  const warmth = 1 - T.MathUtils.smoothstep(solar.altitude, 0, 25);
  const sun = new T.Color('#fff1d9').lerp(new T.Color('#ffb775'), warmth);
  sun.lerp(new T.Color('#cad9e0'), cloud / 140);
  const hemi = new T.Color('#829dbb')
    .lerp(new T.Color('#e5eff0'), daylight)
    .lerp(new T.Color('#edc4a2'), warmth * daylight * 0.22);
  return {
    sun,
    hemi,
    ground: new T.Color('#575b66').lerp(new T.Color('#9f9277'), daylight),
    position: new T.Vector3(
      Math.sin(azimuth) * Math.cos(altitude),
      Math.sin(altitude),
      -Math.cos(azimuth) * Math.cos(altitude),
    ).multiplyScalar(12),
    power:
      4.8 *
      Math.pow(Math.max(0, Math.sin(altitude)), 0.5) *
      (1 - (cloud / 100) * 0.94) *
      (value.weather === 'fog' ? 0.2 : 1),
    ambient: 0.46 + 2.0 * daylight * (1 - (cloud / 100) * 0.25),
    fill: 0.3 + 0.9 * daylight,
  };
}

// All scenery is generated locally. The sky and rain stay inside the glazed aperture.
export function createWindowEnvironment(
  parent: T.Group,
  room: RoomId,
  landscape: HouseLandscape,
) {
  const width = 3.22,
    height = 2.12;
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshBasicMaterial({ map: texture, toneMapped: false });
  const geometry = new T.PlaneGeometry(width, height);
  const sky = new T.Mesh(geometry, material);
  sky.position.z = -0.14;
  parent.add(sky);
  const exteriorMaterial = new T.MeshBasicMaterial({
    map: landscape.register(room, parent),
    transparent: true,
    toneMapped: false,
    depthWrite: false,
  });
  const exterior = new T.Mesh(geometry, exteriorMaterial);
  exterior.position.z = -0.13;
  parent.add(exterior);
  let camera: T.Camera | undefined;
  const viewSeed = { study: 11, living: 37, bedroom: 63, gallery: 89 }[room];
  let state: Environment = { time: 'afternoon', weather: 'clear' };
  let previous = -Infinity;
  let dirty = true;
  const colorKeys = ['top', 'bottom', 'ridge', 'near'] as const;
  const current = colorKeys.map((k) => new T.Color(palettes.afternoon[k]));
  let targets = current.map((c) => c.clone());
  let rainAmount = 0;
  const positions = new Float32Array(150 * 6);
  const rainGeometry = new T.BufferGeometry();
  rainGeometry.setAttribute(
    'position',
    new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
  );
  const rainMaterial = new T.LineBasicMaterial({
    color: '#d4e8ed',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const rain = new T.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  rain.position.z = -0.1;
  parent.add(rain);
  const dropGeometry = new T.SphereGeometry(1, 8, 8);
  const dropMaterial = new T.MeshBasicMaterial({
    color: '#e0f3f3',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const drops = new T.InstancedMesh(dropGeometry, dropMaterial, 55);
  drops.instanceMatrix.setUsage(T.DynamicDrawUsage);
  drops.frustumCulled = false;
  drops.position.z = -0.035;
  parent.add(drops);
  const snowGeometry = new T.BufferGeometry();
  const snowPositions = new Float32Array(180 * 3);
  snowGeometry.setAttribute(
    'position',
    new T.BufferAttribute(snowPositions, 3).setUsage(T.DynamicDrawUsage),
  );
  const flakeCanvas = document.createElement('canvas');
  flakeCanvas.width = flakeCanvas.height = 32;
  const fc = flakeCanvas.getContext('2d')!;
  const fg = fc.createRadialGradient(16, 16, 0, 16, 16, 15);
  fg.addColorStop(0, '#ffffff');
  fg.addColorStop(0.4, '#ffffffe0');
  fg.addColorStop(1, '#ffffff00');
  fc.fillStyle = fg;
  fc.fillRect(0, 0, 32, 32);
  const flakeTexture = new T.CanvasTexture(flakeCanvas);
  const snowMaterial = new T.PointsMaterial({
    color: '#e5eff0',
    size: 0.034,
    map: flakeTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  const snow = new T.Points(snowGeometry, snowMaterial);
  snow.position.z = -0.06;
  snow.frustumCulled = false;
  parent.add(snow);
  // Weather is a visual layer, never a physical target. In dry weather an
  // unused droplet instance still has an identity matrix and must not steal
  // clicks from the computer and other furniture in front of the window.
  for (const effect of [rain, drops, snow]) effect.raycast = () => {};
  let snowAmount = 0;
  const dummy = new T.Object3D();
  const fraction = (v: number) => v - Math.floor(v);
  const seed = (i: number) =>
    fraction(Math.sin(i * 127.1 + 311.7) * 43758.5453);
  const css = (c: T.Color) => `#${c.getHexString()}`;
  function draw(t: number) {
    const w = canvas.width,
      h = canvas.height;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, css(current[0]));
    gradient.addColorStop(1, css(current[1]));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    const night = state.time === 'night';
    parent.updateWorldMatrix(true, false);
    const quaternion = parent.getWorldQuaternion(new T.Quaternion()).invert();
    const eye = camera
      ? parent.worldToLocal(camera.getWorldPosition(new T.Vector3()))
      : new T.Vector3(0, 0, 3);
    if (eye.z < 0.15) eye.set(0, 0, 3);
    function project(az: number, alt: number) {
      const a = (az * Math.PI) / 180,
        e = (alt * Math.PI) / 180;
      const dir = new T.Vector3(
        Math.sin(a) * Math.cos(e),
        Math.sin(e),
        -Math.cos(a) * Math.cos(e),
      ).applyQuaternion(quaternion);
      if (dir.z >= -0.01) return null;
      const distance = (eye.z + 0.14) / -dir.z;
      return [
        ((eye.x + dir.x * distance) / width) * w + w / 2,
        h / 2 - ((eye.y + dir.y * distance) / height) * h,
      ];
    }
    if (state.weather === 'clear') {
      if (night) {
        ctx.fillStyle = '#f3ecd9';
        for (let i = 0; i < 360; i++) {
          const p = project(seed(i) * 360, 10 + seed(i + 99) * 75);
          if (!p) continue;
          ctx.globalAlpha = 0.2 + seed(i + 200) * 0.45;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 0.5 + seed(i + 33), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      const sun = sunFor(state),
        p = project(sun.azimuth, sun.altitude);
      // One geographic sun; it appears only in an aperture that actually faces it.
      if (sun.altitude > -0.8 && p) {
        const [x, y] = p,
          r = 9;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
        glow.addColorStop(0, '#fff4d699');
        glow.addColorStop(1, '#fff4d600');
        ctx.fillStyle = glow;
        ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
        ctx.fillStyle = '#fff2cc';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Broad, softly layered clouds drift slowly above distant ridgelines.
    const cloudCount = state.weather === 'clear' ? 4 : 14;
    for (let i = 0; i < cloudCount; i++) {
      const x =
        fraction(
          seed(i + 300 + viewSeed) +
            t * 0.001 * (1 + (state.windSpeed ?? 6) / 10) * (1 + seed(i)),
        ) *
          1.6 *
          w -
        0.3 * w;
      const y = (0.05 + seed(i + 400) * 0.45) * h;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.19 + seed(i + 700) * 0.1);
      const radius = 130 + seed(i + 600) * 160;
      const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      const shade = night
        ? '146,166,190'
        : state.weather === 'clear'
          ? '255,255,242'
          : '191,203,209';
      cloud.addColorStop(
        0,
        `rgba(${shade},${state.weather === 'clear' ? 0.42 : 0.65})`,
      );
      cloud.addColorStop(1, `rgba(${shade},0)`);
      ctx.fillStyle = cloud;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }
    if (['rain', 'storm', 'fog', 'snow'].includes(state.weather)) {
      const mist = ctx.createLinearGradient(0, h * 0.4, 0, h);
      mist.addColorStop(0, '#bccbd000');
      mist.addColorStop(0.6, night ? '#8396ac26' : '#d4dddd50');
      mist.addColorStop(1, '#bccbd000');
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, w, h);
    }
    texture.needsUpdate = true;
  }
  draw(0);
  return {
    set(value: Environment) {
      state = value;
      targets = colorKeys.map((k) => {
        const color = new T.Color(palettes[value.time][k]);
        if (value.weather !== 'clear')
          color.lerp(
            new T.Color(value.time === 'night' ? '#28364b' : '#9baeb6'),
            value.weather === 'rain' ? 0.65 : 0.42,
          );
        return color;
      });
      previous = -Infinity;
      dirty = true;
    },
    update(t: number, dt: number, reduced: boolean, viewer?: T.Camera) {
      camera = viewer;
      const a = 1 - Math.exp(-dt * 3);
      current.forEach((c, i) => c.lerp(targets[i], a));
      rainAmount = T.MathUtils.lerp(
        rainAmount,
        state.weather === 'rain' || state.weather === 'storm'
          ? Math.max(0.2, Math.min(1, (state.precipitation ?? 0.7) * 0.8))
          : 0,
        a,
      );
      snowAmount = T.MathUtils.lerp(
        snowAmount,
        state.weather === 'snow' ? 1 : 0,
        a,
      );
      snow.visible = snowAmount > 0.005;
      snowMaterial.opacity = snowAmount * 0.9;
      const snowClock = reduced ? 2 : t;
      if (snow.visible) {
        for (let i = 0; i < 180; i++) {
          snowPositions.set(
            [
              (fraction(
                seed(i + viewSeed) +
                  Math.sin(snowClock * 0.5 + i) * 0.018 +
                  snowClock * 0.012,
              ) -
                0.5) *
                width,
              (0.5 -
                fraction(
                  seed(i + 399 + viewSeed) +
                    snowClock * (0.065 + seed(i) * 0.055),
                )) *
                height,
              0,
            ],
            i * 3,
          );
        }
        snowGeometry.attributes.position.needsUpdate = true;
      }
      // Sky texture uploads are capped at 4 Hz; precipitation moves on the render clock.
      const transitioning = current.some(
        (c, i) =>
          Math.abs(c.r - targets[i].r) +
            Math.abs(c.g - targets[i].g) +
            Math.abs(c.b - targets[i].b) >
          0.001,
      );
      if (t - previous >= 0.25 && (!reduced || transitioning || dirty)) {
        draw(reduced ? 0 : t);
        previous = t;
        dirty = false;
      }
      rain.visible = drops.visible = rainAmount > 0.005;
      rainMaterial.opacity = rainAmount * (state.time === 'night' ? 0.3 : 0.48);
      dropMaterial.opacity = rainAmount * 0.3;
      if (!rain.visible) return;
      const clock = reduced ? 2 : t;
      const wind = ((state.windDirection ?? 320) * Math.PI) / 180;
      const windWorld = new T.Vector3(-Math.sin(wind), 0, Math.cos(wind));
      const windLocal = windWorld.applyQuaternion(
        parent.getWorldQuaternion(new T.Quaternion()).invert(),
      );
      const drift = windLocal.x * Math.min(0.65, (state.windSpeed ?? 8) / 35);
      for (let i = 0; i < 150; i++) {
        const speed = 0.6 + seed(i) * 0.55;
        const x =
          (fraction(
            seed(i + 1200 + viewSeed) +
              (clock * speed * height * drift) / width,
          ) -
            0.5) *
          width;
        const y =
          (1 -
            fraction(
              seed(i + 1300 + viewSeed) + clock * (0.6 + seed(i) * 0.55),
            )) *
            height -
          height / 2;
        const length = 0.055 + seed(i + 1400) * 0.12;
        positions.set(
          [
            x,
            y,
            0,
            Math.min(width / 2, Math.max(-width / 2, x - length * drift)),
            Math.min(height / 2, y + length),
            0,
          ],
          i * 6,
        );
      }
      rainGeometry.attributes.position.needsUpdate = true;
      for (let i = 0; i < 55; i++) {
        const moving = i % 3 === 0;
        dummy.position.set(
          (seed(i + 2000 + viewSeed) - 0.5) * (width - 0.06),
          (1 -
            fraction(
              seed(i + 2100 + viewSeed) + (moving ? clock * 0.035 : 0),
            )) *
            (height - 0.06) -
            (height - 0.06) / 2,
          0,
        );
        const size = 0.003 + seed(i + 2200) * 0.006;
        dummy.scale.set(size, size * (moving ? 4 : 1.5), 0.002);
        dummy.updateMatrix();
        drops.setMatrixAt(i, dummy.matrix);
      }
      drops.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      parent.remove(sky, exterior, rain, drops, snow);
      exteriorMaterial.dispose();
      snowGeometry.dispose();
      snowMaterial.dispose();
      flakeTexture.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      rainGeometry.dispose();
      rainMaterial.dispose();
      dropGeometry.dispose();
      dropMaterial.dispose();
    },
  };
}
