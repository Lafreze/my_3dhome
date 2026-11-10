import { humanScale } from './character-scale.mjs';

// The resident has short legs under an oversized coat. Its stride is deliberately
// shorter than the visitors', with the ankle solving to the floor through stance.
export const residentCycleDistance = 0.46;
export function sampleResidentGait(
  distance: number,
  amount: number,
  side: number,
) {
  const blend = Math.max(0, Math.min(1, amount));
  const phase = (((distance / residentCycleDistance + side * 0.5) % 1) + 1) % 1;
  const swing = Math.max(0, (phase - 0.6) / 0.4);
  const recover =
    swing * swing * (3 - 2 * swing) -
    (2 / 3) * swing * (1 - swing) * (1 - 2 * swing);
  const stride = (residentCycleDistance * 0.6) / humanScale('resident');
  const z =
    -(phase < 0.6 ? stride * (0.5 - phase / 0.6) : stride * (recover - 0.5)) *
    blend;
  const lift =
    ((Math.sin(swing * Math.PI) ** 2 * 0.035) / humanScale('resident')) * blend;
  const drop = 0.065 * blend;
  const y = -0.38 + drop + lift;
  const thigh = 0.22,
    shin = 0.16;
  const reach = Math.max(0.060001, Math.min(0.38, Math.hypot(y, z)));
  const knee = -Math.acos(
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
  return { hip, knee, ankle: -hip - knee, drop, lift, z, phase };
}
