import { getCollection } from 'astro:content';
import type { JourneySnapshot } from '@/application/dto/JourneyData';
import { toJourney } from '@/application/journeyMapper';
import type { Journey } from '@/domain/journey/Journey';
import type { JourneyRepository } from '@/domain/journey/JourneyRepository';

/** Reads completed journeys from the build-time content collection. */
export class ContentJourneyRepository implements JourneyRepository {
  async findAll(): Promise<readonly Journey[]> {
    return (await this.snapshots()).map(toJourney);
  }

  /** Serializable form, for handing the journeys to the panel. */
  async snapshots(): Promise<readonly JourneySnapshot[]> {
    const entries = await getCollection('journeys');
    return entries.map((entry) => ({ id: entry.id, ...entry.data }));
  }
}
