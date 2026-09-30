import type {
  DepartureBooking,
  DraftErrors,
  DraftField,
  DraftProblem,
  PassengerDraft,
} from '@/application/BookingService';
import { tr } from '@/i18n/tr';
import { formatDateRange } from '@/shared/format';
import { el, required } from './dom';

const FIELDS: readonly DraftField[] = [
  'departureId',
  'fullName',
  'phone',
  'seatNumber',
  'depositLira',
  'paymentMethod',
];

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

/** The "add passenger" tab: departure, identity, seat and deposit in one form. */
export class PassengerForm {
  private readonly departure: HTMLSelectElement;
  private readonly seats: HTMLElement;
  private readonly deposit: HTMLInputElement;
  private bookings: readonly DepartureBooking[] = [];

  constructor(
    private readonly form: HTMLFormElement,
    private readonly onSubmit: (draft: PassengerDraft) => DraftErrors | null,
  ) {
    this.departure = required(form, '[name="departureId"]');
    this.seats = required(form, '[data-seat-picker]');
    this.deposit = required(form, '[name="depositLira"]');

    this.departure.addEventListener('change', () => this.renderSeats());
    form.addEventListener('click', (event) => {
      const amount =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-deposit]')?.dataset['deposit']
          : undefined;
      if (amount !== undefined) this.deposit.value = amount;
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
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

  private renderSeats(): void {
    const booking = this.bookings.find(({ departure }) => departure.id === this.departure.value);
    if (!booking) {
      this.seats.replaceChildren();
      return;
    }
    const { layout } = booking.departure;
    this.seats.replaceChildren(
      ...layout.seats.map((seat) => {
        const taken = booking.departure.isBooked(seat.number);
        const input = el('input', {
          class: 'visually-hidden',
          attrs: { type: 'radio', name: 'seatNumber', value: String(seat.number) },
        });
        input.disabled = taken;
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
    const errors = this.onSubmit({
      departureId: text('departureId'),
      fullName: text('fullName'),
      phone: text('phone'),
      seatNumber: seat === '' ? null : Number(seat),
      depositLira: parseLira(text('depositLira')),
      paymentMethod: text('paymentMethod'),
      note: text('note'),
    });
    this.showErrors(errors ?? {});
    if (errors === null) this.clearPerson();
  }

  private showErrors(errors: DraftErrors): void {
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
    firstInvalid?.focus();
  }

  /** After a save the departure and payment method stay; the next passenger usually shares them. */
  private clearPerson(): void {
    for (const name of ['fullName', 'phone', 'depositLira', 'note']) {
      required<HTMLInputElement | HTMLTextAreaElement>(this.form, `[name="${name}"]`).value = '';
    }
    required<HTMLInputElement>(this.form, '[name="fullName"]').focus();
  }
}
