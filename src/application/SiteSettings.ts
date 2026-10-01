import { z } from './zod';

/**
 * What the office decides about the public site itself: how the agency is
 * named and reached, what the home page says, and which tours are shown.
 */
export interface SiteSettings {
  readonly brandName: string;
  readonly tursabNumber: string;
  readonly heroTitle: string;
  readonly heroLead: string;
  readonly announcementOn: boolean;
  readonly announcementText: string;
  readonly phone: string;
  readonly whatsapp: string;
  readonly email: string;
  readonly address: string;
  readonly hours: string;
  readonly instagram: string;
  /** Tours kept off the lists of the site; their pages stay reachable by address. */
  readonly hiddenTourIds: readonly string[];
  /** Past journeys kept off the site's lists in the same way. */
  readonly hiddenJourneyIds: readonly string[];
}

const line = (max: number) => z.string().trim().max(max);

export const siteSettingsSchema = z.object({
  brandName: line(60).min(1),
  tursabNumber: line(20),
  heroTitle: line(80).min(1),
  heroLead: line(320).min(1),
  announcementOn: z.boolean(),
  announcementText: line(160),
  phone: line(30),
  whatsapp: line(30),
  email: z.union([z.literal(''), z.email().max(120)]),
  address: line(200),
  hours: line(120),
  instagram: z.union([z.literal(''), z.string().regex(/^@?[A-Za-z0-9._]{1,30}$/)]),
  hiddenTourIds: z.array(z.string().min(1)).max(200),
  // Settings saved before journeys could be hidden have no such list.
  hiddenJourneyIds: z.array(z.string().min(1)).max(500).default([]),
}) satisfies z.ZodType<SiteSettings>;

/** A field of the settings that failed its rules, by name. */
export class InvalidSettingsError extends Error {
  override readonly name = 'InvalidSettingsError';

  constructor(readonly fields: readonly string[]) {
    super(`Invalid site settings: ${fields.join(', ')}`);
  }
}

export interface SiteSettingsRepository {
  /** Whatever was stored last, unchecked; null when nothing was. */
  load(): unknown;
  save(settings: SiteSettings): void;
  clear(): void;
}

/** Reads and changes the site settings; stored values are always checked before use. */
export class SiteSettingsService {
  constructor(
    private readonly defaults: SiteSettings,
    private readonly repository: SiteSettingsRepository,
  ) {}

  get(): SiteSettings {
    const stored = this.repository.load();
    if (typeof stored !== 'object' || stored === null) return this.defaults;
    const parsed = siteSettingsSchema.safeParse({ ...this.defaults, ...stored });
    return parsed.success ? parsed.data : this.defaults;
  }

  /** Changes some settings; refuses the whole change if any field breaks its rules. */
  update(patch: Partial<SiteSettings>): SiteSettings {
    const parsed = siteSettingsSchema.safeParse({ ...this.get(), ...patch });
    if (!parsed.success) {
      throw new InvalidSettingsError([
        ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
      ]);
    }
    this.repository.save(parsed.data);
    return parsed.data;
  }

  isTourHidden(tourId: string): boolean {
    return this.get().hiddenTourIds.includes(tourId);
  }

  setTourHidden(tourId: string, hidden: boolean): void {
    const others = this.get().hiddenTourIds.filter((id) => id !== tourId);
    this.update({ hiddenTourIds: hidden ? [...others, tourId] : others });
  }

  isJourneyHidden(journeyId: string): boolean {
    return this.get().hiddenJourneyIds.includes(journeyId);
  }

  setJourneyHidden(journeyId: string, hidden: boolean): void {
    const others = this.get().hiddenJourneyIds.filter((id) => id !== journeyId);
    this.update({ hiddenJourneyIds: hidden ? [...others, journeyId] : others });
  }

  reset(): void {
    this.repository.clear();
  }
}
