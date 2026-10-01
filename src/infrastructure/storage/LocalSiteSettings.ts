import type { SiteSettings, SiteSettingsRepository } from '@/application/SiteSettings';
import { SITE_SETTINGS_KEY } from './keys';
import type { SafeStorage } from './SafeStorage';

/** The site settings in localStorage; SiteSettingsService checks whatever is read back. */
export class LocalSiteSettings implements SiteSettingsRepository {
  constructor(private readonly storage: SafeStorage) {}

  load(): unknown {
    const raw = this.storage.read(SITE_SETTINGS_KEY);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  save(settings: SiteSettings): void {
    this.storage.write(SITE_SETTINGS_KEY, JSON.stringify(settings));
  }

  clear(): void {
    this.storage.remove(SITE_SETTINGS_KEY);
  }
}
