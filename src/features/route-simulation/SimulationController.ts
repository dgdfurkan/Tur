import type { RoutePlan } from '@/domain/tour/RoutePlan';
import { ROAD_WINDING_FACTOR } from '@/domain/tour/Tour';
import { tr } from '@/i18n/tr';
import { formatKm } from '@/shared/format';
import type { Disposable } from '@/shared/lifecycle';
import { easeLeg, type RouteSimulation, type SimulationSnapshot } from './RouteSimulation';
import type { RouteView } from './RouteView';
import type { SimulationPanel } from './SimulationPanel';
import type { SoundManager } from './SoundManager';

const SPEEDS = [1, 2] as const;
const ENGINE_IDLE = 0.4;
const ENGINE_DRIVING = 1;

/** Whatever is shown between pressing start and the coach setting off. */
export interface BoardingRitual {
  /** Resolves when the ritual is over and the journey may begin. */
  play(): Promise<void>;
}

export interface ControllerOptions {
  /** Length of the tour, shown as a badge before and after the journey. */
  readonly duration: string;
  /** One-line description of the whole route, shown before and after the journey. */
  readonly summary: string;
  /** With reduced motion the coach jumps from stop to stop instead of driving. */
  readonly stepMode: boolean;
}

/**
 * Connects the pieces of the route preview. The simulation decides what
 * happens and when; this class tells the map, the panel and the sound what to
 * show for it, and turns button presses back into simulation commands.
 */
export class SimulationController implements Disposable {
  private readonly unsubscribe: () => void;
  private started = false;
  private boarding = false;
  private speedIndex = 0;

  constructor(
    private readonly plan: RoutePlan,
    private readonly simulation: RouteSimulation,
    private readonly view: RouteView,
    private readonly panel: SimulationPanel,
    private readonly pass: BoardingRitual,
    private readonly sound: SoundManager,
    private readonly options: ControllerOptions,
  ) {
    this.unsubscribe = simulation.subscribe({
      departed: (from) => this.onDeparted(from),
      stopReached: (index) => this.onStopReached(index),
      finished: () => this.onFinished(),
      changed: (snapshot) => this.onChanged(snapshot),
    });

    panel.bind({
      start: () => void this.start(),
      toggle: () => this.toggle(),
      speed: () => this.cycleSpeed(),
      restart: () => this.restart(),
      sound: () => this.toggleSound(),
      seek: (stopIndex) => this.seek(stopIndex),
      layout: () => this.refreshLayout(),
    });

    view.showRoute(plan);
    view.setPadding(panel.padding());
    view.showOverview(true);
    view.onFrame((delta) => this.tick(delta));
    view.start();

    panel.setState('intro');
    panel.showIntro(options.duration, options.summary);
    panel.setMuted(sound.muted);
    panel.setSpeed(SPEEDS[0]);
    panel.setPlaying(false, options.stepMode);
    panel.setStops(null, -1);
    addEventListener('keydown', this.onKey);
  }

  /** "Simülasyonu Başlat": stamp the boarding pass, then set off. */
  async start(): Promise<void> {
    if (this.started || this.boarding) return;
    this.boarding = true;
    // The audio graph has to be created inside this click handler.
    this.sound.unlock();
    await this.pass.play();
    this.boarding = false;
    this.begin();
    this.panel.announce(tr.route.boarded);
  }

  toggle(): void {
    if (!this.started) {
      void this.start();
      return;
    }
    const { playing, phase, stopIndex } = this.simulation.snapshot;
    if (phase === 'finished') return;
    if (this.options.stepMode) {
      this.simulation.seekToStop(stopIndex + 1);
    } else if (playing) {
      this.simulation.pause();
      this.sound.setEngine(ENGINE_IDLE);
    } else {
      this.simulation.play();
    }
  }

  cycleSpeed(): void {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    const speed = SPEEDS[this.speedIndex] ?? 1;
    this.simulation.setSpeed(speed);
    this.panel.setSpeed(speed);
  }

