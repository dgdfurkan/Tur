import type { DepartureBooking } from '@/application/BookingService';
import type { Passenger } from '@/domain/booking/Passenger';
import { tr } from '@/i18n/tr';
import type { ListTable } from '@/infrastructure/export/ListExporter';
import { formatDate, formatDateRange, formatMoney } from '@/shared/format';
import { el, required } from './dom';

export interface ListHandlers {
  edit(passenger: Passenger): void;
  remove(passenger: Passenger): void;
  exportList(table: ListTable, fileName: string): void;
  exportEmpty(): void;
}

/** The "passenger list" tab: records of one departure, their changes and the insurance export. */
export class PassengerList {
  private readonly departure: HTMLSelectElement;
  private readonly list: HTMLElement;
  private bookings: readonly DepartureBooking[] = [];
  private chosenByUser = false;

  constructor(
    root: HTMLElement,
    private readonly handlers: ListHandlers,
  ) {
    this.departure = required(root, '[data-list-select]');
    this.list = required(root, '[data-list]');
    this.departure.addEventListener('change', () => {
      this.chosenByUser = true;
      this.renderList();
    });
    required<HTMLButtonElement>(root, '[data-action="export"]').addEventListener('click', () =>
      this.export(),
    );
  }

  render(bookings: readonly DepartureBooking[]): void {
    this.bookings = bookings;
    const chosen = this.departure.value;
    this.departure.replaceChildren(
      ...bookings.map(({ tour, departure, passengers }) =>
        el('option', {
          text: `${tour.title}, ${formatDateRange(departure.startDate, departure.endDate)} (${passengers.length})`,
          attrs: { value: departure.id },
        }),
      ),
    );
    // Until the user picks a departure, open on the first one that has records to show.
    const withRecords = bookings.find(({ passengers }) => passengers.length > 0)?.departure.id;
    const preferred = this.chosenByUser ? chosen : (withRecords ?? chosen);
    if (bookings.some(({ departure }) => departure.id === preferred)) {
      this.departure.value = preferred;
    }
    this.renderList();
  }

  /** Shows the departure a passenger was just added to. */
  select(departureId: string): void {
    this.chosenByUser = true;
    this.departure.value = departureId;
    this.renderList();
  }

  private get current(): DepartureBooking | undefined {
    return this.bookings.find(({ departure }) => departure.id === this.departure.value);
  }

  private renderList(): void {
    const passengers = this.current?.passengers ?? [];
    if (passengers.length === 0) {
      this.list.replaceChildren(el('p', { class: 'list__empty', text: tr.admin.list.empty }));
      return;
    }
    this.list.replaceChildren(
      el(
        'ul',
        { class: 'list' },
        passengers.map((passenger) => this.row(passenger)),
      ),
    );
  }

  private row(passenger: Passenger): HTMLElement {
    const edit = el('button', {
      class: 'list__action',
      text: tr.admin.list.edit,
      attrs: { type: 'button', 'aria-label': `${tr.admin.list.edit}: ${passenger.fullName}` },
    });
    edit.addEventListener('click', () => this.handlers.edit(passenger));
    const remove = el('button', {
      class: 'list__action list__action--remove',
      text: tr.admin.list.remove,
      attrs: { type: 'button', 'aria-label': `${tr.admin.list.remove}: ${passenger.fullName}` },
    });
    remove.addEventListener('click', () => this.handlers.remove(passenger));

    const details = [
      passenger.phone.format(),
      `${formatMoney(passenger.deposit)} ${tr.admin.paymentMethods[passenger.paymentMethod]}`,
    ];
    return el('li', { class: 'list__row' }, [
      el('span', { class: 'list__seat' }, [
        el('span', { class: 'visually-hidden', text: `${tr.admin.list.seat} ` }),
        el('span', { text: String(passenger.seatNumber) }),
      ]),
      el('div', { class: 'list__person' }, [
        el('strong', { text: passenger.fullName }),
        el('span', { text: details.join(', ') }),
        ...(passenger.note === ''
          ? []
          : [el('span', { class: 'list__note', text: passenger.note })]),
      ]),
      el('div', { class: 'list__actions' }, [edit, remove]),
    ]);
  }

  private export(): void {
    const booking = this.current;
    if (!booking || booking.passengers.length === 0) {
      this.handlers.exportEmpty();
      return;
    }
    const { columns } = tr.admin.list;
    const date = formatDate(booking.departure.startDate);
    this.handlers.exportList(
      {
        columns: [
          columns.order,
          columns.fullName,
          columns.phone,
          columns.seat,
          columns.tour,
          columns.date,
        ],
        rows: booking.passengers.map((passenger, index) => [
          String(index + 1),
          passenger.fullName,
          passenger.phone.format(),
          String(passenger.seatNumber),
          booking.tour.title,
          date,
        ]),
      },
      `sigorta-listesi-${booking.departure.id}`,
    );
  }
}
