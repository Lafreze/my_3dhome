import * as T from 'three';
import type { Character } from './visitor-appearance';
import type { VisitorPart } from './visitor-model';
import { prepareMotionGeometry } from './visitor-motion';

// Traced along each original sculpt's upper and lower eyelid, including asymmetry.
// These landmarks are authored in an orthographic front portrait (1500px / 1.96m).
// They are converted to model metres once; they never depend on viewport dimensions.
const eyes: Record<Character, number[][][]> = {
  bear: [
    [
      [170, 453, 453],
      [176, 450, 477],
      [185, 448, 489],
      [198, 449, 495],
      [210, 454, 492],
      [220, 464, 486],
      [224, 474, 474],
    ],
    [
      [291, 473, 473],
      [298, 460, 486],
      [308, 451, 493],
      [320, 449, 494],
      [332, 450, 490],
      [341, 452, 480],
      [348, 451, 451],
    ],
  ],
  cat: [
    [
      [609, 385, 385],
      [621, 388, 425],
      [638, 390, 444],
      [655, 397, 451],
      [674, 407, 451],
      [693, 420, 447],
      [712, 438, 438],
    ],
    [
      [787, 438, 438],
      [801, 422, 450],
      [821, 406, 452],
      [841, 397, 450],
      [860, 393, 441],
      [875, 385, 416],
      [887, 382, 382],
    ],
  ],
  fox: [
    [
      [1148, 515, 515],
      [1159, 516, 541],
      [1172, 520, 553],
      [1185, 523, 557],
      [1198, 530, 555],
      [1209, 538, 552],
      [1217, 547, 547],
    ],
    [
      [1264, 546, 546],
      [1273, 536, 552],
      [1286, 529, 555],
      [1299, 521, 553],
      [1313, 518, 545],
      [1326, 513, 531],
      [1335, 510, 510],
    ],
  ],
};

