interface SchedulerLike {
  yield?: () => Promise<void>;
}

/**
 * Hands control back to the browser between two heavy steps, so taps, scrolling
 * and painting are never blocked for long while something large is being built.
 */
export function yieldToMain(): Promise<void> {
  const { scheduler } = globalThis as { scheduler?: SchedulerLike };
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Runs a task once the page has been painted, so heavy start-up work never
 * delays the first thing the visitor sees.
 */
export function afterFirstPaint(task: () => void): void {
  // The frame callback runs just before a paint; the timer fires right after it.
  requestAnimationFrame(() => setTimeout(task, 0));
}
