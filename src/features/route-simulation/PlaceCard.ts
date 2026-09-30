import type { Stop } from '@/domain/tour/Tour';

/**
 * The card that shows a picture of the place the coach has reached, with a
 * fact or two about it. It is decoration for sighted visitors; the same words
 * are read out through the panel's announcements.
 */
export class PlaceCard {
  private readonly scene: SVGUseElement;
  private readonly name: HTMLElement;
  private readonly facts: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    const scene = root.querySelector<SVGUseElement>('[data-place-scene]');
    const name = root.querySelector<HTMLElement>('[data-place-name]');
    const facts = root.querySelector<HTMLElement>('[data-place-facts]');
    if (!scene || !name || !facts) throw new Error('The place card is missing a part');
    this.scene = scene;
    this.name = name;
    this.facts = facts;
  }

  /** Width the card takes beside the map, for layouts that keep a column free for it. */
  get width(): number {
    return this.root.offsetWidth;
  }

  show(stop: Stop): void {
    // The drawings are already in the page as symbols; the card only points at one.
    this.scene.setAttribute('href', `#scene-${stop.scene}`);
    this.name.textContent = stop.name;
    this.facts.replaceChildren(
      ...stop.facts.flatMap((fact) => {
        const label = document.createElement('dt');
        label.textContent = fact.label;
        const value = document.createElement('dd');
        value.textContent = fact.value;
        return [label, value];
      }),
    );
    this.root.dataset['shown'] = 'true';
  }

  hide(): void {
    this.root.dataset['shown'] = 'false';
  }
}
