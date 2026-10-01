import type { Tour } from '@/domain/tour/Tour';
import type { TourSnapshot } from './dto/TourData';
import { tourSnapshotSchema } from './dto/tourSchema';
import { toTour } from './tourMapper';

/** A tour as changed in the panel, and the published version it was made from. */
export interface TourDraft {
  /** Fingerprint of the published tour the change started from. */
  readonly base: string;
  readonly tour: TourSnapshot;
  /** ISO 8601 time of the last change. */
  readonly updatedAt: string;
}

/** Where changed tours wait until they are published. */
export interface TourDraftRepository {
  load(): Readonly<Record<string, TourDraft>>;
  save(drafts: Readonly<Record<string, TourDraft>>): void;
}

/** Anything that can say which tours there are right now. */
export interface TourSource {
  tours(): readonly Tour[];
}

/** A change that would leave a tour that cannot exist, such as a seat the coach does not have. */
export class InvalidTourError extends Error {
  override readonly name = 'InvalidTourError';
}

/** JSON with object keys in sorted order, so equal tours read the same whatever built them. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** A short, stable fingerprint of a tour; it changes whenever anything in the tour does. */
export function fingerprint(tour: TourSnapshot): string {
  const text = canonical(tour);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Checks a tour against the content rules and the domain's own; returns it as a domain object. */
export function checkTour(candidate: unknown): { snapshot: TourSnapshot; tour: Tour } {
  const parsed = tourSnapshotSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new InvalidTourError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  try {
    return { snapshot: parsed.data, tour: toTour(parsed.data) };
  } catch (error) {
    throw new InvalidTourError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * The tour catalogue as the office sees it: the published tours with the
 * panel's changes on top. Every change is checked against the same rules as
 * the content files before it is kept, so the panel can never hold a tour the
 * site could not show.
 */
export class TourCatalogEditor implements TourSource {
  private current: { snapshots: TourSnapshot[]; tours: Tour[] } | null = null;

  constructor(
    private readonly published: readonly TourSnapshot[],
    private readonly drafts: TourDraftRepository,
    private readonly now: () => Date,
  ) {}

  snapshots(): readonly TourSnapshot[] {
    return this.state().snapshots;
  }

  tours(): readonly Tour[] {
    return this.state().tours;
  }

  snapshot(tourId: string): TourSnapshot | undefined {
    return this.snapshots().find((tour) => tour.id === tourId);
  }

  tour(tourId: string): Tour | undefined {
    return this.tours().find((tour) => tour.id === tourId);
  }

  /** Whether the panel holds a change to the tour that the site does not show yet. */
  isChanged(tourId: string): boolean {
    return this.drafts.load()[tourId] !== undefined;
  }

  /** Whether the site has published a newer version of the tour since the change began. */
  isStale(tourId: string): boolean {
    const draft = this.drafts.load()[tourId];
    const published = this.published.find((tour) => tour.id === tourId);
    return draft !== undefined && published !== undefined && draft.base !== fingerprint(published);
  }

  /**
   * Applies a change to a tour. The edit receives a copy it may modify; the
   * result is checked and kept, or the change is refused with an
   * InvalidTourError and nothing is stored.
   */
  change(tourId: string, edit: (tour: TourSnapshot) => TourSnapshot): Tour {
    const current = this.snapshot(tourId);
    const published = this.published.find((tour) => tour.id === tourId);
    if (!current || !published) throw new InvalidTourError(`Unknown tour ${tourId}`);
    const { snapshot, tour } = checkTour({ ...edit(structuredClone(current)), id: tourId });

    const others = this.draftsWithout(tourId);
    const base = fingerprint(published);
    // Changed back to what the site shows: there is nothing left to publish.
    this.drafts.save(
      fingerprint(snapshot) === base
        ? others
        : { ...others, [tourId]: { base, tour: snapshot, updatedAt: this.now().toISOString() } },
    );
    this.current = null;
    return tour;
  }

  /** Drops the panel's changes to a tour, so it is shown as the site publishes it. */
  discard(tourId: string): void {
    this.drafts.save(this.draftsWithout(tourId));
    this.current = null;
  }

  private draftsWithout(tourId: string): Record<string, TourDraft> {
    return Object.fromEntries(Object.entries(this.drafts.load()).filter(([id]) => id !== tourId));
  }

  /** Forgets what was worked out, after the drafts were replaced from elsewhere. */
  reload(): void {
    this.current = null;
  }

  private state(): { snapshots: TourSnapshot[]; tours: Tour[] } {
    if (this.current) return this.current;
    const drafts = this.drafts.load();
    const snapshots = this.published.map((tour) => drafts[tour.id]?.tour ?? tour);
    this.current = { snapshots, tours: snapshots.map((snapshot) => toTour(snapshot)) };
    return this.current;
  }
}
