import { tr } from '@/i18n/tr';
import { formatDateRange, formatNumber } from '@/shared/format';
import { href, type AppContext, type Screen } from '../context';
import { el } from '../ui/dom';
import { block, button, emptyState, fab, group, icon, screen, stagger } from '../ui/kit';
import { passengerRow } from '../ui/parts';
import { openPassenger } from './passengerSheet';

/** Lower-case Turkish text without the marks that people leave out when they search. */
function searchable(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ı/g, 'i');
}

/** Every passenger recorded in the panel, by departure, with a search across all of them. */
export function passengersScreen(): Screen {
  return {
    section: 'yolcular',
    title: tr.admin.nav.passengers,
    render(context: AppContext, entering: boolean) {
      const bookings = context.bookings
        .bookings(context.today)
        .filter((booking) => booking.passengers.length > 0);
      const total = bookings.reduce((sum, booking) => sum + booking.passengers.length, 0);
      const add = fab(tr.admin.passengers.add, href('/yolcular/yeni'));

      if (total === 0) {
        return screen({ title: tr.admin.nav.passengers }, [
          emptyState({
            art: 'seyir',
            title: tr.admin.passengers.emptyTitle,
            text: tr.admin.passengers.emptyText,
            action: button({
              label: tr.admin.passengers.add,
              icon: 'plus',
              href: href('/yolcular/yeni'),
            }),
          }),
          add,
        ]);
      }

      const groups = bookings.map((booking) => {
        const rows = booking.passengers.map((passenger) => {
          const item = passengerRow(passenger, (chosen) => openPassenger(context, chosen));
          item.dataset['search'] = searchable(`${passenger.fullName} ${passenger.phone.digits}`);
          return item;
        });
        const section = block(null, [
          el(
            'a',
            { class: 'group-head', attrs: { href: href(`/kalkis/${booking.departure.id}`) } },
            [
              el('span', { class: 'group-head__title', text: booking.tour.title }),
              el('span', {
                class: 'group-head__meta',
                text: `${formatDateRange(booking.departure.startDate, booking.departure.endDate)}, ${tr.admin.passengers.count(formatNumber(booking.passengers.length))}`,
              }),
            ],
          ),
          group(rows),
        ]);
        return section;
      });

      const empty = el('p', {
        class: 'block__empty',
        text: tr.admin.passengers.noMatch,
        attrs: { hidden: '' },
      });
      const search = el('input', {
        class: 'search__input',
        attrs: {
          type: 'search',
          placeholder: tr.admin.passengers.search,
          'aria-label': tr.admin.passengers.search,
          enterkeyhint: 'search',
          autocomplete: 'off',
        },
        on: {
          input: () => {
            const query = searchable(search.value.trim()).replace(/\s+/g, ' ');
            const digits = search.value.replace(/\D/g, '');
            let shown = 0;
            for (const section of groups) {
              let visible = 0;
              for (const item of section.querySelectorAll<HTMLElement>('[data-search]')) {
                const text = item.dataset['search'] ?? '';
                const match =
                  query === '' ||
                  text.includes(query) ||
                  (digits.length >= 3 && text.includes(digits));
                item.hidden = !match;
                if (match) visible += 1;
              }
              section.hidden = visible === 0;
              shown += visible;
            }
            empty.hidden = shown > 0;
          },
        },
      });

      return screen(
        {
          title: tr.admin.nav.passengers,
          subtitle: tr.admin.passengers.subtitle(
            formatNumber(total),
            formatNumber(bookings.length),
          ),
        },
        [
          el('label', { class: 'search' }, [icon('search', 18), search]),
          ...(entering ? stagger(groups) : groups),
          empty,
          add,
        ],
      );
    },
  };
}
