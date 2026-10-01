import type {
  DepartureBooking,
  DraftErrors,
  DraftField,
  DraftProblem,
  PassengerDraft,
} from '@/application/BookingService';
import type { Passenger } from '@/domain/booking/Passenger';
import { tr } from '@/i18n/tr';
import { formatDateRange, formatNumber } from '@/shared/format';
import { el, required } from './dom';

const FIELDS: readonly DraftField[] = [
  'departureId',
  'fullName',
  'phone',
  'seatNumber',
  'depositLira',
  'paymentMethod',
];

export interface FormHandlers {
  /** Saves the draft, as a new record or over the one being edited; returns what was wrong with it. */
  save(draft: PassengerDraft, editing: Passenger | null): DraftErrors | null;
  /** The record being edited is left as it was. */
  cancel(): void;
}

/** "1.500", "1500" and "1500,50" are all amounts a person might type. */
function parseLira(input: string): number | null {
  const normalised = input.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (normalised === '') return null;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : Number.NaN;
}

function messageFor(field: DraftField, problem: DraftProblem): string {
  const messages: Partial<Record<DraftProblem, string>> = tr.admin.errors[field];
  return messages[problem] ?? messages.required ?? '';
}

/**
 * The "add passenger" tab: departure, identity, seat and deposit in one form.
 * The same form edits a record chosen from the list.
 */
export class PassengerForm {
  private readonly form: HTMLFormElement;
  private readonly title: HTMLElement;
  private readonly submitLabel: HTMLElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly departure: HTMLSelectElement;
  private readonly seats: HTMLElement;
  private readonly deposit: HTMLInputElement;
  private bookings: readonly DepartureBooking[] = [];
  private editing: Passenger | null = null;

  constructor(
    section: HTMLElement,
    private readonly handlers: FormHandlers,
  ) {
    this.form = required(section, '[data-form]');
    this.title = required(section, 'h1');
    this.submitLabel = required(section, '[data-submit-label]');
    this.cancelButton = required(section, '[data-action="cancel-edit"]');
    this.departure = required(this.form, '[name="departureId"]');
    this.seats = required(this.form, '[data-seat-picker]');
    this.deposit = required(this.form, '[name="depositLira"]');

    this.departure.addEventListener('change', () => this.renderSeats());
    this.form.addEventListener('click', (event) => {
      const amount =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-deposit]')?.dataset['deposit']
          : undefined;
      if (amount !== undefined) this.deposit.value = amount;
    });
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });
    this.cancelButton.addEventListener('click', () => {
      this.stopEditing();
      handlers.cancel();
    });
  }

  /** Refreshes the departure options and seat plan after any change to the data. */
  render(bookings: readonly DepartureBooking[]): void {
    this.bookings = bookings;
    const chosen = this.departure.value;
    this.departure.replaceChildren(
      ...bookings.map(({ tour, departure }) =>
        el('option', {
          text: `${tour.title}, ${formatDateRange(departure.startDate, departure.endDate)}`,
          attrs: { value: departure.id },
        }),
      ),
    );
    if (bookings.some(({ departure }) => departure.id === chosen)) this.departure.value = chosen;
    this.renderSeats();
  }

  /** Fills the form with a record, whose changes are then saved over it. */
  edit(passenger: Passenger): void {
    this.editing = passenger;
    this.showErrors({}, false);
    this.departure.value = passenger.departureId;
    this.field('fullName').value = passenger.fullName;
    this.field('phone').value = passenger.phone.format();
    this.deposit.value = formatNumber(passenger.deposit.lira);
    this.field('note').value = passenger.note;
    required<HTMLInputElement>(
      this.form,
      `[name="paymentMethod"][value="${passenger.paymentMethod}"]`,
    ).checked = true;
    this.setMode();
    this.renderSeats();
  }

  private renderSeats(): void {
    const booking = this.bookings.find(({ departure }) => departure.id === this.departure.value);
    if (!booking) {
      this.seats.replaceChildren();
      return;
    }
    const { layout } = booking.departure;
    // The record being edited holds its own seat; to the form that seat is free and chosen.
    const own = this.editing?.departureId === booking.departure.id ? this.editing.seatNumber : null;
    this.seats.replaceChildren(
      ...layout.seats.map((seat) => {
        const taken = booking.departure.isBooked(seat.number) && seat.number !== own;
        const input = el('input', {
          class: 'visually-hidden',
          attrs: { type: 'radio', name: 'seatNumber', value: String(seat.number) },
        });
        input.disabled = taken;
        input.checked = seat.number === own;
        const label = el('label', { class: 'seat-option' }, [
          input,
          el('span', { text: String(seat.number) }),
          el('span', {
            class: 'visually-hidden',
            text: `. ${tr.admin.form.seat}, ${taken ? tr.tour.seatTaken : tr.tour.seatFree}`,
          }),
        ]);
        // The aisle is an empty grid column, so seats sit where they do in the coach.
        label.style.gridColumn = String(seat.column + 1);
        label.style.gridRow = String(seat.row);
        return label;
      }),
    );
  }

  private submit(): void {
    const data = new FormData(this.form);
    const text = (name: string): string => {
      const value = data.get(name);
      return typeof value === 'string' ? value : '';
    };
    const seat = text('seatNumber');
    const editing = this.editing;
    const errors = this.handlers.save(
      {
        departureId: text('departureId'),
        fullName: text('fullName'),
        phone: text('phone'),
        seatNumber: seat === '' ? null : Number(seat),
        depositLira: parseLira(text('depositLira')),
        paymentMethod: text('paymentMethod'),
        note: text('note'),
      },
      editing,
    );
    this.showErrors(errors ?? {}, true);
    if (errors !== null) return;
    if (editing) {
      this.stopEditing();
    } else {
      this.clearPerson();
      this.field('fullName').focus();
    }
  }

  /** Back to adding passengers, with nothing of the edited record left in the form. */
  private stopEditing(): void {
    this.editing = null;
    this.showErrors({}, false);
    this.clearPerson();
    this.setMode();
    this.renderSeats();
  }

  private setMode(): void {
    const editing = this.editing !== null;
    this.title.textContent = editing ? tr.admin.form.editTitle : tr.admin.tabs.add;
    this.submitLabel.textContent = editing ? tr.admin.form.update : tr.admin.form.submit;
    this.cancelButton.hidden = !editing;
  }

  private showErrors(errors: DraftErrors, moveFocus: boolean): void {
    let firstInvalid: HTMLElement | undefined;
    for (const field of FIELDS) {
      const problem = errors[field];
      const message = required<HTMLElement>(this.form, `[data-error-for="${field}"]`);
      message.textContent = problem ? messageFor(field, problem) : '';
      for (const control of this.form.querySelectorAll<HTMLElement>(`[name="${field}"]`)) {
        if (problem) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
        const disabled = control instanceof HTMLInputElement && control.disabled;
        if (problem && !firstInvalid && !disabled) firstInvalid = control;
      }
    }
    if (moveFocus) firstInvalid?.focus();
  }

  /** After a save the departure and payment method stay; the next passenger usually shares them. */
  private clearPerson(): void {
    for (const name of ['fullName', 'phone', 'depositLira', 'note']) this.field(name).value = '';
  }

  private field(name: string): HTMLInputElement | HTMLTextAreaElement {
    return required<HTMLInputElement | HTMLTextAreaElement>(this.form, `[name="${name}"]`);
  }
}
