import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createStudioDatabase } from './studio-database.mjs';
import { createVisitStore } from './visitor-analytics.mjs';
import { createHouseHandler } from './house-settings.mjs';

const url = process.env.TEST_POSTGRES_URL;
test(
  'PostgreSQL migration, API writes, restart, IP trust and session locking',
  { skip: !url },
  async () => {
    const control = new pg.Pool({ connectionString: url });
    const schema = 'test_' + randomUUID().replaceAll('-', '');
    await control.query(`CREATE SCHEMA ${schema}`);
    const connection = new URL(url);
    connection.searchParams.set('options', `-c search_path=${schema}`);
    const dir = await mkdtemp(join(tmpdir(), 'kuro-pg-'));
    let database, analytics, server;
    const request = (ip = '127.0.0.1', headers = {}) => ({
      method: 'GET',
      headers: { cookie: `studio_visitor=${'c'.repeat(32)}`, ...headers },
      socket: { remoteAddress: ip },
    });
    const response = { setHeader() {} };
    try {
      // Deliberately use the old schema without IP fields.
      const old = new DatabaseSync(join(dir, 'visitor-analytics.sqlite'));
      old.exec(`CREATE TABLE page_views(id INTEGER PRIMARY KEY,visitor TEXT,at INTEGER,page TEXT,source TEXT,device TEXT,browser TEXT);
      INSERT INTO page_views VALUES(12,'cccccccccccccccccccccccccccccccc',${Date.now()},'小屋','直接访问','电脑','Safari');`);
      old.close();
      const house = {
        version: 1,
        revision: 7,
        updatedAt: null,
        settings: JSON.parse(
          await readFile(
            new URL('../config/house-defaults.json', import.meta.url),
            'utf8',
          ),
        ),
      };
      await writeFile(join(dir, 'house-settings.json'), JSON.stringify(house));
      await writeFile(
        join(dir, 'room-notes.json'),
        JSON.stringify({
          version: 1,
          revision: 1,
          notes: [
            {
              id: 'legacy',
              room: 'study',
              text: '迁移前便签',
              author: '小满',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      );
      await mkdir(join(dir, 'model-library'));
      await writeFile(
        join(dir, 'model-library/catalog.json'),
        JSON.stringify({ version: 2, items: [] }),
      );
      database = await createStudioDatabase(dir, connection.href);
      let clock = Date.now();
      analytics = await createVisitStore(dir, () => clock, {
        database,
        trustRailwayProxy: true,
        locate: (ip) => (ip === '8.8.8.8' ? '美国' : '本地 / 内网'),
      });
      await analytics.page(
        request('127.0.0.1', {
          'x-real-ip': '8.8.8.8',
          'x-forwarded-for': '1.1.1.1',
        }),
        response,
        '/',
      );
      let report = await analytics.report();
      assert.equal(report.storage, 'PostgreSQL');
      assert.equal(report.views, 2);
      assert.equal(report.recent[0].id, 13);
      assert.equal(report.recent[0].ip, '8.8.8.8');
      assert.equal(report.recent[0].location, '美国');
      assert.equal(report.recent[1].ip, null);
      assert.equal(
        report.daily.reduce((sum, day) => sum + day.views, 0),
        2,
      );
      const session = randomUUID();
      await analytics.event(
        request(),
        response,
        { session, kind: 'start', seq: 0, active: 0 },
        'test',
      );
      clock += 25000;
      await Promise.all(
        Array.from({ length: 8 }, () =>
          analytics.event(
            request(),
            response,
            {
              session,
              kind: 'interact',
              seq: 1,
              active: 25,
              target: 'cafeEspresso',
            },
            'test',
          ),
        ),
      );
      report = await analytics.report();
      assert.equal(report.interactions[0].count, 1);
      assert.equal(report.activeSeconds, 25);
      await assert.rejects(
        analytics.event(
          request('127.0.0.1', { cookie: `studio_visitor=${'d'.repeat(32)}` }),
          response,
          { session, kind: 'start', seq: 2, active: 26 },
          'test',
        ),
        { status: 403 },
      );
      let handler = await createHouseHandler({
        dataDir: dir,
        database,
        analytics,
        password: 'test-pg-password',
        secureCookies: false,
      });
      server = createServer(async (req, res) => {
        if (!(await handler(req, res))) {
          res.statusCode = 404;
          res.end();
        }
      });
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      const origin = `http://127.0.0.1:${server.address().port}`;
      const login = await fetch(origin + '/api/admin/login', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: 'test-pg-password' }),
      });
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const { csrf } = await login.json();
      const headers = {
        Origin: origin,
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-Studio-Csrf': csrf,
      };
      assert.equal((await fetch(origin + '/api/admin/visits')).status, 401);
      assert.equal(
        (await fetch(origin + '/api/admin/visits', { headers })).status,
        200,
      );
      assert.equal(
        (await (await fetch(origin + '/api/house')).json()).revision,
        7,
      );
      const saved = await fetch(origin + '/api/house', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          revision: 7,
          patch: { note: '数据库里的小屋', appearance: { bed: '#778899' } },
        }),
      });
      assert.equal(saved.status, 200, await saved.text());
      assert.equal(
        (
          await fetch(origin + '/api/house', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ revision: 7, patch: { note: 'stale' } }),
          })
        ).status,
        409,
      );
      const note = await fetch(origin + '/api/notes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          room: 'cafe',
          text: '今天的咖啡很好喝',
          author: '住客',
        }),
      });
      assert.equal(note.status, 201, await note.text());
      assert.equal(
        (await (await fetch(origin + '/api/notes')).json()).notes.length,
        2,
      );
      const uploaded = await fetch(origin + '/api/models', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'model/gltf-binary',
          'X-Model-Metadata': encodeURIComponent(
            JSON.stringify({
              title: '私有测试模型',
              description: '仅用于持久化验证',
              visibility: 'private',
              compress: false,
            }),
          ),
        },
        body: await readFile(
          new URL('../public/models/exhibits/seraph-room.glb', import.meta.url),
        ),
      });
      assert.equal(uploaded.status, 201);
      await uploaded.json();
      const modelDoc = await (
        await database.document('model-library/catalog.json')
      ).read();
      assert.equal(modelDoc.items.length, 1);
      assert.equal(modelDoc.items[0].visibility, 'private');
      assert.equal(
        (await (await fetch(origin + '/api/models')).json()).items.length,
        0,
      );
      assert.equal(
        JSON.parse(
          await readFile(join(dir, 'model-library/catalog.json'), 'utf8'),
        ).items.length,
        0,
      );
      const doc1 = await database.document('test-cas'),
        doc2 = await database.document('test-cas');
      await doc1.write({ value: 1 });
      await doc2.read();
      await doc1.write({ value: 2 });
      await assert.rejects(doc2.write({ value: 3 }), { status: 409 });
      await analytics.close();
      await database.close();
      database = await createStudioDatabase(dir, connection.href);
      analytics = await createVisitStore(dir, () => clock, { database });
      handler = await createHouseHandler({
        dataDir: dir,
        database,
        analytics,
        password: 'test-pg-password',
        secureCookies: false,
      });
      const restoredModels = await (
        await database.document('model-library/catalog.json')
      ).read();
      assert.equal(
        restoredModels.items[0].shareCode,
        modelDoc.items[0].shareCode,
      );
      assert.equal(
        (await fetch(origin + `/api/models/${restoredModels.items[0].id}.glb`))
          .status,
        404,
      );
      assert.equal(
        (
          await fetch(
            origin +
              `/api/model-share/${restoredModels.items[0].shareCode}/file.glb`,
          )
        ).status,
        200,
      );
      assert.equal((await analytics.report()).views, 2);
      assert.equal((await analytics.report()).interactions[0].count, 1);
      const settings = await (
        await database.document('house-settings.json')
      ).read();
      assert.equal(settings.revision, 8);
      assert.equal(settings.settings.note, '数据库里的小屋');
      assert.equal(settings.settings.appearance.bed, '#778899');
      assert.equal(
        JSON.parse(await readFile(join(dir, 'house-settings.json'), 'utf8'))
          .revision,
        7,
      );
      await analytics.page(
        request('127.0.0.1', {
          'x-real-ip': '8.8.8.8',
          'x-forwarded-for': '8.8.8.8',
        }),
        response,
        '/',
      );
      assert.equal((await analytics.report()).recent[0].ip, '127.0.0.1');
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise((r) => server.close(r));
      }
      await analytics?.close();
      await database?.close();
      await control.query(`DROP SCHEMA ${schema} CASCADE`);
      await control.end();
      await rm(dir, { recursive: true, force: true });
    }
  },
);

test(
  'a corrupt legacy document rolls back the entire PostgreSQL migration',
  { skip: !url },
  async () => {
    const control = new pg.Pool({ connectionString: url });
    const schema = 'test_' + randomUUID().replaceAll('-', '');
    await control.query(`CREATE SCHEMA ${schema}`);
    const connection = new URL(url);
    connection.searchParams.set('options', `-c search_path=${schema}`);
    const dir = await mkdtemp(join(tmpdir(), 'kuro-pg-rollback-'));
    try {
      await writeFile(join(dir, 'house-settings.json'), '{corrupt');
      await assert.rejects(
        createStudioDatabase(dir, connection.href),
        SyntaxError,
      );
      const check = await control.query(
        'SELECT table_name FROM information_schema.tables WHERE table_schema=$1',
        [schema],
      );
      assert.equal(check.rowCount, 0);
    } finally {
      await control.query(`DROP SCHEMA ${schema} CASCADE`);
      await control.end();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
