import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared, deterministic surfaces keep the entire house in one material family.
type Surface =
  | 'smoked-oak'
  | 'ash'
  | 'travertine'
  | 'boucle'
  | 'cotton'
  | 'suede'
  | 'lime'
  | 'clay'
  | 'mineral'
  | 'brushed-metal';
export function makeSurface(kind: Surface, textures: T.Texture[]) {
  const size = 512,
    color = document.createElement('canvas'),
    relief = document.createElement('canvas'),
    roughness = document.createElement('canvas');
  color.width =
    color.height =
    relief.width =
    relief.height =
    roughness.width =
    roughness.height =
      size;
  const c = color.getContext('2d')!,
    h = relief.getContext('2d')!,
    r = roughness.getContext('2d')!;
  const pixels = c.createImageData(size, size),
    heights = h.createImageData(size, size),
    rough = r.createImageData(size, size);
  let seed =
    kind.split('').reduce((a, v) => a * 7 + v.charCodeAt(0), 13) % 2147483647;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2,
        v = (y / size) * Math.PI * 2;
      const noise = random() - 0.5;
      let n = noise * 3;
      if (kind === 'smoked-oak')
        n +=
          Math.sin(v * 58 + Math.sin(u) * 0.5) * 2.6 +
          Math.sin(v * 17 + Math.cos(u * 2) * 0.3) * 1.5;
      if (kind === 'ash')
        n +=
          Math.sin(v * 93 + Math.sin(u * 2) * 0.4) * 2 +
          Math.cos(v * 8 + Math.sin(u) * 0.3) * 1.8;
      if (kind === 'travertine')
        n +=
          Math.sin(v * 5 + Math.sin(u * 2) * 0.45) * 5 +
          (random() > 0.984 ? -50 : 0);
      if (kind === 'boucle')
        n +=
          Math.sin(u * 64 + Math.sin(v * 3) * 0.8) *
            Math.sin(v * 72 + Math.sin(u * 5) * 0.6) *
            5 +
          noise * 3;
      if (kind === 'cotton')
        n +=
          Math.sin(u * 100) * 1.7 +
          Math.sin(v * 110 + Math.sin(u * 3) * 0.25) * 1.4;
      if (kind === 'brushed-metal')
        n += Math.sin(v * 125 + Math.sin(u) * 0.15) * 3 + noise;
      if (kind === 'suede') n += Math.sin(u * 120 + v * 90) * 4 + noise * 5;
      if (['lime', 'clay', 'mineral'].includes(kind))
        n +=
          Math.sin(u * 3 + Math.sin(v * 2)) * 1.4 +
          Math.cos(v * 4 + Math.sin(u * 3)) * 0.8;
      const i = (y * size + x) * 4;
      for (let j = 0; j < 3; j++) {
        pixels.data[i + j] = 242 + n;
        heights.data[i + j] = 128 + n * 2;
        // Non-colour data: broad sheen stays soft, fine fibres/pores vary only up close.
        rough.data[i + j] = 245 + n * (kind === 'brushed-metal' ? 1.6 : 0.6);
      }
      pixels.data[i + 3] = heights.data[i + 3] = rough.data[i + 3] = 255;
    }
  c.putImageData(pixels, 0, 0);
  h.putImageData(heights, 0, 0);
  r.putImageData(rough, 0, 0);
  const map = new T.CanvasTexture(color),
    bumpMap = new T.CanvasTexture(relief),
    roughnessMap = new T.CanvasTexture(roughness);
  map.colorSpace = T.SRGBColorSpace;
  for (const t of [map, bumpMap, roughnessMap]) {
    t.name = kind;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    textures.push(t);
  }
  return {
    map,
    bumpMap,
    normalMap: null,
    roughnessMap,
    bumpScale:
      kind === 'boucle' ? 0.003 : kind === 'brushed-metal' ? 0.00035 : 0.0015,
  };
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
  const surfaces = new Map<Surface, ReturnType<typeof makeSurface>>();
  const cloth = (color: string, kind: Surface) => {
    if (!surfaces.has(kind)) surfaces.set(kind, makeSurface(kind, textures));
    const material = new T.MeshStandardMaterial({
      color,
      ...surfaces.get(kind),
      roughness: 0.94,
    });
    material.name = `interior/${kind}`;
    materials.push(material);
    return material;
  };
  const joinery = {
    wood: base.oak,
    pale: base.paleWood,
    dark: base.darkWood,
    wall: base.cream,
  };
  return {
    living: { ...joinery, cloth: cloth('#ddd2bf', 'boucle') },
    bedroom: { ...joinery, cloth: cloth('#8394a2', 'cotton') },
    gallery: { ...joinery, cloth: cloth('#c8bda7', 'suede') },
  };
}

/** One oak specification for every room, with quiet board-to-board variation. */
export function oakFloorMaterials(
  materials: T.Material[],
  textures: T.Texture[],
) {
  const surface = makeSurface('smoked-oak', textures);
  return ['#c5a580', '#c8a984', '#c6a782', '#c3a37e', '#c7a884'].map(
    (color) => {
      const material = new T.MeshStandardMaterial({
        color,
        ...surface,
        roughness: 0.72,
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
