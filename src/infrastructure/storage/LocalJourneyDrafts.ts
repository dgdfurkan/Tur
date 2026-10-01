import {
  checkJourney,
  type JourneyDraft,
  type JourneyDraftRepository,
} from '@/application/JourneyArchiveEditor';
import { JOURNEY_DRAFTS_KEY } from './keys';
import type { SafeStorage } from './SafeStorage';

/**
 * The panel's changed and recorded journeys in localStorage. Each one is
 * checked against the journey rules when read, so a damaged or tampered entry
 * is dropped instead of reaching the panel.
 */
export class LocalJourneyDrafts implements JourneyDraftRepository {
  constructor(private readonly storage: SafeStorage) {}

  load(): Readonly<Record<string, JourneyDraft>> {
    const raw = this.storage.read(JOURNEY_DRAFTS_KEY);
    if (raw === null) return {};
    try {
      return LocalJourneyDrafts.revive(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  save(drafts: Readonly<Record<string, JourneyDraft>>): void {
    if (Object.keys(drafts).length === 0) this.storage.remove(JOURNEY_DRAFTS_KEY);
    else this.storage.write(JOURNEY_DRAFTS_KEY, JSON.stringify(drafts));
  }

  /** Keeps the entries that are whole and valid. */
  static revive(value: unknown): Record<string, JourneyDraft> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const drafts: Record<string, JourneyDraft> = {};
    for (const [id, entry] of Object.entries(value)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const { base, journey, updatedAt } = entry as Record<string, unknown>;
      if ((typeof base !== 'string' && base !== null) || typeof updatedAt !== 'string') continue;
      try {
        const { snapshot } = checkJourney(journey);
        if (snapshot.id === id) drafts[id] = { base, journey: snapshot, updatedAt };
      } catch {
        // A draft that breaks the rules is dropped.
      }
    }
    return drafts;
  }
}
