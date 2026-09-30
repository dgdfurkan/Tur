import type { RoutePlan } from '@/domain/tour/RoutePlan';
import { roadKm, type Tour } from '@/domain/tour/Tour';
import { tr } from '@/i18n/tr';
import {
  formatDate,
  formatDateRange,
  formatDuration,
  formatKm,
  formatMoney,
  formatTime,
} from '@/shared/format';
import type { FilmTemplate } from './Storyboard';

/** Words the maker of a film chooses; everything else comes from the tour. */
export interface FilmBranding {
  readonly brandName: string;
  /** A phone number, an address on the web or an account name; empty to leave it out. */
  readonly contactLine: string;
  readonly showDate: boolean;
  readonly showPrice: boolean;
}

/** Every word that is painted on a film, ready to draw. */
export interface FilmCopy {
  readonly brandName: string;
  readonly contactLine: string;
  /** The line on the opening and closing signs. */
  readonly title: string;
  readonly subtitle: string;
  /** Short figures shown as small signs under the title. */
  readonly chips: readonly string[];
  /** Optional lines such as the date and the price. */
  readonly details: readonly string[];
  readonly pass: {
    readonly tourTitle: string;
    readonly date: string;
    readonly time: string;
    readonly meetingPoint: string;
    readonly seat: string;
    readonly destination: string;
  };
}

/**
 * Gathers the words of a film.
 * @param plan The route being filmed: the whole tour, or one day of it.
 * @param day The day being filmed, for a film of a single day.
 */
export function filmCopy(
  tour: Tour,
  plan: RoutePlan,
  template: FilmTemplate,
  branding: FilmBranding,
  today: string,
  day?: number,
): FilmCopy {
  const departure = tour.nextDeparture(today);
  const dayInfo = template === 'day' ? tour.days.find((item) => item.number === day) : undefined;
  const sights = plan.stops.filter((stop) => stop.stop.kind === 'sight').length;

  const details: string[] = [];
  if (branding.showDate && departure) {
    details.push(formatDateRange(departure.startDate, departure.endDate));
  }
  if (branding.showPrice) details.push(`${tr.tour.perPerson} ${formatMoney(tour.price)}`);

  return {
    brandName: branding.brandName.trim(),
    contactLine: branding.contactLine.trim(),
    title: dayInfo ? dayInfo.title : tour.title,
    subtitle: dayInfo
      ? `${tour.title}, ${dayInfo.number}. ${tr.tour.day}`
      : formatDuration(tour.nights, tour.dayCount),
    chips: [tr.studio.film.sights(sights), tr.studio.film.distance(formatKm(roadKm(plan.totalKm)))],
    details,
    pass: {
      tourTitle: tour.title,
      date: departure ? formatDate(departure.startDate) : '',
      time: departure ? formatTime(departure.time) : '',
      meetingPoint: departure?.meetingPoint ?? plan.stops[0]?.stop.name ?? '',
      seat: String(departure?.freeSeats[0] ?? '–'),
      destination: tour.destination,
    },
  };
}
