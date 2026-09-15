import { DatabaseSync } from 'node:sqlite';
import { mkdir, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
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
export async function createVisitStore(dataDir, now = Date.now) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const file = resolve(dataDir, 'visitor-analytics.sqlite');
  const db = new DatabaseSync(file);
  await chmod(file, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS page_views (id INTEGER PRIMARY KEY, visitor TEXT NOT NULL, at INTEGER NOT NULL, page TEXT NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL, browser TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS views_at ON page_views(at);
    CREATE INDEX IF NOT EXISTS views_visitor ON page_views(visitor);
    CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, visitor TEXT NOT NULL, started INTEGER NOT NULL, seen INTEGER NOT NULL, active REAL NOT NULL DEFAULT 0, room TEXT NOT NULL, mode TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT -1);
    CREATE INDEX IF NOT EXISTS visits_started ON visits(started);
    CREATE TABLE IF NOT EXISTS visit_events (id INTEGER PRIMARY KEY, session TEXT NOT NULL, at INTEGER NOT NULL, kind TEXT NOT NULL, room TEXT NOT NULL, target TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS events_session ON visit_events(session, at);
    CREATE INDEX IF NOT EXISTS events_at ON visit_events(at);`);
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
    page(req, res, path) {
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
      db.prepare(
        'INSERT INTO page_views(visitor,at,page,source,device,browser) VALUES (?,?,?,?,?,?)',
      ).run(visitor, now(), page, source, device, browser);
    },
    event(req, res, value, rateKey) {
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
      db.prepare(
        'INSERT OR IGNORE INTO visits(id,visitor,started,seen,room,mode) VALUES (?,?,?,?,?,?)',
      ).run(value.session, visitor, t, t, room, mode);
      const previous = db
        .prepare('SELECT * FROM visits WHERE id=?')
        .get(value.session);
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
      db.exec('BEGIN');
      try {
        db.prepare(
          'UPDATE visits SET seen=?,active=?,room=?,mode=?,seq=? WHERE id=?',
        ).run(t, active, room, mode, value.seq, value.session);
        if (value.kind !== 'heartbeat')
          db.prepare(
            'INSERT INTO visit_events(session,at,kind,room,target) VALUES (?,?,?,?,?)',
          ).run(value.session, t, value.kind, room, target);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    report({ days = 30, page = 0 } = {}) {
      days = [7, 30, 90, 0].includes(Number(days)) ? Number(days) : 30;
      page = Math.max(
        0,
        Math.min(100000, Number.isSafeInteger(Number(page)) ? Number(page) : 0),
      );
      const since = days ? now() - days * 86400000 : 0;
      const counts = db
        .prepare(
          'SELECT COUNT(*) views, COUNT(DISTINCT visitor) visitors FROM page_views WHERE at>=?',
        )
        .get(since);
      const sessions = db
        .prepare(
          'SELECT COUNT(*) sessions, COALESCE(SUM(active),0) activeSeconds FROM visits WHERE started>=?',
        )
        .get(since);
      const total = db
        .prepare('SELECT COUNT(*) total FROM page_views WHERE at>=?')
        .get(since).total;
      return {
        days,
        page,
        total,
        generatedAt: now(),
        ...counts,
        ...sessions,
        online: db
          .prepare(
            'SELECT COUNT(DISTINCT visitor) count FROM visits WHERE seen>=?',
          )
          .get(now() - 45000).count,
        daily: db
          .prepare(
            "SELECT strftime('%Y-%m-%d',at/1000,'unixepoch','+9 hours') day,COUNT(*) views,COUNT(DISTINCT visitor) visitors FROM page_views WHERE at>=? GROUP BY day ORDER BY day DESC LIMIT 90",
          )
          .all(since)
          .reverse(),
        rooms: db
          .prepare(
            "SELECT room, COUNT(*) count FROM visit_events WHERE kind='room' AND at>=? GROUP BY room ORDER BY count DESC",
          )
          .all(since),
        interactions: db
          .prepare(
            "SELECT target,COUNT(*) count FROM visit_events WHERE kind='interact' AND at>=? GROUP BY target ORDER BY count DESC LIMIT 15",
          )
          .all(since),
        devices: db
          .prepare(
            'SELECT device,COUNT(*) count FROM page_views WHERE at>=? GROUP BY device ORDER BY count DESC',
          )
          .all(since),
        recent: db
          .prepare(`SELECT p.id, substr(p.visitor,1,10) visitor, p.at, p.page, p.source, p.device, p.browser,
          (SELECT COUNT(*) FROM page_views h WHERE h.visitor=p.visitor) visits
          FROM page_views p WHERE p.at>=? ORDER BY p.at DESC,p.id DESC LIMIT 30 OFFSET ?`)
          .all(since, page * 30),
        activity: db
          .prepare(
            "SELECT substr(v.visitor,1,10) visitor,v.started,v.seen,v.active,v.room,v.mode, (SELECT COUNT(*) FROM visit_events e WHERE e.session=v.id AND e.kind='interact') interactions FROM visits v WHERE started>=? ORDER BY started DESC LIMIT 30",
          )
          .all(since),
      };
    },
    close: () => db.close(),
  };
}
