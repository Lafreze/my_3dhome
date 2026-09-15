import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createVisitStore } from './visitor-analytics.mjs';
import { createHouseHandler } from './house-settings.mjs';

void test('visit records persist; only a valid unexpired administrator session can read them', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kuro-visits-'));
  let clock = Date.now();
  let analytics = await createVisitStore(dir, () => clock);
  const handler = await createHouseHandler({
    dataDir: dir,
    password: 'test-visits-password',
    analytics,
    secureCookies: false,
    now: () => clock,
  });
  const server = createServer(async (req, res) => {
    if (await handler(req, res)) return;
    try {
      analytics.page(req, res, new URL(req.url, 'http://local').pathname);
    } catch {
      res.statusCode = 500;
    }
    res.end('hello');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const sid = randomUUID();
  let visitorCookie = '',
    adminCookie = '';
  const event = (data, headers = {}) =>
    fetch(origin + '/api/visits', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: visitorCookie,
        ...headers,
      },
      body: JSON.stringify({
        session: sid,
        kind: 'start',
        seq: 0,
        active: 0,
        room: 'study',
        ...data,
      }),
    });
  try {
    const landing = await fetch(origin + '/', {
      headers: {
        Referer: 'https://example.test/private?token=secret',
        'User-Agent': 'Mozilla/5.0 (iPhone) Mobile Safari',
      },
    });
    visitorCookie = landing.headers.get('set-cookie').split(';')[0];
    assert.match(landing.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
    assert.equal((await event({})).status, 200);
    clock += 25000;
    assert.equal(
      (await event({ kind: 'heartbeat', seq: 1, active: 25 })).status,
      200,
    );
    clock += 1000;
    assert.equal(
      (await event({ kind: 'room', seq: 2, active: 26, room: 'cafe' })).status,
      200,
    );
    assert.equal(
      (
        await event({
          kind: 'interact',
          seq: 3,
          active: 26,
          target: 'cafeEspresso',
        })
      ).status,
      200,
    );
    await event({
      kind: 'interact',
      seq: 3,
      active: 26,
      target: 'cafeEspresso',
    });
    assert.equal(
      (await event({ kind: 'mode', seq: 4, mode: 'roam', active: 9000 }))
        .status,
      200,
    );
    assert.equal(
      (await event({ seq: 5 }, { Origin: 'https://evil.test' })).status,
      403,
    );
    assert.equal(
      (await event({ seq: 5 }, { Cookie: `studio_visitor=${'b'.repeat(32)}` }))
        .status,
      403,
    );
    assert.equal((await event({ session: '../secret', seq: 5 })).status, 400);
    assert.equal(
      (await event({ target: 'x'.repeat(3000), seq: 5 })).status,
      413,
    );
    assert.equal((await fetch(origin + '/api/visits')).status, 405);
    assert.equal((await fetch(origin + '/api/admin/visits')).status, 401);
    assert.equal(
      (
        await fetch(origin + '/api/admin/visits', {
          headers: { Cookie: `studio_admin=${'a'.repeat(64)}` },
        })
      ).status,
      401,
    );
    const login = await fetch(origin + '/api/admin/login', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: 'test-visits-password' }),
    });
    adminCookie = login.headers.get('set-cookie').split(';')[0];
    const response = await fetch(origin + '/api/admin/visits', {
      headers: { Cookie: adminCookie },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const report = await response.json();
    assert.equal(report.views, 1);
    assert.equal(report.visitors, 1);
    assert.equal(report.sessions, 1);
    assert.equal(report.interactions[0].count, 1);
    assert.equal(report.devices[0].device, '手机');
    assert(report.activeSeconds <= 29);
    assert.equal(report.activity[0].mode, 'roam');
    assert.equal(report.recent[0].source, 'example.test');
    assert(!JSON.stringify(report).includes('token'));
    assert(!JSON.stringify(report).includes('127.0.0.1'));
    for (let i = 0; i < 34; i++)
      await fetch(origin + '/', { headers: { Cookie: visitorCookie } });
    assert.equal(analytics.report({ page: 1 }).recent.length, 5);
    assert.equal(analytics.report({ page: 0 }).visitors, 1);
    assert.equal(analytics.report({ page: 'bad' }).recent.length, 30);
    const before = analytics.report();
    analytics.close();
    analytics = await createVisitStore(dir, () => clock);
    assert.deepEqual(analytics.report(), before);
    const raw = (
      await readFile(join(dir, 'visitor-analytics.sqlite'))
    ).toString('utf8');
    assert(!raw.includes('token=secret'));
    assert(!raw.includes('test-visits-password'));
    clock += 9 * 3600000;
    assert.equal(
      (
        await fetch(origin + '/api/admin/visits', {
          headers: { Cookie: adminCookie },
        })
      ).status,
      401,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    analytics.close();
    await rm(dir, { recursive: true, force: true });
  }
});
