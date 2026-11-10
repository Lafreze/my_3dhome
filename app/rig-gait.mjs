// One cycle advances exactly this distance; stance feet move backwards at ground speed.
export const rigCycleDistance = 0.52;
export function sampleRigLeg(
  distance,
  amount,
  side,
  thigh,
  shin,
  cycle = rigCycleDistance,
  minDrop = 0.036,
  stepLift = 0.045,
) {
  const phase = (((distance / cycle + side * 0.5) % 1) + 1) % 1;
  const stance = 0.6,
    swing = Math.max(0, (phase - stance) / (1 - stance));
  // Endpoint velocity matches the stance, avoiding a jerk at lift-off and touchdown.
  const recover =
    swing * swing * (3 - 2 * swing) -
    ((1 - stance) / stance) * swing * (1 - swing) * (1 - 2 * swing);
  const z =
    cycle *
    stance *
    (phase < stance ? 0.5 - phase / stance : recover - 0.5) *
    amount;
  const lift = Math.sin(swing * Math.PI) ** 2 * stepLift * amount;
  const length = thigh + shin;
  const drop =
    Math.max(
      minDrop,
      length -
        Math.sqrt(Math.max(0, length * length - (cycle * 0.33) ** 2)) +
        0.002,
    ) * amount;
  const y = -(thigh + shin) + drop + lift;
  const reach = Math.min(
    thigh + shin - 0.000001,
    Math.max(Math.abs(thigh - shin) + 0.000001, Math.hypot(y, z)),
  );
  const knee = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        (reach * reach - thigh * thigh - shin * shin) / (2 * thigh * shin),
      ),
    ),
  );
  const hip =
    Math.atan2(-z, -y) -
    Math.atan2(shin * Math.sin(knee), thigh + shin * Math.cos(knee));
  return { hip, knee, ankle: -hip - knee, lift, z, drop, phase };
}
