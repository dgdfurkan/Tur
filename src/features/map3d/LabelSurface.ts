import type { Disposable } from '@/shared/lifecycle';

export type LabelTone = 'stop' | 'city' | 'sea';
export type LabelState = 'idle' | 'active' | 'visited';

export interface LabelSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Whatever actually shows the place-name signs: HTML on top of the map on a
 * page, or paint on a film frame. The label layer decides where signs go and
 * which ones give way; a surface only draws what it is told.
 */
export interface LabelSurface extends Disposable {
  /** Makes a sign and reports how much room it takes. */
  create(id: string, text: string, tone: LabelTone): LabelSize;
  /** Restyles a sign for a state and reports its new size. */
  restyle(id: string, state: LabelState): LabelSize;
  /** Moves a sign; the point is where its post meets the ground. */
  move(id: string, x: number, y: number): void;
  setShown(id: string, shown: boolean): void;
  destroy(id: string): void;
}
