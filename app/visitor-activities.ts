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
    {
      phone: 1,
      coffee: 2,
      offerCoffee: 2,
      shareTea: 2,
      shareBook: 3,
      inviteRead: 3,
      shareFlowers: 5,
      waveHello: 6,
      applaud: 7,
      thanks: 8,
      agree: 8,
      inviteTalk: 9,
    }[event.kind] ??
    0;
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
