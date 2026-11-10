const distance = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function cornerPoints(a, b, c, cut) {
  if (!cut) return [[...b]];
  const entry = mix(b, a, cut / distance(a, b));
  const exit = mix(b, c, cut / distance(b, c));
  const steps = Math.max(6, Math.ceil((cut * 2) / 0.035));
  return Array.from({ length: steps + 1 }, (_, n) => {
    const t = n / steps;
    return mix(mix(entry, b, t), mix(b, exit, t), t).map((v) => +v.toFixed(5));
  });
}

/** Store only verified corner radii, keeping the shared all-house catalogue small. */
export function expandWalkingPath(path, cuts = []) {
  if (path.length < 3) return path.map((p) => [...p]);
  const points = [[...path[0]]];
  for (let i = 1; i < path.length - 1; i++)
    points.push(
      ...cornerPoints(path[i - 1], path[i], path[i + 1], cuts[i] || 0),
    );
  points.push([...path.at(-1)]);
  return points.filter((p, i) => !i || distance(p, points[i - 1]) > 0.00001);
}

/** Round only corners whose complete swept path passes the supplied clearance check. */
export function walkingCornerCuts(path, clear) {
  const cuts = path.map(() => 0);
  if (path.length < 3) return cuts;
  const result = [[...path[0]]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1],
      b = path[i],
      c = path[i + 1];
    const before = distance(a, b),
      after = distance(b, c);
    let rounded;
    for (
      let cut = Math.min(0.36, before * 0.32, after * 0.32);
      cut >= 0.035;
      cut *= 0.5
    ) {
      const radius = +cut.toFixed(5);
      const points = cornerPoints(a, b, c, radius);
      const candidate = [result.at(-1), ...points, c];
      if (candidate.slice(1).every((p, n) => clear(candidate[n], p))) {
        rounded = points;
        cuts[i] = radius;
        break;
      }
    }
    result.push(...(rounded || [[...b]]));
  }
  return cuts;
}

export function roundWalkingPath(path, clear) {
  return expandWalkingPath(path, walkingCornerCuts(path, clear));
}

export function walkingPathLength(path) {
  return path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
}

export function walkingPathPoint(path, travelled) {
  let remaining = Math.max(0, travelled);
  for (let i = 1; i < path.length; i++) {
    const length = distance(path[i - 1], path[i]);
    if (remaining <= length && length > 0)
      return mix(path[i - 1], path[i], remaining / length);
    remaining -= length;
  }
  return [...path.at(-1)];
}

/** Smooth acceleration/deceleration, with exactly the same itinerary arrival time. */
export function walkingProgress(time, duration, length) {
  if (duration <= 0 || length <= 0) return { distance: length, speed: 0 };
  const t = Math.max(0, Math.min(duration, time));
  const ramp = Math.min(0.24, duration / 4);
  const peak = length / (duration - ramp);
  const integral = (u) => u * u * u - (u * u * u * u) / 2;
  const ease = (u) => u * u * (3 - 2 * u);
  if (t < ramp)
    return {
      distance: peak * ramp * integral(t / ramp),
      speed: peak * ease(t / ramp),
    };
  if (t > duration - ramp) {
    const u = (duration - t) / ramp;
    return {
      distance: length - peak * ramp * integral(u),
      speed: peak * ease(u),
    };
  }
  return { distance: peak * (t - ramp / 2), speed: peak };
}
