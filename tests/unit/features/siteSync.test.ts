import { describe, expect, it } from 'vitest';
import { readLocalJourneys } from '@/features/site-sync/journeys';
import { readLocalSettings } from '@/features/site-sync/settings';
import { JOURNEY_DRAFTS_KEY, SITE_SETTINGS_KEY } from '@/infrastructure/storage/keys';
import { memoryStorage, publishedJourneys } from '../support/stores';

describe('reading the panel records on a public page', () => {
  it('finds nothing on a visitor’s device', () => {
    const storage = memoryStorage();
    expect(readLocalSettings(storage)).toBeNull();
    expect(readLocalJourneys(storage, new Set()).records.size).toBe(0);
  });

  it('takes the settings it can use and ignores the rest', () => {
    const storage = memoryStorage();
    storage.write(
      SITE_SETTINGS_KEY,
      JSON.stringify({
        brandName: 'Yol Turizm',
        heroTitle: 42,
        phone: '0312 000 00 00',
        announcementOn: true,
        announcementText: 'Kasım turlarında son koltuklar.',
        hiddenTourIds: ['ege-klasikleri', 7],
        hiddenJourneyIds: ['2026-09-18-kapadokya'],
      }),
    );
    const settings = readLocalSettings(storage);
    expect(settings?.text.brandName).toBe('Yol Turizm');
    expect(settings?.text.heroTitle).toBeUndefined();
    expect(settings?.announcementOn).toBe(true);
    expect([...(settings?.hiddenTourIds ?? [])]).toEqual(['ege-klasikleri']);
    expect(settings?.hiddenJourneyIds.has('2026-09-18-kapadokya')).toBe(true);
  });

  it('reads the panel’s journeys, telling recorded ones from changed ones', () => {
    const storage = memoryStorage();
    const [published] = publishedJourneys();
    if (!published) throw new Error('no journeys');
    storage.write(
      JOURNEY_DRAFTS_KEY,
      JSON.stringify({
        [published.id]: { base: 'abc', journey: { ...published, guests: 50 } },
        '2026-09-03-ege-klasikleri': {
          base: null,
          journey: { ...published, id: '2026-09-03-ege-klasikleri', tour: 'ege-klasikleri' },
        },
        'kötü kayıt': { base: null, journey: published },
        bozuk: { base: null, journey: { ...published, scene: 'yok' } },
      }),
    );
    const local = readLocalJourneys(storage, new Set());
    expect(local.records.get(published.id)?.journey.guests).toBe(50);
    expect(local.records.get(published.id)?.isNew).toBe(false);
    expect(local.records.get('2026-09-03-ege-klasikleri')?.isNew).toBe(true);
    expect(local.records.has('kötü kayıt')).toBe(false);
    expect(local.records.has('bozuk')).toBe(false);
  });
});
