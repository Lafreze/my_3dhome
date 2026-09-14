import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Surface =
  | 'smoked-oak'
  | 'walnut'
  | 'ash'
  | 'travertine'
  | 'boucle'
  | 'cotton'
  | 'linen'
  | 'wool'
  | 'velvet'
  | 'leather'
  | 'suede'
  | 'lime'
  | 'clay'
  | 'glaze'
  | 'mineral'
  | 'brushed-metal';

type SurfaceMaps = {
  map: T.CanvasTexture;
  bumpMap: T.CanvasTexture;
  normalMap: null;
  roughnessMap: T.CanvasTexture;
  bumpScale: number;
};
// A room scene owns its maps. Sharing by finish avoids repeated canvases and GPU uploads.
const surfaceCache = new WeakMap<T.Texture[], Map<Surface, SurfaceMaps>>();

/** Tileable, neutral albedo with independent height and roughness data. */
export function makeSurface(kind: Surface, textures: T.Texture[]): SurfaceMaps {
  let cache = surfaceCache.get(textures);
  if (!cache) surfaceCache.set(textures, (cache = new Map()));
  const cached = cache.get(kind);
  if (cached) return cached;
  const size = 512;
  let seed = kind
    .split('')
    .reduce((a, v) => (a * 31 + v.charCodeAt(0)) >>> 0, 17);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const grids = [4, 8, 16, 32, 64].map((n) => ({
    n,
    values: Float32Array.from({ length: n * n }, () => random()),
  }));
  const noise = (u: number, v: number, octave = 0) => {
    const { n, values } = grids[octave];
    const x = (((u % 1) + 1) % 1) * n,
      y = (((v % 1) + 1) % 1) * n;
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const at = (dx: number, dy: number) =>
      values[((iy + dy) % n) * n + ((ix + dx) % n)];
    return (
      T.MathUtils.lerp(
        T.MathUtils.lerp(at(0, 0), at(1, 0), sx),
        T.MathUtils.lerp(at(0, 1), at(1, 1), sx),
        sy,
      ) - 0.5
    );
  };
  const canvases = Array.from({ length: 3 }, () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return canvas;
  });
  const contexts = canvases.map((c) => c.getContext('2d')!);
  const pixels = contexts.map((c) => c.createImageData(size, size));
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const broad = noise(u, v),
        medium = noise(u, v, 2),
        fine = random() - 0.5;
      let tone = broad * 5 + fine * 2,
        height = medium * 9 + fine * 4,
        polish = medium * 10;
      if (kind === 'smoked-oak' || kind === 'walnut' || kind === 'ash') {
        // Long fibres and gently wandering growth rings; no high-contrast zebra stripes.
        const warp = noise(u, v, 1) * 0.09 + Math.sin(u * tau) * 0.018;
        const grain = Math.sin((v * 52 + warp * 24) * tau);
        const ring = Math.sin((v * 7 + noise(u, v) * 0.9) * tau);
        const pores = Math.pow(Math.max(0, grain), 12);
        const longitudinal = noise(u, v * 8, 0);
        tone =
          broad * 10 + ring * 3.5 + longitudinal * 7 - pores * 6 + fine * 1.5;
        height = longitudinal * 18 - pores * 12 + fine * 3;
        polish = longitudinal * 15 - pores * 11;
      } else if (
        ['linen', 'cotton', 'wool', 'boucle', 'suede', 'velvet'].includes(kind)
      ) {
        const count =
          kind === 'cotton'
            ? 112
            : kind === 'linen'
              ? 80
              : kind === 'boucle'
                ? 62
                : 96;
        const warp = Math.sin((u * count + noise(u, v, 1) * 0.32) * tau);
        const weft = Math.sin((v * count + noise(v, u, 1) * 0.38) * tau);
        const loop = warp * weft;
        const yarn = kind === 'boucle' ? loop * 17 : (warp + weft) * 5;
        tone = broad * 7 + medium * 4 + yarn * 0.28 + fine * 3;
        height = yarn + medium * 12 + fine * 10;
        polish = yarn * 0.4 + medium * 10;
        if (kind === 'velvet' || kind === 'suede') {
          tone = broad * 9 + medium * 2 + fine * 1.5;
          height = medium * 5 + fine * 6;
          polish = broad * 16 + fine * 4;
        }
      } else if (kind === 'leather') {
        const grain = noise(u, v, 4),
          pores = Math.max(0, 0.13 - Math.abs(grain)) * 120;
        tone = broad * 12 + medium * 3 - pores * 0.3 + fine * 1.2;
        height = grain * 29 - pores + fine * 3;
        polish = broad * 19 + grain * 12;
      } else if (kind === 'travertine') {
        const vein = noise(u, v * 2, 0) * 17 + noise(u, v * 2, 2) * 5;
        const pore = fine > 0.484 && medium > -0.08 ? (fine - 0.484) * 1900 : 0;
        tone = vein - pore * 0.7 + broad * 6;
        height = medium * 8 - pore;
        polish = vein * 0.8 - pore * 0.5;
      } else if (kind === 'brushed-metal') {
        const brushed = noise(u, v * 16, 0);
        tone = brushed * 8 + fine * 1.5;
        height = brushed * 16 + fine * 3;
        polish = brushed * 26 + broad * 7;
      } else if (kind === 'glaze' || kind === 'clay') {
        const fleck = fine > 0.491 ? 15 : 0;
        tone = broad * 5 - fleck + fine;
        height = medium * 4 + fine * 3;
        polish = broad * 8 + medium * 6;
      } else {
        // Broad trowel movement lives in albedo; plaster stays smooth under grazing light.
        tone = broad * 10 + medium * 2 + fine * 1.5;
        height = broad * 8 + medium * 3 + fine * 3;
        polish = broad * 5 + medium * 5;
      }
      const index = (y * size + x) * 4;
      const values = [242 + tone, 128 + height, 232 + polish];
      for (let channel = 0; channel < 3; channel++) {
        for (let c = 0; c < 3; c++)
          pixels[channel].data[index + c] = values[channel];
        pixels[channel].data[index + 3] = 255;
      }
    }
  contexts.forEach((c, i) => c.putImageData(pixels[i], 0, 0));
  const [map, bumpMap, roughnessMap] = canvases.map((canvas, i) => {
    const t = new T.CanvasTexture(canvas);
    t.name = `interior/${kind}/${['albedo', 'height', 'roughness'][i]}`;
    t.colorSpace = i === 0 ? T.SRGBColorSpace : T.NoColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    textures.push(t);
    return t;
  });
  const result = {
    map,
    bumpMap,
    roughnessMap,
    normalMap: null,
    bumpScale:
      kind === 'boucle' || kind === 'wool'
        ? 0.009
        : kind === 'linen'
          ? 0.006
          : kind === 'leather'
            ? 0.004
            : kind === 'brushed-metal' || kind === 'glaze'
              ? 0.0007
              : kind === 'lime'
                ? 0.002
                : 0.0035,
  };
  cache.set(kind, result);
  return result;
}

