import type { Tour } from '@/domain/tour/Tour';
import { tr } from '@/i18n/tr';
import { formatKm } from '@/shared/format';

/** One line about the whole route, shown before the journey starts and after it ends. */
export function routeSummary(tour: Tour): string {
  return `${tour.sightCount} gezi noktası, ${tr.tour.approximately} ${formatKm(tour.routeDistanceKm)} yol.`;
}
