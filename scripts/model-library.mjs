import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { createModelStorage } from './model-storage.mjs';
import { compressModel } from './model-compression.mjs';

export const MAX_MODEL_BYTES = 200 * 1024 * 1024;
const MAX_LIBRARY_BYTES = 1024 * 1024 * 1024;
const fail = (status, message) => Object.assign(new Error(message), { status });

/** Accept self-contained GLB 2.0 only; a model cannot fetch arbitrary remote resources. */
export function validateModelGlb(bytes) {
  if (bytes.length < 32 || bytes.length > MAX_MODEL_BYTES)
    throw fail(413, '模型不能超过 200 MB。');
  if (
    bytes.readUInt32LE(0) !== 0x46546c67 ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  )
    throw fail(400, '文件不是完整的 GLB 2.0 模型。');
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw fail(400, '模型分块不完整。');
    const length = bytes.readUInt32LE(offset),
      type = bytes.readUInt32LE(offset + 4);
    if (length % 4 || offset + 8 + length > bytes.length)
      throw fail(400, '模型分块长度无效。');
    chunks.push({
      type,
      body: bytes.subarray(offset + 8, offset + 8 + length),
    });
    offset += length + 8;
  }
  if (
    chunks[0]?.type !== 0x4e4f534a ||
    chunks.length !== 2 ||
    chunks[1].type !== 0x004e4942 ||
    chunks[0].body.length > 8 * 1024 * 1024
  )
    throw fail(400, '请使用包含几何和贴图的单文件 GLB。');
  let gltf;
  try {
    gltf = JSON.parse(chunks[0].body.toString('utf8'));
  } catch {
    throw fail(400, '模型描述无法读取。');
  }
  if (
    gltf.asset?.version !== '2.0' ||
    !Array.isArray(gltf.meshes) ||
    !gltf.meshes.length ||
    gltf.meshes.length > 5000 ||
    (gltf.nodes?.length || 0) > 10000
  )
    throw fail(400, '模型内容不完整或过于复杂。');
  const resources = [...(gltf.buffers || []), ...(gltf.images || [])];
  if (resources.some((r) => r.uri !== undefined))
    throw fail(400, '请将所有贴图和几何打包在 GLB 内，不要引用外部文件。');
  if (
    gltf.buffers?.length !== 1 ||
    !Number.isSafeInteger(gltf.buffers[0].byteLength) ||
    gltf.buffers[0].byteLength < 1 ||
    gltf.buffers[0].byteLength > chunks[1].body.length
  )
    throw fail(400, '模型数据区不完整。');
  for (const view of gltf.bufferViews || []) {
    const offset = view.byteOffset || 0;
    if (
      view.buffer !== 0 ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(view.byteLength) ||
      view.byteLength < 0 ||
      offset + view.byteLength > gltf.buffers[0].byteLength
    )
      throw fail(400, '模型数据范围无效。');
  }
  const supported = new Set([
    'KHR_draco_mesh_compression',
    'EXT_meshopt_compression',
    'KHR_mesh_quantization',
    'KHR_texture_transform',
    'KHR_materials_unlit',
    'KHR_materials_pbrSpecularGlossiness',
    'KHR_materials_clearcoat',
    'KHR_materials_ior',
    'KHR_materials_sheen',
    'KHR_materials_specular',
    'KHR_materials_transmission',
    'KHR_materials_volume',
    'KHR_materials_emissive_strength',
    'KHR_materials_iridescence',
    'KHR_materials_anisotropy',
    'EXT_texture_webp',
    'KHR_texture_basisu',
  ]);
  if ((gltf.extensionsRequired || []).some((e) => !supported.has(e)))
    throw fail(400, '模型需要暂不支持的扩展，请导出标准 GLB 后重试。');
  let triangles = 0;
  for (const mesh of gltf.meshes)
    for (const p of mesh.primitives || []) {
      const position = gltf.accessors?.[p.attributes?.POSITION];
      if (
        !position ||
        !Number.isSafeInteger(position.count) ||
        position.count < 1
      )
        throw fail(400, '模型缺少有效的顶点。');
      triangles += (gltf.accessors?.[p.indices]?.count ?? position.count) / 3;
    }
  if (triangles > 4000000)
    throw fail(400, '模型超过 400 万三角面，请先简化后再保存。');
  return { triangles: Math.round(triangles) };
}

