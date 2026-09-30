import { BookingService } from '@/application/BookingService';
import type { TourSnapshot } from '@/application/dto/TourData';
import { toTour } from '@/application/tourMapper';
import { CsvListExporter } from '@/infrastructure/export/CsvListExporter';
import { LocalPassengerRepository } from '@/infrastructure/storage/LocalPassengerRepository';
import { SafeStorage } from '@/infrastructure/storage/SafeStorage';
import { todayIso } from '@/shared/format';
import { AdminApp } from './AdminApp';
import { required } from './dom';

/** Composition root of the operations panel. */
export function mountAdmin(root: HTMLElement): void {
  const snapshots = JSON.parse(
    required<HTMLScriptElement>(root, '[data-tours]').textContent ?? '[]',
  ) as TourSnapshot[];
  const bookings = new BookingService(
    snapshots.map(toTour),
    new LocalPassengerRepository(new SafeStorage()),
    () => new Date(),
    () => crypto.randomUUID(),
  );
  new AdminApp(root, bookings, new CsvListExporter(), todayIso()).start(
    new URLSearchParams(location.search).get('bolum'),
  );
}
