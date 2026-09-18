import { DatabaseSync } from 'node:sqlite';
import { mkdir, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyticsSchema } from './studio-database.mjs';
import { visitorIP } from './seat-presence.mjs';
import { createGeolocation } from './visitor-geolocation.mjs';
import { randomBytes } from 'node:crypto';

const roomIds = new Set([
  'study',
  'living',
  'bedroom',
  'gallery',
  'cafe',
  'corridor',
  'gaming',
  'library',
  'garden',
  'bar',
  'exhibit',
]);
const kinds = new Set([
  'start',
  'heartbeat',
  'room',
  'interact',
  'mode',
  'end',
]);
const pageName = (path) =>
  path === '/' || path === '/index.html'
    ? '小屋'
    : path.startsWith('/models/private/') ||
        path === '/model-share' ||
        path === '/model-share.html'
      ? '分享展览'
      : path === '/models' || path === '/models/' || path === '/models.html'
        ? '模型展览'
        : null;
export async function createVisitStore(
  dataDir,
  now = Date.now,
  {
    database = /** @type {Awaited<ReturnType<typeof import('./studio-database.mjs').createStudioDatabase>>} */ (
      null
    ),
    trustRailwayProxy = false,
    locate = null,
  } = {},
) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const file = resolve(dataDir, 'visitor-analytics.sqlite');
  const sqlite = database ? null : new DatabaseSync(file);
  if (sqlite) {
    await chmod(file, 0o600);
    sqlite.exec(
      'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;' + analyticsSchema,
    );
    const cols = sqlite
      .prepare('PRAGMA table_info(page_views)')
      .all()
      .map((c) => c.name);
    for (const column of ['ip', 'location'])
      if (!cols.includes(column))
        sqlite.exec(`ALTER TABLE page_views ADD COLUMN ${column} TEXT`);
  }
  const geolocate = locate || (await createGeolocation());
  const sql = (source) => {
    if (!database) return source;
    let index = 0;
    return source
      .replaceAll('?', () => '$' + ++index)
      .replace('activeSeconds', '"activeSeconds"')
      .replace(
        "strftime('%Y-%m-%d',at/1000,'unixepoch','+9 hours')",
        "to_char(to_timestamp(at/1000.0) AT TIME ZONE 'Asia/Tokyo','YYYY-MM-DD')",
      );
  };
  const query = async (source, params = [], client = null) =>
    database
      ? client
        ? (await client.query(sql(source), params)).rows
        : database.query(sql(source), params)
      : sqlite.prepare(source).all(...params);
  const run = async (source, params = [], client = null) =>
    database
      ? client
        ? client.query(sql(source), params)
        : database.query(sql(source), params)
      : sqlite.prepare(source).run(...params);
  // Serialize SQLite transactions; PostgreSQL uses a connection and row lock per session.
  let writes = Promise.resolve();
  const transaction = (fn) => {
    if (database) return database.transaction(fn);
    const pending = writes.then(async () => {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(null);
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    });
    writes = pending.catch(() => {});
    return pending;
  };
  const identity = (req, res) => {
    const saved = /(?:^|;\s*)studio_visitor=([a-f0-9]{32})(?:;|$)/.exec(
      req.headers.cookie || '',
    )?.[1];
    const id = saved || randomBytes(16).toString('hex');
    if (!saved)
      res.setHeader(
        'Set-Cookie',
        `studio_visitor=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      );
    return id;
  };
  const attempts = new Map();
  function limit(key) {
    const t = now();
    if (attempts.size > 10000)
      for (const [k, v] of attempts) if (v.until < t) attempts.delete(k);
    const v = attempts.get(key);
    if (v && v.until > t) {
      if (++v.count > 180)
        throw Object.assign(Error('记录请求过于频繁。'), { status: 429 });
    } else {
      if (attempts.size >= 20000) attempts.delete(attempts.keys().next().value);
      attempts.set(key, { count: 1, until: t + 60000 });
    }
  }
  return {
    async page(req, res, path) {
      const page = pageName(path);
      if (
        !page ||
        req.method !== 'GET' ||
        req.headers.purpose === 'prefetch' ||
        req.headers['sec-purpose']?.includes('prefetch')
      )
        return;
      const visitor = identity(req, res);
      const ua = String(req.headers['user-agent'] || '').slice(0, 500);
      let source = '直接访问';
      try {
        source = new URL(req.headers.referer).hostname.slice(0, 120);
      } catch {
        /* Direct navigation. */
      }
      const device = /bot|crawler|spider/i.test(ua)
        ? '机器人'
        : /ipad|tablet/i.test(ua)
          ? '平板'
          : /mobile|iphone|android/i.test(ua)
            ? '手机'
            : '电脑';
      const browser = /edg/i.test(ua)
        ? 'Edge'
        : /firefox/i.test(ua)
          ? 'Firefox'
          : /chrome|crios/i.test(ua)
            ? 'Chrome'
            : /safari/i.test(ua)
              ? 'Safari'
              : '其他';
      const ip = visitorIP(req, trustRailwayProxy) || null;
      await transaction((client) =>
        run(
          'INSERT INTO page_views(visitor,at,page,source,device,browser,ip,location) VALUES (?,?,?,?,?,?,?,?)',
          [
            visitor,
            now(),
            page,
            source,
            device,
            browser,
            ip,
            ip ? geolocate(ip) : null,
          ],
          client,
        ),
      );
    },
    async event(req, res, value, rateKey) {
      limit(rateKey);
      if (
        !value ||
        !/^[a-f0-9-]{36}$/.test(value.session || '') ||
        !kinds.has(value.kind) ||
        !Number.isSafeInteger(value.seq) ||
        value.seq < 0 ||
        value.seq > 1000000 ||
        !Number.isFinite(value.active) ||
        value.active < 0 ||
        value.active > 604800
      )
        throw Object.assign(Error('访问记录格式不正确。'), { status: 400 });
      const visitor = identity(req, res),
        t = now();
      const room = roomIds.has(value.room) ? value.room : 'study';
      const mode = value.mode === 'roam' ? 'roam' : 'browse';
      // Only allow object IDs, never typed text, URLs, locations or administrator content.
      const target =
        typeof value.target === 'string' &&
        /^[a-zA-Z0-9._-]{1,64}$/.test(value.target)
          ? value.target
          : '';
      await transaction(async (client) => {
        await run(
          'INSERT INTO visits(id,visitor,started,seen,room,mode) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
          [value.session, visitor, t, t, room, mode],
          client,
        );
        const previous = (
          await query(
            'SELECT * FROM visits WHERE id=?' + (database ? ' FOR UPDATE' : ''),
            [value.session],
            client,
          )
        )[0];
        if (previous.visitor !== visitor)
          throw Object.assign(Error('访问会话不匹配。'), { status: 403 });
        if (value.seq <= previous.seq) return;
        const active = Math.max(
          previous.active,
          Math.min(
            value.active,
            previous.active + Math.min(35, (t - previous.seen) / 1000 + 1),
          ),
        );
        await run(
          'UPDATE visits SET seen=?,active=?,room=?,mode=?,seq=? WHERE id=?',
          [t, active, room, mode, value.seq, value.session],
          client,
        );
        if (value.kind !== 'heartbeat')
          await run(
            'INSERT INTO visit_events(session,at,kind,room,target) VALUES (?,?,?,?,?)',
            [value.session, t, value.kind, room, target],
            client,
          );
      });
    },
    async report({ days = 30, page = 0 } = {}) {
      days = [7, 30, 90, 0].includes(Number(days)) ? Number(days) : 30;
      page = Math.max(
        0,
        Math.min(100000, Number.isSafeInteger(Number(page)) ? Number(page) : 0),
      );
      const since = days ? now() - days * 86400000 : 0;
      const counts = (
        await query(
          'SELECT COUNT(*) views, COUNT(DISTINCT visitor) visitors FROM page_views WHERE at>=?',
          [since],
        )
      )[0];
      const sessions = (
        await query(
          'SELECT COUNT(*) sessions, COALESCE(SUM(active),0) activeSeconds FROM visits WHERE started>=?',
          [since],
        )
      )[0];
      return {
        days,
        page,
        total: counts.views,
        generatedAt: now(),
        ...counts,
        ...sessions,
        storage: database ? 'PostgreSQL' : '本地 SQLite',
        online: (
          await query(
            'SELECT COUNT(DISTINCT visitor) count FROM visits WHERE seen>=?',
            [now() - 45000],
          )
        )[0].count,
        daily: (
          await query(
            "SELECT strftime('%Y-%m-%d',at/1000,'unixepoch','+9 hours') AS day,COUNT(*) views,COUNT(DISTINCT visitor) visitors FROM page_views WHERE at>=? GROUP BY day ORDER BY day DESC LIMIT 90",
            [since],
          )
        ).reverse(),
        rooms: await query(
          "SELECT room,COUNT(*) count FROM visit_events WHERE kind='room' AND at>=? GROUP BY room ORDER BY count DESC",
          [since],
        ),
        interactions: await query(
          "SELECT target,COUNT(*) count FROM visit_events WHERE kind='interact' AND at>=? GROUP BY target ORDER BY count DESC LIMIT 15",
          [since],
        ),
        devices: await query(
          'SELECT device,COUNT(*) count FROM page_views WHERE at>=? GROUP BY device ORDER BY count DESC',
          [since],
        ),
        recent: await query(
          `SELECT p.id, substr(p.visitor,1,10) visitor,p.at,p.page,p.source,p.device,p.browser,p.ip,p.location,
          (SELECT COUNT(*) FROM page_views h WHERE h.visitor=p.visitor) visits FROM page_views p WHERE p.at>=? ORDER BY p.at DESC,p.id DESC LIMIT 30 OFFSET ?`,
          [since, page * 30],
        ),
        activity: await query(
          "SELECT substr(v.visitor,1,10) visitor,v.started,v.seen,v.active,v.room,v.mode,(SELECT COUNT(*) FROM visit_events e WHERE e.session=v.id AND e.kind='interact') interactions FROM visits v WHERE started>=? ORDER BY started DESC LIMIT 30",
          [since],
        ),
      };
    },
    close: async () => {
      await writes;
      sqlite?.close();
    },
  };
}
