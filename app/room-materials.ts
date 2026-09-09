import * as T from 'three';
import { deferredTexture, type RoomAssets } from './asset-loading';
import { assetManifest } from './asset-url';
import type { RoomId } from './house-data';
// Verified CC0 production derivatives are resolved through the versioned manifest.
export function localPbr(
  scope: RoomAssets,
  textures: T.Texture[],
  asset: string,
  repeat: T.Vector2,
  albedo = true,
) {
  const load = (file: string, color = false) => {
    const id = `texture.${asset}.${file}`;
    const room = assetManifest.assets[id].room as RoomId | 'shared';
    const t = deferredTexture(scope, room, id, file === 'nor_gl');
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
