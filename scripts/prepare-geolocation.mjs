import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const config = JSON.parse(
  await readFile(
    new URL('../config/geolocation.json', import.meta.url),
    'utf8',
  ),
);
const file = new URL('../output/geoip/city.mmdb', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
let ready = false;
try {
  ready = hash(await readFile(file)) === config.unpackedSha256;
} catch {
  /* First build. */
}
if (!ready) {
  const response = await fetch(config.url, {
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) throw Error(`GeoIP download failed: ${response.status}`);
  const compressed = Buffer.from(await response.arrayBuffer());
  if (hash(compressed) !== config.sha256)
    throw Error('GeoIP download checksum mismatch');
  const content = gunzipSync(compressed);
  if (hash(content) !== config.unpackedSha256)
    throw Error('GeoIP database checksum mismatch');
  await mkdir(new URL('../output/geoip/', import.meta.url), {
    recursive: true,
  });
  const temporary = new URL('./city.mmdb.tmp', file);
  await writeFile(temporary, content);
  await rename(temporary, file);
}
console.log(
  `GeoIP database verified: ${config.provider} ${config.release} (${config.license})`,
);
