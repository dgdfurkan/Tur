import { Vector3, type Camera } from 'three';
import type { Disposable } from '@/shared/lifecycle';

export type LabelTone = 'stop' | 'city' | 'sea';
export type LabelState = 'idle' | 'active' | 'visited';

interface Label {
  readonly element: HTMLElement;
  readonly position: Vector3;
  readonly priority: number;
  state: LabelState;
  width: number;
  height: number;
  shown: boolean;
}

const RELAYOUT_EVERY = 5;
const EDGE_MARGIN = 8;
const ACTIVE_BONUS = 1000;

/**
 * Place names drawn as small road signs in HTML on top of the canvas, so text
 * stays crisp and selectable by assistive technology. Labels follow their 3D
 * anchor every frame; overlaps are resolved by priority every few frames.
 */
export class LabelLayer implements Disposable {
  private readonly labels = new Map<string, Label>();
  private readonly projected = new Vector3();
  private frame = 0;

  constructor(private readonly container: HTMLElement) {}

  add(id: string, text: string, position: Vector3, tone: LabelTone, priority: number): void {
    const element = document.createElement('div');
    element.className = `map-label map-label--${tone}`;
    element.dataset['state'] = 'idle';
    const plate = document.createElement('span');
    plate.className = 'map-label__plate';
    plate.textContent = text;
    element.append(plate);
    this.container.append(element);
    this.labels.set(id, {
      element,
      position: position.clone(),
      priority,
      state: 'idle',
      width: element.offsetWidth,
      height: element.offsetHeight,
      shown: false,
    });
  }

  setState(id: string, state: LabelState): void {
    const label = this.labels.get(id);
    if (!label || label.state === state) return;
    label.state = state;
    label.element.dataset['state'] = state;
    // The active sign is larger, so its footprint has to be measured again.
    label.width = label.element.offsetWidth;
    label.height = label.element.offsetHeight;
    this.frame = 0;
  }

  remove(prefix: string): void {
    for (const [id, label] of this.labels) {
      if (!id.startsWith(prefix)) continue;
      label.element.remove();
      this.labels.delete(id);
    }
  }

  update(camera: Camera, width: number, height: number): void {
    const relayout = this.frame % RELAYOUT_EVERY === 0;
    this.frame += 1;
    const placed: { left: number; top: number; right: number; bottom: number }[] = [];
    const ordered = relayout
      ? [...this.labels.values()].sort((a, b) => this.rank(b) - this.rank(a))
      : this.labels.values();

    for (const label of ordered) {
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
          left: x - label.width / 2,
          top: y - label.height,
          right: x + label.width / 2,
          bottom: y,
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
          label.element.classList.toggle('map-label--shown', shown);
        }
      }
      // Hidden labels keep following their anchor, so one that is still fading
      // out never lingers where the map used to be.
      if (onScreen) {
        // Anchored at the bottom centre, where the sign post meets the ground.
        label.element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      }
    }
  }

  dispose(): void {
    for (const label of this.labels.values()) label.element.remove();
    this.labels.clear();
  }

  private rank(label: Label): number {
    return label.priority + (label.state === 'active' ? ACTIVE_BONUS : 0);
  }
}
