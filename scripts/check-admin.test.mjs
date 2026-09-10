import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHouseHandler } from './house-settings.mjs';

async function fixture(password = 'test-passphrase') {
  const dir = await mkdtemp(join(tmpdir(), 'kuro-admin-'));
  let clock = Date.now();
  const make = () =>
    createHouseHandler({
      dataDir: dir,
      password,
      now: () => clock,
      secureCookies: false,
    });
  let handler = await make();
  const server = createServer((req, res) => void handler(req, res));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = '',
    csrf = '';
  const request = async (path, method = 'GET', data, headers = {}) => {
    const options = {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-Studio-CSRF': csrf,
        ...headers,
      },
    };
    if (method !== 'GET' && data !== undefined)
      options.body = JSON.stringify(data);
    const response = await fetch(origin + path, options);
    return {
      status: response.status,
      headers: response.headers,
      data: await response.json(),
    };
  };
  const login = async () => {
    const r = await request('/api/admin/login', 'POST', {
      passphrase: password,
    });
    cookie = r.headers.get('set-cookie')?.split(';')[0] || '';
    csrf = r.data.csrf;
    return r;
  };
  return {
    dir,
    request,
    login,
    advance: (ms) => (clock += ms),
    restart: async () => {
      handler = await make();
    },
    close: async () => {
      await new Promise((r) => server.close(r));
      await rm(dir, { recursive: true, force: true });
    },
  };
}
test('public read, server-side auth, CSRF and logout protect every write', async () => {
  const f = await fixture();
  try {
    const initial = await f.request('/api/house');
    assert.equal(initial.status, 200);
    assert.equal(initial.data.revision, 0);
    assert(!JSON.stringify(initial).includes('test-passphrase'));
    assert.equal(
      (
        await f.request('/api/house', 'PATCH', {
          revision: 0,
          patch: { note: 'guest' },
        })
      ).status,
      401,
    );
    assert.equal(
      (await f.request('/api/admin/login', 'POST', { passphrase: 'wrong' }))
        .status,
      401,
    );
    const login = await f.login();
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.equal(
      (
        await f.request(
          '/api/house',
          'PATCH',
          { revision: 0, patch: { note: 'bad' } },
          { Origin: 'https://evil.example' },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          '/api/house',
          'PATCH',
          { revision: 0, patch: { note: 'bad' } },
          { 'X-Studio-CSRF': 'bad' },
        )
      ).status,
      403,
    );
    const saved = await f.request('/api/house', 'PATCH', {
      revision: 0,
      patch: {
        note: '大家都能看见的随笔',
        devices: { computer: { url: 'https://example.com', enabled: true } },
        appearance: { livingSofa: 2 },
      },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.revision, 1);
    assert.equal(
      (await f.request('/api/admin/logout', 'POST', {})).status,
      200,
    );
    assert.equal(
      (
        await f.request('/api/house', 'PATCH', {
          revision: 1,
          patch: { note: 'guest' },
        })
      ).status,
      401,
    );
    await f.restart();
    const restored = await f.request('/api/house');
    assert.equal(restored.data.settings.note, saved.data.settings.note);
    assert.equal(
      restored.data.settings.devices.computer.url,
      'https://example.com/',
    );
    assert.equal(restored.data.settings.appearance.livingSofa, 2);
    assert(
      !String(await readFile(join(f.dir, 'house-settings.json'))).includes(
        'test-passphrase',
      ),
    );
  } finally {
    await f.close();
  }
});
test('validation rejects scripts, fake images, unknown fields and stale revisions; concurrent saves serialize', async () => {
  const f = await fixture();
  try {
    await f.login();
    for (const patch of [
      { devices: { tv: { url: 'javascript:alert(1)', enabled: true } } },
      { appearance: { rug: 99 } },
      { wallArt: { galleryArt1: 'data:image/png;base64,PHN2Zz4=' } },
      { secret: 'leak' },
      JSON.parse('{"__proto__":{"admin":true}}'),
    ])
      assert.equal(
        (await f.request('/api/house', 'PATCH', { revision: 0, patch })).status,
        400,
      );
    const outcomes = await Promise.all(
      ['one', 'two'].map((note) =>
        f.request('/api/house', 'PATCH', { revision: 0, patch: { note } }),
      ),
    );
    assert.deepEqual(
      outcomes.map((r) => r.status).sort((a, b) => a - b),
      [200, 409],
    );
    const latest = await f.request('/api/house');
    assert.equal(latest.data.revision, 1);
    f.advance(8 * 3600000 + 1);
    assert.equal(
      (
        await f.request('/api/house', 'PATCH', {
          revision: 1,
          patch: { note: 'expired' },
        })
      ).status,
      401,
    );
  } finally {
    await f.close();
  }
});
test('login throttles guesses and missing environment password fails closed', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await f.request('/api/admin/login', 'POST', { passphrase: 'wrong' }))
          .status,
        401,
      );
    assert.equal((await f.login()).status, 429);
    f.advance(900001);
    assert.equal((await f.login()).status, 200);
  } finally {
    await f.close();
  }
  const disabled = await fixture('');
  try {
    assert.equal((await disabled.login()).status, 503);
  } finally {
    await disabled.close();
  }
});

test('study artwork and arbitrary valid furniture colors persist across restart and remain public read-only', async () => {
  const f = await fixture();
  try {
    await f.login();
    const initial = await f.request('/api/house');
    const patch = {
      wallArt: {
        studyArt1: 'asset:art.quiet-hills',
        studyArt2: 'asset:art.evening-window',
        studyArt3: 'asset:art.botanical-study',
      },
      appearance: { bed: '#527a60' },
    };
    const saved = await f.request('/api/house', 'PATCH', {
      revision: initial.data.revision,
      patch,
    });
    assert.equal(saved.status, 200);
    await f.restart();
    const publicRead = await f.request('/api/house');
    assert.deepEqual(publicRead.data.settings.wallArt, patch.wallArt);
    assert.equal(publicRead.data.settings.appearance.bed, '#527a60');
    assert.equal(
      (
        await f.request('/api/house', 'PATCH', {
          revision: publicRead.data.revision,
          patch: { wallArt: { studyArt1: null } },
        })
      ).status,
      401,
    );
  } finally {
    await f.close();
  }
});
