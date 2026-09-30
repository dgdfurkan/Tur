import type { Departure } from '@/domain/tour/Departure';
import type { Tour, TourCategory } from '@/domain/tour/Tour';
import type { TourRepository } from '@/domain/tour/TourRepository';

export interface ScheduledTour {
  readonly tour: Tour;
  readonly departure: Departure;
}

/** Read-side queries over the tour catalogue. */
export class TourCatalogService {
  constructor(private readonly repository: TourRepository) {}

  /** All tours, nearest destination first, which is how a distance sign lists them. */
  async listTours(): Promise<readonly Tour[]> {
    const tours = await this.repository.findAll();
    return [...tours].sort((a, b) => a.distanceFromOriginKm - b.distanceFromOriginKm);
  }

  async listByCategory(category: TourCategory): Promise<readonly Tour[]> {
    return (await this.listTours()).filter((tour) => tour.category === category);
  }

  async findTour(id: string): Promise<Tour | undefined> {
    return (await this.repository.findAll()).find((tour) => tour.id === id);
  }

  /** Every upcoming departure across all tours, soonest first. */
  async upcomingDepartures(today: string, limit?: number): Promise<readonly ScheduledTour[]> {
    const tours = await this.repository.findAll();
    const scheduled = tours
      .flatMap((tour) => tour.upcomingDepartures(today).map((departure) => ({ tour, departure })))
      .sort((a, b) => a.departure.startDate.localeCompare(b.departure.startDate));
    return limit === undefined ? scheduled : scheduled.slice(0, limit);
  }
}
