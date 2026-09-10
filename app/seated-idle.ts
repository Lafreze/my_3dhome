/** A quiet, page-local clock. Never catches up after a hidden tab or an open panel. */
export class SeatedIdle {
  private seed: number;
  private clock = 0;
  private next = 14;
  private lastActor = '';
  private lastKind = new Map<string, { kind: number; repeats: number }>();
  private arrivals = new Map<string, number>();
  private active: {
    id: string;
    kind: number;
    start: number;
    duration: number;
  } | null = null;
  constructor(seed: number) {
    this.seed = seed >>> 0;
  }
  setSeed(seed: number) {
    this.seed = seed >>> 0;
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  update(
    dt: number,
    eligible: string[],
    paused: boolean,
    busy: boolean,
    reduced: boolean,
  ) {
    for (const id of this.arrivals.keys())
      if (!eligible.includes(id)) this.arrivals.delete(id);
    for (const id of eligible)
      if (!this.arrivals.has(id))
        this.arrivals.set(id, this.clock + 12 + this.random() * 10);
    // Leaving a seat, lying down, greeting someone, or leaving view clears held props.
    if (this.active && (!eligible.includes(this.active.id) || reduced)) {
      this.active = null;
      this.next = this.clock + 20 + this.random() * 40;
    }
    if (paused || reduced) return;
    this.clock += Math.min(Math.max(dt, 0), 0.1);
    if (this.active && this.clock >= this.active.start + this.active.duration) {
      this.active = null;
      this.next = this.clock + 20 + this.random() * 40;
    }
    if (this.active || busy || this.clock < this.next || !eligible.length)
      return;
    const ready = eligible.filter((id) => this.clock >= this.arrivals.get(id)!);
    if (!ready.length) return;
    const choices =
      ready.length > 1 ? ready.filter((id) => id !== this.lastActor) : ready;
    const id = choices[Math.floor(this.random() * choices.length)];
    // Both actions remain random. Prefer variety, and never repeat three times.
    const previous = this.lastKind.get(id);
    const phoneChance = previous ? (previous.kind === 1 ? 0.28 : 0.72) : 0.55;
    const kind =
      previous && previous.repeats >= 2
        ? 3 - previous.kind
        : this.random() < phoneChance
          ? 1
          : 2;
    this.active = {
      id,
      kind,
      start: this.clock,
      duration: 7 + this.random() * 5,
    };
    this.lastActor = id;
    this.lastKind.set(id, {
      kind,
      repeats: previous?.kind === kind ? previous.repeats + 1 : 1,
    });
    // A long-lived public tab need not retain an unlimited history of departed users.
    if (this.lastKind.size > 128)
      this.lastKind.delete(this.lastKind.keys().next().value!);
  }
  sample(id: string) {
    if (!this.active || this.active.id !== id) return { kind: 0, amount: 0 };
    const age = this.clock - this.active.start;
    const smooth = (x: number) => {
      x = Math.max(0, Math.min(1, x));
      return x * x * (3 - 2 * x);
    };
    return {
      kind: this.active.kind,
      amount: smooth(age / 1.8) * smooth((this.active.duration - age) / 1.8),
    };
  }
  snapshot() {
    return {
      clock: this.clock,
      next: this.next,
      active: this.active ? { ...this.active } : null,
    };
  }
}
