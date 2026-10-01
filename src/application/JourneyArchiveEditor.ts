import { byLatest, type Journey } from '@/domain/journey/Journey';
import type { JourneyData, JourneySnapshot } from './dto/JourneyData';
import { journeySnapshotSchema } from './dto/journeySchema';
import { fingerprint } from './fingerprint';
import { toJourney } from './journeyMapper';

/** A journey as changed or recorded in the panel. */
export interface JourneyDraft {
  /** Fingerprint of the published journey the change started from; null when it was recorded here. */
  readonly base: string | null;
  readonly journey: JourneySnapshot;
  /** ISO 8601 time of the last change. */
  readonly updatedAt: string;
}

/** Where journeys changed or recorded in the panel wait until they are published. */
export interface JourneyDraftRepository {
  load(): Readonly<Record<string, JourneyDraft>>;
  save(drafts: Readonly<Record<string, JourneyDraft>>): void;
}

/** A change that would leave a journey that cannot have happened, such as one ending before it starts. */
export class InvalidJourneyError extends Error {
  override readonly name = 'InvalidJourneyError';
}

/** Checks a journey against the content rules and the domain's own. */
export function checkJourney(candidate: unknown): { snapshot: JourneySnapshot; journey: Journey } {
  const parsed = journeySnapshotSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new InvalidJourneyError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  try {
    return { snapshot: parsed.data, journey: toJourney(parsed.data) };
  } catch (error) {
    throw new InvalidJourneyError(error instanceof Error ? error.message : String(error), {
      cause: error,
    });
  }
}

/** The address of a journey: the day it started and its tour, numbered when that is taken. */
export function journeyId(
  data: Pick<JourneyData, 'startDate' | 'tour'>,
  taken: (id: string) => boolean,
): string {
  const base = `${data.startDate}-${data.tour}`;
  let id = base;
  for (let n = 2; taken(id); n += 1) id = `${base}-${n}`;
  return id;
}

/**
 * The past journeys as the office sees them: the published ones with the
 * panel's changes on top, and the ones recorded in the panel that the site
 * does not show yet. Every change is checked against the content rules before
 * it is kept.
 */
export class JourneyArchiveEditor {
  private current: { snapshots: JourneySnapshot[]; journeys: Journey[] } | null = null;

  constructor(
    private readonly published: readonly JourneySnapshot[],
    private readonly drafts: JourneyDraftRepository,
    private readonly now: () => Date,
  ) {}

  /** Every journey, the latest first. */
  journeys(): readonly Journey[] {
    return this.state().journeys;
  }

  journey(id: string): Journey | undefined {
    return this.journeys().find((journey) => journey.id === id);
  }

  snapshot(id: string): JourneySnapshot | undefined {
    return this.state().snapshots.find((journey) => journey.id === id);
  }

  /** Recorded in the panel and not on the site yet. */
  isNew(id: string): boolean {
    return this.drafts.load()[id] !== undefined && !this.isPublished(id);
  }

  /** Published, with a change in the panel that the site does not show yet. */
  isChanged(id: string): boolean {
    return this.drafts.load()[id] !== undefined && this.isPublished(id);
  }

  /** Whether the site has published a newer version of the journey since the change began. */
  isStale(id: string): boolean {
    const draft = this.drafts.load()[id];
    const published = this.published.find((journey) => journey.id === id);
    return draft !== undefined && published !== undefined && draft.base !== fingerprint(published);
  }

  /** Records a journey the site does not have yet. */
  create(data: JourneyData): Journey {
    const id = journeyId(data, (candidate) => this.snapshot(candidate) !== undefined);
    const { snapshot, journey } = checkJourney({ ...data, id });
    this.drafts.save({ ...this.drafts.load(), [id]: this.draft(null, snapshot) });
    this.current = null;
    return journey;
  }

  /**
   * Applies a change to a journey. The edit receives a copy it may modify; the
   * result is checked and kept, or refused with an InvalidJourneyError.
   */
  change(id: string, edit: (journey: JourneySnapshot) => JourneySnapshot): Journey {
    const current = this.snapshot(id);
    if (!current) throw new InvalidJourneyError(`Unknown journey ${id}`);
    const { snapshot, journey } = checkJourney({ ...edit(structuredClone(current)), id });
    const others = this.draftsWithout(id);
    const published = this.published.find((item) => item.id === id);
    if (published) {
      const base = fingerprint(published);
      // Changed back to what the site shows: there is nothing left to publish.
      this.drafts.save(
        fingerprint(snapshot) === base ? others : { ...others, [id]: this.draft(base, snapshot) },
      );
    } else {
      this.drafts.save({ ...others, [id]: this.draft(null, snapshot) });
    }
    this.current = null;
    return journey;
  }

  /** Forgets a journey recorded in the panel. A published one can only be hidden. */
  remove(id: string): void {
    if (!this.isNew(id)) throw new InvalidJourneyError(`Journey ${id} is on the site`);
    this.drafts.save(this.draftsWithout(id));
    this.current = null;
  }

  /** Drops the panel's changes to a published journey, so it reads as the site shows it. */
  discard(id: string): void {
    this.drafts.save(this.draftsWithout(id));
    this.current = null;
  }

  /** Forgets what was worked out, after the drafts were replaced from elsewhere. */
  reload(): void {
    this.current = null;
  }

  private isPublished(id: string): boolean {
    return this.published.some((journey) => journey.id === id);
  }

  private draft(base: string | null, journey: JourneySnapshot): JourneyDraft {
    return { base, journey, updatedAt: this.now().toISOString() };
  }

  private draftsWithout(id: string): Record<string, JourneyDraft> {
    return Object.fromEntries(Object.entries(this.drafts.load()).filter(([key]) => key !== id));
  }

  private state(): { snapshots: JourneySnapshot[]; journeys: Journey[] } {
    if (this.current) return this.current;
    const drafts = this.drafts.load();
    const snapshots = [
      ...this.published.map((journey) => drafts[journey.id]?.journey ?? journey),
      ...Object.entries(drafts)
        .filter(([id]) => !this.isPublished(id))
        .map(([, draft]) => draft.journey),
    ];
    this.current = { snapshots, journeys: snapshots.map(toJourney).sort(byLatest) };
    return this.current;
  }
}
