import type { DepartureBooking } from '@/application/BookingService';
import type { Passenger } from '@/domain/booking/Passenger';
import type { Tour } from '@/domain/tour/Tour';
import type { SeatLayout } from '@/domain/vehicle/SeatLayout';
import { tr } from '@/i18n/tr';
import { formatDateRange, formatMoney, formatNumber, formatTime } from '@/shared/format';
import { href } from '../context';
import { el } from './dom';
import { chip, dateTile, icon, occupancyBar, scene } from './kit';

/** Whole days from one ISO date to another. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000,
  );
}

/** "Bugün", "Yarın" or how many days are left. */
export function whenText(startDate: string, today: string): string {
  const days = daysBetween(today, startDate);
  if (days <= 0) return tr.admin.ui.today;
  if (days === 1) return tr.admin.ui.tomorrow;
  return tr.admin.ui.inDays(days);
}

/** What is left of a departure, in words. */
export function seatsText(booking: DepartureBooking): string {
  const { remaining } = booking.departure.occupancy;
  return remaining === 0 ? tr.tour.soldOut : tr.admin.ui.seatsLeft(formatNumber(remaining));
}

/** A departure in a list: its day as a calendar leaf, the tour, the hour and how full it is. */
export function departureRow(
  booking: DepartureBooking,
  options: { readonly showTour?: boolean } = {},
): HTMLElement {
  const { tour, departure } = booking;
  const showTour = options.showTour ?? true;
  return el('a', { class: 'departure-row', attrs: { href: href(`/kalkis/${departure.id}`) } }, [
    dateTile(departure.startDate, departure.occupancy.level),
    el('span', { class: 'departure-row__text' }, [
      el('span', {
        class: 'departure-row__title',
        text: showTour ? tour.title : formatDateRange(departure.startDate, departure.endDate),
      }),
      el('span', {
        class: 'departure-row__meta',
        text: showTour
          ? `${formatDateRange(departure.startDate, departure.endDate)}, ${formatTime(departure.time)}`
          : `${formatTime(departure.time)}, ${departure.meetingPoint}`,
      }),
      el('span', { class: 'departure-row__seats' }, [
        occupancyBar(departure.occupancy),
        el('span', { class: 'tabular', text: seatsText(booking) }),
      ]),
    ]),
    el('span', { class: 'row__chevron' }, [icon('chevron', 18)]),
  ]);
}

/** A tour in the catalogue: its picture, name, price and state. */
export function tourRow(
  tour: Tour,
  options: { readonly hidden: boolean; readonly changed: boolean; readonly today: string },
): HTMLElement {
  const next = tour.nextDeparture(options.today);
  return el('a', { class: 'tour-row', attrs: { href: href(`/turlar/${tour.id}`) } }, [
    el('span', { class: 'tour-row__art' }, [scene(tour.scene)]),
    el('span', { class: 'tour-row__text' }, [
      el('span', { class: 'tour-row__title', text: tour.title }),
      el('span', {
        class: 'tour-row__meta',
        text: next
          ? `${tr.tour.nextDeparture}: ${formatDateRange(next.startDate, next.endDate)}`
          : tr.admin.tours.noDeparture,
      }),
      el('span', { class: 'tour-row__chips' }, [
        el('strong', { class: 'tour-row__price tabular', text: formatMoney(tour.price) }),
        options.hidden ? chip(tr.admin.tours.hidden, 'grey') : chip(tr.admin.tours.live, 'green'),
        options.changed ? chip(tr.admin.tours.changed, 'blue') : null,
      ]),
    ]),
    el('span', { class: 'row__chevron' }, [icon('chevron', 18)]),
  ]);
}

