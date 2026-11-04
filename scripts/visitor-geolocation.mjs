import { fork } from 'node:child_process';
import { access } from 'node:fs/promises';
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
export async function createGeolocation(
  file = process.env.STUDIO_GEOIP_FILE || resolve('output/geoip/city.mmdb'),
  { idleMs = 60000, timeoutMs = 10000 } = {},
) {
  let available = true;
  try {
    await access(file);
  } catch (error) {
    if (process.env.STUDIO_GEOIP_FILE || error.code !== 'ENOENT') throw error;
    available = false;
  }
  let worker,
    idleTimer,
    serial = 0,
    closed = false;
  const cache = new Map(),
    pending = new Map();
  const stop = () => {
    clearTimeout(idleTimer);
    const previous = worker;
    worker = undefined;
    for (const task of pending.values()) {
      clearTimeout(task.timer);
      task.resolve('归属地未知');
    }
    pending.clear();
    if (!previous || previous.exitCode !== null || previous.signalCode !== null)
      return;
    return new Promise((resolve) => {
      previous.once('exit', resolve);
      previous.kill();
    });
  };
  const idle = () => {
    if (pending.size) return;
    worker?.unref();
    worker?.channel?.unref();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(stop, idleMs);
    idleTimer.unref();
  };
  const start = () => {
    if (worker) return;
    const current = fork(
      new URL('./visitor-geolocation-reader.mjs', import.meta.url),
      [file],
      { execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
    );
    worker = current;
    current.on('message', ({ id, location }) => {
      if (worker !== current) return;
      const task = pending.get(id);
      if (!task) return;
      clearTimeout(task.timer);
      pending.delete(id);
      task.resolve(location);
      idle();
    });
    current.on('error', () => {
      if (worker !== current) return;
      console.error(
        'IP location reader unavailable; IP recording remains active.',
      );
      void stop();
    });
    current.on('exit', () => {
      if (worker === current) void stop();
    });
  };
  const locate = async (ip) => {
    const family = isIP(ip);
    if (!family) return '归属地未知';
    if (local.check(ip, family === 6 ? 'ipv6' : 'ipv4')) return '本地 / 内网';
    if (!available || closed) return '归属地未知';
    if (cache.has(ip)) return cache.get(ip);
    // Share concurrent lookups for the same address as well as completed results.
    const result = (async () => {
      clearTimeout(idleTimer);
      start();
      worker.ref();
      worker.channel?.ref();
      const location = await new Promise((resolve) => {
        const id = ++serial;
        const timer = setTimeout(() => {
          void stop();
        }, timeoutMs);
        pending.set(id, { resolve, timer });
        const current = worker;
        current.send({ id, ip }, (error) => {
          if (error && worker === current) void stop();
        });
      });
      if (location === '归属地未知') cache.delete(ip);
      return location;
    })();
    if (cache.size >= 1024) cache.delete(cache.keys().next().value);
    cache.set(ip, result);
    return result;
  };
  locate.close = async () => {
    closed = true;
    cache.clear();
    await stop();
  };
  locate.snapshot = () => ({
    loaded: !!worker,
    pid: worker?.pid ?? null,
    pending: pending.size,
    cached: cache.size,
  });
  return locate;
}
