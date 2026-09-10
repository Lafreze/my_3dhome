import type { ActorId } from './life-data';

export type LifeSession = {
  seed: number;
  source: 'server' | 'local';
  serverTime: number | null;
  previous: Partial<Record<ActorId, string>>;
};
const storageKey = 'kuro.life.starts.v1';

/** Resolved before actors are shown, after the base house has already loaded. */
export async function loadLifeSession(): Promise<LifeSession> {
  const session: LifeSession = {
    seed: crypto.getRandomValues(new Uint32Array(1))[0] ^ Date.now(),
    source: 'local',
    serverTime: null,
    previous: {},
  };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved?.version === 1 && saved.nodes && typeof saved.nodes === 'object')
      session.previous = saved.nodes;
  } catch {
    /* Storage may be unavailable; random starts still work. */
  }
  try {
    const response = await fetch('/api/life/seed', {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return session;
    const data = await response.json();
    if (
      data.version === 1 &&
      Number.isInteger(data.seed) &&
      data.seed >= 0 &&
      data.seed <= 0xffffffff &&
      Number.isSafeInteger(data.serverTime)
    ) {
      session.seed = data.seed;
      session.serverTime = data.serverTime;
      session.source = 'server';
    }
  } catch {
    /* Local/offline mode uses the same navigation with a local seed. */
  }
  return session;
}

export function rememberLifeStarts(nodes: Partial<Record<ActorId, string>>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, nodes }));
  } catch {
    /* Persistence is optional. */
  }
}
