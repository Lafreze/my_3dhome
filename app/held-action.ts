/** Finish lowering the current object before changing hands or beginning another action. */
export function createHeldAction() {
  let kind = 0,
    amount = 0;
  return {
    sample(next: number, strength: number, dt: number, reduced = false) {
      if (!kind) kind = next;
      const target =
        kind && next === kind ? Math.max(0, Math.min(1, strength)) : 0;
      const step = reduced ? 1 : Math.min(0.08, Math.max(0, dt)) * 2.5;
      amount += Math.max(-step, Math.min(step, target - amount));
      if (amount < 0.001 && target === 0) {
        kind = next;
        amount = 0;
      }
      return { kind, amount: amount * amount * (3 - 2 * amount) };
    },
  };
}
