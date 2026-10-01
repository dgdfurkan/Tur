import { describe, expect, it } from 'vitest';
import {
  InvalidSettingsError,
  SiteSettingsService,
  type SiteSettings,
} from '@/application/SiteSettings';
import { SITE_SETTINGS_KEY } from '@/infrastructure/storage/keys';
import { LocalSiteSettings } from '@/infrastructure/storage/LocalSiteSettings';
import { memoryStorage } from '../support/stores';

const DEFAULTS: SiteSettings = {
  brandName: 'Ajans Adı',
  tursabNumber: '',
  heroTitle: 'Başlık',
  heroLead: 'Açıklama.',
  announcementOn: false,
  announcementText: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  hours: '',
  instagram: '',
  hiddenTourIds: [],
};

function service(storage = memoryStorage()) {
  return { storage, settings: new SiteSettingsService(DEFAULTS, new LocalSiteSettings(storage)) };
}

describe('SiteSettingsService', () => {
  it('starts from the defaults and keeps a valid change', () => {
    const { settings } = service();
    expect(settings.get()).toEqual(DEFAULTS);
    settings.update({ phone: '0312 000 00 00', instagram: '@ajans' });
    expect(settings.get()).toMatchObject({ phone: '0312 000 00 00', instagram: '@ajans' });
  });

  it('refuses a change with a broken field and names it', () => {
    const { settings } = service();
    try {
      settings.update({ email: 'adres-yok', brandName: '' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSettingsError);
      expect((error as InvalidSettingsError).fields).toEqual(['brandName', 'email']);
    }
    expect(settings.get()).toEqual(DEFAULTS);
  });

  it('hides and shows a tour', () => {
    const { settings } = service();
    settings.setTourHidden('kapadokya', true);
    expect(settings.isTourHidden('kapadokya')).toBe(true);
    settings.setTourHidden('kapadokya', false);
    expect(settings.get().hiddenTourIds).toEqual([]);
  });

  it('falls back to the defaults when the stored settings are damaged', () => {
    const { settings, storage } = service();
    storage.write(SITE_SETTINGS_KEY, JSON.stringify({ email: 42 }));
    expect(settings.get()).toEqual(DEFAULTS);
    storage.write(SITE_SETTINGS_KEY, 'nope');
    expect(settings.get()).toEqual(DEFAULTS);
  });
});
