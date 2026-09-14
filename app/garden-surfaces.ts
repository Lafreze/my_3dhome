import * as T from 'three';
import { interiorMaterial } from './house-finishes';

/** Small shared maps, with separate colour, micro relief and surface roughness. */
export function botanicalSurface(
  kind: 'petal' | 'leaf' | 'soil',
  textures: T.Texture[],
) {
  const size = 256;
  const canvases = Array.from({ length: 3 }, () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  });
  const contexts = canvases.map((c) => c.getContext('2d')!);
  const pixels = contexts.map((c) => c.createImageData(size, size));
  let seed = 2719;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = seed / 4294967296 - 0.5,
        u = x / (size - 1),
        v = y / (size - 1);
      const vein = Math.pow(
        Math.max(0, Math.cos((u * 19 + Math.sin(v * 5) * 0.35) * Math.PI * 2)),
        12,
      );
      const midrib = Math.exp(-Math.pow((u - 0.5) * 95, 2));
      const branch = Math.pow(
        Math.max(0, Math.cos((v * 12 + Math.abs(u - 0.5) * 4) * Math.PI * 2)),
        22,
      );
      const tone =
        kind === 'petal'
          ? 215 + 30 * v - vein * 5 + grain * 3
          : kind === 'leaf'
            ? 160 +
              42 * Math.sin(u * Math.PI) +
              midrib * 18 +
              branch * 9 +
              grain * 5
            : 184 + grain * 48 + Math.sin(x * 1.7 + y * 2.1) * 14;
      const height =
        kind === 'petal'
          ? 128 + vein * 16 + grain * 4
          : kind === 'leaf'
            ? 118 + midrib * 40 + branch * 14 + grain * 4
            : 128 + grain * 110;
      const rough =
        kind === 'petal'
          ? 210 + grain * 12
          : kind === 'leaf'
            ? 184 + grain * 15
            : 245 + grain * 10;
      for (let i = 0; i < 3; i++) {
        const value = [tone, height, rough][i],
          at = (y * size + x) * 4;
        pixels[i].data[at] =
          pixels[i].data[at + 1] =
          pixels[i].data[at + 2] =
            value;
        pixels[i].data[at + 3] = 255;
      }
    }
  const [map, bumpMap, roughnessMap] = canvases.map((c, i) => {
    contexts[i].putImageData(pixels[i], 0, 0);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT =
      kind === 'soil' ? T.RepeatWrapping : T.ClampToEdgeWrapping;
    t.anisotropy = 8;
    textures.push(t);
    return t;
  });
  map.colorSpace = T.SRGBColorSpace;
  return { map, bumpMap, roughnessMap };
}

/** A thin cupped lamina, with a slightly wavy edge instead of a flattened sphere. */
export function petalGeometry() {
  const g = new T.PlaneGeometry(2, 2, 8, 12);
  const p = g.getAttribute('position'),
    uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i) * 2 - 1,
      v = uv.getY(i),
      t = v * 2 - 1;
    const span = Math.pow(Math.max(0.0001, Math.sin(v * Math.PI)), 0.65);
    p.setXYZ(
      i,
      u * span,
      0.18 * u * u +
        0.15 * t * t +
        Math.sin(v * 19 + u * 3) * 0.035 * Math.abs(u),
      t,
    );
  }
  // The original plane winds downward after mapping Y to Z.
  const index = g.getIndex()!;
  for (let i = 0; i < index.count; i += 3) {
    const b = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, b);
  }
  g.computeVertexNormals();
  return g;
}

/** Open concave blade, resting on its underside on the workbench. */
export function trowelGeometry() {
  const g = new T.PlaneGeometry(1, 1, 10, 14),
    p = g.getAttribute('position'),
    uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i) * 2 - 1,
      v = uv.getY(i);
    const w = 0.065 * Math.pow(Math.max(0.0001, Math.sin(v * Math.PI)), 0.5);
    p.setXYZ(i, u * w, 0.004 + u * u * 0.024, -0.115 - v * 0.26);
  }
  g.computeVertexNormals();
  return g;
}

export function gardenCraftFinishes(
  materials: T.Material[],
  textures: T.Texture[],
) {
  const finish = (
    kind: Parameters<typeof interiorMaterial>[0],
    color: string,
  ) => interiorMaterial(kind, color, materials, textures);
  const steel = finish('brushed-metal', '#b9bfc0');
  steel.roughness = 0.43;
  steel.side = T.DoubleSide;
  const enamel = finish('glaze', '#d6dfd8');
  enamel.roughness = 0.38;
  enamel.clearcoat = 0.27;
  const frame = finish('brushed-metal', '#a99f8d');
  frame.metalness = 0.65;
  frame.roughness = 0.5;
  const twine = finish('linen', '#c7b495');
  const glove = finish('suede', '#c5b69e');
  const stone = finish('travertine', '#e3ded2');
  stone.roughness = 0.78;
  return { steel, enamel, frame, twine, glove, stone };
}
