const calm = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A short buzz confirming a change, on phones that can; others ignore it. */
export function tap(): void {
  try {
    navigator.vibrate?.(8);
  } catch {
    // Not every browser lets a page vibrate, and nothing depends on it.
  }
}

/**
 * Counts a figure up from zero when a screen opens. Only the text changes, so
 * nothing is laid out again; with reduced motion the final value is shown at once.
 */
export function countUp(
  element: HTMLElement,
  value: number,
  format: (value: number) => string,
): void {
  element.textContent = format(value);
  if (calm() || value <= 0) return;
  const duration = 650;
  const started = performance.now();
  const step = (now: number): void => {
    const t = Math.min(1, (now - started) / duration);
    // A strong ease-out: quick at first, settling on the value.
    const eased = 1 - (1 - t) ** 4;
    element.textContent = format(t >= 1 ? value : Math.round(value * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  element.textContent = format(0);
  requestAnimationFrame(step);
}

/** Runs a change of screen as a view transition where the browser has one. */
export function transition(direction: 'push' | 'pop' | 'tab' | 'none', change: () => void): void {
  const start = document.startViewTransition?.bind(document);
  if (!start || direction === 'none' || calm()) {
    change();
    return;
  }
  document.documentElement.dataset['nav'] = direction;
  const run = start(change);
  void run.finished.finally(() => {
    delete document.documentElement.dataset['nav'];
  });
}
