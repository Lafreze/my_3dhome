/** Finite, interrupt-safe actions. No wall clock: leaving a room or opening a modal pauses time. */
export class CuriosityMotion {
  active = false;
  progress = 0;
  runs = 0;
  readonly duration: number;
  constructor(duration: number) {
    this.duration = duration;
  }
  start() {
    if (this.active) return false;
    this.active = true;
    this.progress = 0;
    this.runs++;
    return true;
  }
  update(dt: number, paused: boolean, reduced: boolean) {
    if (!this.active || paused) return false;
    this.progress = reduced
      ? 1
      : Math.min(
          1,
          this.progress +
            Math.max(0, Number.isFinite(dt) ? dt : 0) / this.duration,
        );
    if (this.progress < 1) return false;
    this.active = false;
    return true;
  }
  get opened() {
    return this.runs % 2 === 1;
  }
}
