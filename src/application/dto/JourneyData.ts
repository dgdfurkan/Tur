import type { JourneyGroup } from '@/domain/journey/Journey';
import type { SceneKey } from '@/domain/tour/Tour';

/**
 * Serializable shape of a completed journey: a content file, a record the
 * panel keeps on the device, or what is handed to the browser.
 */
export interface MomentData {
  day: number;
  place: string;
  scene: SceneKey;
  note: string;
}

export interface JourneyData {
  tour: string;
  title: string;
  scene: SceneKey;
  startDate: string;
  endDate: string;
  group: JourneyGroup;
  guests: number;
  distanceKm: number;
  story: string;
  moments: MomentData[];
}

export interface JourneySnapshot extends JourneyData {
  id: string;
}
