import { TourCatalogService } from '@/application/TourCatalogService';
import { ContentTourRepository } from '@/infrastructure/content/ContentTourRepository';

/** Composition root for build-time pages: wires the catalogue to its content source. */
const repository = new ContentTourRepository();

export const tourCatalog = new TourCatalogService(repository);

export const loadTourSnapshots = (): ReturnType<ContentTourRepository['snapshots']> =>
  repository.snapshots();
