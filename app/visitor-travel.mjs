import routes from '../config/visitor-routes.json' with { type: 'json' };
export const visitorTravelNodes = routes.nodes;
export const footLift = {
  bear: 0.46098,
  cat: 0.47743,
  fox: 0.30373,
  noir: 0.4021,
  rose: 0.38518,
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const blend = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const ease = (t) => t * t * (3 - 2 * t);
const angle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
/** Server-issued, immutable itinerary. No client-supplied coordinates or durations. */
export function createVisitorJourney(
  fromSeat,
  toSeat,
  fromPosture,
  toPosture,
  at,
) {
  const from = routes.nodes[fromSeat],
    to = routes.nodes[toSeat];
  if (!from || !to) return null;
  let path = routes.routes[`${fromSeat}|${toSeat}`];
  if (!path) path = routes.routes[`${toSeat}|${fromSeat}`]?.toReversed();
  if (fromSeat === toSeat) path = [];
  if (!path) return null;
  const walk =
    path.slice(1).reduce((sum, p, i) => sum + dist(path[i], p), 0) / 0.72;
  const exit = path.length
    ? Math.max(1.4, dist(from.position, from.approach) / 0.46)
    : 0;
  const enter = path.length
    ? Math.max(1.4, dist(to.position, to.approach) / 0.46)
    : 0;
  const rise = fromPosture === 'rest' ? 3.0 : 1.6,
    settle = toPosture === 'rest' ? 3.2 : 1.8;
  return {
    fromSeat,
    toSeat,
    fromPosture,
    toPosture,
    at,
    path,
    rise,
    exit,
    walk,
    enter,
    settle,
    duration: (rise + exit + walk + enter + settle) * 1000,
  };
}
export function sampleVisitorJourney(journey, now, character = 'bear') {
  const j = journey,
    from = routes.nodes[j.fromSeat],
    to = routes.nodes[j.toSeat];
  const total = Math.max(0, (now - j.at) / 1000),
    floor = 0.085 + footLift[character];
  const base = {
    position: [...from.position],
    yaw: from.yaw,
    stand: 0,
    rest: 0,
    gait: 0,
    moving: true,
    phase: 'rise',
    seatId: j.fromSeat,
  };
  let t = total;
  if (!j.path.length) {
    const v = ease(Math.min(1, total / (j.rise + j.settle)));
    return {
      ...base,
      position: blend(from.position, to.position, v),
      stand: j.toPosture === 'rest' ? v : 1 - v,
      rest: j.toPosture === 'rest' ? v : 1 - v,
      moving: v < 1,
      phase: v < 1 ? 'settle' : 'seated',
      seatId: j.toSeat,
    };
  }
  if (t < j.rise) {
    const v = ease(t / j.rise);
    return {
      ...base,
      stand: j.fromPosture === 'rest' ? 1 : v,
      rest: j.fromPosture === 'rest' ? 1 - v : 0,
      position: blend(
        from.position,
        [
          from.position[0],
          Math.max(from.position[1], floor) + 0.12,
          from.position[2],
        ],
        v,
      ),
    };
  }
  t -= j.rise;
  const start = [
      from.position[0],
      Math.max(from.position[1], floor) + 0.12,
      from.position[2],
    ],
    a = [from.approach[0], floor, from.approach[2]];
  const exitYaw = Math.atan2(a[0] - start[0], a[2] - start[2]);
  if (t < j.exit) {
    const v = ease(t / j.exit);
    return {
      ...base,
      stand: 1,
      phase: 'exit',
      position: blend(start, a, v),
      yaw: angle(from.yaw, exitYaw, Math.min(1, v * 3)),
      gait: ((t * 0.46) / 0.36) * Math.PI * 2,
    };
  }
  t -= j.exit;
  if (t < j.walk) {
    let remaining = t * 0.72;
    for (let i = 1; i < j.path.length; i++) {
      const a = j.path[i - 1],
        b = j.path[i],
        length = dist(a, b);
      if (remaining <= length) {
        const v = length ? remaining / length : 1,
          p = blend(a, b, v);
        p[1] = floor;
        const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
        const prev =
          i > 1
            ? Math.atan2(a[0] - j.path[i - 2][0], a[2] - j.path[i - 2][2])
            : exitYaw;
        return {
          ...base,
          stand: 1,
          phase: 'walk',
          position: p,
          yaw: angle(prev, yaw, Math.min(1, remaining / 0.16)),
          gait: ((j.exit * 0.46 + t * 0.72) / 0.36) * Math.PI * 2,
        };
      }
      remaining -= length;
    }
  }
  t -= j.walk;
  const end = [
      to.position[0],
      Math.max(to.position[1], floor) + 0.12,
      to.position[2],
    ],
    b = [to.approach[0], floor, to.approach[2]];
  const entryYaw = Math.atan2(end[0] - b[0], end[2] - b[2]);
  if (t < j.enter) {
    const v = ease(t / j.enter);
    return {
      ...base,
      stand: 1,
      phase: 'enter',
      seatId: j.toSeat,
      position: blend(b, end, v),
      yaw: angle(entryYaw, to.yaw, v),
      gait: ((j.exit * 0.46 + j.walk * 0.72 + t * 0.46) / 0.36) * Math.PI * 2,
    };
  }
  t -= j.enter;
  const v = ease(Math.min(1, t / j.settle));
  return {
    ...base,
    phase: v < 1 ? 'settle' : 'seated',
    seatId: j.toSeat,
    position: blend(end, to.position, v),
    yaw: to.yaw,
    stand: j.toPosture === 'rest' ? 1 : 1 - v,
    rest: j.toPosture === 'rest' ? v : 0,
    moving: v < 1,
  };
}
