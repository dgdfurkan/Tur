import {
  checkTour,
  type TourDraft,
  type TourDraftRepository,
} from '@/application/TourCatalogEditor';
import { TOUR_DRAFTS_KEY } from './keys';
import type { SafeStorage } from './SafeStorage';

/**
 * The panel's changed tours in localStorage. Each one is checked against the
 * tour rules when read, so a damaged or tampered entry is dropped instead of
 * reaching the panel.
 */
export class LocalTourDrafts implements TourDraftRepository {
  constructor(private readonly storage: SafeStorage) {}

  load(): Readonly<Record<string, TourDraft>> {
    const raw = this.storage.read(TOUR_DRAFTS_KEY);
    if (raw === null) return {};
    try {
      return LocalTourDrafts.revive(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  save(drafts: Readonly<Record<string, TourDraft>>): void {
    if (Object.keys(drafts).length === 0) this.storage.remove(TOUR_DRAFTS_KEY);
    else this.storage.write(TOUR_DRAFTS_KEY, JSON.stringify(drafts));
  }

  /** Keeps the entries that are whole and valid. */
  static revive(value: unknown): Record<string, TourDraft> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const drafts: Record<string, TourDraft> = {};
    for (const [tourId, entry] of Object.entries(value)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const { base, tour, updatedAt } = entry as Record<string, unknown>;
      if (typeof base !== 'string' || typeof updatedAt !== 'string') continue;
      try {
        const { snapshot } = checkTour(tour);
        if (snapshot.id === tourId) drafts[tourId] = { base, tour: snapshot, updatedAt };
      } catch {
        // A draft that breaks the rules is dropped.
      }
    }
    return drafts;
  }
}