/** Distinct light response for oiled timber, woven fibres, aniline leather and ceramic glaze. */
export function interiorMaterial(
  kind: Surface,
  color: string,
  materials: T.Material[],
  textures: T.Texture[],
) {
  const cloth = [
    'boucle',
    'cotton',
    'linen',
    'wool',
    'velvet',
    'suede',
  ].includes(kind);
  const timber = ['smoked-oak', 'walnut', 'ash'].includes(kind);
  const material = new T.MeshPhysicalMaterial({
    color,
    ...makeSurface(kind, textures),
    roughness: cloth
      ? 0.94
      : timber
        ? 0.53
        : kind === 'leather'
          ? 0.57
          : kind === 'glaze'
            ? 0.25
            : kind === 'brushed-metal'
              ? 0.36
              : kind === 'travertine'
                ? 0.67
                : 0.95,
    metalness: kind === 'brushed-metal' ? 0.83 : 0,
    sheen: cloth ? (kind === 'velvet' ? 0.7 : 0.28) : 0,
    sheenRoughness: kind === 'velvet' ? 0.65 : 0.9,
    sheenColor: new T.Color(color).lerp(new T.Color('#f4ece1'), 0.32),
    clearcoat:
      kind === 'glaze' ? 0.42 : timber ? 0.12 : kind === 'leather' ? 0.1 : 0,
    clearcoatRoughness: kind === 'glaze' ? 0.24 : 0.48,
    envMapIntensity: kind === 'brushed-metal' ? 1.1 : 0.75,
  });
  material.name = `interior/${kind}`;
  material.userData.surface = kind;
  materials.push(material);
  return material;
}

