import type { Departure } from '@/domain/tour/Departure';
import type { Tour } from '@/domain/tour/Tour';
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

  /** Each tour that still has a departure ahead, with that departure, soonest first. */
  async nextDepartures(today: string, limit?: number): Promise<readonly ScheduledTour[]> {
    const tours = await this.repository.findAll();
    const scheduled = tours
      .flatMap((tour) => {
        const departure = tour.nextDeparture(today);
        return departure ? [{ tour, departure }] : [];
      })
      .sort((a, b) => a.departure.startDate.localeCompare(b.departure.startDate));
    return limit === undefined ? scheduled : scheduled.slice(0, limit);
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
