import type { DepartureBooking } from '@/application/BookingService';
import { tr } from '@/i18n/tr';
import {
  formatDate,
  formatDateRange,
  formatLira,
  formatNumber,
  formatPercent,
  formatTime,
} from '@/shared/format';
import { href, type AppContext, type Screen } from '../context';
import { el } from '../ui/dom';
import { block, fab, group, occupancyRing, row, scene, screen, stagger, stat } from '../ui/kit';
import { countUp } from '../ui/motion';
import { daysBetween, departureRow, seatsText, whenText } from '../ui/parts';

const SOON_DAYS = 3;
const UPCOMING_SHOWN = 6;
const COMPLETED_SHOWN = 3;

/** Departures that have ended without a record among the past journeys yet, the latest first. */
function completed(context: AppContext): HTMLElement[] {
  const recorded = new Set(
    context.journeys.journeys().map((journey) => `${journey.tourId}|${journey.startDate}`),
  );
  return context.catalog
    .tours()
    .flatMap((tour) =>
      tour.departures
        .filter(
          (departure) =>
            departure.endDate < context.today && !recorded.has(`${tour.id}|${departure.startDate}`),
        )
        .map((departure) => ({ tour, departure })),
    )
    .sort((a, b) => b.departure.startDate.localeCompare(a.departure.startDate))
    .slice(0, COMPLETED_SHOWN)
    .map(({ tour, departure }) =>
      row({
        title: tour.title,
        subtitle: `${formatDateRange(departure.startDate, departure.endDate)}: ${tr.admin.journeys.addCompleted}`,
        icon: { name: 'check', tone: 'green' },
        href: href(`/gecmis/yeni?kalkis=${departure.id}`),
      }),
    );
}

/** Departures that need a look: full, nearly full, or leaving within days. */
function attention(bookings: readonly DepartureBooking[], today: string): HTMLElement[] {
  return bookings.flatMap((booking) => {
    const { departure, tour } = booking;
    const { level } = departure.occupancy;
    const days = daysBetween(today, departure.startDate);
    let text: string | null = null;
    if (level === 'full') text = tr.tour.soldOut;
    else if (level === 'limited') text = seatsText(booking);
    else if (days <= SOON_DAYS) text = tr.admin.home.leaving(whenText(departure.startDate, today));
    if (text === null) return [];
    return [
      row({
        title: tour.title,
        subtitle: `${formatDateRange(departure.startDate, departure.endDate)}: ${text}`,
        icon: {
          name: level === 'full' ? 'alert' : 'clock',
          tone: level === 'full' ? 'red' : 'yellow',
        },
        href: href(`/kalkis/${departure.id}`),
      }),
    ];
  });
}

/** The first thing the office sees: the next departure, the figures that matter and what needs doing. */
export function homeScreen(): Screen {
  return {
    section: 'ozet',
    title: tr.admin.nav.home,
    render(context: AppContext, entering: boolean) {
      const bookings = context.bookings.bookings(context.today);
      const summary = context.bookings.summary(context.today);
      const [next] = bookings;

      const figures = [
        { label: tr.admin.stats.departures, value: summary.departureCount, format: formatNumber },
        { label: tr.admin.stats.passengers, value: summary.passengerCount, format: formatNumber },
        {
          label: tr.admin.stats.deposits,
          value: summary.depositTotal.lira,
          format: formatLira,
        },
        { label: tr.admin.stats.freeSeats, value: summary.freeSeats, format: formatNumber },
      ];
      const stats = figures.map((figure) => {
        const tile = stat(figure.label, figure.format(figure.value));
        const value = tile.querySelector<HTMLElement>('.stat__value');
        if (entering && value) countUp(value, figure.value, figure.format);
        return tile;
      });

      const alerts = attention(bookings, context.today);
      const ended = completed(context);
      return screen({ title: tr.admin.nav.home, subtitle: formatDate(context.today) }, [
        next ? nextCard(next, context) : null,
        el('div', { class: 'stats' }, entering ? stagger(stats) : stats),
        alerts.length > 0 ? block(tr.admin.home.attention, [group(alerts)]) : null,
        ended.length > 0
          ? block(tr.admin.journeys.completed, [group(ended)], {
              footnote: tr.admin.journeys.completedHint,
            })
          : null,
        block(
          tr.admin.home.upcoming,
          [
            bookings.length === 0
              ? el('p', { class: 'block__empty', text: tr.admin.home.noDepartures })
              : group(
                  bookings.slice(0, UPCOMING_SHOWN).map((booking) => departureRow(booking)),
                  'group--departures',
                ),
          ],
          {
            action:
              bookings.length > UPCOMING_SHOWN
                ? el('a', {
                    class: 'block__link',
                    text: tr.admin.home.allTours,
                    attrs: { href: href('/turlar') },
                  })
                : undefined,
          },
        ),
        fab(tr.admin.passengers.add, href('/yolcular/yeni')),
      ]);
    },
  };
}

/** The departure coming up next, with its picture, when it leaves and how many seats are left. */
function nextCard(booking: DepartureBooking, context: AppContext): HTMLElement {
  const { tour, departure, passengers } = booking;
  const deposits = passengers.reduce((sum, passenger) => sum + passenger.deposit.kurus, 0) / 100;
  return el('article', { class: 'next' }, [
    el('div', { class: 'next__art' }, [
      scene(tour.scene),
      el('span', { class: 'next__when', text: whenText(departure.startDate, context.today) }),
    ]),
    el('div', { class: 'next__body' }, [
      el('div', { class: 'next__text' }, [
        el('p', { class: 'next__label', text: tr.admin.home.next }),
        el('h2', {}, [
          el('a', {
            class: 'next__link',
            text: tour.title,
            attrs: { href: href(`/kalkis/${departure.id}`) },
          }),
        ]),
        el('p', {
          class: 'next__meta',
          text: `${formatDateRange(departure.startDate, departure.endDate)}, ${formatTime(departure.time)}`,
        }),
        el('p', { class: 'next__meta', text: departure.meetingPoint }),
      ]),
      occupancyRing(departure.occupancy, tr.admin.ui.freeSeatsShort),
    ]),
    el('dl', { class: 'next__figures' }, [
      el('div', {}, [
        el('dt', { text: tr.admin.departure.passengers }),
        el('dd', { class: 'tabular', text: formatNumber(passengers.length) }),
      ]),
      el('div', {}, [
        el('dt', { text: tr.admin.stats.deposits }),
        el('dd', { class: 'tabular', text: formatLira(deposits) }),
      ]),
      el('div', {}, [
        el('dt', { text: tr.tour.occupancy }),
        el('dd', { class: 'tabular', text: formatPercent(departure.occupancy.ratio) }),
      ]),
    ]),
  ]);
}
