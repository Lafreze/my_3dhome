import * as T from 'three';
// Verified CC0 source and hashes are in public/materials/manifest.json.
// Always served locally: no asset-CDN dependency at runtime.
export function localPbr(
  textures: T.Texture[],
  asset: string,
  repeat: T.Vector2,
  albedo = true,
) {
  const loader = new T.TextureLoader();
  const load = (file: string, color = false) => {
    const t = loader.load(`/materials/${asset}/${file}.jpg`);
    t.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.copy(repeat);
    t.anisotropy = 8;
    textures.push(t);
    return t;
  };
  return {
    ...(albedo
      ? { map: load(asset === 'fabric_pattern_07' ? 'col_1' : 'Diffuse', true) }
      : {}),
    normalMap: load('nor_gl'),
    roughnessMap: load('Rough'),
  };
}
