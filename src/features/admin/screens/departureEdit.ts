import { InvalidTourError } from '@/application/TourCatalogEditor';
import { addDays, newDepartureId, removeDeparture, saveDeparture } from '@/application/tourEdits';
import { SeatLayout } from '@/domain/vehicle/SeatLayout';
import { tr } from '@/i18n/tr';
import { formatNumber } from '@/shared/format';
import { href, type AppContext, type Screen } from '../context';
import { el } from '../ui/dom';
import { block, button, field, group, screen } from '../ui/kit';
import { tap } from '../ui/motion';
import { seatLegend, seatMap } from '../ui/parts';

const NEW = 'yeni';
/** A new departure is first offered this many days after the last one. */
const NEXT_GAP_DAYS = 14;

/**
 * A departure of a tour, new or existing: its dates, hour and meeting point,
 * and the seats sold through other channels, marked on the coach.
 */
export function departureEditScreen(tourId: string, departureId: string): Screen | null {
  return {
    section: 'turlar',
    title: departureId === NEW ? tr.admin.departure.new : tr.admin.departure.edit,
    render(context: AppContext) {
      const data = context.catalog.snapshot(tourId);
      const existing = data?.departures.find((item) => item.id === departureId);
      const back = { href: `#/turlar/${tourId}`, label: data?.destination ?? tr.admin.ui.back };
      if (!data || (departureId !== NEW && !existing)) {
        return screen({ title: tr.admin.departure.edit, back }, [
          el('p', { class: 'block__empty', text: tr.admin.departure.missing }),
        ]);
      }
      const isNew = existing === undefined;
      const dayCount = data.days.length;
      const last = data.departures.at(-1);
      const firstDate =
        last && addDays(last.startDate, NEXT_GAP_DAYS) > context.today
          ? addDays(last.startDate, NEXT_GAP_DAYS)
          : addDays(context.today, NEXT_GAP_DAYS);

      const start = el('input', { attrs: { type: 'date', required: '' } });
      const end = el('input', { attrs: { type: 'date', required: '' } });
      const time = el('input', { attrs: { type: 'time', required: '', step: '300' } });
      const meeting = el('input', {
        attrs: { type: 'text', maxlength: '120', autocomplete: 'off' },
      });
      start.value = existing?.startDate ?? firstDate;
      end.value = existing?.endDate ?? addDays(start.value, dayCount - 1);
      time.value = existing?.time ?? last?.time ?? '07:00';
      meeting.value = existing?.meetingPoint ?? last?.meetingPoint ?? '';
      // The return date follows the departure date until it is changed by hand.
      let endTouched = false;
      end.addEventListener('input', () => {
        endTouched = true;
      });
      start.addEventListener('change', () => {
        if (!endTouched && start.value) end.value = addDays(start.value, dayCount - 1);
      });

      const meetingPoints = [...new Set(data.departures.map((item) => item.meetingPoint))].filter(
        (point) => point !== meeting.value,
      );
      const suggestions = meetingPoints.length
        ? el(
            'div',
            { class: 'quick' },
            meetingPoints.map((point) =>
              el('button', {
                class: 'quick__chip',
                text: point,
                attrs: { type: 'button' },
                on: { click: () => (meeting.value = point) },
              }),
            ),
          )
        : null;

      // Seats sold through other channels; panel records occupy their own seats.
      const sold = new Set(existing?.bookedSeats ?? []);
      const booking = isNew ? undefined : context.bookings.booking(departureId);
      const panelSeats = new Set(
        booking?.passengers.map((passenger) => passenger.seatNumber) ?? [],
      );
      const layout = SeatLayout.of(data.seatLayout);
      const counter = el('p', { class: 'seat-count tabular', attrs: { 'aria-live': 'polite' } });
      const seatsHost = el('div');
      const drawSeats = (): void => {
        counter.textContent = tr.admin.departure.soldCount(
          formatNumber(sold.size),
          formatNumber(layout.capacity),
        );
        seatsHost.replaceChildren(
          seatMap({
            layout,
            label: tr.admin.departure.seats,
            mode: 'toggle',
            stateOf: (seat) =>
              panelSeats.has(seat) ? 'passenger' : sold.has(seat) ? 'sold' : 'free',
            onSeat: (seat, state) => {
              if (state === 'passenger') return;
              if (sold.has(seat)) sold.delete(seat);
              else sold.add(seat);
              tap();
              drawSeats();
              seatsHost
                .querySelector<HTMLElement>(`[aria-label^="${tr.admin.form.seat} ${seat},"]`)
                ?.focus();
            },
          }),
        );
      };
      drawSeats();

      const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
      const form = el('form', { class: 'form', attrs: { novalidate: '' } }, [
        block(tr.admin.departure.when, [
          group(
            [
              field({ label: tr.admin.departure.startDate, control: start }),
              field({ label: tr.admin.departure.endDate, control: end }),
              field({ label: tr.tour.departureTime, control: time }),
            ],
            'group--form',
          ),
        ]),
        block(tr.admin.departure.meetingPoint, [
          group(
            [field({ label: tr.admin.departure.meetingPoint, control: meeting }), suggestions],
            'group--form',
          ),
        ]),
        block(
          tr.admin.departure.seats,
          [
            el('div', { class: 'card card--seats' }, [
              counter,
              seatsHost,
              seatLegend(['free', 'sold', 'passenger']),
            ]),
          ],
          {
            footnote: tr.admin.departure.toggleHint,
          },
        ),
        error,
        el('div', { class: 'save-bar' }, [
          button({ label: tr.admin.ui.save, type: 'submit', size: 'lg', block: true }),
        ]),
      ]);

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const problem =
          !start.value || !end.value
            ? tr.admin.departure.errors.dates
            : end.value < start.value
              ? tr.admin.departure.errors.order
              : !time.value
                ? tr.admin.departure.errors.time
                : meeting.value.trim() === ''
                  ? tr.admin.departure.errors.meeting
                  : null;
        if (problem) {
          error.textContent = problem;
          error.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        try {
          context.catalog.change(
            tourId,
            saveDeparture({
              id: existing?.id ?? newDepartureId(data, start.value),
              startDate: start.value,
              endDate: end.value,
              time: time.value,
              meetingPoint: meeting.value.trim(),
              bookedSeats: [...sold].sort((a, b) => a - b),
            }),
          );
        } catch (failure) {
          if (!(failure instanceof InvalidTourError)) throw failure;
          error.textContent = tr.admin.ui.invalid;
          return;
        }
        tap();
        context.toast.show(isNew ? tr.admin.departure.added : tr.admin.departure.saved);
        context.back(`/turlar/${tourId}`);
      });

      const remove = async (): Promise<void> => {
        if (panelSeats.size > 0) {
          context.toast.show(tr.admin.departure.hasPassengers);
          return;
        }
        const yes = await context.confirm({
          title: tr.admin.departure.remove,
          text: tr.admin.departure.removeText,
          confirm: tr.admin.departure.remove,
          danger: true,
        });
        if (!yes) return;
        context.catalog.change(tourId, removeDeparture(departureId));
        context.toast.show(tr.admin.departure.removed);
        context.back(`/turlar/${tourId}`);
      };

      return screen(
        {
          title: isNew ? tr.admin.departure.new : tr.admin.departure.edit,
          subtitle: data.title,
          back,
        },
        [
          form,
          isNew
            ? null
            : block(null, [
                group([
                  booking
                    ? el('a', { class: 'row', attrs: { href: href(`/kalkis/${departureId}`) } }, [
                        el('span', { class: 'row__text' }, [
                          el('span', { class: 'row__title', text: tr.admin.departure.openCard }),
                        ]),
                      ])
                    : null,
                  el(
                    'button',
                    {
                      class: 'row row--danger',
                      attrs: { type: 'button' },
                      on: { click: () => void remove() },
                    },
                    [
                      el('span', { class: 'row__text' }, [
                        el('span', { class: 'row__title', text: tr.admin.departure.remove }),
                      ]),
                    ],
                  ),
                ]),
              ]),
        ],
      );
    },
  };
}
