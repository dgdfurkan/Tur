import type { PassengerRepository } from '@/domain/booking/PassengerRepository';
import { Money } from '@/domain/shared/Money';
import { Occupancy } from '@/domain/tour/Occupancy';
import { SeatLayout } from '@/domain/vehicle/SeatLayout';
import { formatMoney } from '@/shared/format';
import { occupancyText, seatPlanLabel } from '@/shared/occupancyText';
import type { LocalChanges } from './localChanges';

/** Seats sold elsewhere and recorded in the panel, for departures the panel changed or filled. */
function seatsByDeparture(
  passengers: PassengerRepository,
  changes: LocalChanges,
): { taken: Map<string, Set<number>>; capacity: Map<string, number> } {
  const taken = new Map<string, Set<number>>();
  const capacity = new Map<string, number>();
  for (const tour of changes.tours.values()) {
    for (const [departureId, seats] of tour.departures) {
      taken.set(departureId, new Set(seats));
      if (tour.seatLayout) capacity.set(departureId, SeatLayout.of(tour.seatLayout).capacity);
    }
  }
  for (const passenger of passengers.findAll()) {
    const seats = taken.get(passenger.departureId);
    if (seats) seats.add(passenger.seatNumber);
    else taken.set(passenger.departureId, new Set([passenger.seatNumber]));
  }
  return { taken, capacity };
}

/**
 * Shows, on the public pages of this device, what the operations panel has
 * changed here: passengers recorded, seats sold, prices and hidden tours.
 * The pages were built without them; until the panel publishes to a server,
 * this is how a change made in the office can be seen on the site.
 */
export function syncLocalChanges(
  root: ParentNode,
  passengers: PassengerRepository,
  changes: LocalChanges,
): void {
  const changedDepartures = new Set(
    [...changes.tours.values()].flatMap((tour) => [...tour.departures.keys()]),
  );
  const { taken, capacity } = seatsByDeparture(passengers, changes);

  for (const meter of root.querySelectorAll<HTMLElement>('[data-occupancy][data-departure-id]')) {
    const departureId = meter.dataset['departureId'] ?? '';
    const seats = taken.get(departureId);
    if (!seats) continue;
    const size = capacity.get(departureId) ?? Number(meter.dataset['capacity']);
    const base = changedDepartures.has(departureId) ? 0 : Number(meter.dataset['booked']);
    if (!Number.isInteger(size) || size <= 0 || !Number.isInteger(base)) continue;
    const occupancy = new Occupancy(size, Math.min(size, base + seats.size));
    const text = occupancyText(occupancy);
    meter.dataset['level'] = occupancy.level;
    const percent = meter.querySelector('[data-occupancy-percent]');
    const status = meter.querySelector('[data-occupancy-status]');
    if (percent) percent.textContent = text.percent;
    if (status) status.textContent = text.status;
    meter.querySelector('[data-occupancy-fill]')?.setAttribute('width', String(occupancy.percent));
  }

  for (const plan of root.querySelectorAll<SVGElement>('[data-seat-map][data-departure-id]')) {
    const departureId = plan.dataset['departureId'] ?? '';
    const seats = taken.get(departureId);
    // A plan drawn for another coach layout cannot show the new one's seats.
    if (
      !seats ||
      (capacity.has(departureId) && capacity.get(departureId) !== Number(plan.dataset['capacity']))
    )
      continue;
    const replaced = changedDepartures.has(departureId);
    for (const seat of plan.querySelectorAll<SVGElement>('[data-seat]')) {
      const number = Number(seat.dataset['seat']);
      if (seats.has(number)) seat.classList.add('seat--taken');
      else if (replaced) seat.classList.remove('seat--taken');
    }
    const booked = plan.querySelectorAll('.seat--taken').length;
    const size = Number(plan.dataset['capacity']);
    if (Number.isInteger(size) && size > 0) {
      plan.setAttribute('aria-label', seatPlanLabel(new Occupancy(size, Math.min(size, booked))));
    }
  }

  for (const price of root.querySelectorAll<HTMLElement>('[data-price-for]')) {
    const lira = changes.tours.get(price.dataset['priceFor'] ?? '')?.priceTry;
    if (lira) price.textContent = formatMoney(Money.fromLira(lira));
  }

  for (const card of root.querySelectorAll<HTMLElement>('[data-tour-card]')) {
    card.hidden = changes.hiddenTourIds.has(card.dataset['tourCard'] ?? '');
  }
}
