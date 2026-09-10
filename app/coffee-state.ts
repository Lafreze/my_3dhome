export const drinks = {
  espresso: {
    name: '浓缩',
    color: '#69402b',
    scale: [0.82, 0.8, 0.82],
    note: '小杯，浓郁的烘焙香。',
  },
  latte: {
    name: '拿铁',
    color: '#c79c6b',
    scale: [1, 1, 1],
    note: '奶泡轻覆，适合慢慢喝。',
  },
  filter: {
    name: '手冲',
    color: '#8c542f',
    scale: [0.9, 1.15, 0.9],
    note: '清透的果香，留一点回甘。',
  },
} as const;
export type Drink = keyof typeof drinks;
export type CoffeeSnapshot = {
  drink: Drink;
  phase: 'empty' | 'grinding' | 'extracting' | 'ready';
  age: number;
  heat: number;
};
export const coffeeHeat = (age: number) =>
  Math.max(0, 1 - Math.max(0, age) / 180) ** 1.6;
export function createCoffeeState(onChange: (state: CoffeeSnapshot) => void) {
  let drink: Drink = 'latte',
    phase: CoffeeSnapshot['phase'] = 'empty',
    elapsed = 0,
    age = 0;
  const snapshot = (): CoffeeSnapshot => ({
    drink,
    phase,
    age,
    heat: phase === 'ready' ? coffeeHeat(age) : 0,
  });
  return {
    snapshot,
    start(next: Drink) {
      if (phase === 'grinding' || phase === 'extracting') return false;
      drink = next;
      phase = 'grinding';
      elapsed = age = 0;
      onChange(snapshot());
      return true;
    },
    clear() {
      if (phase !== 'ready') return;
      phase = 'empty';
      age = 0;
      onChange(snapshot());
    },
    update(dt: number) {
      if (phase === 'ready') {
        age += dt;
        return;
      }
      if (phase === 'empty') return;
      elapsed += dt;
      const next =
        elapsed >= 8 ? 'ready' : elapsed >= 2 ? 'extracting' : 'grinding';
      if (phase !== next) {
        phase = next;
        onChange(snapshot());
      }
    },
  };
}
