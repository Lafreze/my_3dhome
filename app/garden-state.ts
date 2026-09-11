export function createGardenState() {
  let page = 0,
    turning = 1,
    watering = 1,
    pouring = 1,
    filled = false,
    domeOpen = false;
  return {
    snapshot: () => ({ page, turning, watering, pouring, filled, domeOpen }),
    interact(id: string) {
      if (id === 'gardenAlbum' && turning === 1) {
        page = (page + 1) % 3;
        turning = 0;
        return true;
      }
      if (id === 'gardenWorkbench' && watering === 1) {
        watering = 0;
        return true;
      }
      if (id === 'gardenLemonade' && pouring === 1) {
        pouring = 0;
        filled = false;
        return true;
      }
      if (id === 'gardenTerrarium') {
        domeOpen = !domeOpen;
        return true;
      }
      return false;
    },
    update(dt: number, reduced = false) {
      const d = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
      turning = Math.min(1, turning + d / 0.85);
      watering = Math.min(1, watering + d / 4.8);
      pouring = Math.min(1, pouring + d / 3.2);
      if (pouring > 0.5 && pouring < 1) filled = true;
      if (reduced) {
        turning = 1;
        watering = 1;
        if (pouring < 1) filled = true;
        pouring = 1;
      }
    },
  };
}
