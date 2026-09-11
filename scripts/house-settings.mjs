import { readFile, mkdir, open, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { visitorIP } from './seat-presence.mjs';
import { createRoomNotes } from './room-notes.mjs';

const defaults = JSON.parse(
  await readFile(
    new URL('../config/house-defaults.json', import.meta.url),
    'utf8',
  ),
);
const artLibrary = JSON.parse(
  await readFile(
    new URL('../config/wall-art-library.json', import.meta.url),
    'utf8',
  ),
);
const artReferences = new Set(artLibrary.map((a) => `asset:${a.id}`));
const wallImage = (v) => (artReferences.has(v) ? v : image(v));
const colorKeys = Object.keys(defaults.appearance);
const artKeys = [
  'studyArt1',
  'studyArt2',
  'studyArt3',
  'livingArt1',
  'livingArt2',
  'galleryArt1',
  'galleryArt2',
  'galleryArt3',
];
const hash = (s) => createHash('sha256').update(s).digest();
const fail = (status, message) => Object.assign(new Error(message), { status });
const record = (value) =>
  value && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed) {
  if (!record(value) || Object.keys(value).some((k) => !allowed.includes(k)))
    throw fail(400, '设置格式不正确。');
}
function text(value, max, required = false) {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    throw fail(400, '文字为空或超出长度限制。');
  return value;
}
function url(value) {
  text(value, 2048);
  if (!value) return '';
  try {
    const u = new URL(value);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
      throw Error();
    return u.href;
  } catch {
    throw fail(400, '网址需为完整的 HTTP / HTTPS 地址。');
  }
}
function image(value) {
  if (value === '') return '';
  text(value, 700000);
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    value,
  );
  if (!m || m[2].length % 4) throw fail(400, '图片需为 PNG、JPEG 或 WebP。');
  const b = Buffer.from(m[2], 'base64');
  const valid =
    m[1] === 'png'
      ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : m[1] === 'jpeg'
        ? b[0] === 255 && b[1] === 216 && b[2] === 255
        : b.toString('ascii', 0, 4) === 'RIFF' &&
          b.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || b.length > 500 * 1024)
    throw fail(400, '图片无效或超过 500 KB，请先压缩。');
  return value;
}
export function validateSettings(input) {
  keys(input, ['profile', 'note', 'appearance', 'devices', 'wallArt']);
  const p = input.profile;
  keys(p, ['name', 'subtitle', 'about', 'projects', 'photos']);
  if (
    !Array.isArray(p.projects) ||
    p.projects.length < 1 ||
    p.projects.length > 12 ||
    !Array.isArray(p.photos) ||
    p.photos.length > 6
  )
    throw fail(400, '作品或照片数量超出限制。');
  const profile = {
    name: text(p.name, 50, true),
    subtitle: text(p.subtitle, 80),
    about: text(p.about, 3000),
    projects: p.projects.map((v) => {
      keys(v, ['title', 'category', 'description', 'url', 'image']);
      return {
        title: text(v.title, 100, true),
        category: text(v.category, 80),
        description: text(v.description, 3000),
        url: url(v.url),
        image: image(v.image),
      };
    }),
    photos: p.photos.map(image),
  };
  keys(input.appearance, colorKeys);
  const appearance = Object.fromEntries(
    colorKeys.map((k) => {
      const v = input.appearance[k];
      if (
        !(Number.isInteger(v) && v >= 0 && v <= 2) &&
        !(typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v))
      )
        throw fail(400, '配色选项无效。');
      return [k, v];
    }),
  );
  keys(input.devices, ['computer', 'tv']);
  const devices = Object.fromEntries(
    ['computer', 'tv'].map((k) => {
      const v = input.devices[k];
      keys(v, ['url', 'enabled']);
      if (typeof v.enabled !== 'boolean') throw fail(400, '电源设置无效。');
      return [k, { url: url(v.url), enabled: v.enabled }];
    }),
  );
  keys(input.wallArt, artKeys);
  const wallArt = Object.fromEntries(
    Object.entries(input.wallArt)
      .filter(([, v]) => v !== null && v !== '')
      .map(([k, v]) => [k, wallImage(v)]),
  );
  return {
    profile,
    note: text(input.note, 5000),
    appearance,
    devices,
    wallArt,
  };
}

