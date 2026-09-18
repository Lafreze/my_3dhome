import { open } from 'maxmind';
import { BlockList, isIP } from 'node:net';
import { resolve } from 'node:path';

const local = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
])
  local.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
])
  local.addSubnet(address, prefix, 'ipv6');
let loaded;
export async function createGeolocation(
  file = process.env.STUDIO_GEOIP_FILE || resolve('output/geoip/city.mmdb'),
) {
  if (!loaded)
    loaded = open(file).catch((error) => {
      if (process.env.STUDIO_GEOIP_FILE || error.code !== 'ENOENT') throw error;
      return null; // Local development can run without the optional city database.
    });
  const reader = await loaded;
  const name = (value) => value?.names?.['zh-CN'] || value?.names?.en || '';
  const cache = new Map();
  return (ip) => {
    const family = isIP(ip);
    if (!family) return '归属地未知';
    if (local.check(ip, family === 6 ? 'ipv6' : 'ipv4')) return '本地 / 内网';
    if (cache.has(ip)) return cache.get(ip);
    const record = reader?.get(ip);
    const value =
      [
        ...new Set(
          [
            name(record?.country),
            ...(record?.subdivisions || []).map(name),
            name(record?.city),
          ].filter(Boolean),
        ),
      ].join(' · ') || '归属地未知';
    if (cache.size >= 4096) cache.delete(cache.keys().next().value);
    cache.set(ip, value);
    return value;
  };
}
