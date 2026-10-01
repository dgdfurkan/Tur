import { siteSettingsSchema, type SiteSettingsRepository } from '@/application/SiteSettings';
import type { TourDraftRepository } from '@/application/TourCatalogEditor';
import type { PassengerRepository } from '@/domain/booking/PassengerRepository';
import { LocalPassengerRepository } from '../storage/LocalPassengerRepository';
import { LocalTourDrafts } from '../storage/LocalTourDrafts';

/** Names the file kind, so an unrelated JSON file is never read as a backup. */
export const BACKUP_FORMAT = 'tur-panel-yedek';
const BACKUP_VERSION = 1;

export interface PanelStores {
  readonly passengers: PassengerRepository;
  readonly drafts: TourDraftRepository;
  readonly settings: SiteSettingsRepository;
}

export type RestoreResult =
  | { readonly ok: true; readonly passengers: number; readonly tours: number }
  | { readonly ok: false };

/**
 * Everything the panel keeps on this device in one JSON file: passengers,
 * changed tours and site settings. Until the panel shares its data through a
 * server, a backup is how records move to another device or survive a
 * cleared browser.
 */
export function createBackup(stores: PanelStores, now: Date): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: now.toISOString(),
      passengers: stores.passengers.findAll().map(LocalPassengerRepository.toPlain),
      tourDrafts: stores.drafts.load(),
      siteSettings: stores.settings.load(),
    },
    null,
    2,
  );
}

/**
 * Replaces the device's records with those in a backup. Every record is
 * checked as it would be when read from storage; a file that is not a backup
 * of this panel changes nothing.
 */
export function restoreBackup(text: string, stores: PanelStores): RestoreResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  if (typeof data !== 'object' || data === null) return { ok: false };
  const backup = data as Record<string, unknown>;
  if (backup['format'] !== BACKUP_FORMAT || backup['version'] !== BACKUP_VERSION) {
    return { ok: false };
  }
  const rawPassengers = Array.isArray(backup['passengers']) ? backup['passengers'] : [];
  const passengers = rawPassengers.flatMap((item) => LocalPassengerRepository.revive(item) ?? []);
  const drafts = LocalTourDrafts.revive(backup['tourDrafts']);

  stores.passengers.replaceAll(passengers);
  stores.drafts.save(drafts);
  const settings = siteSettingsSchema.safeParse(backup['siteSettings']);
  if (settings.success) stores.settings.save(settings.data);
  else stores.settings.clear();
  return { ok: true, passengers: passengers.length, tours: Object.keys(drafts).length };
}
