import activities from './visitor-activities.json' with { type: 'json' };
export { activities };
export type ActivityKind = keyof typeof activities;
type Event = { kind: string; at: number; expiresAt: number };
const smooth = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};
export function sampleVisitorActivity(
  event: Event | undefined,
  now: number,
  reduced = false,
) {
  if (!event || now < event.at || now >= event.expiresAt)
    return { kind: 0, amount: 0, age: 0 };
  const spec = activities[event.kind as ActivityKind];
  const kind =
    spec?.kind ??
    (event.kind === 'phone' ? 1 : event.kind === 'coffee' ? 2 : 0);
  if (!kind) return { kind: 0, amount: 0, age: 0 };
  const age = (now - event.at) / 1000;
  return {
    kind,
    age,
    amount: reduced
      ? 1
      : smooth(age / 1.1) * smooth((event.expiresAt - now) / 1100),
  };
}
export function giftFlight(
  at: number,
  now: number,
  expiresAt: number,
  reduced = false,
) {
  const age = (now - at) / 1000;
  if (age < 0 || now >= expiresAt) return null;
  const progress = reduced ? 1 : smooth((age - 0.7) / 2.8);
  return {
    progress,
    lift: reduced ? 0 : Math.sin(progress * Math.PI) * 0.55,
    scale: reduced ? 1 : smooth(age / 0.6) * smooth((expiresAt - now) / 1300),
  };
}
