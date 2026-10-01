import type { BookingService, DraftErrors, PassengerDraft } from '@/application/BookingService';
import type { Passenger } from '@/domain/booking/Passenger';
import { tr } from '@/i18n/tr';
import type { ListExporter, ListTable } from '@/infrastructure/export/ListExporter';
import { required } from './dom';
import { PassengerForm } from './PassengerForm';
import { PassengerList } from './PassengerList';
import { SAMPLE_PEOPLE } from './sampleData';
import { SummaryView } from './SummaryView';
import { Toast } from './Toast';

type ViewName = 'ozet' | 'ekle' | 'liste';

/** How many departures the sample passengers are spread over. */
const SAMPLE_DEPARTURES = 2;

const isViewName = (value: string | undefined): value is ViewName =>
  value === 'ozet' || value === 'ekle' || value === 'liste';

/**
 * The operations panel. It owns navigation between the three tabs and
 * re-renders every view from the booking service after each change, so the
 * views hold no records of their own; the form only remembers which record
 * it is editing.
 */
export class AdminApp {
  private readonly summary: SummaryView;
  private readonly form: PassengerForm;
  private readonly list: PassengerList;
  private readonly toast: Toast;
  private readonly tabs: HTMLButtonElement[];

  constructor(
    private readonly root: HTMLElement,
    private readonly bookings: BookingService,
    private readonly exporter: ListExporter,
    private readonly today: string,
  ) {
    this.summary = new SummaryView(required(root, '[data-panel="ozet"]'));
    this.form = new PassengerForm(required(root, '[data-panel="ekle"]'), {
      save: (draft, editing) => this.save(draft, editing),
      cancel: () => this.show('liste', true),
    });
    this.list = new PassengerList(required(root, '[data-panel="liste"]'), {
      edit: (passenger) => this.edit(passenger),
      remove: (passenger) => this.remove(passenger),
      exportList: (table, fileName) => this.download(table, fileName),
      exportEmpty: () => this.toast.show(tr.admin.list.exportEmpty),
    });
    this.toast = new Toast(required(root, '[data-toast]'));
    this.tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];

    for (const tab of this.tabs) {
      tab.addEventListener('click', () => {
        const view = tab.dataset['tab'];
        if (isViewName(view)) this.show(view, true);
      });
    }
    required<HTMLButtonElement>(root, '[data-action="samples"]').addEventListener('click', () =>
      this.loadSamples(),
    );
    required<HTMLButtonElement>(root, '[data-action="reset"]').addEventListener('click', () => {
      this.bookings.clear();
      this.refresh();
      this.toast.show(tr.admin.dataCleared);
    });
  }

  /** @param section The section to open first, as named in the address by the tab bar of other pages. */
  start(section?: string | null): void {
    this.refresh();
    this.show(isViewName(section ?? undefined) ? (section as ViewName) : 'ozet', false);
    this.root.dataset['ready'] = 'true';
  }

  private show(view: ViewName, moveFocus: boolean): void {
    this.root.dataset['view'] = view;
    for (const tab of this.tabs) {
      if (tab.dataset['tab'] === view) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    // Screen reader users land on the heading of the section they opened.
    if (moveFocus) required<HTMLElement>(this.root, `[data-panel="${view}"] h1`).focus();
  }

  private refresh(): void {
    const bookings = this.bookings.bookings(this.today);
    this.summary.render(this.bookings.summary(this.today), bookings);
    this.form.render(bookings);
    this.list.render(bookings);
  }

  private save(draft: PassengerDraft, editing: Passenger | null): DraftErrors | null {
    const result = editing
      ? this.bookings.updatePassenger(editing, draft)
      : this.bookings.addPassenger(draft);
    if (!result.ok) {
      this.toast.show(tr.admin.form.fixErrors);
      return result.errors;
    }
    this.refresh();
    this.list.select(result.passenger.departureId);
    // A changed record is shown where it now stands; after adding, the next passenger usually follows.
    if (editing) this.show('liste', true);
    this.toast.show(editing ? tr.admin.form.updated : tr.admin.form.saved);
    return null;
  }

  private edit(passenger: Passenger): void {
    this.form.edit(passenger);
    this.show('ekle', true);
  }

  private remove(passenger: Passenger): void {
    this.bookings.removePassenger(passenger.id);
    this.refresh();
    this.toast.show(tr.admin.list.removed, {
      label: tr.admin.list.undo,
      run: () => {
        const restored = this.bookings.restorePassenger(passenger);
        this.refresh();
        this.toast.show(restored ? tr.admin.list.restored : tr.admin.list.restoreFailed);
      },
    });
  }

  /** Spreads the sample passengers over the two nearest departures that have room for them. */
  private loadSamples(): void {
    const perDeparture = Math.ceil(SAMPLE_PEOPLE.length / SAMPLE_DEPARTURES);
    const targets = this.bookings
      .bookings(this.today)
      .filter(({ departure }) => departure.occupancy.remaining >= perDeparture)
      .slice(0, SAMPLE_DEPARTURES);
    SAMPLE_PEOPLE.forEach((person, index) => {
      const target = targets[index % Math.max(1, targets.length)];
      if (!target) return;
      // Re-read the departure so seats taken earlier in this loop are excluded.
      const seat = this.bookings.booking(target.departure.id)?.departure.freeSeats[0];
      if (seat === undefined) return;
      this.bookings.addPassenger({ ...person, departureId: target.departure.id, seatNumber: seat });
    });
    this.refresh();
    this.toast.show(tr.admin.samplesLoaded);
  }

  private download(table: ListTable, fileName: string): void {
    const blob = new Blob([this.exporter.export(table)], { type: this.exporter.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.${this.exporter.extension}`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.show(tr.admin.list.exported);
  }
}
