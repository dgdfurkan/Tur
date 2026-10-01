import { tr } from '@/i18n/tr';
import { formatNumber } from '@/shared/format';
import type { AppContext, Screen } from '../context';
import { el } from '../ui/dom';
import { group, screen, segmented, stagger } from '../ui/kit';
import { tourRow } from '../ui/parts';

type Filter = 'all' | 'live' | 'hidden';

/** The catalogue: every tour with its price and state; a tour opens to be managed. */
export function toursScreen(): Screen {
  let filter: Filter = 'all';
  return {
    section: 'turlar',
    title: tr.admin.nav.tours,
    render(context: AppContext, entering: boolean) {
      const tours = context.catalog.tours();
      const upcoming = tours.reduce(
        (sum, tour) => sum + tour.upcomingDepartures(context.today).length,
        0,
      );
      const rows = tours.map((tour) => {
        const hidden = context.settings.isTourHidden(tour.id);
        const item = tourRow(tour, {
          hidden,
          changed: context.catalog.isChanged(tour.id),
          today: context.today,
        });
        item.dataset['state'] = hidden ? 'hidden' : 'live';
        return item;
      });
      const apply = (): void => {
        for (const item of rows) item.hidden = filter !== 'all' && item.dataset['state'] !== filter;
      };
      apply();
      return screen(
        {
          title: tr.admin.nav.tours,
          subtitle: tr.admin.tours.subtitle(formatNumber(tours.length), formatNumber(upcoming)),
        },
        [
          segmented<Filter>({
            name: 'tour-filter',
            legend: tr.admin.tours.filter,
            value: filter,
            choices: [
              { value: 'all', label: tr.admin.tours.all },
              { value: 'live', label: tr.admin.tours.live },
              { value: 'hidden', label: tr.admin.tours.hidden },
            ],
            onChange: (value) => {
              filter = value;
              apply();
            },
          }),
          group(entering ? stagger(rows) : rows, 'group--tours'),
          el('p', { class: 'block__foot', text: tr.admin.tours.newTourNote }),
        ],
      );
    },
  };
}
