import { createHash } from 'node:crypto';
import path from 'node:path';

export const PREFIX = 'kuro/';
export const IMMUTABLE = 'public, max-age=31536000, immutable';
export const MANIFEST_CACHE = 'public, max-age=300, must-revalidate';
export const mimeTypes = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.ktx2': 'image/ktx2',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.hdr': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.js': 'text/javascript',
};
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
export function safePath(value) {
  if (
    typeof value !== 'string' ||
    !/^[a-zA-Z0-9_./-]+$/.test(value) ||
    value
      .split('/')
      .some((s) => !s || s === '.' || s === '..' || s.startsWith('.'))
  )
    throw new Error(`Unsafe asset path: ${value}`);
  return value;
}
export function objectKey(value) {
  safePath(value);
  if (!value.startsWith(PREFIX) || value === PREFIX)
    throw new Error('Only kuro/ objects are permitted');
  return value;
}
export function contentType(value) {
  if (/^licenses\/[a-z0-9_.-]+\.txt$/.test(value)) return 'text/plain';
  const ext = path.posix.extname(value).toLowerCase();
  const type = mimeTypes[ext];
  if (!type || (ext === '.js' && !value.startsWith('decoders/')))
    throw new Error(`Forbidden production file: ${value}`);
  return type;
}
export function hashedPath(value, data) {
  safePath(value);
  contentType(value);
  const ext = path.posix.extname(value);
  return `${value.slice(0, -ext.length)}.${sha256(data).slice(0, 16)}${ext}`;
}
export function publicManifest(manifest) {
  const assets = Object.fromEntries(
    Object.entries(manifest.assets).filter(([, a]) => a.publish),
  );
  const version = sha256(JSON.stringify(assets)).slice(0, 16);
  return { schemaVersion: 1, version, assets };
}
