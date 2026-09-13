import type { CuriosityId } from './exploration-data';

/** Quiet original sounds, unlocked only by the visitor touching a mechanism. */
export function createCuriosityAudio() {
  let context: AudioContext | null = null;
  const voices = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  const stop = () => {
    for (const voice of voices) {
      voice.oscillator.onended = null;
      voice.oscillator.stop();
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    voices.clear();
  };
  const visibility = () => {
    if (document.hidden) stop();
  };
  document.addEventListener('visibilitychange', visibility);
  const tone = (
    hz: number,
    volume: number,
    duration: number,
    harmonic = false,
  ) => {
    if (
      !context ||
      context.state !== 'running' ||
      document.hidden ||
      voices.size >= 12
    )
      return;
    const t = context.currentTime,
      oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = harmonic ? 'triangle' : 'sine';
    oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain).connect(context.destination);
    const voice = { oscillator, gain };
    voices.add(voice);
    oscillator.onended = () => {
      voices.delete(voice);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(t);
    oscillator.stop(t + duration + 0.02);
  };
  return {
    unlock() {
      try {
        context ??= new AudioContext();
        void context.resume().catch(() => {});
      } catch {
        /* Visual actions remain usable when audio is unavailable. */
      }
    },
    tick(id: CuriosityId, step: number) {
      if (id === 'bedroomMusicBox') {
        const notes = [
          784, 659.25, 523.25, 587.33, 659.25, 392, 523.25, 659.25,
        ];
        const note = notes[step % notes.length];
        tone(note, 0.017, 0.62);
        tone(note * 2, 0.004, 0.31);
      } else if (id === 'corridorChime' && step < 5) {
        const note = [1046.5, 1318.5, 1568, 1174.7, 1760][step];
        tone(note, 0.016 * (1 - step / 6), 0.9);
        tone(note * 2.71, 0.002, 0.43);
      } else if (id === 'livingMetronome')
        tone(step % 2 ? 1250 : 1550, 0.012, 0.045, true);
      else if (id === 'galleryFlipbook' || id === 'cafeGrinder')
        tone(
          id === 'cafeGrinder' ? 180 + (step % 3) * 35 : 390,
          0.006,
          0.045,
          true,
        );
      else if (step === 0 && id === 'barCoasters') tone(540, 0.008, 0.08, true);
    },
    stop,
    dispose() {
      stop();
      document.removeEventListener('visibilitychange', visibility);
      if (context) void context.close();
      context = null;
    },
  };
}
