import { setDetails, setPrice, setSingleSupplement } from '@/application/tourEdits';
import type { TourCategory } from '@/domain/tour/Tour';
import { SeatLayout } from '@/domain/vehicle/SeatLayout';
import { pageUrl } from '@/config/paths';
import { categoryLabels, tr } from '@/i18n/tr';
import { formatDuration, formatKm, formatMoney, formatNumber } from '@/shared/format';
import { href, type AppContext, type Screen } from '../context';
import { el } from '../ui/dom';
import { block, button, group, iconButton, row, scene, screen, toggleRow } from '../ui/kit';
import { tap } from '../ui/motion';
import { departureRow } from '../ui/parts';
import { editAmount, editChoice, editNumber, editText, pickScene } from './editSheets';

/**
 * One tour, to be managed: whether the site shows it, its price, its
 * departures and everything the tour page tells. Every change is checked
 * before it is kept.
 */
export function tourScreen(tourId: string): Screen | null {
  return {
    section: 'turlar',
    title: tr.admin.nav.tours,
    render(context: AppContext) {
      const tour = context.catalog.tour(tourId);
      const data = context.catalog.snapshot(tourId);
      if (!tour || !data) {
        return screen(
          { title: tr.admin.nav.tours, back: { href: '#/turlar', label: tr.admin.nav.tours } },
          [el('p', { class: 'block__empty', text: tr.admin.tour.missing })],
        );
      }
      const change = (edit: Parameters<typeof context.catalog.change>[1]): void => {
        context.catalog.change(tourId, edit);
      };
      const hidden = context.settings.isTourHidden(tourId);
      const bookings = context.bookings
        .bookings(context.today)
        .filter((booking) => booking.tour.id === tourId);

      return screen(
        {
          title: tour.title,
          subtitle: formatDuration(tour.nights, tour.dayCount),
          back: { href: '#/turlar', label: tr.admin.nav.tours },
          art: tour.scene,
          actions: [
            iconButton({
              icon: 'external',
              label: tr.admin.tour.openOnSite,
              href: pageUrl(`turlar/${tour.id}`),
            }),
          ],
        },
        [
          context.catalog.isStale(tourId)
            ? el('div', { class: 'notice' }, [
                el('p', { text: tr.admin.tour.stale }),
                button({
                  label: tr.admin.tour.useSite,
                  variant: 'secondary',
                  onClick: () => {
                    context.catalog.discard(tourId);
                    context.refresh();
                  },
                }),
              ])
            : null,
          group([
            toggleRow({
              title: tr.admin.tour.visible,
              subtitle: hidden ? tr.admin.tour.hiddenHint : tr.admin.tour.visibleHint,
              checked: !hidden,
              icon: { name: hidden ? 'eyeOff' : 'eye', tone: hidden ? 'grey' : 'green' },
              onChange: (visible) => {
                context.settings.setTourHidden(tourId, !visible);
                tap();
                context.refresh();
                context.toast.show(visible ? tr.admin.tour.shown : tr.admin.tour.hiddenNow);
              },
            }),
          ]),

          block(tr.admin.tour.price, [
            group([
              row({
                title: tr.tour.perPerson,
                value: el('strong', { class: 'tabular', text: formatMoney(tour.price) }),
                icon: { name: 'wallet', tone: 'green' },
                onClick: () =>
                  editAmount(context, {
                    title: tr.tour.perPerson,
                    label: tr.admin.tour.priceLabel,
                    value: tour.price.lira,
                    done: tr.admin.tour.priceSaved,
                    save: (lira) => change(setPrice(lira ?? tour.price.lira)),
                  }),
              }),
              row({
                title: tr.tour.singleSupplement,
                value: tour.singleSupplement
                  ? formatMoney(tour.singleSupplement)
                  : tr.admin.ui.none,
                icon: { name: 'bed', tone: 'grey' },
                onClick: () =>
                  editAmount(context, {
                    title: tr.tour.singleSupplement,
                    label: tr.admin.tour.priceLabel,
                    value: tour.singleSupplement?.lira ?? null,
                    clearLabel: tr.admin.tour.removeSupplement,
                    save: (lira) => change(setSingleSupplement(lira)),
                  }),
              }),
            ]),
          ]),

          block(
            tr.tour.departures,
            [
              bookings.length === 0
                ? el('p', { class: 'block__empty', text: tr.tour.noDepartures })
                : group(
                    bookings.map((booking) => {
                      const item = departureRow(booking, { showTour: false });
                      item.setAttribute(
                        'href',
                        href(`/turlar/${tourId}/kalkis/${booking.departure.id}`),
                      );
                      return item;
                    }),
                    'group--departures',
                  ),
            ],
            {
              action: el('a', {
                class: 'block__link',
                text: tr.admin.tour.addDeparture,
                attrs: { href: href(`/turlar/${tourId}/kalkis/yeni`) },
              }),
            },
          ),

          block(tr.admin.tour.details, [
            group([
              row({
                title: tr.admin.tour.name,
                subtitle: tour.title,
                icon: { name: 'ticket', tone: 'blue' },
                onClick: () =>
                  editText(context, {
                    title: tr.admin.tour.name,
                    label: tr.admin.tour.name,
                    value: tour.title,
                    maxLength: 80,
                    save: (title) => change(setDetails({ title })),
                  }),
              }),
              row({
                title: tr.admin.tour.destination,
                subtitle: tour.destination,
                icon: { name: 'pin', tone: 'blue' },
                onClick: () =>
                  editText(context, {
                    title: tr.admin.tour.destination,
                    label: tr.admin.tour.destination,
                    value: tour.destination,
                    maxLength: 40,
                    hint: tr.admin.tour.destinationHint,
                    save: (destination) => change(setDetails({ destination })),
                  }),
              }),
              row({
                title: tr.admin.tour.summary,
                subtitle: tour.summary,
                icon: { name: 'list', tone: 'blue' },
                onClick: () =>
                  editText(context, {
                    title: tr.admin.tour.summary,
                    label: tr.admin.tour.summary,
                    value: tour.summary,
                    multiline: true,
                    maxLength: 300,
                    save: (summary) => change(setDetails({ summary })),
                  }),
              }),
              row({
                title: tr.admin.tour.category,
                value: categoryLabels[tour.category],
                icon: { name: 'sliders', tone: 'brown' },
                onClick: () =>
                  editChoice<TourCategory>(context, {
                    title: tr.admin.tour.category,
                    value: tour.category,
                    choices: (['kultur', 'doga', 'gunubirlik'] as const).map((value) => ({
                      value,
                      label: categoryLabels[value],
                    })),
                    save: (category) => change(setDetails({ category })),
                  }),
              }),
              row({
                title: tr.admin.tour.picture,
                lead: el('span', { class: 'row__thumb' }, [scene(tour.scene)]),
                value: tr.admin.scenes[tour.scene],
                onClick: () =>
                  pickScene(context, {
                    title: tr.admin.tour.picture,
                    value: tour.scene,
                    save: (key) => change(setDetails({ scene: key })),
                  }),
              }),
              row({
                title: tr.admin.tour.vehicle,
                value: data.seatLayout,
                icon: { name: 'bus', tone: 'grey' },
                onClick: () =>
                  editChoice(context, {
                    title: tr.admin.tour.vehicle,
                    value: data.seatLayout,
                    choices: (['2+1', '2+2'] as const).map((code) => ({
                      value: code,
                      label: code,
                      hint: tr.admin.tour.seatsOf(formatNumber(SeatLayout.of(code).capacity)),
                    })),
                    save: (seatLayout) => change(setDetails({ seatLayout })),
                  }),
              }),
              row({
                title: tr.admin.tour.distance,
                value: formatKm(tour.distanceFromOriginKm),
                icon: { name: 'route', tone: 'grey' },
                onClick: () =>
                  editNumber(context, {
                    title: tr.admin.tour.distance,
                    label: tr.admin.tour.distanceLabel,
                    value: tour.distanceFromOriginKm,
                    min: 1,
                    max: 2500,
                    hint: tr.admin.tour.distanceHint,
                    save: (km) =>
                      change(setDetails({ distanceFromAnkaraKm: km ?? tour.distanceFromOriginKm })),
                  }),
              }),
            ]),
          ]),

          block(tr.admin.tour.content, [
            group([
              row({
                title: tr.tour.itinerary,
                value: tr.admin.tour.daysAndStops(
                  formatNumber(tour.dayCount),
                  formatNumber(tour.stops.length),
                ),
                icon: { name: 'route', tone: 'brown' },
                href: href(`/turlar/${tourId}/program`),
              }),
              row({
                title: tr.tour.included,
                value: tr.admin.tour.items(formatNumber(tour.included.length)),
                icon: { name: 'check', tone: 'green' },
                href: href(`/turlar/${tourId}/liste/dahil`),
              }),
              row({
                title: tr.tour.excluded,
                value: tr.admin.tour.items(formatNumber(tour.excluded.length)),
                icon: { name: 'minus', tone: 'grey' },
                href: href(`/turlar/${tourId}/liste/haric`),
              }),
              row({
                title: tr.tour.lodging,
                value: tr.admin.tour.hotels(formatNumber(tour.hotels.length)),
                icon: { name: 'bed', tone: 'brown' },
                href: href(`/turlar/${tourId}/konaklama`),
              }),
            ]),
          ]),

          context.catalog.isChanged(tourId)
            ? block(
                null,
                [
                  group([
                    row({
                      title: tr.admin.tour.discard,
                      icon: { name: 'refresh', tone: 'red' },
                      danger: true,
                      onClick: () =>
                        void context
                          .confirm({
                            title: tr.admin.tour.discard,
                            text: tr.admin.tour.discardText,
                            confirm: tr.admin.tour.discard,
                            danger: true,
                          })
                          .then((yes) => {
                            if (!yes) return;
                            context.catalog.discard(tourId);
                            context.refresh();
                            context.toast.show(tr.admin.tour.discarded);
                          }),
                    }),
                  ]),
                ],
                { footnote: tr.admin.tour.changedNote },
              )
            : null,
        ],
      );
    },
  };
}