export async function createHouseHandler({
  dataDir = process.env.STUDIO_DATA_DIR || resolve('output/server-data'),
  password = process.env.STUDIO_ADMIN_PASSWORD || '',
  publicOrigin = process.env.STUDIO_PUBLIC_ORIGIN || '',
  secureCookies = process.env.NODE_ENV === 'production',
  trustRailwayProxy = false,
  now = Date.now,
} = {}) {
  const file = resolve(dataDir, 'house-settings.json');
  const roomNotes = await createRoomNotes(dataDir, now);
  const noteAttempts = new Map();
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  let state = {
    version: 1,
    revision: 0,
    updatedAt: null,
    settings: structuredClone(defaults),
  };
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    if (
      saved.version !== 1 ||
      !Number.isSafeInteger(saved.revision) ||
      saved.revision < 0
    )
      throw Error('Invalid saved house settings');
    state = {
      version: 1,
      revision: saved.revision,
      updatedAt: saved.updatedAt,
      settings: validateSettings(saved.settings),
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const sessions = new Map(),
    attempts = new Map();
  let writes = Promise.resolve();
  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    });
    res.end(JSON.stringify(body));
  };
  const cookie = (value, age) =>
    `studio_admin=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookies ? '; Secure' : ''}`;
  const session = (req) => {
    const token = /(?:^|;\s*)studio_admin=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie || '',
    )?.[1];
    const key = token && hash(token).toString('hex'),
      s = key && sessions.get(key);
    if (s && s.expires > now()) return { ...s, key };
    if (key) sessions.delete(key);
    return null;
  };
  const sameOrigin = (req) => {
    const expected =
      publicOrigin ||
      `${secureCookies ? 'https' : 'http'}://${req.headers.host}`;
    if (
      req.headers.origin !== expected ||
      req.headers['sec-fetch-site'] === 'cross-site'
    )
      throw fail(403, '请从小屋页面提交设置。');
  };
  const body = async (req, limit) => {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))
      throw fail(415, '请使用 JSON 提交。');
    if (Number(req.headers['content-length']) > limit) {
      req.resume();
      throw fail(413, '内容过大，请减少图片。');
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > limit) throw fail(413, '内容过大，请减少图片。');
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw fail(400, '设置格式不正确。');
    }
  };
  return async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (
      path !== '/api/house' &&
      path !== '/api/notes' &&
      !path.startsWith('/api/admin/')
    )
      return false;
    try {
      if (req.method === 'GET' && path === '/api/notes') {
        send(res, 200, roomNotes.snapshot());
        return true;
      }
      if (req.method === 'GET' && path === '/api/house') {
        const etag = `"house-r${state.revision}"`;
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-store' });
          res.end();
        } else send(res, 200, state, { ETag: etag });
        return true;
      }
      if (req.method === 'GET' && path === '/api/admin/session') {
        const s = session(req);
        send(res, 200, {
          authenticated: !!s,
          csrf: s?.csrf || '',
          expiresAt: s?.expires || null,
        });
        return true;
      }
      sameOrigin(req);
      if (req.method === 'POST' && path === '/api/notes') {
        const value = await body(req, 4096);
        keys(value, ['room', 'author', 'text']);
        const ip = visitorIP(req, trustRailwayProxy);
        for (const [key, times] of noteAttempts)
          if (times.every((t) => t < now() - 600000)) noteAttempts.delete(key);
        const recent = (noteAttempts.get(ip) || []).filter(
          (t) => t > now() - 600000,
        );
        if (
          recent.length >= 5 ||
          (recent.length && now() - recent.at(-1) < 30000) ||
          (!recent.length && noteAttempts.size >= 5000)
        )
          throw fail(429, '先歇一会儿，稍后再留一张便签。');
        // Reserve the rate-limit slot before the queued disk write.
        noteAttempts.set(ip, [...recent, now()]);
        send(res, 201, await roomNotes.add(value));
        return true;
      }
      if (req.method === 'POST' && path === '/api/admin/login') {
        if (!password) throw fail(503, '管理暗号尚未配置。');
        const ip = visitorIP(req, trustRailwayProxy);
        for (const [k, v] of attempts) if (v.until <= now()) attempts.delete(k);
        for (const [k, v] of sessions)
          if (v.expires <= now()) sessions.delete(k);
        const prior = attempts.get(ip);
        if (prior?.count >= 5) {
          send(
            res,
            429,
            { error: '尝试次数较多，请 15 分钟后再试。' },
            { 'Retry-After': String(Math.ceil((prior.until - now()) / 1000)) },
          );
          return true;
        }
        if (attempts.size >= 5000 && !prior) throw fail(429, '请稍后再试。');
        const value = await body(req, 2048);
        const ok =
          typeof value?.passphrase === 'string' &&
          value.passphrase.length <= 256 &&
          timingSafeEqual(hash(value.passphrase), hash(password));
        if (!ok) {
          attempts.set(ip, {
            count: (prior?.count || 0) + 1,
            until: prior?.until || now() + 900000,
          });
          throw fail(401, '暗号不对，再想一想。');
        }
        attempts.delete(ip);
        const old = session(req);
        if (old) sessions.delete(old.key);
        if (sessions.size >= 1000)
          sessions.delete(sessions.keys().next().value);
        const token = randomBytes(32).toString('hex'),
          csrf = randomBytes(24).toString('hex'),
          expires = now() + 8 * 3600000;
        sessions.set(hash(token).toString('hex'), { csrf, expires });
        send(
          res,
          200,
          { authenticated: true, csrf, expiresAt: expires },
          { 'Set-Cookie': cookie(token, 8 * 3600) },
        );
        return true;
      }
      const s = session(req);
      if (!s) throw fail(401, '请先输入管理暗号。');
      if (req.headers['x-studio-csrf'] !== s.csrf)
        throw fail(403, '验证已失效，请重新进入管理模式。');
      if (req.method === 'DELETE' && path === '/api/notes') {
        const value = await body(req, 1024);
        keys(value, ['id']);
        send(res, 200, await roomNotes.remove(text(value.id, 64, true)));
        return true;
      }
      if (req.method === 'POST' && path === '/api/admin/logout') {
        sessions.delete(s.key);
        send(
          res,
          200,
          { authenticated: false },
          { 'Set-Cookie': cookie('', 0) },
        );
        return true;
      }
      if (req.method !== 'PATCH' || path !== '/api/house')
        throw fail(405, '不支持此操作。');
      const value = await body(req, 12 * 1024 * 1024);
      keys(value, ['revision', 'patch']);
      keys(value.patch, [
        'profile',
        'note',
        'appearance',
        'devices',
        'wallArt',
      ]);
      const update = async () => {
        if (s.expires <= now() || !sessions.has(s.key))
          throw fail(401, '管理会话已过期，请重新输入暗号。');
        if (value.revision !== state.revision)
          throw fail(409, '另一管理页面已保存新设置，请重新打开编辑器后再试。');
        const previous = state.settings,
          patch = value.patch;
        for (const [key, allowed] of [
          ['appearance', colorKeys],
          ['devices', ['computer', 'tv']],
          ['wallArt', artKeys],
        ])
          if (patch[key] !== undefined) keys(patch[key], allowed);
        const settings = validateSettings({
          ...previous,
          ...patch,
          appearance: { ...previous.appearance, ...patch.appearance },
          devices: { ...previous.devices, ...patch.devices },
          wallArt: { ...previous.wallArt, ...patch.wallArt },
        });
        const next = {
          version: 1,
          revision: state.revision + 1,
          updatedAt: new Date(now()).toISOString(),
          settings,
        };
        const temp = `${file}.${randomBytes(8).toString('hex')}.tmp`;
        try {
          const handle = await open(temp, 'wx', 0o600);
          try {
            await handle.writeFile(JSON.stringify(next));
            await handle.sync();
          } finally {
            await handle.close();
          }
          await rename(temp, file);
        } catch (error) {
          await unlink(temp).catch(() => {});
          throw error;
        }
        state = next;
        send(res, 200, state);
      };
      const pending = writes.then(update);
      writes = pending.catch(() => {});
      await pending;
    } catch (error) {
      if (!res.headersSent)
        send(res, error.status || 500, {
          error: error.status
            ? error.message
            : '服务器暂时无法保存，请稍后重试。',
        });
    }
    return true;
  };
}