  restart(): void {
    this.started = false;
    this.simulation.restart();
    this.sound.setEngine(0);
    this.view.setActiveStop(null);
    this.view.setVisitedThrough(-1);
    this.view.setPosition(0, 0);
    this.view.setTimeOfDay('day');
    this.view.showOverview();
    this.panel.setState('intro');
    this.panel.showIntro(this.options.duration, this.options.summary);
    this.panel.setStops(null, -1);
    this.panel.setProgress(0);
  }

  toggleSound(): void {
    this.sound.unlock();
    this.sound.setMuted(!this.sound.muted);
    this.panel.setMuted(this.sound.muted);
  }

  /** Jumps to a stop from the list; skips the boarding pass if it has not been shown. */
  seek(stopIndex: number): void {
    if (this.boarding) return;
    this.sound.unlock();
    this.started = true;
    this.panel.setState('running');
    this.simulation.seekToStop(stopIndex);
  }

  refreshLayout(): void {
    this.view.setPadding(this.panel.padding());
    if (!this.started) this.view.showOverview();
  }

  dispose(): void {
    removeEventListener('keydown', this.onKey);
    this.unsubscribe();
    this.sound.dispose();
    this.view.dispose();
  }

  private begin(): void {
    this.started = true;
    this.panel.setState('running');
    if (this.options.stepMode) this.simulation.seekToStop(0);
    else this.simulation.play();
  }

  private tick(deltaSeconds: number): void {
    this.simulation.update(deltaSeconds);
    const { legIndex, legProgress } = this.simulation.snapshot;
    this.view.setPosition(legIndex, legProgress);
    if (this.plan.legCount > 0) {
      this.panel.setProgress((legIndex + easeLeg(legProgress)) / this.plan.legCount);
    }
  }

  private onDeparted(fromIndex: number): void {
    const next = this.plan.stops[fromIndex + 1];
    this.view.setActiveStop(null);
    this.view.setVisitedThrough(fromIndex);
    // Every departure is a morning or a daytime one; evening only falls at a hotel.
    this.view.setTimeOfDay('day');
    this.view.followCoach(fromIndex);
    this.sound.setEngine(ENGINE_DRIVING);
    this.panel.setStops(null, fromIndex);
    if (next) this.panel.showTravelling(next, this.legDistance(fromIndex));
  }

  /** Road distance of a leg, rounded to a figure that reads naturally. */
  private legDistance(legIndex: number): string {
    const km = this.plan.legKm(legIndex) * ROAD_WINDING_FACTOR;
    return formatKm(km < 10 ? Math.max(1, Math.round(km)) : Math.round(km / 5) * 5);
  }

  private onStopReached(stopIndex: number): void {
    const stop = this.plan.stops[stopIndex];
    if (!stop) return;
    this.view.setVisitedThrough(stopIndex - 1);
    this.view.setActiveStop(stopIndex);
    this.view.setTimeOfDay(stop.stop.kind === 'lodging' ? 'dusk' : 'day');
    this.view.focusStop(stopIndex);
    this.sound.setEngine(ENGINE_IDLE);
    this.sound.chime();
    this.panel.showStop(stop);
    this.panel.setStops(stopIndex, stopIndex - 1);
    this.panel.announce(`${stop.stop.name}. ${stop.stop.summary}`);
  }

  private onFinished(): void {
    this.sound.setEngine(0);
    this.view.setTimeOfDay('day');
    this.view.showOverview();
    this.panel.setState('finished');
    this.panel.showFinished(this.options.duration, this.options.summary);
    this.panel.announce(`${tr.route.finished}. ${this.options.summary}`);
  }

  private onChanged(snapshot: SimulationSnapshot): void {
    this.panel.setPlaying(snapshot.playing, this.options.stepMode);
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    // Keys typed into a control belong to that control.
    if (event.target instanceof HTMLElement && event.target.closest('button, a, input')) return;
    const { stopIndex } = this.simulation.snapshot;
    if (event.key === ' ') {
      event.preventDefault();
      this.toggle();
    } else if (event.key === 'ArrowRight' && stopIndex < this.plan.stops.length - 1) {
      this.seek(stopIndex + 1);
    } else if (event.key === 'ArrowLeft' && stopIndex > 0) {
      this.seek(stopIndex - 1);
    }
  };
}
