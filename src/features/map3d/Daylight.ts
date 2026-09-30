import { Color, DirectionalLight, HemisphereLight, MathUtils, type Object3D } from 'three';
import type { TimeOfDay } from '@/features/route-simulation/RouteView';
import type { Updatable } from '@/shared/lifecycle';

interface Mood {
  readonly sky: string;
  /** Multiplies the painted surfaces, which no lamp reaches. */
  readonly tint: string;
  readonly sun: string;
  readonly sunStrength: number;
  readonly skyStrength: number;
  /** How high the balloons fly: 0 on the ground, 1 at full height. */
  readonly balloonLift: number;
}

const MOODS: Record<TimeOfDay, Mood> = {
  day: {
    sky: '#dcedf8',
    tint: '#ffffff',
    sun: '#fff3dc',
    sunStrength: 2.1,
    skyStrength: 1.5,
    balloonLift: 1,
  },
  dusk: {
    sky: '#f4cfb2',
    tint: '#dfb9a9',
    sun: '#ffb37c',
    sunStrength: 1.75,
    skyStrength: 1.05,
    balloonLift: 0.06,
  },
};

const RESPONSE = 1.3;
const SETTLED = 0.003;

/** What the time of day changes besides the lamps themselves. */
export interface DaylightScene {
  setSky(color: Color): void;
  setTint(color: Color): void;
  setBalloonLift(lift: number): void;
}

/**
 * The map's light: a glow from the sky and a sun, blended from one time of day
 * to another. Evening falls when the coach reaches its hotel and the balloons
 * come down; in the morning the light returns and they rise again.
 */
export class Daylight implements Updatable {
  readonly lamps: readonly Object3D[];
  private readonly glow = new HemisphereLight('#ffffff', '#c4d2dc', MOODS.day.skyStrength);
  private readonly sun = new DirectionalLight(MOODS.day.sun, MOODS.day.sunStrength);
  private readonly sky = new Color(MOODS.day.sky);
  private readonly tint = new Color(MOODS.day.tint);
  private readonly goal = new Color();
  private lift = MOODS.day.balloonLift;
  private mood = MOODS.day;
  private settled = false;

  /** @param instant Switch at once instead of fading; used when the visitor prefers reduced motion. */
  constructor(
    private readonly scene: DaylightScene,
    private readonly instant = false,
  ) {
    this.sun.position.set(-70, 130, 90);
    this.lamps = [this.glow, this.sun];
  }

  set(time: TimeOfDay): void {
    if (this.mood === MOODS[time]) return;
    this.mood = MOODS[time];
    this.settled = false;
  }

  update(deltaSeconds: number): void {
    if (this.settled) return;
    const { mood } = this;
    const gap =
      Math.abs(this.sun.intensity - mood.sunStrength) + Math.abs(this.lift - mood.balloonLift);
    // Close enough is finished: the last step lands exactly on the mood and the blending stops.
    const blend = this.instant || gap < SETTLED ? 1 : 1 - Math.exp(-deltaSeconds * RESPONSE);
    this.settled = blend === 1;

    this.sky.lerp(this.goal.set(mood.sky), blend);
    this.tint.lerp(this.goal.set(mood.tint), blend);
    this.sun.color.lerp(this.goal.set(mood.sun), blend);
    this.sun.intensity = MathUtils.lerp(this.sun.intensity, mood.sunStrength, blend);
    this.glow.intensity = MathUtils.lerp(this.glow.intensity, mood.skyStrength, blend);
    this.lift = MathUtils.lerp(this.lift, mood.balloonLift, blend);

    this.scene.setSky(this.sky);
    this.scene.setTint(this.tint);
    this.scene.setBalloonLift(this.lift);
  }
}