export const SHARE_CODE = /^[A-Za-z0-9_-]{43}$/;
export async function createModelLibrary(
  dataDir,
  now = Date.now,
  options = {},
) {
  const directory = resolve(dataDir, 'model-library'),
    catalog = resolve(directory, 'catalog.json');
  const storage =
    options.storage === undefined ? createModelStorage() : options.storage;
  const compress = options.compress || compressModel;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let items = [];
  try {
    const saved = JSON.parse(await readFile(catalog, 'utf8'));
    if (![1, 2].includes(saved.version) || !Array.isArray(saved.items))
      throw Error('Invalid model library');
    items = saved.items;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const persist = async (next) => {
    const temp = `${catalog}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temp, 'wx', 0o600);
      try {
        await handle.writeFile(JSON.stringify({ version: 2, items: next }));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temp, catalog);
      items = next;
    } finally {
      await unlink(temp).catch(() => {});
    }
  };
  // Preserve legacy originals locally; update the catalog only after R2 confirms each copy.
  if (storage)
    for (const item of items)
      if (!item.objectKey) {
        const content = await readFile(resolve(directory, `${item.id}.glb`));
        const objectKey = await storage.put(content);
        await persist(
          items.map((x) =>
            x.id === item.id ? { ...x, objectKey, storage: 'r2' } : x,
          ),
        );
      }
  let writes = Promise.resolve(),
    uploading = false;
  const mutate = (fn) => {
    const result = writes.then(fn);
    writes = result.catch(() => {});
    return result;
  };
  const privateItem = (item) => item.visibility === 'private';
  const present = (item, admin = false, share = false) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    bytes: item.bytes,
    originalBytes: item.originalBytes || item.bytes,
    createdAt: item.createdAt,
    visibility: item.visibility || 'public',
    category: privateItem(item)
      ? 'PRIVATE / COLLECTION'
      : 'PERSONAL / COLLECTION',
    url: share
      ? `/api/model-share/${item.shareCode}/file.glb`
      : `/api/models/${item.id}.glb`,
    ...(admin
      ? {
          storage: item.storage || 'local',
          compression: item.compression || 'original',
          ...(privateItem(item)
            ? { sharePath: `/models/private/${item.shareCode}` }
            : {}),
        }
      : {}),
  });
  const shared = (code) =>
    SHARE_CODE.test(code) &&
    items.find((x) => privateItem(x) && x.shareCode === code);
  const reads = new Map();
  const read = async (item) => {
    if (reads.has(item.id)) return reads.get(item.id);
    if (reads.size >= 2) throw fail(503, '模型正在读取，请稍后重试。');
    const pending = item.objectKey
      ? storage
        ? storage.get(item.objectKey)
        : Promise.reject(Error('R2 unavailable'))
      : readFile(resolve(directory, `${item.id}.glb`));
    reads.set(item.id, pending);
    try {
      return await pending;
    } finally {
      reads.delete(item.id);
    }
  };
  const serveItem = async (req, res, item) => {
    const headers = {
      'Content-Type': 'model/gltf-binary',
      'Content-Length': item.bytes,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      'X-Model-Storage': item.objectKey ? 'r2' : 'local',
      'Accept-Ranges': 'bytes',
    };
    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    let bytes;
    try {
      bytes = await read(item);
    } catch {
      throw fail(503, '模型存储暂时不可用，请稍后重试。');
    }
    let start = 0,
      end = bytes.length - 1,
      status = 200;
    if (req.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!range || (!range[1] && !range[2]))
        throw fail(416, '无效的数据范围。');
      start = range[1]
        ? Number(range[1])
        : Math.max(0, bytes.length - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= bytes.length
      )
        throw fail(416, '无效的数据范围。');
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(status, headers);
    res.end(bytes.subarray(start, end + 1));
  };
  return {
    list: (admin = false) =>
      items
        .filter((item) => admin || !privateItem(item))
        .map((item) => present(item, admin)),
    storage: storage ? 'r2' : 'local',
    share(code) {
      const item = shared(code);
      if (!item) throw fail(404, '链接不存在或已失效。');
      return present(item, false, true);
    },
    async resetShare(id) {
      return mutate(async () => {
        const item = items.find((x) => x.id === id && privateItem(x));
        if (!item) throw fail(404, '没有找到这件私密模型。');
        const next = {
          ...item,
          shareCode: randomBytes(32).toString('base64url'),
        };
        await persist(items.map((x) => (x.id === id ? next : x)));
        return present(next, true);
      });
    },
    async add(req) {
      if (uploading) {
        req.resume();
        throw fail(409, '已有模型正在处理，请完成后再上传。');
      }
      uploading = true;
      try {
        if (
          !/^(model\/gltf-binary|application\/octet-stream)(?:;|$)/i.test(
            req.headers['content-type'] || '',
          )
        )
          throw fail(415, '请选择 GLB 模型文件。');
        if (Number(req.headers['content-length']) > MAX_MODEL_BYTES) {
          req.resume();
          throw fail(413, '模型不能超过 200 MB。');
        }
        let metadata;
        try {
          metadata = JSON.parse(
            decodeURIComponent(req.headers['x-model-metadata'] || ''),
          );
        } catch {
          throw fail(400, '模型说明无法读取。');
        }
        if (
          !metadata ||
          typeof metadata.title !== 'string' ||
          !metadata.title.trim() ||
          metadata.title.length > 80 ||
          typeof metadata.description !== 'string' ||
          metadata.description.length > 600 ||
          (metadata.visibility !== undefined &&
            !['public', 'private'].includes(metadata.visibility)) ||
          (metadata.compress !== undefined &&
            typeof metadata.compress !== 'boolean')
        )
          throw fail(400, '模型名称、说明或上传选项无效。');
        // Known-length uploads are filled directly: avoid retaining 200 MB of
        // chunks alongside another 200 MB concatenation while codecs run.
        const declared = Number(req.headers['content-length']);
        const allocated =
          Number.isSafeInteger(declared) && declared > 0
            ? Buffer.allocUnsafe(declared)
            : null;
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          const end = size + chunk.length;
          if (end > MAX_MODEL_BYTES) throw fail(413, '模型不能超过 200 MB。');
          if (allocated) {
            if (end > allocated.length) throw fail(400, '文件长度不符。');
            chunk.copy(allocated, size);
          } else chunks.push(chunk);
          size = end;
        }
        if (allocated && size !== allocated.length)
          throw fail(400, '上传未完成。');
        let content = allocated || Buffer.concat(chunks, size);
        chunks.length = 0;
        validateModelGlb(content);
        let compression = 'original';
        if (metadata.compress) {
          try {
            const optimized = await compress(content);
            validateModelGlb(optimized);
            if (optimized.length < content.length) {
              content = optimized;
              compression = 'compressed';
            } else compression = 'already-optimized';
          } catch {
            compression = 'fallback';
          }
        }
        return await mutate(async () => {
          if (
            items.length >= 50 ||
            items.reduce((sum, item) => sum + item.bytes, 0) + content.length >
              MAX_LIBRARY_BYTES
          )
            throw fail(413, '展柜空间已满（最多 50 件或 1 GB）。');
          const item = {
            id: randomUUID(),
            title: metadata.title.trim(),
            description: metadata.description.trim(),
            bytes: content.length,
            originalBytes: size,
            compression,
            createdAt: new Date(now()).toISOString(),
            visibility: metadata.visibility || 'public',
            ...(metadata.visibility === 'private'
              ? { shareCode: randomBytes(32).toString('base64url') }
              : {}),
            storage: storage ? 'r2' : 'local',
          };
          if (storage) {
            try {
              item.objectKey = await storage.put(content);
            } catch {
              throw fail(503, 'R2 保存失败，模型尚未发布，请稍后重试。');
            }
          } else {
            const model = await open(
              resolve(directory, `${item.id}.glb`),
              'wx',
              0o600,
            );
            try {
              await model.writeFile(content);
              await model.sync();
            } finally {
              await model.close();
            }
          }
          await persist([...items, item]);
          return present(item, true);
        });
      } finally {
        uploading = false;
      }
    },
    async serve(req, res, id, admin = false) {
      const item = items.find((x) => x.id === id && (admin || !privateItem(x)));
      if (!item) throw fail(404, '没有找到这件模型。');
      await serveItem(req, res, item);
    },
    async serveShare(req, res, code) {
      const item = shared(code);
      if (!item) throw fail(404, '链接不存在或已失效。');
      await serveItem(req, res, item);
    },
  };
}
