import type { Tour } from '@/domain/tour/Tour';
import { tr } from '@/i18n/tr';
import { formatKm } from '@/shared/format';

/** One line about a tour's whole route: how many sights it visits and how long the road is. */
export function routeSummary(tour: Tour): string {
  return `${tour.sightCount} gezi noktası, ${tr.tour.approximately} ${formatKm(tour.routeDistanceKm)} yol.`;
}
