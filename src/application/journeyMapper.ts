import { Journey } from '@/domain/journey/Journey';
import type { JourneySnapshot } from './dto/JourneyData';

/** Builds the domain object from the serializable journey shape. */
export function toJourney(snapshot: JourneySnapshot): Journey {
  return new Journey({
    id: snapshot.id,
    tourId: snapshot.tour,
    title: snapshot.title,
    scene: snapshot.scene,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    group: snapshot.group,
    guests: snapshot.guests,
    distanceKm: snapshot.distanceKm,
    story: snapshot.story,
    moments: snapshot.moments,
  });
}
