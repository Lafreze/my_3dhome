import * as T from 'three';

import type { Environment } from './environment-data';

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
  const p = palettes[value.time],
    wet = value.weather !== 'clear',
    night = value.time === 'night';
  return {
    sun: new T.Color(wet ? (night ? '#839bc0' : '#cad9e0') : p.sun),
    hemi: new T.Color(wet ? (night ? '#8299bb' : '#c4d3de') : p.hemi),
    ground: new T.Color(p.ground),
    position: new T.Vector3(...p.position),
    power: p.power * (value.weather === 'rain' ? 0.12 : wet ? 0.28 : 1),
    ambient: p.ambient * (value.weather === 'rain' ? 0.66 : wet ? 0.83 : 1),
    fill: p.fill * (wet ? 0.8 : 1),
  };
}

// All scenery is generated locally. The sky and rain stay inside the glazed aperture.
export function createWindowEnvironment(parent: T.Group) {
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
    const p = palettes[state.time],
      night = state.time === 'night';
    if (state.weather === 'clear') {
      if (night) {
        ctx.fillStyle = '#f3ecd9';
        for (let i = 0; i < 65; i++) {
          ctx.globalAlpha = 0.28 + seed(i + 200) * 0.55;
          ctx.beginPath();
          ctx.arc(
            seed(i) * w,
            seed(i + 99) * h * 0.65,
            0.5 + seed(i + 33),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      const x = p.orb[0] * w,
        y = p.orb[1] * h,
        r = night ? 22 : 29;
      const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 4);
      glow.addColorStop(0, night ? '#e4edfd40' : '#fff4d680');
      glow.addColorStop(1, '#fff4d600');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
      ctx.fillStyle = night ? '#ebeddf' : '#fff0c5';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (night) {
        ctx.fillStyle = '#b4c4ca40';
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.arc(
            x + (seed(i + 500) - 0.5) * 28,
            y + (seed(i + 540) - 0.5) * 28,
            2 + seed(i + 550) * 4,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    }
    // Broad, softly layered clouds drift slowly above distant ridgelines.
    const cloudCount = state.weather === 'clear' ? 4 : 14;
    for (let i = 0; i < cloudCount; i++) {
      const x =
        fraction(seed(i + 300) + t * 0.003 * (1 + seed(i))) * 1.6 * w - 0.3 * w;
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
    for (let layer = 0; layer < 4; layer++) {
      const base = 0.62 + layer * 0.105;
      const color = current[2].clone().lerp(current[3], layer / 3);
      const mountain = ctx.createLinearGradient(0, h * 0.45, 0, h);
      mountain.addColorStop(0, css(color));
      mountain.addColorStop(1, css(color.clone().lerp(current[1], 0.12)));
      ctx.fillStyle = mountain;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 4; x += 4) {
        const y =
          base +
          Math.sin(x * 0.008 + layer * 2) * 0.075 +
          Math.sin(x * 0.017 + layer * 4) * 0.028 +
          Math.sin(x * 0.037) * 0.006;
        ctx.lineTo(x, y * h);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      if (layer >= 2) {
        for (let i = 0; i < 70; i++) {
          const x = (i * w) / 69,
            y =
              (base +
                Math.sin(x * 0.008 + layer * 2) * 0.075 +
                Math.sin(x * 0.017 + layer * 4) * 0.028) *
              h;
          const size =
            (5 + seed(i + layer * 77) * 16) * (layer === 3 ? 1.5 : 1);
          ctx.beginPath();
          ctx.moveTo(x, y - size);
          ctx.lineTo(x - size * 0.26, y + 3);
          ctx.lineTo(x + size * 0.26, y + 3);
          ctx.fill();
        }
      }
    }
    if (state.weather === 'rain') {
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
    update(t: number, dt: number, reduced: boolean) {
      const a = 1 - Math.exp(-dt * 3);
      current.forEach((c, i) => c.lerp(targets[i], a));
      rainAmount = T.MathUtils.lerp(
        rainAmount,
        state.weather === 'rain' ? 1 : 0,
        a,
      );
      // Cloud texture uploads are capped at 10 Hz; rain moves on the render clock.
      const transitioning = current.some(
        (c, i) =>
          Math.abs(c.r - targets[i].r) +
            Math.abs(c.g - targets[i].g) +
            Math.abs(c.b - targets[i].b) >
          0.001,
      );
      if (t - previous >= 0.1 && (!reduced || transitioning || dirty)) {
        draw(reduced ? 0 : t);
        previous = t;
        dirty = false;
      }
      rain.visible = drops.visible = rainAmount > 0.005;
      rainMaterial.opacity = rainAmount * (state.time === 'night' ? 0.3 : 0.48);
      dropMaterial.opacity = rainAmount * 0.3;
      if (!rain.visible) return;
      const clock = reduced ? 2 : t;
      for (let i = 0; i < 150; i++) {
        const speed = 0.6 + seed(i) * 0.55;
        const x =
          (fraction(seed(i + 1200) - (clock * speed * height * 0.22) / width) -
            0.5) *
          width;
        const y =
          (1 - fraction(seed(i + 1300) + clock * (0.6 + seed(i) * 0.55))) *
            height -
          height / 2;
        const length = 0.055 + seed(i + 1400) * 0.12;
        positions.set(
          [
            x,
            y,
            0,
            Math.min(width / 2, x + length * 0.22),
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
          (seed(i + 2000) - 0.5) * (width - 0.06),
          (1 - fraction(seed(i + 2100) + (moving ? clock * 0.035 : 0))) *
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
      parent.remove(sky, rain, drops);
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
