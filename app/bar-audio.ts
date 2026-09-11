import { barRecords } from './bar-state';
// Small original arrangements, synthesized locally after a listener presses play.
export async function playBarRecord(index: number) {
  const track = barRecords[index];
  const ctx = new AudioContext();
  try {
    await ctx.resume();
  } catch (error) {
    void ctx.close();
    throw error;
  }
  const gain = ctx.createGain();
  gain.gain.value = 0.052;
  gain.connect(ctx.destination);
  let beat = 0,
    next = ctx.currentTime + 0.05;
  function note(
    midi: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ) {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(volume, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + duration);
    o.connect(g);
    g.connect(gain);
    o.start(start);
    o.stop(start + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  const schedule = () => {
    if (ctx.state !== 'running') return;
    if (next < ctx.currentTime) next = ctx.currentTime + 0.04;
    while (next < ctx.currentTime + 0.2) {
      const step = 60 / track.bpm,
        m = track.notes[beat % track.notes.length];
      note(m, next, step * 0.85, 0.72, index === 2 ? 'triangle' : 'sine');
      if (beat % 2 === 0) {
        note(m - 24, next, step * 1.65, 0.72, 'sine');
        note(m + 7, next + 0.03, step * 0.9, 0.22, 'sine');
      }
      if (beat % 4 === 3)
        note(m + 12, next + step * 0.5, step * 0.35, 0.2, 'sine');
      beat++;
      next += step;
    }
  };
  schedule();
  const timer = setInterval(schedule, 75);
  const visibility = () => {
    if (document.hidden) void ctx.suspend();
    else if (ctx.state === 'suspended') void ctx.resume();
  };
  document.addEventListener('visibilitychange', visibility);
  return {
    close() {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      void ctx.close();
    },
  };
}
