export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Fast at first, settling gently: how things arrive. */
export function easeOut(value: number): number {
  return 1 - (1 - clamp01(value)) ** 3;
}

/** Slow at first, then quick: how a stamp comes down. */
export function easeIn(value: number): number {
  return clamp01(value) ** 4;
}

/** The share of `value` that lies past `from`, spread over `span`; for staggering parts of one movement. */
export function after(value: number, from: number, span: number): number {
  return clamp01((value - from) / span);
}
