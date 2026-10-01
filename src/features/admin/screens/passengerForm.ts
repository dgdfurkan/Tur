import type {
  DepartureBooking,
  DraftErrors,
  DraftField,
  DraftProblem,
  PassengerDraft,
} from '@/application/BookingService';
import { PAYMENT_METHODS, type Passenger } from '@/domain/booking/Passenger';
import { tr } from '@/i18n/tr';
import { formatDateRange, formatNumber } from '@/shared/format';
import { type AppContext, type Screen } from '../context';
import { el } from '../ui/dom';
import { block, button, field, group, segmented, screen } from '../ui/kit';
import { tap } from '../ui/motion';
import { seatLegend, seatMap } from '../ui/parts';

const QUICK_DEPOSITS = [500, 1000, 2000, 5000];
const FIELDS: readonly DraftField[] = [
  'departureId',
  'fullName',
  'phone',
  'seatNumber',
  'depositLira',
  'paymentMethod',
];

/** "1.500", "1500" and "1500,50" are all amounts a person might type. */
export function parseLira(input: string): number | null {
  const normalised = input.trim().replace(/[\s₺]/g, '').replace(/\./g, '').replace(',', '.');
  if (normalised === '') return null;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : Number.NaN;
}

function messageFor(field: DraftField, problem: DraftProblem): string {
  const messages: Partial<Record<DraftProblem, string>> = tr.admin.errors[field];
  return messages[problem] ?? messages.required ?? '';
}

/**
 * The form that records a passenger, or changes one. On a phone it is the
 * screen used most, so the seat is chosen on the coach itself and the deposit
 * with one press.
 */
