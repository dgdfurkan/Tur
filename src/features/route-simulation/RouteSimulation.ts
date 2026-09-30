import type { RoutePlan } from '@/domain/tour/RoutePlan';
import type { StopKind } from '@/domain/tour/Tour';

export type SimulationPhase = 'idle' | 'driving' | 'dwelling' | 'finished';

export interface SimulationSnapshot {
  readonly phase: SimulationPhase;
  readonly playing: boolean;
  /** Stop the coach last left; the coach is on the leg that starts there. */
  readonly legIndex: number;
  /** Linear progress along the current leg, 0 to 1. */
  readonly legProgress: number;
  /** Last stop the coach reached. */
  readonly stopIndex: number;
  readonly speed: number;
}

export interface SimulationListener {
  stopReached?(stopIndex: number): void;
  departed?(fromStopIndex: number): void;
  finished?(): void;
  changed?(snapshot: SimulationSnapshot): void;
}

const SECONDS_PER_KM = 0.016;
const MIN_LEG_SECONDS = 1.1;
const MAX_LEG_SECONDS = 5.5;
/** Hops inside one town should not look like a journey. */
const SHORT_HOP_KM = 2;
const SHORT_HOP_SECONDS = 0.5;

const DWELL_SECONDS: Record<StopKind, number> = {
  departure: 0,
  rest: 1.5,
  sight: 2.3,
  lodging: 2.6,
  arrival: 0,
};

/**
 * Drives a coach along a route in simulated time. It knows nothing about
 * rendering: views read the snapshot each frame and listeners react to events.
 */
export class RouteSimulation {
  private readonly listeners = new Set<SimulationListener>();
  private phase: SimulationPhase = 'idle';
  private playing = false;
  private legIndex = 0;
  private legProgress = 0;
  private stopIndex = 0;
  private dwellRemaining = 0;
  private speed = 1;

  constructor(private readonly plan: RoutePlan) {
    if (plan.stops.length < 2) {
      throw new RangeError('A route needs at least two stops');
    }
  }

  get snapshot(): SimulationSnapshot {
    return {
      phase: this.phase,
      playing: this.playing,
      legIndex: this.legIndex,
      legProgress: this.legProgress,
      stopIndex: this.stopIndex,
      speed: this.speed,
    };
  }

  subscribe(listener: SimulationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Begins the journey, or resumes it after a pause. */
  play(): void {
    if (this.phase === 'finished') return;
    if (this.phase === 'idle') {
      this.phase = 'driving';
      this.emit((listener) => listener.departed?.(0));
    }
    this.playing = true;
    this.notifyChanged();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.notifyChanged();
  }

  restart(): void {
    this.phase = 'idle';
    this.playing = false;
    this.legIndex = 0;
    this.legProgress = 0;
    this.stopIndex = 0;
    this.dwellRemaining = 0;
    this.notifyChanged();
  }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) {
      throw new RangeError(`Speed must be positive, received ${speed}`);
    }
    this.speed = speed;
    this.notifyChanged();
  }

  /** Jumps straight to a stop and waits there as if the coach had just arrived. */
  seekToStop(stopIndex: number): void {
    const lastIndex = this.plan.stops.length - 1;
    if (!Number.isInteger(stopIndex) || stopIndex < 0 || stopIndex > lastIndex) {
      throw new RangeError(`Stop index out of range: ${stopIndex}`);
    }
    this.stopIndex = stopIndex;
    this.legProgress = 0;
    if (stopIndex === lastIndex) {
      this.legIndex = lastIndex - 1;
      this.legProgress = 1;
      this.phase = 'finished';
      this.playing = false;
    } else {
      this.legIndex = stopIndex;
      this.phase = 'dwelling';
      this.dwellRemaining = this.dwellSeconds(stopIndex);
    }
    this.emit((listener) => listener.stopReached?.(stopIndex));
    this.notifyChanged();
  }

  /** Advances simulated time. Safe to call with large steps, e.g. after a hidden tab. */
  update(deltaSeconds: number): void {
    if (!this.playing || deltaSeconds <= 0) return;
    let remaining = deltaSeconds * this.speed;
    // Bounded so a pathological plan can never spin the loop forever.
    for (let guard = 0; remaining > 0 && this.playing && guard < 1000; guard += 1) {
      remaining = this.phase === 'dwelling' ? this.dwell(remaining) : this.drive(remaining);
    }
    this.notifyChanged();
  }

  legSeconds(legIndex: number): number {
    const km = this.plan.legKm(legIndex);
    if (km < SHORT_HOP_KM) return SHORT_HOP_SECONDS;
    return Math.min(MAX_LEG_SECONDS, Math.max(MIN_LEG_SECONDS, km * SECONDS_PER_KM));
  }

  private dwellSeconds(stopIndex: number): number {
    const kind = this.plan.stops[stopIndex]?.stop.kind;
    return kind ? DWELL_SECONDS[kind] : 0;
  }

  private dwell(time: number): number {
    if (time < this.dwellRemaining) {
      this.dwellRemaining -= time;
      return 0;
    }
    const left = time - this.dwellRemaining;
    this.dwellRemaining = 0;
    this.phase = 'driving';
    this.emit((listener) => listener.departed?.(this.legIndex));
    return left;
  }

  private drive(time: number): number {
    const duration = this.legSeconds(this.legIndex);
    const needed = (1 - this.legProgress) * duration;
    if (time < needed) {
      this.legProgress += time / duration;
      return 0;
    }
    this.arrive(this.legIndex + 1);
    return time - needed;
  }

  private arrive(stopIndex: number): void {
    this.stopIndex = stopIndex;
    this.emit((listener) => listener.stopReached?.(stopIndex));
    if (stopIndex === this.plan.stops.length - 1) {
      this.legProgress = 1;
      this.phase = 'finished';
      this.playing = false;
      this.emit((listener) => listener.finished?.());
      return;
    }
    this.legIndex = stopIndex;
    this.legProgress = 0;
    this.phase = 'dwelling';
    this.dwellRemaining = this.dwellSeconds(stopIndex);
  }

  private notifyChanged(): void {
    const snapshot = this.snapshot;
    this.emit((listener) => listener.changed?.(snapshot));
  }

  private emit(call: (listener: SimulationListener) => void): void {
    for (const listener of this.listeners) call(listener);
  }
}

/** Coaches pull away and brake gently; applied by views to the linear leg progress. */
export function easeLeg(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return clamped < 0.5 ? 2 * clamped * clamped : 1 - (-2 * clamped + 2) ** 2 / 2;
}
