import { getCollection } from 'astro:content';
import { toTour } from '@/application/tourMapper';
import type { TourSnapshot } from '@/application/dto/TourData';
import type { Tour } from '@/domain/tour/Tour';
import type { TourRepository } from '@/domain/tour/TourRepository';

/** Reads tours from the build-time content collection. */
export class ContentTourRepository implements TourRepository {
  async findAll(): Promise<readonly Tour[]> {
    return (await this.snapshots()).map(toTour);
  }

  /** Serializable form, for handing a tour to client-side code. */
  async snapshots(): Promise<readonly TourSnapshot[]> {
    const entries = await getCollection('tours');
    return entries.map((entry) => ({ id: entry.id, ...entry.data }));
  }
}
