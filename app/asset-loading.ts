import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { assetManifest, assetUrl } from './asset-url';
import type { HouseView, RoomId } from './house-data';

// Extend the default Three.js manager; the existing visitor model cache stays its owner.
export const loadingManager = T.DefaultLoadingManager;
T.Cache.enabled = true;
loadingManager.setURLModifier((url) => {
  // Draco/Basis loaders append fixed filenames. Resolve them to immutable manifest paths.
  for (const asset of Object.values(assetManifest.assets))
    if (
      asset.type === 'decoder' &&
      url ===
        assetUrl(
          asset.logicalPath.slice(0, asset.logicalPath.lastIndexOf('/') + 1),
        ) +
          asset.logicalPath.split('/').pop()
    )
      return assetUrl(asset.path);
  return url;
});
type Transfer = {
  loaded: number;
  total: number;
  status: 'loading' | 'ready' | 'error';
};
const transfers = new Map<string, Transfer>();
const listeners = new Set<() => void>();
const requests = new Map<string, Promise<ArrayBuffer>>();
const bytesCache = new Map<string, ArrayBuffer>();
const MAX_BYTES = 64 * 1024 * 1024;
const emit = () => listeners.forEach((fn) => fn());
export async function fetchAssetBytes(id: string): Promise<ArrayBuffer> {
  const entry = assetManifest.assets[id];
  if (!entry) throw new Error(`Unknown production asset: ${id}`);
  const cached = bytesCache.get(id);
  if (cached) {
    bytesCache.delete(id);
    bytesCache.set(id, cached);
    transfers.set(id, {
      loaded: entry.size,
      total: entry.size,
      status: 'ready',
    });
    return cached;
  }
  const pending = requests.get(id);
  if (pending) return pending;
  const request = (async () => {
    const url = assetUrl(id);
    const state: Transfer = { loaded: 0, total: entry.size, status: 'loading' };
    transfers.set(id, state);
    emit();
    loadingManager.itemStart(url);
    try {
      const response = await fetch(url, {
        credentials: 'omit',
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) throw new Error(`Asset HTTP ${response.status}`);
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          state.loaded += value.length;
          emit();
        }
      } else {
        const value = new Uint8Array(await response.arrayBuffer());
        chunks.push(value);
        state.loaded = value.length;
      }
      if (state.loaded !== entry.size) throw new Error('Asset size mismatch');
      const bytes = new Uint8Array(state.loaded);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      // Detect a missing object served as HTML, corruption, or stale bytes behind an immutable URL.
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      if (
        Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join('') !== entry.sha256
      )
        throw new Error('Asset hash mismatch');
      bytesCache.set(id, bytes.buffer);
      let total = Array.from(bytesCache.values()).reduce(
        (sum, item) => sum + item.byteLength,
        0,
      );
      for (const [key, value] of bytesCache) {
        if (total <= MAX_BYTES) break;
        bytesCache.delete(key);
        total -= value.byteLength;
      }
      state.status = 'ready';
      emit();
      return bytes.buffer;
    } catch (error) {
      state.status = 'error';
      loadingManager.itemError(url);
      emit();
      throw error;
    } finally {
      loadingManager.itemEnd(url);
      requests.delete(id);
    }
  })();
  requests.set(id, request);
  return request;
}
export function releaseAssetTexture(texture: T.Texture) {
  texture.dispose();
  // Blob cache entries from GLTFLoader cannot be fetched again after revokeObjectURL.
  // Their decoded bitmap belongs to the final model lease, not the long-lived byte cache.
  if (
    typeof ImageBitmap !== 'undefined' &&
    texture.image instanceof ImageBitmap
  ) {
    for (const [key, value] of Object.entries(T.Cache.files))
      if (value === texture.image) T.Cache.remove(key);
    texture.image.close();
  }
}
let activeRenderer: T.WebGLRenderer | undefined;
export function setAssetRenderer(renderer?: T.WebGLRenderer) {
  activeRenderer = renderer;
}
export async function loadAssetGltf(id: string) {
  const bytes = await fetchAssetBytes(id);
  const isGlb = new DataView(bytes).getUint32(0, true) === 0x46546c67;
  const gltf = JSON.parse(
    new TextDecoder().decode(
      isGlb
        ? bytes.slice(20, 20 + new DataView(bytes).getUint32(12, true))
        : bytes,
    ),
  );
  const extensions: string[] = gltf.extensionsUsed || [];
  const loader = new GLTFLoader(loadingManager);
  let draco: DRACOLoader | undefined, basis: KTX2Loader | undefined;
  if (extensions.includes('KHR_draco_mesh_compression')) {
    draco = new DRACOLoader(loadingManager).setDecoderPath(
      assetUrl('decoders/draco/'),
    );
    loader.setDRACOLoader(draco);
  }
  if (extensions.includes('KHR_texture_basisu')) {
    if (!activeRenderer) throw new Error('KTX2 requires an active renderer');
    basis = new KTX2Loader(loadingManager)
      .setTranscoderPath(assetUrl('decoders/basis/'))
      .detectSupport(activeRenderer);
    loader.setKTX2Loader(basis);
  }
  if (extensions.includes('EXT_meshopt_compression')) {
    const url = assetUrl('decoder.meshopt');
    const decoderModule = await import(/* @vite-ignore */ url);
    loader.setMeshoptDecoder(decoderModule.MeshoptDecoder);
  }
  const url = assetUrl(id);
  try {
    return await loader.parseAsync(
      bytes.slice(0),
      url.slice(0, url.lastIndexOf('/') + 1),
    );
  } finally {
    draco?.dispose();
    basis?.dispose();
  }
}
export type AssetProgress = {
  loaded: number;
  total: number;
  completed: number;
  count: number;
  busy: boolean;
  errors: string[];
};
type Task = {
  room: RoomId | 'shared';
  id: string;
  load: () => Promise<void>;
  status: 'idle' | 'loading' | 'ready' | 'error';
  promise?: Promise<void>;
};
const adjacent: Record<RoomId, RoomId[]> = {
  study: ['living', 'bedroom'],
  living: ['study', 'gallery'],
  bedroom: ['study', 'gallery', 'cafe'],
  gallery: ['living', 'bedroom', 'cafe', 'corridor'],
  cafe: ['bedroom', 'gallery', 'corridor'],
  corridor: ['gallery', 'cafe', 'gaming', 'bar'],
  bar: ['corridor'],
  gaming: ['corridor'],
};
export function createRoomAssets(
  onProgress: (progress: AssetProgress) => void,
) {
  let view: HouseView = 'study',
    disposed = false,
    idleTimer: number | undefined,
    generation = 0;
  const tasks: Task[] = [];
  const visible = (task: Task) =>
    task.room === 'shared' ||
    view === 'overview' ||
    view === 'plan' ||
    task.room === view;
  function notify() {
    if (disposed) return;
    const current = tasks.filter(visible);
    const unique = [...new Set(current.map((task) => task.id))];
    onProgress({
      loaded: unique.reduce(
        (sum, id) =>
          sum +
          Math.min(
            transfers.get(id)?.loaded || 0,
            assetManifest.assets[id]?.size || 0,
          ),
        0,
      ),
      total: unique.reduce(
        (sum, id) => sum + (assetManifest.assets[id]?.size || 0),
        0,
      ),
      completed: current.filter((t) => t.status === 'ready').length,
      count: current.length,
      busy: current.some((t) => t.status === 'idle' || t.status === 'loading'),
      errors: [
        ...new Set(
          current.filter((t) => t.status === 'error').map((t) => t.id),
        ),
      ],
    });
  }
  async function run(task: Task) {
    if (disposed || task.status === 'ready') return;
    if (task.promise) return task.promise;
    task.status = 'loading';
    notify();
    task.promise = task
      .load()
      .then(() => {
        task.status = 'ready';
      })
      .catch(() => {
        task.status = 'error';
      })
      .finally(() => {
        task.promise = undefined;
        notify();
      });
    return task.promise;
  }
  function cancelIdle() {
    generation++;
    if (idleTimer !== undefined) {
      if (typeof window.cancelIdleCallback === 'function')
        window.cancelIdleCallback(idleTimer);
      else window.clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  }
  function schedulePrefetch() {
    if (
      disposed ||
      view === 'overview' ||
      view === 'plan' ||
      tasks.filter(visible).some((t) => t.status !== 'ready')
    )
      return;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (
      connection?.saveData ||
      /(^|-)2g$/.test(connection?.effectiveType || '')
    )
      return;
    const current = generation;
    const ids = [
      ...new Set(
        tasks
          .filter((t) => adjacent[view as RoomId].includes(t.room as RoomId))
          .map((t) => t.id),
      ),
    ];
    const prefetch = () => {
      idleTimer = undefined;
      void (async () => {
        for (const id of ids) {
          if (disposed || current !== generation) return;
          try {
            await fetchAssetBytes(id);
          } catch {
            /* Background failure surfaces only when its room is entered. */
          }
        }
      })();
    };
    idleTimer =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(prefetch, { timeout: 5000 })
        : window.setTimeout(prefetch, 1500);
  }
  listeners.add(notify);
  return {
    get disposed() {
      return disposed;
    },
    register(room: RoomId | 'shared', id: string, load: () => Promise<void>) {
      const task: Task = { room, id, load, status: 'idle' };
      tasks.push(task);
      return () => run(task);
    },
    activate(next: HouseView) {
      view = next;
      cancelIdle();
      void Promise.all(
        tasks
          .filter((task) => visible(task) && task.status !== 'error')
          .map(run),
      ).then(schedulePrefetch);
      notify();
    },
    retry() {
      cancelIdle();
      void Promise.all(
        tasks.filter((t) => visible(t) && t.status === 'error').map(run),
      ).then(schedulePrefetch);
    },
    dispose() {
      disposed = true;
      cancelIdle();
      listeners.delete(notify);
    },
  };
}
export type RoomAssets = ReturnType<typeof createRoomAssets>;

export function deferredTexture(
  scope: RoomAssets,
  room: RoomId | 'shared',
  id: string,
  normal = false,
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = normal ? '#8080ff' : '#ffffff';
  ctx.fillRect(0, 0, 1, 1);
  const texture = new T.Texture<HTMLCanvasElement | HTMLImageElement>(canvas);
  texture.needsUpdate = true;
  scope.register(room, id, async () => {
    const bytes = await fetchAssetBytes(id);
    if (scope.disposed) return;
    const url = URL.createObjectURL(
      new Blob([bytes], { type: assetManifest.assets[id].contentType }),
    );
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (!scope.disposed) {
        // The placeholder allocated 1x1 immutable GPU storage; reset before resizing.
        texture.dispose();
        texture.image = img;
        texture.needsUpdate = true;
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  return texture;
}