/** Eyelids follow the existing face relief and take their skin color from its texture. */
export function createVisitorEyelids(
  parts: VisitorPart[],
  character: Character,
): VisitorPart {
  const allLandmarks = eyes[character].flat();
  const minY =
    1.11 - (Math.max(...allLandmarks.map((p) => p[2])) * 1.96) / 1500 - 0.026;
  const maxY =
    1.11 - (Math.min(...allLandmarks.map((p) => p[1])) * 1.96) / 1500 + 0.026;
  const objects = parts.map((part) => {
    // Raycast only the small facial patch, not the whole 100k-triangle figurine.
    const geometry = new T.BufferGeometry();
    for (const [name, attribute] of Object.entries(part.geometry.attributes))
      geometry.setAttribute(name, attribute);
    const source = part.geometry.index!,
      p = part.geometry.getAttribute('position');
    const faceIndices: number[] = [];
    for (let i = 0; i < source.count; i += 3) {
      const a = source.getX(i),
        b = source.getX(i + 1),
        c = source.getX(i + 2);
      if (
        Math.max(p.getY(a), p.getY(b), p.getY(c)) >= minY &&
        Math.min(p.getY(a), p.getY(b), p.getY(c)) <= maxY &&
        Math.max(p.getZ(a), p.getZ(b), p.getZ(c)) > 0.06
      )
        faceIndices.push(a, b, c);
    }
    geometry.setIndex(faceIndices);
    const mesh = new T.Mesh(geometry, part.material);
    mesh.updateMatrixWorld(true);
    return mesh;
  });
  const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, 0, -1));
  const texturePixels = new Map<
    T.Texture,
    { pixels: Uint8ClampedArray; width: number; height: number }
  >();
  const fallback = new T.Color(character === 'fox' ? '#dcc0ac' : '#d7b89a');
  function surface(x: number, y: number) {
    ray.ray.origin.set(x, y, 2);
    let hit = ray.intersectObjects(objects, false)[0];
    // The imported relief has a few sub-millimetre holes at painted material seams.
    for (const radius of [0.0006, 0.0015, 0.003, 0.006]) {
      if (hit) break;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        ray.ray.origin.set(x + dx * radius, y + dy * radius, 2);
        hit = ray.intersectObjects(objects, false)[0];
        if (hit) break;
      }
    }
    if (!hit)
      throw new Error(`Missing ${character} eyelid surface at ${x}, ${y}`);
    return hit;
  }
  function albedo(hit: T.Intersection) {
    const mesh = hit.object as T.Mesh;
    const material = (
      Array.isArray(mesh.material)
        ? mesh.material[hit.face?.materialIndex || 0]
        : mesh.material
    ) as T.MeshStandardMaterial;
    if (!material.map || !hit.uv) return fallback.clone();
    const map = material.map;
    let data = texturePixels.get(map);
    if (!data) {
      const canvas = document.createElement('canvas');
      const image = map.image as ImageBitmap;
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      data = {
        pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height,
      };
      texturePixels.set(map, data);
    }
    const uv = hit.uv.clone();
    map.transformUv(uv);
    const x = Math.max(
      0,
      Math.min(data.width - 1, Math.floor(uv.x * data.width)),
    );
    const y = Math.max(
      0,
      Math.min(data.height - 1, Math.floor(uv.y * data.height)),
    );
    const i = (y * data.width + x) * 4;
    return new T.Color().setRGB(
      data.pixels[i] / 255,
      data.pixels[i + 1] / 255,
      data.pixels[i + 2] / 255,
      T.SRGBColorSpace,
    );
  }
  const position: number[] = [],
    open: number[] = [],
    colors: number[] = [],
    normal: number[] = [],
    indices: number[] = [];
  const offset = { bear: -0.64, cat: 0, fox: 0.64 }[character];
  const scale = 1.96 / 1500;
  const rows = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 0.96, 0.99, 1];
  const lash = new T.Color(character === 'bear' ? '#352116' : '#30252a');
  for (const landmarks of eyes[character]) {
    const points = landmarks.map(([x, upper, lower]) => [
      (x - 750) * scale - offset,
      1.11 - upper * scale,
      1.11 - lower * scale,
    ]);
    const cx = (points[0][0] + points.at(-1)![0]) / 2;
    const cy =
      points.reduce((s, p) => s + (p[1] + p[2]) / 2, 0) / points.length;
    // Fit a smooth eyelid dome instead of copying the original iris' sculpted ridges.
    const system = Array.from(
      { length: 6 },
      () => Array(7).fill(0) as number[],
    );
    for (const [x, top, bottom] of points.slice(1, -1))
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        const y = T.MathUtils.lerp(top, bottom, f),
          px = (x - cx) * 20,
          py = (y - cy) * 20;
        const terms = [1, px, py, px * px, px * py, py * py],
          z = surface(x, y).point.z;
        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 6; j++) system[i][j] += terms[i] * terms[j];
          system[i][6] += terms[i] * z;
        }
      }
    for (let i = 0; i < 6; i++) {
      let pivot = i;
      for (let j = i + 1; j < 6; j++)
        if (Math.abs(system[j][i]) > Math.abs(system[pivot][i])) pivot = j;
      [system[i], system[pivot]] = [system[pivot], system[i]];
      const factor = system[i][i];
      for (let j = i; j < 7; j++) system[i][j] /= factor;
      for (let k = 0; k < 6; k++)
        if (k !== i) {
          const factor = system[k][i];
          for (let j = i; j < 7; j++) system[k][j] -= factor * system[i][j];
        }
    }
    const q = system.map((row) => row[6]);
    const dome = (x: number, y: number) => {
      const px = (x - cx) * 20,
        py = (y - cy) * 20;
      return (
        q[0] +
        q[1] * px +
        q[2] * py +
        q[3] * px * px +
        q[4] * px * py +
        q[5] * py * py
      );
    };
    // Tuck the raised iris relief under the moving lid without stretching its UVs.
    for (const part of parts) {
      const p = part.geometry.getAttribute('position'),
        delta = part.geometry.getAttribute('visitorBlinkDelta');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        if (
          x < points[0][0] - 0.009 ||
          x > points.at(-1)![0] + 0.009 ||
          z < 0.1
        )
          continue;
        const segment =
          x >= points.at(-1)![0]
            ? points.length - 2
            : Math.max(
                0,
                points.findIndex(
                  (v, j) => j < points.length - 1 && x <= points[j + 1][0],
                ),
              );
        const a = points[segment],
          b = points[segment + 1],
          f = T.MathUtils.clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
        const top = T.MathUtils.lerp(a[1], b[1], f),
          bottom = T.MathUtils.lerp(a[2], b[2], f);
        if (y < bottom - 0.012 || y > top + 0.018) continue;
        const xWeight =
          T.MathUtils.smoothstep(
            x,
            points[0][0] - 0.009,
            points[0][0] + 0.002,
          ) *
          (1 -
            T.MathUtils.smoothstep(
              x,
              points.at(-1)![0] - 0.002,
              points.at(-1)![0] + 0.009,
            ));
        const yWeight =
          T.MathUtils.smoothstep(y, bottom - 0.012, bottom - 0.003) *
          (1 - T.MathUtils.smoothstep(y, top + 0.006, top + 0.018));
        const surfaceZ = surface(x, y).point.z;
        if (z < surfaceZ - 0.022) continue; // Do not pull the back of the head or nearby hair.
        delta.setXYZ(i, 0, 0, -0.016 * xWeight * yWeight);
      }
    }
    // Use nearby bare skin, rejecting iris, liner, hair and red facial markings.
    const skinSamples: T.Color[] = [];
    for (const [x, top, bottom] of points.slice(1, -1)) {
      for (const y of [top + 0.011, bottom - 0.012, bottom - 0.019]) {
        const sample = albedo(surface(x, y));
        const srgb = sample.clone().convertLinearToSRGB();
        if (
          srgb.r > 0.42 &&
          srgb.g > 0.28 &&
          srgb.r > srgb.g * 1.04 &&
          srgb.r < srgb.g * 1.55 &&
          srgb.g > srgb.b * 1.03
        )
          skinSamples.push(sample);
      }
    }
    const skin = skinSamples.length
      ? skinSamples
          .reduce((sum, c) => sum.add(c), new T.Color(0, 0, 0))
          .multiplyScalar(1 / skinSamples.length)
      : fallback;
    for (const upper of [true, false]) {
      const base = position.length / 3;
      const columns = 49;
      for (let col = 0; col < columns; col++) {
        const along = (col / (columns - 1)) * (points.length - 1),
          segment = Math.min(points.length - 2, Math.floor(along)),
          f = along - segment;
        const a = points[segment],
          b = points[segment + 1];
        const x = cx + (T.MathUtils.lerp(a[0], b[0], f) - cx) * 1.08,
          top =
            T.MathUtils.lerp(a[1], b[1], f) +
            Math.sin((col / (columns - 1)) * Math.PI) * 0.013,
          bottom =
            T.MathUtils.lerp(a[2], b[2], f) -
            Math.sin((col / (columns - 1)) * Math.PI) * 0.001;
        const edgeY = upper ? top : bottom;
        const closeY = T.MathUtils.lerp(top, bottom, 0.81);
        const origin = surface(x, edgeY).point;
        for (const row of rows) {
          const y = T.MathUtils.lerp(edgeY, closeY, row);
          const depth = dome(x, y);
          position.push(
            x,
            y,
            depth + 0.006 + (upper && row > 0.96 ? 0.0005 : 0),
          );
          open.push(x, edgeY, origin.z + 0.0003);
          const n = new T.Vector3(
            -(dome(x + 0.0005, y) - dome(x - 0.0005, y)) / 0.001,
            -(dome(x, y + 0.0005) - dome(x, y - 0.0005)) / 0.001,
            1,
          ).normalize();
          normal.push(n.x, n.y, n.z);
          const color = skin.clone();
          if (upper && row >= 0.96) color.copy(lash);
          else {
            color.multiplyScalar(upper ? 1 - 0.06 * row : 1);
          }
          colors.push(color.r, color.g, color.b);
        }
      }
      for (let col = 0; col < columns - 1; col++)
        for (let row = 0; row < rows.length - 1; row++) {
          const a = base + col * rows.length + row,
            b = a + rows.length;
          if (upper) indices.push(a, a + 1, b, b, a + 1, b + 1);
          else indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute(
    'visitorLidOpen',
    new T.Float32BufferAttribute(open, 3),
  );
  geometry.setIndex(indices);
  prepareMotionGeometry(geometry, character);
  // The face is rigid in the Blender Rest shape: rotate onto the pillow with it.
  const lift = character === 'cat' ? 0.335 : 0.295;
  for (const [source, target] of [
    ['position', 'visitorRestPosition'],
    ['visitorLidOpen', 'visitorRestLidOpen'],
    ['normal', 'visitorRestNormal'],
  ] as const) {
    const a = geometry.getAttribute(source),
      values = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) {
      values[i * 3] = a.getX(i);
      values[i * 3 + 1] = a.getZ(i) + (source === 'normal' ? 0 : lift);
      values[i * 3 + 2] = -a.getY(i);
    }
    geometry.setAttribute(target, new T.BufferAttribute(values, 3));
  }
  geometry.computeBoundingSphere();
  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.67,
    side: T.DoubleSide,
  });
  material.name = `${character}_Eyelids`;
  objects.forEach((object) => object.geometry.dispose());
  return {
    geometry,
    material,
    matrix: new T.Matrix4(),
    name: `${character} eyelids`,
    character,
    eyelid: true,
  };
}
