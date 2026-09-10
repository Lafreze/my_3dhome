/** Lift before traversing the record; the cueing lever and arm share one timeline. */
export class RecordMechanism {
  phase: 'parked' | 'cue' | 'playing' | 'return' = 'parked';
  elapsed = 0;
  angle = 0;
  yaw = 0.72;
  lift = -0.09;
  private returnYaw = 0;
  private returnLift = 0;
  private startYaw: number;
  private innerYaw: number;
  constructor(startYaw = 0, innerYaw = -0.34) {
    this.startYaw = startYaw;
    this.innerYaw = innerYaw;
  }
  update(dt: number, on: boolean, reduced: boolean) {
    if (reduced) {
      this.yaw = on ? this.startYaw : 0.72;
      this.lift = on ? 0 : -0.09;
      return;
    }
    if (!on && (this.phase === 'playing' || this.phase === 'cue'))
      this.returning();
    if (on && this.phase === 'parked') {
      this.phase = 'cue';
      this.elapsed = 0;
    }
    this.elapsed += Math.min(dt, 0.1);
    const smooth = (x: number) => {
      x = Math.max(0, Math.min(1, x));
      return x * x * (3 - 2 * x);
    };
    if (this.phase !== 'parked')
      this.angle = (this.angle + dt * 3.49) % (Math.PI * 2);
    if (this.phase === 'cue') {
      this.yaw = 0.72 + (this.startYaw - 0.72) * smooth(this.elapsed / 1.1);
      this.lift = -0.09 * (1 - smooth((this.elapsed - 1.1) / 0.8));
      if (this.elapsed >= 1.9) {
        this.phase = 'playing';
        this.elapsed = 0;
      }
    } else if (this.phase === 'playing') {
      this.yaw =
        this.startYaw +
        (this.innerYaw - this.startYaw) * Math.min(1, this.elapsed / 240);
      this.lift = 0;
      if (this.elapsed >= 240) this.returning();
    } else if (this.phase === 'return') {
      this.lift =
        this.returnLift +
        (-0.09 - this.returnLift) * smooth(this.elapsed / 0.65);
      this.yaw =
        this.returnYaw +
        (0.72 - this.returnYaw) * smooth((this.elapsed - 0.65) / 1.1);
      if (this.elapsed >= 1.75) {
        this.phase = 'parked';
        this.elapsed = 0;
      }
    }
  }
  private returning() {
    this.returnYaw = this.yaw;
    this.returnLift = this.lift;
    this.phase = 'return';
    this.elapsed = 0;
  }
}
