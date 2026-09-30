import type { Occupancy } from '@/domain/tour/Occupancy';
import { tr } from '@/i18n/tr';
import { formatPercent } from './format';

export interface OccupancyText {
  readonly percent: string;
  readonly status: string;
}

/** The two labels of an occupancy meter; shared by the rendered page and the live update. */
export function occupancyText(occupancy: Occupancy): OccupancyText {
  const status =
    occupancy.level === 'full'
      ? tr.tour.soldOut
      : occupancy.level === 'limited'
        ? `Son ${occupancy.remaining} Koltuk`
        : `${tr.tour.remainingSeats}: ${occupancy.remaining}`;
  return { percent: `${tr.tour.occupancy} ${formatPercent(occupancy.ratio)}`, status };
}

/** Spoken description of a seat plan, for the plan's accessible name. */
export function seatPlanLabel(occupancy: Occupancy): string {
  return `${tr.tour.seatStatus}: ${occupancy.capacity} koltuktan ${occupancy.booked} koltuk dolu, ${occupancy.remaining} koltuk boş.`;
}
