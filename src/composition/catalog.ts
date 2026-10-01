import { JourneyArchive } from '@/application/JourneyArchive';
import { TourCatalogService } from '@/application/TourCatalogService';
import { ContentJourneyRepository } from '@/infrastructure/content/ContentJourneyRepository';
import { ContentTourRepository } from '@/infrastructure/content/ContentTourRepository';

export { loadFaq } from '@/infrastructure/content/ContentFaq';

/** Composition root for build-time pages: wires the catalogue and the archive to their content. */
const tours = new ContentTourRepository();
const journeys = new ContentJourneyRepository();

export const tourCatalog = new TourCatalogService(tours);

export const journeyArchive = new JourneyArchive(journeys);

export const loadTourSnapshots = (): ReturnType<ContentTourRepository['snapshots']> =>
  tours.snapshots();

export const loadJourneySnapshots = (): ReturnType<ContentJourneyRepository['snapshots']> =>
  journeys.snapshots();
