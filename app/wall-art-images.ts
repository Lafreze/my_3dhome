import * as T from 'three';
import { assetUrl } from './asset-url';
import library from '../config/wall-art-library.json';

export const wallArtLibrary = library;
export function wallArtUrl(value: string): string {
  if (!value.startsWith('asset:')) return value;
  const id = value.slice(6);
  return library.some((item) => item.id === id) ? assetUrl(id) : '';
}
export function loadFramedArt(url: string, aspect: number): Promise<T.Texture> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onerror = () => reject(new Error('图片暂时无法载入。'));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(1024 * aspect);
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#eee8da';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(
        canvas.width / image.width,
        canvas.height / image.height,
      );
      ctx.drawImage(
        image,
        (canvas.width - image.width * scale) / 2,
        (canvas.height - image.height * scale) / 2,
        image.width * scale,
        image.height * scale,
      );
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = 8;
      resolve(texture);
    };
    image.src = url;
  });
}
