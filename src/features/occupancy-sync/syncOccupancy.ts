import type { PassengerRepository } from '@/domain/booking/PassengerRepository';
import { Occupancy } from '@/domain/tour/Occupancy';
import { occupancyText, seatPlanLabel } from '@/shared/occupancyText';

function mergedOccupancy(element: HTMLOrSVGElement, extraSeats: number): Occupancy | null {
  const capacity = Number(element.dataset['capacity']);
  const booked = Number(element.dataset['booked']);
  if (!Number.isInteger(capacity) || !Number.isInteger(booked) || capacity <= 0) return null;
  return new Occupancy(capacity, Math.min(capacity, booked + extraSeats));
}

/**
 * Adds the passengers recorded in the demo panel on this device to the
 * occupancy the page was built with. It shows how a record made in the office
 * reaches the public site; the real system will read it from a server.
 */
export function syncOccupancy(root: ParentNode, repository: PassengerRepository): void {
  const seatsByDeparture = new Map<string, number[]>();
  for (const passenger of repository.findAll()) {
    const seats = seatsByDeparture.get(passenger.departureId) ?? [];
    seats.push(passenger.seatNumber);
    seatsByDeparture.set(passenger.departureId, seats);
  }
  if (seatsByDeparture.size === 0) return;

  for (const meter of root.querySelectorAll<HTMLElement>('[data-occupancy][data-departure-id]')) {
    const seats = seatsByDeparture.get(meter.dataset['departureId'] ?? '');
    const occupancy = seats && mergedOccupancy(meter, seats.length);
    if (!occupancy) continue;
    const text = occupancyText(occupancy);
    meter.dataset['level'] = occupancy.level;
    const percent = meter.querySelector('[data-occupancy-percent]');
    const status = meter.querySelector('[data-occupancy-status]');
    if (percent) percent.textContent = text.percent;
    if (status) status.textContent = text.status;
    meter.querySelector('[data-occupancy-fill]')?.setAttribute('width', String(occupancy.percent));
  }

  for (const plan of root.querySelectorAll<SVGElement>('[data-seat-map][data-departure-id]')) {
    const seats = seatsByDeparture.get(plan.dataset['departureId'] ?? '');
    if (!seats) continue;
    for (const seat of seats) {
      plan.querySelector(`[data-seat="${seat}"]`)?.classList.add('seat--taken');
    }
    const occupancy = mergedOccupancy(plan, seats.length);
    if (occupancy) plan.setAttribute('aria-label', seatPlanLabel(occupancy));
  }
}
