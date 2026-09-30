import type { LabelSize, LabelState, LabelSurface, LabelTone } from './LabelSurface';

/**
 * Place-name signs as HTML on top of the canvas, so the text stays crisp and
 * is styled by the page's own style sheet (see route-map.css).
 */
export class DomLabels implements LabelSurface {
  private readonly elements = new Map<string, HTMLElement>();

  constructor(private readonly container: HTMLElement) {}

  create(id: string, text: string, tone: LabelTone): LabelSize {
    const element = document.createElement('div');
    element.className = `map-label map-label--${tone}`;
    element.dataset['state'] = 'idle';
    const plate = document.createElement('span');
    plate.className = 'map-label__plate';
    plate.textContent = text;
    element.append(plate);
    this.container.append(element);
    this.elements.set(id, element);
    return { width: element.offsetWidth, height: element.offsetHeight };
  }

  restyle(id: string, state: LabelState): LabelSize {
    const element = this.elements.get(id);
    if (!element) return { width: 0, height: 0 };
    element.dataset['state'] = state;
    return { width: element.offsetWidth, height: element.offsetHeight };
  }

  move(id: string, x: number, y: number): void {
    const element = this.elements.get(id);
    if (!element) return;
    // Anchored at the bottom centre, where the sign post meets the ground.
    element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }

  setShown(id: string, shown: boolean): void {
    this.elements.get(id)?.classList.toggle('map-label--shown', shown);
  }

  destroy(id: string): void {
    this.elements.get(id)?.remove();
    this.elements.delete(id);
  }

  dispose(): void {
    for (const element of this.elements.values()) element.remove();
    this.elements.clear();
  }
}
