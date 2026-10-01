import type { FaqEntry } from '@/application/dto/faqSchema';
import type { JourneySnapshot } from '@/application/dto/JourneyData';
import { FaqEditor } from '@/application/FaqEditor';
import type { TourSnapshot } from '@/application/dto/TourData';
import { JourneyArchiveEditor } from '@/application/JourneyArchiveEditor';
import { SiteSettingsService, type SiteSettings } from '@/application/SiteSettings';
import { TourCatalogEditor } from '@/application/TourCatalogEditor';
import { siteConfig } from '@/config/site';
import { LocalFaqDraft } from '@/infrastructure/storage/LocalFaqDraft';
import { LocalJourneyDrafts } from '@/infrastructure/storage/LocalJourneyDrafts';
import { LocalPassengerRepository } from '@/infrastructure/storage/LocalPassengerRepository';
import { LocalSiteSettings } from '@/infrastructure/storage/LocalSiteSettings';
import { LocalTourDrafts } from '@/infrastructure/storage/LocalTourDrafts';
import { SafeStorage } from '@/infrastructure/storage/SafeStorage';

/** The settings the site was built with, which the panel starts from. */
function builtSiteSettings(): SiteSettings {
  const { brand, home, contact, license, announcement } = siteConfig;
  return {
    brandName: brand.name,
    tursabNumber: license.tursabNumber ?? '',
    heroTitle: home.title,
    heroLead: home.lead,
    announcementOn: announcement !== null,
    announcementText: announcement ?? '',
    phone: contact.phone ?? '',
    whatsapp: contact.whatsapp ?? '',
    email: contact.email ?? '',
    address: contact.address ?? '',
    hours: contact.hours ?? '',
    instagram: contact.instagram ?? '',
    hiddenTourIds: [],
    hiddenJourneyIds: [],
  };
}

/**
 * The records the panel keeps on this device, and the services over them.
 * The panel and the video studio both open them here, so they always see the
 * same tours and settings.
 */
export function openPanelData(
  published: readonly TourSnapshot[],
  publishedJourneys: readonly JourneySnapshot[] = [],
  publishedFaq: readonly FaqEntry[] = [],
) {
  const storage = new SafeStorage();
  const stores = {
    passengers: new LocalPassengerRepository(storage),
    drafts: new LocalTourDrafts(storage),
    journeys: new LocalJourneyDrafts(storage),
    faq: new LocalFaqDraft(storage),
    settings: new LocalSiteSettings(storage),
  };
  return {
    stores,
    catalog: new TourCatalogEditor(published, stores.drafts, () => new Date()),
    journeys: new JourneyArchiveEditor(publishedJourneys, stores.journeys, () => new Date()),
    faq: new FaqEditor(publishedFaq, stores.faq, () => new Date()),
    settings: new SiteSettingsService(builtSiteSettings(), stores.settings),
  };
}
