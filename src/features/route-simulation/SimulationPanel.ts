import type { RouteStop } from '@/domain/tour/RoutePlan';
import { tr } from '@/i18n/tr';
import type { ViewPadding } from '@/shared/lifecycle';
import { formatMinutes } from '@/shared/format';

export interface PanelHandlers {
  start(): void;
  toggle(): void;
  speed(): void;
  restart(): void;
  sound(): void;
  seek(stopIndex: number): void;
  /** The panel changed size or shape, so the map has to re-frame. */
  layout(): void;
}

export type PanelState = 'intro' | 'running' | 'finished';

const WIDE_LAYOUT = '(min-width: 60rem)';
const EDGE_GAP = 16;

/**
 * The interface around the map: status card, transport controls and the list
 * of stops. It only reads and writes the DOM; every decision is made by the
 * controller that owns it.
 */
export class SimulationPanel {
  private readonly panel: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly day: HTMLElement;
  private readonly kind: HTMLElement;
  private readonly title: HTMLElement;
  private readonly text: HTMLElement;
  private readonly duration: HTMLElement;
  private readonly durationText: HTMLElement;
  private readonly live: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly toggleLabel: HTMLElement;
  private readonly speedLabel: HTMLElement;
  private readonly soundLabel: HTMLElement;
  private readonly sheetLabel: HTMLElement;
  private readonly stopButtons: HTMLButtonElement[];
  private readonly wide = matchMedia(WIDE_LAYOUT);

  constructor(private readonly root: HTMLElement) {
    this.panel = this.find('[data-panel]');
    this.bar = this.find('[data-bar]');
    this.day = this.find('[data-panel-day]');
    this.kind = this.find('[data-card-kind]');
    this.title = this.find('[data-card-title]');
    this.text = this.find('[data-card-text]');
    this.duration = this.find('[data-card-duration]');
    this.durationText = this.find('[data-card-duration-text]');
    this.live = this.find('[data-announce]');
    this.progress = this.find('[data-progress]');
    this.toggleLabel = this.find('[data-toggle-label]');
    this.speedLabel = this.find('[data-speed-label]');
    this.soundLabel = this.find('[data-sound-label]');
    this.sheetLabel = this.find('[data-sheet-label]');
    this.stopButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-stop-index]')];
  }

  /** Connects the controls to whoever reacts to them. */
  bind(handlers: PanelHandlers): void {
    const actions: Record<string, () => void> = {
      start: handlers.start,
      toggle: handlers.toggle,
      speed: handlers.speed,
      restart: handlers.restart,
      sound: handlers.sound,
      sheet: () => this.toggleSheet(handlers.layout),
    };
    this.root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const action = target?.closest<HTMLElement>('[data-action]')?.dataset['action'];
      if (action) {
        actions[action]?.();
        return;
      }
      const stop = target?.closest<HTMLElement>('[data-stop-index]')?.dataset['stopIndex'];
      if (stop === undefined) return;
      // On a phone the open list covers the map; close it so the chosen stop is visible.
      if (!this.wide.matches && this.root.dataset['sheet'] === 'open') {
        this.toggleSheet(handlers.layout);
      }
      handlers.seek(Number(stop));
    });
    this.wide.addEventListener('change', handlers.layout);
    addEventListener('resize', handlers.layout);
  }

  setState(state: PanelState): void {
    this.root.dataset['state'] = state;
  }

  showIntro(badge: string, summary: string): void {
    this.day.textContent = badge;
    this.kind.textContent = '';
    this.title.textContent = tr.route.heading;
    this.text.textContent = summary;
    this.setDuration(undefined);
  }

  showStop(stop: RouteStop): void {
    this.day.textContent = `${stop.day}. ${tr.tour.day}`;
    this.kind.textContent = tr.route.kinds[stop.stop.kind];
    this.title.textContent = stop.stop.name;
    this.text.textContent = stop.stop.summary;
    this.setDuration(stop.stop.durationMinutes);
  }

  /** Shown between stops: where the coach is heading and how far it still is. */
  showTravelling(next: RouteStop, distance: string): void {
    this.day.textContent = `${next.day}. ${tr.tour.day}`;
    this.kind.textContent = tr.route.onTheRoad;
    this.title.textContent = next.stop.name;
    this.text.textContent = `Sonraki durağa ${tr.tour.approximately} ${distance} yol var.`;
    this.setDuration(undefined);
  }

  showFinished(badge: string, summary: string): void {
    this.day.textContent = badge;
    this.kind.textContent = '';
    this.title.textContent = tr.route.finished;
    this.text.textContent = summary;
    this.setDuration(undefined);
  }

  /** Read out by screen readers; visual users see the same change on the card. */
  announce(message: string): void {
    this.live.textContent = message;
  }

  setPlaying(playing: boolean, stepMode: boolean): void {
    this.root.dataset['playing'] = String(playing);
    this.toggleLabel.textContent = stepMode
      ? tr.route.nextStop
      : playing
        ? tr.route.pause
        : tr.route.play;
  }

  setSpeed(speed: number): void {
    this.speedLabel.textContent = `${tr.route.speed} ${speed}x`;
  }

  setMuted(muted: boolean): void {
    this.root.dataset['muted'] = String(muted);
    this.soundLabel.textContent = muted ? tr.route.soundOn : tr.route.soundOff;
  }

  setProgress(fraction: number): void {
    this.progress.style.transform = `scaleX(${Math.min(1, Math.max(0, fraction)).toFixed(4)})`;
  }

  setStops(activeIndex: number | null, visitedThrough: number): void {
    this.stopButtons.forEach((button, index) => {
      const active = index === activeIndex;
      if (active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.dataset['visited'] = String(index <= visitedThrough && !active);
      if (active && this.root.dataset['sheet'] === 'open') {
        button.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  /** The area of the viewport the panel and top bar cover, so the map can avoid it. */
  padding(): ViewPadding {
    const bar = this.bar.getBoundingClientRect();
    const panel = this.panel.getBoundingClientRect();
    if (this.wide.matches) {
      return { left: panel.right + EDGE_GAP, right: EDGE_GAP, top: bar.bottom, bottom: EDGE_GAP };
    }
    return {
      left: EDGE_GAP,
      right: EDGE_GAP,
      top: bar.bottom,
      bottom: Math.max(0, innerHeight - panel.top),
    };
  }

  private toggleSheet(onLayout: () => void): void {
    const open = this.root.dataset['sheet'] !== 'open';
    this.root.dataset['sheet'] = open ? 'open' : 'closed';
    this.sheetLabel.textContent = open ? tr.route.hideStops : tr.route.showStops;
    this.panel.addEventListener('transitionend', onLayout, { once: true });
  }

  private setDuration(minutes: number | undefined): void {
    this.duration.hidden = minutes === undefined;
    this.durationText.textContent = minutes === undefined ? '' : formatMinutes(minutes);
  }

  private find(selector: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Route panel is missing ${selector}`);
    return element;
  }
}
