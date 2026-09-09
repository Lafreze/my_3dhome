import manifestData from './generated/asset-manifest.json' with { type: 'json' };

export type AssetEntry = {
  type: string;
  room: string;
  rooms: string[];
  path: string;
  logicalPath: string;
  size: number;
  sha256: string;
  contentType: string;
  dependencies: string[];
  publish: boolean;
};
export const assetManifest = manifestData as {
  version: string;
  assets: Record<string, AssetEntry>;
};
// Vite replaces this exact public variable during the build. No server secrets are imported.
const configuredBase = import.meta.env?.VITE_ASSET_BASE_URL || '';
export function assetUrl(pathOrId: string, base = configuredBase): string {
  if (/^https:\/\//i.test(pathOrId)) {
    const url = new URL(pathOrId);
    if (url.username || url.password)
      throw new Error('Credentials are forbidden in asset URLs');
    return pathOrId;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(pathOrId) || pathOrId.startsWith('//'))
    throw new Error(
      'Only HTTPS or relative production asset paths are supported',
    );
  let key = pathOrId.replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  const entry =
    assetManifest.assets[key] ||
    Object.values(assetManifest.assets).find(
      (a) => a.logicalPath === key || a.path === key,
    );
  if (entry) key = entry.path;
  if (
    key.split('/').some((part) => part === '.' || part === '..') ||
    /[\\?#%]/.test(key)
  )
    throw new Error('Invalid asset path');
  // Pending user-supplied models stay on the existing local origin, never in R2.
  const prefix = (
    entry && !entry.publish ? '/assets' : base.trim() || '/assets'
  ).replace(/\/+$/, '');
  if (prefix.startsWith('https://')) {
    const url = new URL(prefix);
    if (url.username || url.password || url.search || url.hash)
      throw new Error('Invalid asset base URL');
    return `${url.origin}${url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '')}/${key}`;
  }
  if (
    !prefix.startsWith('/') ||
    prefix.startsWith('//') ||
    /[\\?#%]/.test(prefix) ||
    prefix.split('/').includes('..')
  )
    throw new Error('Asset base must be HTTPS or a local absolute path');
  return `${prefix.replace(/\/{2,}/g, '/')}/${key}`;
}
export const usesRemoteAssets = () => configuredBase.startsWith('https://');