/** A passenger in a list; pressing it opens the record. */
export function passengerRow(
  passenger: Passenger,
  onOpen: (passenger: Passenger) => void,
  options: { readonly context?: string } = {},
): HTMLElement {
  return el(
    'button',
    {
      class: 'passenger-row',
      attrs: { type: 'button' },
      on: { click: () => onOpen(passenger) },
    },
    [
      el(
        'span',
        {
          class: 'seat-badge tabular',
          attrs: { 'aria-label': `${tr.admin.form.seat} ${passenger.seatNumber}` },
        },
        [el('span', { text: String(passenger.seatNumber), attrs: { 'aria-hidden': 'true' } })],
      ),
      el('span', { class: 'passenger-row__text' }, [
        el('span', { class: 'passenger-row__name', text: passenger.fullName }),
        el('span', {
          class: 'passenger-row__meta',
          text: [options.context, passenger.phone.format()].filter(Boolean).join(', '),
        }),
      ]),
      el('span', { class: 'passenger-row__deposit tabular', text: formatMoney(passenger.deposit) }),
    ],
  );
}

export type SeatState = 'free' | 'sold' | 'passenger';

/**
 * The coach seen from above with its seats where they really are. In `pick`
 * mode the seats are radio buttons of a form; in `toggle` mode each free or
 * sold seat can be switched; in `view` mode only seats with a callback react.
 */
export function seatMap(options: {
  readonly layout: SeatLayout;
  readonly stateOf: (seat: number) => SeatState;
  readonly label: string;
  readonly mode: 'pick' | 'toggle' | 'view';
  readonly chosen?: number | null;
  readonly name?: string;
  readonly onSeat?: (seat: number, state: SeatState) => void;
}): HTMLElement {
  const words: Record<SeatState, string> = {
    free: tr.tour.seatFree,
    sold: tr.admin.seats.sold,
    passenger: tr.admin.seats.passenger,
  };
  const seats = options.layout.seats.map((seat) => {
    const state = options.stateOf(seat.number);
    const label = `${tr.admin.form.seat} ${seat.number}, ${words[state]}`;
    let node: HTMLElement;
    if (options.mode === 'pick') {
      const input = el('input', {
        class: 'visually-hidden',
        attrs: {
          type: 'radio',
          name: options.name ?? 'seatNumber',
          value: String(seat.number),
          'aria-label': label,
        },
      });
      input.disabled = state !== 'free';
      input.checked = options.chosen === seat.number;
      node = el('label', { class: 'seat', attrs: { 'data-state': state } }, [
        input,
        el('span', { text: String(seat.number), attrs: { 'aria-hidden': 'true' } }),
      ]);
    } else {
      const reacts =
        options.mode === 'toggle' ? state !== 'passenger' || !!options.onSeat : !!options.onSeat;
      node = reacts
        ? el('button', {
            class: 'seat',
            text: String(seat.number),
            attrs: {
              type: 'button',
              'data-state': state,
              'aria-label': label,
              'aria-pressed': options.mode === 'toggle' ? String(state === 'sold') : undefined,
            },
            on: { click: () => options.onSeat?.(seat.number, state) },
          })
        : el('span', {
            class: 'seat',
            text: String(seat.number),
            attrs: { 'data-state': state, 'aria-label': label, role: 'img' },
          });
    }
    // The aisle is an empty column, so seats sit where they do in the coach.
    node.style.gridColumn = String(seat.column + 1);
    node.style.gridRow = String(seat.row);
    return node;
  });
  const grid = el('div', { class: 'coach__grid' }, seats);
  grid.style.setProperty('--columns', String(options.layout.columnCount));
  return el(
    'div',
    {
      class: 'coach',
      attrs: {
        role: options.mode === 'pick' ? 'radiogroup' : 'group',
        'aria-label': options.label,
      },
    },
    [
      el('div', { class: 'coach__front', attrs: { 'aria-hidden': 'true' } }, [
        el('span', { class: 'coach__wheel' }),
        el('span', { text: tr.tour.front }),
      ]),
      grid,
    ],
  );
}

/** The key under a seat plan. */
export function seatLegend(states: readonly SeatState[]): HTMLElement {
  const words: Record<SeatState, string> = {
    free: tr.tour.seatFree,
    sold: tr.admin.seats.sold,
    passenger: tr.admin.seats.passenger,
  };
  return el(
    'ul',
    { class: 'seat-legend' },
    states.map((state) =>
      el('li', {}, [
        el('span', {
          class: 'seat seat--key',
          attrs: { 'data-state': state, 'aria-hidden': 'true' },
        }),
        words[state],
      ]),
    ),
  );
}
