import type { BookingSummary, DepartureBooking } from '@/application/BookingService';
import type { Occupancy } from '@/domain/tour/Occupancy';
import { formatDateRange, formatMoney, formatNumber } from '@/shared/format';
import { occupancyText } from '@/shared/occupancyText';
import { el, required } from './dom';

/** Builds an occupancy meter; the panel and the public site word it the same way. */
export function occupancyMeter(occupancy: Occupancy): HTMLElement {
  const text = occupancyText(occupancy);
  const fill = el('span', { class: 'panel-meter__fill' });
  fill.style.transform = `scaleX(${occupancy.ratio.toFixed(4)})`;
  return el('div', { class: 'panel-meter', attrs: { 'data-level': occupancy.level } }, [
    el('div', { class: 'panel-meter__labels' }, [
      el('span', { text: text.percent }),
      el('strong', { text: text.status }),
    ]),
    el('div', { class: 'panel-meter__bar' }, [fill]),
  ]);
}

/** The overview tab: four figures and every upcoming departure with its occupancy. */
export class SummaryView {
  private readonly stats: Record<keyof BookingSummary, HTMLElement>;
  private readonly list: HTMLElement;

  constructor(root: HTMLElement) {
    this.stats = {
      departureCount: required(root, '[data-stat="departures"]'),
      passengerCount: required(root, '[data-stat="passengers"]'),
      depositTotal: required(root, '[data-stat="deposits"]'),
      freeSeats: required(root, '[data-stat="free-seats"]'),
    };
    this.list = required(root, '[data-departures]');
  }

  render(summary: BookingSummary, bookings: readonly DepartureBooking[]): void {
    this.stats.departureCount.textContent = formatNumber(summary.departureCount);
    this.stats.passengerCount.textContent = formatNumber(summary.passengerCount);
    this.stats.depositTotal.textContent = formatMoney(summary.depositTotal);
    this.stats.freeSeats.textContent = formatNumber(summary.freeSeats);

    this.list.replaceChildren(
      ...bookings.map(({ tour, departure, passengers }) =>
        el('li', { class: 'departure' }, [
          el('div', { class: 'departure__head' }, [
            el('strong', { text: tour.title }),
            el('span', { text: formatDateRange(departure.startDate, departure.endDate) }),
          ]),
          occupancyMeter(departure.occupancy),
          el('p', {
            class: 'departure__own',
            text: `Panelden eklenen yolcu: ${formatNumber(passengers.length)}`,
          }),
        ]),
      ),
    );
  }
}
