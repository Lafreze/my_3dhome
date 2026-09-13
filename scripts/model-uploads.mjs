import { mkdir, readdir, stat, writeFile, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { MAX_MODEL_BYTES } from './model-library.mjs';
const CHUNK_BYTES = 10 * 1024 * 1024;
const TTL = 60 * 60 * 1000;
const fail = (status, message) => Object.assign(new Error(message), { status });

// Small authenticated requests avoid edge request-size and processing timeouts.
// Parts live outside the web root, and only a validated, encrypted R2 object is published.
export async function createModelUploads(dataDir, library, now = Date.now) {
  const root = resolve(dataDir, 'model-upload-parts');
  await mkdir(root, { recursive: true, mode: 0o700 });
  for (const name of await readdir(root)) {
    if (!/^[a-f0-9-]{36}$/.test(name)) continue;
    const path = resolve(root, name),
      info = await stat(path);
    if (now() - info.mtimeMs > TTL)
      await rm(path, { recursive: true, force: true });
  }
  const jobs = new Map();
  const present = (g) => ({
    id: g.id,
    state: g.state,
    received: g.received,
    bytes: g.bytes,
    chunkBytes: CHUNK_BYTES,
    ...(g.item ? { item: g.item } : {}),
    ...(g.error ? { error: g.error } : {}),
  });
  const clean = async () => {
    for (const [id, g] of jobs)
      if (g.state !== 'processing' && !g.writing && now() - g.touched > TTL) {
        jobs.delete(id);
        await rm(g.path, { recursive: true, force: true });
      }
  };
  const find = (id, owner) => {
    const g = jobs.get(id);
    if (!g || g.owner !== owner || now() - g.touched > TTL)
      throw fail(404, '上传已失效，请重新选择文件。');
    g.touched = now();
    return g;
  };
  return {
    async start(value, owner) {
      await clean();
      if (
        !Number.isSafeInteger(value.bytes) ||
        value.bytes < 32 ||
        value.bytes > MAX_MODEL_BYTES
      )
        throw fail(413, '模型不能超过 200 MB。');
      const m = value.metadata;
      if (
        !m ||
        typeof m.title !== 'string' ||
        !m.title.trim() ||
        m.title.length > 80 ||
        typeof m.description !== 'string' ||
        m.description.length > 600 ||
        !['private', 'public'].includes(m.visibility) ||
        typeof m.compress !== 'boolean'
      )
        throw fail(400, '模型名称或上传选项无效。');
      if (
        [...jobs.values()].filter((g) =>
          ['receiving', 'processing'].includes(g.state),
        ).length >= 2
      )
        throw fail(409, '已有模型正在上传，请完成后再试。');
      const id = randomUUID(),
        path = resolve(root, id);
      await mkdir(path, { mode: 0o700 });
      const g = {
        id,
        path,
        owner,
        metadata: m,
        bytes: value.bytes,
        received: 0,
        parts: new Map(),
        state: 'receiving',
        touched: now(),
        writing: false,
      };
      jobs.set(id, g);
      return present(g);
    },
    status(id, owner) {
      return present(find(id, owner));
    },
    async part(id, index, owner, req) {
      const g = find(id, owner);
      if (g.state !== 'receiving' || g.writing)
        throw fail(409, '模型正在处理，请稍后。');
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= Math.ceil(g.bytes / CHUNK_BYTES)
      )
        throw fail(400, '分段编号无效。');
      const expected = Math.min(CHUNK_BYTES, g.bytes - index * CHUNK_BYTES);
      if (Number(req.headers['content-length']) > expected)
        throw fail(413, '上传分段过大。');
      g.writing = true;
      try {
        const bytes = Buffer.allocUnsafe(expected);
        let length = 0;
        for await (const chunk of req) {
          if (length + chunk.length > expected)
            throw fail(413, '上传分段过大。');
          chunk.copy(bytes, length);
          length += chunk.length;
        }
        if (length !== expected) throw fail(400, '上传分段不完整，请重试。');
        const hash = createHash('sha256').update(bytes).digest('hex');
        if (g.parts.has(index)) {
          if (g.parts.get(index) !== hash)
            throw fail(409, '重复分段内容不一致。');
          return present(g);
        }
        await writeFile(resolve(g.path, `${index}.part`), bytes, {
          mode: 0o600,
          flag: 'wx',
        });
        g.parts.set(index, hash);
        g.received += length;
        g.touched = now();
        return present(g);
      } finally {
        g.writing = false;
      }
    },
    complete(id, owner) {
      const g = find(id, owner);
      if (g.state !== 'receiving') return present(g);
      if (g.writing || g.received !== g.bytes)
        throw fail(409, '文件尚未上传完整。');
      if ([...jobs.values()].some((j) => j.state === 'processing'))
        throw fail(409, '另一个模型正在处理，请稍后。');
      g.state = 'processing';
      const request = Readable.from(
        (async function* () {
          for (let n = 0; n < g.parts.size; n++)
            yield* createReadStream(resolve(g.path, `${n}.part`));
        })(),
      );
      request.headers = {
        'content-type': 'model/gltf-binary',
        'content-length': String(g.bytes),
        'x-model-metadata': encodeURIComponent(JSON.stringify(g.metadata)),
      };
      void library
        .add(request)
        .then(
          (item) => {
            g.item = item;
            g.state = 'complete';
          },
          (error) => {
            g.error = error.status ? error.message : '模型处理失败，请重试。';
            g.state = 'failed';
          },
        )
        .finally(async () => {
          g.touched = now();
          await rm(g.path, { recursive: true, force: true }).catch(() => {});
        });
      return present(g);
    },
    async cancel(id, owner) {
      const g = find(id, owner);
      if (g.state === 'processing' || g.writing)
        throw fail(409, '模型正在处理。');
      jobs.delete(id);
      await rm(g.path, { recursive: true, force: true });
      return { cancelled: true };
    },
  };
}
