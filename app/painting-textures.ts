import * as T from 'three';
import { assetManifest } from './asset-url';
import { fetchAssetBytes, type RoomAssets } from './asset-loading';
import type { RoomId } from './house-data';

const sources = new WeakMap<
  RoomAssets,
  Map<string, Promise<T.Source<HTMLImageElement>>>
>();

// Adjacent frames use contiguous crops of the same source, with no geometry bridging their gap.
export function paintingWindow(
  sourceAspect: number,
  frameAspect: number,
  panel = 0,
  panels = 1,
) {
  const target = frameAspect * panels;
  const width = Math.min(1, target / sourceAspect);
  const height = Math.min(1, sourceAspect / target);
  return {
    x: (1 - width) / 2 + (panel * width) / panels,
    y: (1 - height) / 2,
    width: width / panels,
    height,
  };
}

export function paintingTexture(
  scope: RoomAssets,
  room: RoomId,
  id: string,
  textures: T.Texture[],
  aspect: number,
  panel = 0,
  panels = 1,
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e8e1d1';
  ctx.fillRect(0, 0, 1, 1);
  const texture = new T.Texture<HTMLCanvasElement | HTMLImageElement>(canvas);
  texture.name = `Painting / ${id} / ${panel + 1} of ${panels}`;
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  textures.push(texture);
  scope.register(room, id, async () => {
    let cache = sources.get(scope);
    if (!cache) sources.set(scope, (cache = new Map()));
    let pending = cache.get(id);
    if (!pending) {
      pending = (async () => {
        const bytes = await fetchAssetBytes(id);
        const url = URL.createObjectURL(
          new Blob([bytes], { type: assetManifest.assets[id].contentType }),
        );
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          return new T.Source(image);
        } finally {
          URL.revokeObjectURL(url);
        }
      })();
      cache.set(id, pending);
      void pending.catch(() => cache!.delete(id));
    }
    const source = await pending;
    if (scope.disposed) return;
    const crop = paintingWindow(
      source.data.width / source.data.height,
      aspect,
      panel,
      panels,
    );
    texture.dispose();
    texture.source = source;
    texture.repeat.set(crop.width, crop.height);
    texture.offset.set(crop.x, crop.y);
    texture.needsUpdate = true;
  });
  return texture;
}
