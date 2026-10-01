import { byLatest, type Journey, type JourneyGroup } from '@/domain/journey/Journey';
import type { JourneyRepository } from '@/domain/journey/JourneyRepository';

/** Read-side queries over the completed journeys. */
export class JourneyArchive {
  constructor(private readonly repository: JourneyRepository) {}

  /** Every journey, the latest first. */
  async list(): Promise<readonly Journey[]> {
    return [...(await this.repository.findAll())].sort(byLatest);
  }

  /** The journeys made on one tour, the latest first. */
  async ofTour(tourId: string): Promise<readonly Journey[]> {
    return (await this.list()).filter((journey) => journey.tourId === tourId);
  }

  /** The journeys made by some kinds of group, the latest first. */
  async ofGroups(groups: readonly JourneyGroup[]): Promise<readonly Journey[]> {
    return (await this.list()).filter((journey) => groups.includes(journey.group));
  }
}
