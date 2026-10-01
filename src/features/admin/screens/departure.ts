import { tr } from '@/i18n/tr';
import {
  formatDate,
  formatDateRange,
  formatMoney,
  formatNumber,
  formatTime,
} from '@/shared/format';
import { Money } from '@/domain/shared/Money';
import { href, type AppContext, type Screen } from '../context';
import { el } from '../ui/dom';
import { block, button, group, occupancyRing, row, screen, stagger } from '../ui/kit';
import { passengerRow, seatLegend, seatMap, whenText } from '../ui/parts';
import { openPassenger } from './passengerSheet';

/**
 * Everything about one departure on one screen: how full the coach is, who
 * is on it and what they still owe, with the insurance list a press away.
 */
export function departureScreen(departureId: string): Screen | null {
  return {
    title: tr.admin.departure.title,
    render(context: AppContext, entering: boolean) {
      const booking = context.bookings.booking(departureId);
      if (!booking) {
        return screen(
          { title: tr.admin.departure.title, back: { href: '#/', label: tr.admin.nav.home } },
          [el('p', { class: 'block__empty', text: tr.admin.departure.missing })],
        );
      }
      const { tour, departure, passengers } = booking;
      const occupancy = departure.occupancy;
      const panelSeats = new Map(passengers.map((passenger) => [passenger.seatNumber, passenger]));
      const deposits = passengers.reduce(
        (sum, passenger) => sum.add(passenger.deposit),
        Money.zero(),
      );
      const balance = passengers.reduce(
        (sum, passenger) => sum.add(context.bookings.balance(passenger)),
        Money.zero(),
      );

      const exportList = (): void => {
        if (passengers.length === 0) {
          context.toast.show(tr.admin.list.exportEmpty);
          return;
        }
        const { columns } = tr.admin.list;
        const date = formatDate(departure.startDate);
        context.download(
          context.exporter.export({
            columns: [
              columns.order,
              columns.fullName,
              columns.phone,
              columns.seat,
              columns.tour,
              columns.date,
            ],
            rows: passengers.map((passenger, index) => [
              String(index + 1),
              passenger.fullName,
              passenger.phone.format(),
              String(passenger.seatNumber),
              tour.title,
              date,
            ]),
          }),
          `sigorta-listesi-${departure.id}.${context.exporter.extension}`,
          context.exporter.mimeType,
        );
        context.toast.show(tr.admin.list.exported);
      };

      const rows = passengers.map((passenger) =>
        passengerRow(passenger, (chosen) => openPassenger(context, chosen)),
      );

      return screen(
        {
          title: tour.title,
          subtitle: `${formatDateRange(departure.startDate, departure.endDate)}, ${whenText(departure.startDate, context.today)}`,
          back: { href: '#/', label: tr.admin.ui.back },
          art: tour.scene,
        },
        [
          el('div', { class: 'card departure-summary' }, [
            occupancyRing(occupancy, tr.admin.ui.freeSeatsShort),
            el('dl', { class: 'figures' }, [
              figure(tr.admin.departure.sold, formatNumber(occupancy.booked)),
              figure(tr.admin.departure.passengers, formatNumber(passengers.length)),
              figure(tr.admin.stats.deposits, formatMoney(deposits)),
              figure(tr.admin.passenger.balance, formatMoney(balance)),
            ]),
          ]),
          group([
            row({
              title: tr.tour.departureTime,
              value: formatTime(departure.time),
              icon: { name: 'clock', tone: 'blue' },
            }),
            row({
              title: tr.admin.departure.meetingPoint,
              subtitle: departure.meetingPoint,
              icon: { name: 'pin', tone: 'blue' },
            }),
            row({
              title: tr.admin.departure.vehicle,
              value: departure.layout.code,
              icon: { name: 'bus', tone: 'blue' },
            }),
          ]),
          block(
            tr.admin.departure.seats,
            [
              el('div', { class: 'card card--seats' }, [
                seatMap({
                  layout: departure.layout,
                  label: tr.admin.departure.seats,
                  mode: 'view',
                  stateOf: (seat) =>
                    panelSeats.has(seat) ? 'passenger' : departure.isBooked(seat) ? 'sold' : 'free',
                  onSeat: (seat, state) => {
                    const passenger = panelSeats.get(seat);
                    if (passenger) openPassenger(context, passenger);
                    else if (state === 'free') {
                      context.go(
                        `/yolcular/yeni?kalkis=${encodeURIComponent(departure.id)}&koltuk=${seat}`,
                      );
                    }
                  },
                }),
                seatLegend(['free', 'sold', 'passenger']),
              ]),
            ],
            { footnote: tr.admin.departure.seatsHint },
          ),
          block(
            tr.admin.departure.passengers,
            [
              rows.length === 0
                ? el('p', { class: 'block__empty', text: tr.admin.departure.noPassengers })
                : group(entering ? stagger(rows) : rows),
            ],
            {
              action: el('a', {
                class: 'block__link',
                text: tr.admin.passengers.add,
                attrs: { href: href(`/yolcular/yeni?kalkis=${encodeURIComponent(departure.id)}`) },
              }),
            },
          ),
          el('div', { class: 'actions' }, [
            button({
              label: tr.admin.list.export,
              icon: 'download',
              variant: 'secondary',
              block: true,
              onClick: exportList,
            }),
            button({
              label: tr.admin.departure.edit,
              icon: 'pencil',
              variant: 'tonal',
              block: true,
              href: href(`/turlar/${tour.id}/kalkis/${departure.id}`),
            }),
          ]),
          el('p', { class: 'block__foot', text: tr.admin.list.exportNote }),
        ],
      );
    },
  };
}

function figure(label: string, value: string): HTMLElement {
  return el('div', {}, [el('dt', { text: label }), el('dd', { class: 'tabular', text: value })]);
}
