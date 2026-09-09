import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  IMMUTABLE,
  MANIFEST_CACHE,
  publicManifest,
  sha256,
} from './lib/asset-policy.mjs';

export async function verifyAssets({
  base = 'https://assets.kuro.cafe/kuro',
  manifest,
  fetcher = fetch,
  cors = true,
}) {
  const expected = publicManifest(manifest),
    checks = [],
    failures = [];
  const check = (ok, label) => {
    checks.push({ check: label, passed: !!ok });
    if (!ok) failures.push(label);
  };
  const request = (suffix, options = {}) =>
    fetcher(`${base.replace(/\/+$/, '')}/${suffix}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      ...options,
      headers: { 'Accept-Encoding': 'identity', ...options.headers },
    });
  try {
    const response = await request('manifests/assets.json', {
      headers: { 'Cache-Control': 'no-cache', Origin: 'https://kuro.cafe' },
    });
    check(response.status === 200, 'Manifest GET');
    check(
      response.headers.get('cache-control') === MANIFEST_CACHE,
      'Manifest cache = 300 seconds',
    );
    check(
      response.headers.get('content-type')?.split(';')[0] ===
        'application/json',
      'Manifest MIME',
    );
    const actual = await response.json();
    check(
      actual.version === expected.version &&
        JSON.stringify(actual.assets) === JSON.stringify(expected.assets),
      'Manifest matches this release and excludes unapproved assets',
    );
    const sample = new Map();
    for (const [id, entry] of Object.entries(
      cors ? expected.assets : manifest.assets,
    )) {
      const head = await request(entry.path, {
        method: 'HEAD',
        headers: { Origin: 'https://kuro.cafe' },
      });
      check(head.status === 200, `${id}: HEAD`);
      check(
        head.headers.get('content-type')?.split(';')[0] === entry.contentType,
        `${id}: MIME ${entry.contentType}`,
      );
      check(
        head.headers.get('cache-control') === IMMUTABLE,
        `${id}: immutable cache`,
      );
      check(
        Number(head.headers.get('content-length')) === entry.size,
        `${id}: size`,
      );
      check(!!head.headers.get('etag'), `${id}: ETag`);
      if (cors)
        check(
          head.headers.get('access-control-allow-origin') ===
            'https://kuro.cafe',
          `${id}: HEAD CORS`,
        );
      if (!sample.has(path.extname(entry.path)))
        sample.set(path.extname(entry.path), entry);
    }
    for (const [ext, entry] of sample) {
      const response = await request(entry.path, {
        headers: { Origin: 'https://kuro.cafe' },
      });
      check(
        response.status === 200 &&
          sha256(Buffer.from(await response.arrayBuffer())) === entry.sha256,
        `${ext}: GET body hash`,
      );
      const range = await request(entry.path, {
        headers: { Range: 'bytes=0-15', Origin: 'https://kuro.cafe' },
      });
      check(
        range.status === 206 &&
          range.headers.get('content-range') === `bytes 0-15/${entry.size}` &&
          (await range.arrayBuffer()).byteLength === 16,
        `${ext}: Range 206`,
      );
    }
    const entry = Object.values(expected.assets)[0];
    if (!entry) throw new Error('No approved production assets');
    if (cors) {
      for (const origin of [
        'https://kuro.cafe',
        'https://www.kuro.cafe',
        'http://localhost:3000',
        'http://localhost:5173',
      ]) {
        const response = await request(entry.path, {
          method: 'GET',
          headers: { Origin: origin },
        });
        check(
          response.headers.get('access-control-allow-origin') === origin,
          `Allowed Origin: ${origin}`,
        );
        await response.body?.cancel();
      }
      // Warm approved origins first to detect accidental cross-origin cache leakage.
      const forbidden = await request(entry.path, {
        headers: { Origin: 'https://unapproved.invalid' },
      });
      check(
        !forbidden.headers.has('access-control-allow-origin'),
        'Unapproved Origin has no ACAO',
      );
      await forbidden.body?.cancel();
      const preflight = await request(entry.path, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://kuro.cafe',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Range',
        },
      });
      check(
        preflight.ok &&
          preflight.headers
            .get('access-control-allow-methods')
            ?.includes('GET'),
        'Range preflight GET',
      );
      const write = await request(entry.path, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://kuro.cafe',
          'Access-Control-Request-Method': 'PUT',
        },
      });
      check(
        !write.headers.get('access-control-allow-methods')?.includes('PUT'),
        'No anonymous write CORS permission',
      );
      const root = new URL(base).origin;
      for (const suffix of ['/', '/?list-type=2', '/kuro/', '/kuro/models/']) {
        const response = await fetcher(root + suffix, {
          redirect: 'error',
          signal: AbortSignal.timeout(20000),
        });
        const body = await response.text();
        check(
          [403, 404].includes(response.status) &&
            !/ListBucketResult|<Contents>|Index of\s*\//i.test(body),
          `No directory listing: ${suffix}`,
        );
      }
      const repeated = await request(entry.path, { method: 'HEAD' });
      checks.push({
        check: 'CDN cache observation',
        value: repeated.headers.get('cf-cache-status') || 'not exposed',
      });
    }
  } catch (error) {
    check(
      false,
      `Verification unavailable: ${error.cause?.code || error.name}`,
    );
  }
  return {
    base,
    release: expected.version,
    checkedAt: new Date().toISOString(),
    checks,
    failures,
    pendingModels: Object.entries(manifest.assets)
      .filter(([, a]) => !a.publish)
      .map(([id]) => id),
    audioVideo: Object.values(expected.assets).some(
      (a) => a.type === 'audio' || a.type === 'video',
    )
      ? 'checked by type sample'
      : 'not applicable: project synthesizes music with Web Audio and plays user-selected external video',
  };
}
async function main() {
  const { values } = parseArgs({ options: { base: { type: 'string' } } });
  const base =
    values.base ||
    process.env.VITE_ASSET_BASE_URL ||
    'https://assets.kuro.cafe/kuro';
  if (
    new URL(base).origin !== 'https://assets.kuro.cafe' ||
    new URL(base).pathname.replace(/\/$/, '') !== '/kuro'
  )
    throw new Error(
      'Production verification requires https://assets.kuro.cafe/kuro',
    );
  const manifest = JSON.parse(
    await readFile('app/generated/asset-manifest.json', 'utf8'),
  );
  const result = await verifyAssets({ base, manifest });
  await mkdir('output', { recursive: true });
  await writeFile(
    'output/r2-verification.json',
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length) process.exitCode = 1;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch(() => {
    console.error('R2 verification failed; check configuration.');
    process.exitCode = 1;
  });
