/** A small forward hop with a planted preparation and landing; units are metres. */
export const rabbitHopDuration = 1.35;
export function sampleRabbitHop(time: number) {
  const cycles = Math.floor(Math.max(0, time) / rabbitHopDuration);
  const phase = Math.max(0, time) - cycles * rabbitHopDuration;
  const flight = Math.min(1, Math.max(0, (phase - 0.25) / 0.65));
  const progress = flight * flight * (3 - 2 * flight);
  return {
    distance: (cycles + progress) * 0.34,
    height: Math.sin(flight * Math.PI) * 0.11,
    flight,
    crouch:
      phase < 0.25
        ? Math.sin((phase / 0.25) * Math.PI)
        : phase > 0.9
          ? Math.sin(((phase - 0.9) / 0.45) * Math.PI) * 0.5
          : 0,
  };
}
