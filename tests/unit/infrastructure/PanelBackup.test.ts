import { describe, expect, it } from 'vitest';
import { JourneyArchiveEditor } from '@/application/JourneyArchiveEditor';
import { SiteSettingsService, type SiteSettings } from '@/application/SiteSettings';
import { TourCatalogEditor } from '@/application/TourCatalogEditor';
import { setPrice } from '@/application/tourEdits';
import { Passenger } from '@/domain/booking/Passenger';
import { Phone } from '@/domain/booking/Phone';
import { Money } from '@/domain/shared/Money';
import { createBackup, restoreBackup, type PanelStores } from '@/infrastructure/backup/PanelBackup';
import { LocalFaqDraft } from '@/infrastructure/storage/LocalFaqDraft';
import { LocalJourneyDrafts } from '@/infrastructure/storage/LocalJourneyDrafts';
import { LocalPassengerRepository } from '@/infrastructure/storage/LocalPassengerRepository';
import { LocalSiteSettings } from '@/infrastructure/storage/LocalSiteSettings';
import { LocalTourDrafts } from '@/infrastructure/storage/LocalTourDrafts';
import { memoryStorage, publishedJourneys, publishedTours } from '../support/stores';

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
  hiddenJourneyIds: [],
};

function device(): PanelStores {
  const storage = memoryStorage();
  return {
    passengers: new LocalPassengerRepository(storage),
    drafts: new LocalTourDrafts(storage),
    journeys: new LocalJourneyDrafts(storage),
    faq: new LocalFaqDraft(storage),
    settings: new LocalSiteSettings(storage),
  };
}

const journeyArchive = (stores: PanelStores) =>
  new JourneyArchiveEditor(publishedJourneys(), stores.journeys, () => new Date());

describe('panel backup', () => {
  it('carries passengers, changed tours, journeys and settings to another device', () => {
    const office = device();
    const phone = Phone.parse('0500 000 00 01');
    if (!phone) throw new Error('bad phone');
    office.passengers.save(
      new Passenger({
        id: 'p1',
        departureId: 'kapadokya-2026-11-06',
        fullName: 'Ayşe Yılmaz',
        phone,
        seatNumber: 15,
        deposit: Money.fromLira(500),
        paymentMethod: 'nakit',
        note: '',
        createdAt: '2026-10-01T09:00:00.000Z',
      }),
    );
    new TourCatalogEditor(publishedTours(), office.drafts, () => new Date()).change(
      'kapadokya',
      setPrice(10_500),
    );
    new SiteSettingsService(DEFAULTS, office.settings).update({ phone: '0312 000 00 00' });
    const recorded = journeyArchive(office).create({
      tour: 'safranbolu-amasra',
      title: 'Safranbolu ve Amasra Turu',
      scene: 'konak',
      startDate: '2026-09-12',
      endDate: '2026-09-13',
      group: 'okul',
      guests: 42,
      distanceKm: 590,
      story: 'Bir lisenin öğrencileriyle Safranbolu ve Amasra gezildi.',
      moments: [],
    });

    const file = createBackup(office, new Date('2026-10-01T10:00:00Z'));
    const laptop = device();
    expect(restoreBackup(file, laptop)).toEqual({
      ok: true,
      passengers: 1,
      tours: 1,
      journeys: 1,
    });
    expect(journeyArchive(laptop).journey(recorded.id)?.guests).toBe(42);

    expect(laptop.passengers.findAll().map((passenger) => passenger.fullName)).toEqual([
      'Ayşe Yılmaz',
    ]);
    const catalog = new TourCatalogEditor(publishedTours(), laptop.drafts, () => new Date());
    expect(catalog.tour('kapadokya')?.price.lira).toBe(10_500);
    expect(new SiteSettingsService(DEFAULTS, laptop.settings).get().phone).toBe('0312 000 00 00');
  });

  it('reads a backup made before journeys could be recorded', () => {
    const laptop = device();
    const old = JSON.stringify({
      format: 'tur-panel-yedek',
      version: 1,
      passengers: [],
      tourDrafts: {},
      siteSettings: null,
    });
    expect(restoreBackup(old, laptop)).toEqual({ ok: true, passengers: 0, tours: 0, journeys: 0 });
    expect(laptop.faq.load()).toBeNull();
  });

  it('leaves the device untouched when the file is not a backup of this panel', () => {
    const laptop = device();
    for (const text of ['', '{}', '[]', '{"format":"başka","version":1}', 'not json']) {
      expect(restoreBackup(text, laptop)).toEqual({ ok: false });
    }
  });
});