export function passengerFormScreen(options: {
  readonly passengerId?: string;
  readonly departureId?: string | null;
  readonly seat?: number | null;
}): Screen {
  return {
    title: options.passengerId ? tr.admin.form.editTitle : tr.admin.passengers.add,
    render(context: AppContext) {
      const editing: Passenger | undefined = options.passengerId
        ? context.bookings.passengers().find((passenger) => passenger.id === options.passengerId)
        : undefined;
      const bookings = context.bookings.bookings(context.today);
      const title = editing ? tr.admin.form.editTitle : tr.admin.passengers.add;
      const fallback = editing
        ? '/yolcular'
        : options.departureId
          ? `/kalkis/${options.departureId}`
          : '/yolcular';

      if (bookings.length === 0) {
        return screen({ title, back: { href: `#${fallback}`, label: tr.admin.ui.back } }, [
          el('p', { class: 'block__empty', text: tr.admin.home.noDepartures }),
        ]);
      }

      const chosenDeparture =
        bookings.find(
          ({ departure }) => departure.id === (editing?.departureId ?? options.departureId),
        )?.departure.id ??
        bookings[0]?.departure.id ??
        '';

      const departure = el('select', {
        on: { change: () => drawSeats(departure.value, null) },
      });
      departure.append(
        ...bookings.map(({ tour, departure: item, passengers }) => {
          const free =
            item.occupancy.remaining + (editing && editing.departureId === item.id ? 1 : 0);
          return el('option', {
            text: `${tour.title}, ${formatDateRange(item.startDate, item.endDate)} (${tr.admin.ui.seatsLeft(formatNumber(free))})`,
            attrs: { value: item.id, 'data-count': String(passengers.length) },
          });
        }),
      );
      departure.value = chosenDeparture;

      const name = el('input', {
        attrs: { type: 'text', autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'next' },
      });
      const phone = el('input', {
        attrs: { type: 'tel', inputmode: 'tel', autocomplete: 'off', enterkeyhint: 'next' },
      });
      const deposit = el('input', {
        attrs: { type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done' },
      });
      const note = el('textarea', { attrs: { rows: '2', maxlength: '200' } });
      if (editing) {
        name.value = editing.fullName;
        phone.value = editing.phone.format();
        deposit.value = formatNumber(editing.deposit.lira);
        note.value = editing.note;
      }

      const seats = el('div', { class: 'seat-field' });
      const seatError = el('p', {
        class: 'field__error',
        attrs: { 'data-error-for': 'seatNumber' },
      });
      const drawSeats = (departureId: string, chosen: number | null): void => {
        const booking: DepartureBooking | undefined = bookings.find(
          (item) => item.departure.id === departureId,
        );
        if (!booking) {
          seats.replaceChildren();
          return;
        }
        const own = editing?.departureId === departureId ? editing.seatNumber : null;
        const panelSeats = new Set(booking.passengers.map((passenger) => passenger.seatNumber));
        seats.replaceChildren(
          seatMap({
            layout: booking.departure.layout,
            label: tr.admin.form.seat,
            mode: 'pick',
            chosen: chosen ?? own,
            stateOf: (seat) =>
              seat === own || !booking.departure.isBooked(seat)
                ? 'free'
                : panelSeats.has(seat)
                  ? 'passenger'
                  : 'sold',
          }),
          seatLegend(['free', 'sold', 'passenger']),
        );
      };
      drawSeats(chosenDeparture, options.seat ?? null);

      const quick = el(
        'div',
        { class: 'quick' },
        QUICK_DEPOSITS.map((amount) =>
          el('button', {
            class: 'quick__chip tabular',
            text: formatNumber(amount),
            attrs: { type: 'button' },
            on: {
              click: () => {
                deposit.value = formatNumber(amount);
                tap();
              },
            },
          }),
        ),
      );

      const payment = segmented({
        name: 'paymentMethod',
        legend: tr.admin.form.paymentMethod,
        value: editing?.paymentMethod ?? 'nakit',
        choices: PAYMENT_METHODS.map((method) => ({
          value: method,
          label: tr.admin.paymentMethods[method],
        })),
      });

      const form = el('form', { class: 'form', attrs: { novalidate: '' } }, [
        block(null, [
          group(
            [field({ label: tr.admin.form.departure, control: departure, name: 'departureId' })],
            'group--form',
          ),
        ]),
        block(tr.admin.form.person, [
          group(
            [
              field({ label: tr.admin.form.fullName, control: name, name: 'fullName' }),
              field({
                label: tr.admin.form.phone,
                control: phone,
                name: 'phone',
                hint: tr.admin.form.phoneHint,
              }),
            ],
            'group--form',
          ),
        ]),
        block(tr.admin.form.seat, [seats, seatError], { footnote: tr.admin.form.seatHint }),
        block(tr.admin.form.payment, [
          group(
            [
              el('div', { class: 'field' }, [
                field({ label: tr.admin.form.deposit, control: deposit, name: 'depositLira' }),
                quick,
              ]),
              payment,
              el('p', { class: 'field__error', attrs: { 'data-error-for': 'paymentMethod' } }),
            ],
            'group--form',
          ),
        ]),
        block(tr.admin.form.note, [
          group(
            [
              field({
                label: tr.admin.form.note,
                control: note,
                name: 'note',
                hint: tr.admin.form.noteHint,
              }),
            ],
            'group--form',
          ),
        ]),
        el('div', { class: 'save-bar' }, [
          button({
            label: editing ? tr.admin.form.update : tr.admin.form.submit,
            type: 'submit',
            size: 'lg',
            block: true,
          }),
        ]),
      ]);

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const text = (key: string): string => {
          const value = data.get(key);
          return typeof value === 'string' ? value : '';
        };
        const seat = text('seatNumber');
        const draft: PassengerDraft = {
          departureId: text('departureId'),
          fullName: text('fullName'),
          phone: text('phone'),
          seatNumber: seat === '' ? null : Number(seat),
          depositLira: parseLira(text('depositLira')),
          paymentMethod: text('paymentMethod'),
          note: text('note'),
        };
        const result = editing
          ? context.bookings.updatePassenger(editing, draft)
          : context.bookings.addPassenger(draft);
        if (!result.ok) {
          showErrors(form, result.errors);
          context.toast.show(tr.admin.form.fixErrors);
          return;
        }
        tap();
        context.toast.show(editing ? tr.admin.form.updated : tr.admin.form.saved);
        context.back(`/kalkis/${result.passenger.departureId}`);
      });

      return screen({ title, back: { href: `#${fallback}`, label: tr.admin.ui.back } }, [form]);
    },
  };
}

/** Marks every field with a problem and moves to the first of them. */
function showErrors(form: HTMLFormElement, errors: DraftErrors): void {
  let first: HTMLElement | undefined;
  for (const name of FIELDS) {
    const problem = errors[name];
    for (const message of form.querySelectorAll<HTMLElement>(`[data-error-for="${name}"]`)) {
      message.textContent = problem ? messageFor(name, problem) : '';
    }
    for (const control of form.querySelectorAll<HTMLElement>(`[name="${name}"]`)) {
      if (problem) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
      const disabled = control instanceof HTMLInputElement && control.disabled;
      if (problem && !first && !disabled) first = control;
    }
  }
  if (errors.seatNumber && !first)
    first = form.querySelector<HTMLElement>('.seat-field') ?? undefined;
  first?.focus();
  first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
