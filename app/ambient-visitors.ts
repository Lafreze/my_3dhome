import catalog from './seat-catalog.json' with { type: 'json' };
import type { Seat, Visitor } from './seat-data';
const seats = catalog as Seat[];
import { readAppearance, type Character } from './visitor-appearance.ts';

// Local residents never enter presence, visit statistics, or seat reservations.
export function createAmbientVisitors(seed = Math.random() * 0xffffffff) {
  let state = seed >>> 0;
  const random = () =>
    (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  const choose = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const characters: Character[] = ['noir', 'rose', 'ivory', 'dusk', 'ribbon'];
  const palettes = [
    { hairColor: '#b6a397', topColor: '#727e72', bottomColor: '#514a45' },
    { hairColor: '#9e8caa', topColor: '#8a7180', bottomColor: '#514653' },
    { hairColor: '#d6bc9d', topColor: '#718a9b', bottomColor: '#465569' },
    { hairColor: '#b99183', topColor: '#a58365', bottomColor: '#665448' },
  ];
  let guests: (Visitor & { until: number })[] = [];
  let nextCheck = 0,
    serial = 0;
  return {
    update(
      now: number,
      room: string,
      people: Visitor[],
      residentSeat?: string | null,
      paused = false,
      force = false,
    ) {
      if (paused || (!force && now < nextCheck)) return null;
      nextCheck = now + 1500;
      const blocked = new Set(
        people.flatMap((p) => [p.seatId, p.journey?.fromSeat]).filter(Boolean),
      );
      if (residentSeat) blocked.add(residentSeat);
      const previous = guests.map((g) => g.id).join();
      // Rotate only out of sight; real visitors always take priority.
      guests = guests.filter(
        (g) =>
          !blocked.has(g.seatId) &&
          (g.until > now ||
            seats.find((s) => s.id === g.seatId)?.room === room),
      );
      for (const g of guests) blocked.add(g.seatId);
      while (guests.length < 3) {
        const free = seats.filter(
          (s) =>
            s.kind !== 'bed' &&
            !blocked.has(s.id) &&
            !['bedroom', 'corridor', 'gallery'].includes(s.room),
        );
        const local = free.filter((s) => s.room === room);
        const hasLocal = guests.some(
          (g) => seats.find((s) => s.id === g.seatId)?.room === room,
        );
        const seat = choose(!hasLocal && local.length ? local : free);
        if (!seat) break;
        const id = `ambient-${++serial}`;
        guests.push({
          id,
          name: `${choose(['小满', '清禾', '阿遥', '桃桃', '木木', '小凪'])} · 住客`,
          seatId: seat.id,
          appearance: readAppearance({
            character: choose(
              characters.filter(
                (c) => !guests.some((g) => g.appearance?.character === c),
              ),
            ),
            ...choose(
              palettes.filter(
                (p) =>
                  !guests.some((g) => g.appearance?.topColor === p.topColor),
              ),
            ),
          }),
          posture: 'sit',
          gesture: {
            id: `${id}-reading`,
            kind:
              seat.room === 'study' || seat.room === 'library'
                ? 'readBook'
                : 'coffee',
            at: now + 1800,
            expiresAt: now + 30000 + random() * 40000,
          },
          until: now + 180000 + random() * 180000,
        });
        blocked.add(seat.id);
      }
      return previous === guests.map((g) => g.id).join()
        ? null
        : guests.map(({ until: _until, ...guest }) => guest);
    },
  };
}
