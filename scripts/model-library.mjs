import { mkdir, readFile, open, rename, unlink, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const MAX_MODEL_BYTES = 80 * 1024 * 1024;
const MAX_LIBRARY_BYTES = 1024 * 1024 * 1024;
const fail = (status, message) => Object.assign(new Error(message), { status });

/** Accept self-contained GLB 2.0 only; a model cannot fetch arbitrary remote resources. */
export function validateModelGlb(bytes) {
  if (bytes.length < 32 || bytes.length > MAX_MODEL_BYTES)
    throw fail(413, '模型需小于 80 MB。');
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

export async function createModelLibrary(dataDir, now = Date.now) {
  const directory = resolve(dataDir, 'model-library'),
    catalog = resolve(directory, 'catalog.json');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let items = [];
  try {
    const saved = JSON.parse(await readFile(catalog, 'utf8'));
    if (saved.version !== 1 || !Array.isArray(saved.items))
      throw Error('Invalid model library');
    items = saved.items;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let writes = Promise.resolve();
  const list = () =>
    items.map(({ id, title, description, bytes, createdAt }) => ({
      id,
      title,
      description,
      bytes,
      createdAt,
      category: 'PERSONAL / COLLECTION',
      url: `/api/models/${id}.glb`,
    }));
  return {
    list,
    async add(req) {
      if (
        !/^(model\/gltf-binary|application\/octet-stream)(?:;|$)/i.test(
          req.headers['content-type'] || '',
        )
      )
        throw fail(415, '请选择 GLB 模型文件。');
      if (Number(req.headers['content-length']) > MAX_MODEL_BYTES) {
        req.resume();
        throw fail(413, '模型需小于 80 MB。');
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
        typeof metadata.title !== 'string' ||
        !metadata.title.trim() ||
        metadata.title.length > 80 ||
        typeof metadata.description !== 'string' ||
        metadata.description.length > 600
      )
        throw fail(400, '请填写名称（80 字以内）和说明（600 字以内）。');
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > MAX_MODEL_BYTES) throw fail(413, '模型需小于 80 MB。');
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks);
      validateModelGlb(content);
      const update = async () => {
        if (
          items.length >= 50 ||
          items.reduce((sum, item) => sum + item.bytes, 0) + bytes >
            MAX_LIBRARY_BYTES
        )
          throw fail(413, '展柜空间已满（最多 50 件或 1 GB）。');
        const item = {
          id: randomUUID(),
          title: metadata.title.trim(),
          description: metadata.description.trim(),
          bytes,
          createdAt: new Date(now()).toISOString(),
        };
        const modelFile = resolve(directory, `${item.id}.glb`),
          temp = `${catalog}.${item.id}.tmp`;
        try {
          const model = await open(modelFile, 'wx', 0o600);
          try {
            await model.writeFile(content);
            await model.sync();
          } finally {
            await model.close();
          }
          const next = [...items, item],
            handle = await open(temp, 'wx', 0o600);
          try {
            await handle.writeFile(JSON.stringify({ version: 1, items: next }));
            await handle.sync();
          } finally {
            await handle.close();
          }
          await rename(temp, catalog);
          items = next;
          return list().at(-1);
        } catch (error) {
          await unlink(temp).catch(() => {});
          await unlink(modelFile).catch(() => {});
          throw error;
        }
      };
      const result = writes.then(update);
      writes = result.catch(() => {});
      return result;
    },
    async serve(req, res, id) {
      if (!items.some((item) => item.id === id))
        throw fail(404, '没有找到这件模型。');
      const file = resolve(directory, `${id}.glb`),
        info = await stat(file);
      res.writeHead(200, {
        'Content-Type': 'model/gltf-binary',
        'Content-Length': info.size,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') res.end();
      else
        createReadStream(file)
          .on('error', () => res.destroy())
          .pipe(res);
    },
  };
}
