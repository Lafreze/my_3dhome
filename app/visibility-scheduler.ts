/** Shared scheduling: hidden pages own no animation frames or polling timers. */
type Scheduler = {
  document: Pick<
    Document,
    'hidden' | 'addEventListener' | 'removeEventListener'
  >;
  setTimeout: (fn: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
  requestAnimationFrame: (fn: (time: number) => void) => number;
  cancelAnimationFrame: (id: number) => void;
};
const browserScheduler = (): Scheduler => ({
  document,
  setTimeout: (fn, delay) => window.setTimeout(fn, delay),
  clearTimeout: (id) => window.clearTimeout(id),
  requestAnimationFrame: (fn) => window.requestAnimationFrame(fn),
  cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
});
export function visibleInterval(
  callback: (waking: boolean) => unknown,
  delay: number,
  options: { immediate?: boolean; onHide?: () => void } = {},
  env = browserScheduler(),
) {
  let timer = 0,
    running = false,
    disposed = false,
    wakePending = false;
  const schedule = () => {
    if (!disposed && !env.document.hidden)
      timer = env.setTimeout(() => {
        void tick(false).catch(() => {});
      }, delay);
  };
  const tick = async (waking: boolean) => {
    if (disposed || env.document.hidden) return;
    if (running) {
      wakePending ||= waking;
      return;
    }
    env.clearTimeout(timer);
    timer = 0;
    running = true;
    try {
      await callback(waking);
    } finally {
      running = false;
      if (wakePending) {
        wakePending = false;
        void tick(true).catch(() => {});
      } else schedule();
    }
  };
  const visibility = () => {
    env.clearTimeout(timer);
    timer = 0;
    if (env.document.hidden) {
      wakePending = false;
      options.onHide?.();
    } else void tick(true).catch(() => {});
  };
  env.document.addEventListener('visibilitychange', visibility);
  if (options.immediate) void tick(true).catch(() => {});
  else schedule();
  return () => {
    disposed = true;
    wakePending = false;
    env.clearTimeout(timer);
    env.document.removeEventListener('visibilitychange', visibility);
  };
}

export function visibleFrames(
  render: (time: number) => boolean | void,
  options: {
    enabled?: () => boolean;
    fps?: () => number;
    onWake?: () => void;
  } = {},
  env = browserScheduler(),
) {
  let frame = 0,
    timer = 0,
    disposed = false;
  const cancel = () => {
    env.cancelAnimationFrame(frame);
    env.clearTimeout(timer);
    frame = timer = 0;
  };
  const allowed = () =>
    !disposed && !env.document.hidden && (options.enabled?.() ?? true);
  const invalidate = () => {
    if (!allowed() || frame || timer) return;
    frame = env.requestAnimationFrame(tick);
  };
  const tick = (time: number) => {
    frame = 0;
    if (!allowed()) return;
    if (render(time) === false) return;
    const fps = options.fps?.() ?? 60;
    if (fps < 60)
      timer = env.setTimeout(
        () => {
          timer = 0;
          invalidate();
        },
        Math.max(0, 1000 / fps - 16),
      );
    else invalidate();
  };
  const visibility = () => {
    cancel();
    if (allowed()) {
      options.onWake?.();
      invalidate();
    }
  };
  env.document.addEventListener('visibilitychange', visibility);
  return {
    invalidate,
    refresh: visibility,
    dispose() {
      disposed = true;
      cancel();
      env.document.removeEventListener('visibilitychange', visibility);
    },
  };
}
