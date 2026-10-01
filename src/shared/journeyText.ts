import type { Journey } from '@/domain/journey/Journey';
import { tr } from '@/i18n/tr';
import { formatDateRange, formatDuration, formatKm, formatMonthYear, formatNumber } from './format';

/**
 * The words a journey is shown with. The pages and the script that shows the
 * panel's changes on this device both use them, so a journey reads the same
 * whichever drew it.
 */
export function journeyText(journey: Journey) {
  return {
    title: journey.title,
    group: tr.journeys.groups[journey.group],
    dates: formatDateRange(journey.startDate, journey.endDate),
    stamp: formatMonthYear(journey.startDate).toLocaleUpperCase('tr-TR'),
    guests: formatNumber(journey.guests),
    duration: formatDuration(journey.nights, journey.dayCount),
    distance: formatKm(journey.distanceKm),
    story: journey.story,
  };
}

export type JourneyField = keyof ReturnType<typeof journeyText>;
