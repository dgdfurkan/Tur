import { BookingService } from '@/application/BookingService';
import type { FaqEntry } from '@/application/dto/faqSchema';
import type { JourneySnapshot } from '@/application/dto/JourneyData';
import type { TourSnapshot } from '@/application/dto/TourData';
import { openPanelData } from '@/composition/panelData';
import { createBackup, restoreBackup } from '@/infrastructure/backup/PanelBackup';
import { CsvListExporter } from '@/infrastructure/export/CsvListExporter';
import { todayIso } from '@/shared/format';
import { AdminApp } from './AdminApp';
import { required } from './ui/dom';

/** Composition root of the operations panel. */
export function mountAdmin(root: HTMLElement): void {
  const snapshots = JSON.parse(
    required<HTMLScriptElement>(root, '[data-tours]').textContent ?? '[]',
  ) as TourSnapshot[];
  const journeySnapshots = JSON.parse(
    required<HTMLScriptElement>(root, '[data-journeys]').textContent ?? '[]',
  ) as JourneySnapshot[];
  const questions = JSON.parse(
    required<HTMLScriptElement>(root, '[data-faq]').textContent ?? '[]',
  ) as FaqEntry[];
  const { stores, catalog, journeys, faq, settings } = openPanelData(
    snapshots,
    journeySnapshots,
    questions,
  );
  const bookings = new BookingService(
    catalog,
    stores.passengers,
    () => new Date(),
    () => crypto.randomUUID(),
  );

  new AdminApp(root, required(root, '[data-screen-host]'), {
    bookings,
    catalog,
    journeys,
    faq,
    settings,
    exporter: new CsvListExporter(),
    backup: {
      create: () => createBackup(stores, new Date()),
      restore: (text) => restoreBackup(text, stores),
    },
    today: todayIso(),
  }).start();
}
