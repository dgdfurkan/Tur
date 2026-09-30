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
