import { Vector3, type Camera } from 'three';
import type { LabelState, LabelSurface, LabelTone } from './LabelSurface';
import type { Disposable } from '@/shared/lifecycle';

interface Label {
  readonly position: Vector3;
  readonly priority: number;
  /** Empty room the sign asks for around itself, in pixels. */
  readonly spacing: number;
  state: LabelState;
  width: number;
  height: number;
  shown: boolean;
}

const RELAYOUT_EVERY = 5;
const EDGE_MARGIN = 8;
const ACTIVE_BONUS = 1000;
/** City names are background: they give way rather than crowd a route's own signs. */
const SPACING: Record<LabelTone, number> = { stop: 0, city: 18, sea: 6 };

/**
 * Decides where place-name signs stand and which ones are shown. Labels follow
 * their 3D anchor every frame; overlaps are resolved by priority every few
 * frames. How a sign looks is left to the surface it is given.
 */
export class LabelLayer implements Disposable {
  private readonly labels = new Map<string, Label>();
  private readonly projected = new Vector3();
  private frame = 0;

  constructor(private readonly surface: LabelSurface) {}

  add(id: string, text: string, position: Vector3, tone: LabelTone, priority: number): void {
    const { width, height } = this.surface.create(id, text, tone);
    this.labels.set(id, {
      position: position.clone(),
      priority,
      spacing: SPACING[tone],
      state: 'idle',
      width,
      height,
      shown: false,
    });
  }

  setState(id: string, state: LabelState): void {
    const label = this.labels.get(id);
    if (!label || label.state === state) return;
    label.state = state;
    // The active sign is larger, so its footprint has to be measured again.
    const { width, height } = this.surface.restyle(id, state);
    label.width = width;
    label.height = height;
    this.frame = 0;
  }

  remove(prefix: string): void {
    for (const id of this.labels.keys()) {
      if (!id.startsWith(prefix)) continue;
      this.surface.destroy(id);
      this.labels.delete(id);
    }
  }

  update(camera: Camera, width: number, height: number): void {
    const relayout = this.frame % RELAYOUT_EVERY === 0;
    this.frame += 1;
    const placed: { left: number; top: number; right: number; bottom: number }[] = [];
    const ordered = relayout
      ? [...this.labels].sort(([, a], [, b]) => this.rank(b) - this.rank(a))
      : this.labels;

    for (const [id, label] of ordered) {
      this.projected.copy(label.position).project(camera);
      const x = ((this.projected.x + 1) / 2) * width;
      const y = ((1 - this.projected.y) / 2) * height;
      const onScreen =
        this.projected.z < 1 &&
        x > EDGE_MARGIN &&
        x < width - EDGE_MARGIN &&
        y > EDGE_MARGIN &&
        y < height - EDGE_MARGIN;

      if (relayout) {
        const box = {
          left: x - label.width / 2 - label.spacing,
          top: y - label.height - label.spacing,
          right: x + label.width / 2 + label.spacing,
          bottom: y + label.spacing,
        };
        const free = !placed.some(
          (other) =>
            box.left < other.right &&
            box.right > other.left &&
            box.top < other.bottom &&
            box.bottom > other.top,
        );
        const shown = onScreen && free;
        if (shown) placed.push(box);
        if (shown !== label.shown) {
          label.shown = shown;
          this.surface.setShown(id, shown);
        }
      }
      // Hidden labels keep following their anchor, so one that is still fading
      // out never lingers where the map used to be.
      if (onScreen) this.surface.move(id, x, y);
    }
  }

  dispose(): void {
    this.surface.dispose();
    this.labels.clear();
  }

  private rank(label: Label): number {
    return label.priority + (label.state === 'active' ? ACTIVE_BONUS : 0);
  }
}