/** Grain follows each timber member, with the same density on rails, legs and panels. */
export function fitTimberGrain(
  geometry: T.BufferGeometry,
  material: T.Material,
) {
  if (
    !(geometry instanceof T.BoxGeometry) ||
    geometry.userData.grainFitted ||
    !['smoked-oak', 'walnut', 'ash'].includes(material.userData.surface)
  )
    return;
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new T.Vector3()).toArray();
  const along = size.indexOf(Math.max(...size));
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const n = [
      Math.abs(normal.getX(i)),
      Math.abs(normal.getY(i)),
      Math.abs(normal.getZ(i)),
    ];
    const face = n.indexOf(Math.max(...n));
    const axes = [0, 1, 2].filter((axis) => axis !== face);
    const u = face === along ? axes[0] : along;
    const v = axes.find((axis) => axis !== u)!;
    uv.setXY(
      i,
      position.getComponent(i, u) / 1.8 + 0.5,
      position.getComponent(i, v) / 0.48 + 0.5,
    );
  }
  uv.needsUpdate = true;
  geometry.userData.grainFitted = true;
}
export function houseFinishes(
  materials: T.Material[],
  textures: T.Texture[],
  base: {
    oak: T.MeshStandardMaterial;
    paleWood: T.MeshStandardMaterial;
    darkWood: T.MeshStandardMaterial;
    cream: T.MeshStandardMaterial;
  },
) {
  const cloth = (color: string, kind: Surface) =>
    interiorMaterial(kind, color, materials, textures);
  const joinery = {
    wood: base.oak,
    pale: base.paleWood,
    dark: base.darkWood,
    wall: base.cream,
  };
  return {
    living: { ...joinery, cloth: cloth('#eee7db', 'boucle') },
    bedroom: { ...joinery, cloth: cloth('#e9e3d8', 'cotton') },
    gallery: { ...joinery, cloth: cloth('#c8baa7', 'suede') },
  };
}

/** One oak specification for every room, with quiet board-to-board variation. */
export function oakFloorMaterials(
  materials: T.Material[],
  textures: T.Texture[],
) {
  const surface = makeSurface('smoked-oak', textures);
  return ['#bba38a', '#c4ae96', '#bfa78e', '#b7a08a', '#c0aa93'].map(
    (color) => {
      const material = new T.MeshStandardMaterial({
        color,
        ...surface,
        roughness: 0.59,
      });
      material.name = 'interior/warm-oak-floor';
      material.userData.live = true;
      materials.push(material);
      return material;
    },
  );
}

export function addOakFloor(
  parent: T.Group,
  width: number,
  depth: number,
  materials: T.MeshStandardMaterial[],
) {
  const bins = materials.map(() => [] as T.BufferGeometry[]);
  const rows = Math.round(depth / 0.28),
    pitch = depth / rows;
  for (let row = 0; row < rows; row++) {
    let x = -width / 2,
      col = 0;
    while (x < width / 2 - 0.001) {
      const length = Math.min(
        col ? 1.98 : [1.98, 1.13, 0.68, 1.52][row % 4],
        width / 2 - x,
      );
      const geometry = new T.BoxGeometry(length - 0.006, 0.035, pitch - 0.005);
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++)
        uv.setXY(
          i,
          (uv.getX(i) * length) / 1.98 + row * 0.173,
          uv.getY(i) + col * 0.237 + row * 0.137,
        );
      geometry.translate(
        x + length / 2,
        0.06,
        -depth / 2 + (row + 0.5) * pitch,
      );
      bins[(row + col * 2) % materials.length].push(geometry);
      x += length;
      col++;
    }
  }
  bins.forEach((geometries, i) => {
    const geometry = mergeGeometries(geometries)!;
    geometries.forEach((g) => g.dispose());
    const floor = new T.Mesh(geometry, materials[i]);
    floor.name = 'warm-oak-boards';
    floor.receiveShadow = true;
    parent.add(floor);
  });
}
