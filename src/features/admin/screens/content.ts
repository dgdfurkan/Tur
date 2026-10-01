import type { HotelData, StopData } from '@/application/dto/TourData';
import { InvalidTourError } from '@/application/TourCatalogEditor';
import { setDay, setHotels, setList, setStop } from '@/application/tourEdits';
import { SCENE_KEYS, type SceneKey } from '@/domain/tour/Tour';
import { tr } from '@/i18n/tr';
import { formatMinutes, formatNumber } from '@/shared/format';
import type { AppContext, Screen } from '../context';
import { el } from '../ui/dom';
import { block, button, field, group, icon, iconButton, row, scene, screen } from '../ui/kit';
import { tap } from '../ui/motion';
import { editText } from './editSheets';

/*
 * The parts of a tour page that are lists: the day-by-day programme, what the
 * price covers and does not, and the hotels.
 */

function missing(tourId: string): HTMLElement {
  return screen(
    { title: tr.admin.nav.tours, back: { href: `#/turlar/${tourId}`, label: tr.admin.ui.back } },
    [el('p', { class: 'block__empty', text: tr.admin.tour.missing })],
  );
}

/** Saves a change made in a sheet, keeping the sheet open with the reason if it is refused. */
function keep(
  context: AppContext,
  error: HTMLElement,
  run: () => void,
  done = tr.admin.ui.saved,
): void {
  try {
    run();
  } catch (problem) {
    if (!(problem instanceof InvalidTourError)) throw problem;
    error.textContent = tr.admin.ui.invalid;
    return;
  }
  tap();
  void context.sheet.close();
  context.refresh();
  context.toast.show(done);
}

/** The programme: each day's title and summary, and what is told about each stop. */
export function programScreen(tourId: string): Screen {
  return {
    section: 'turlar',
    title: tr.tour.itinerary,
    render(context: AppContext) {
      const data = context.catalog.snapshot(tourId);
      if (!data) return missing(tourId);
      const days = data.days.map((day, dayIndex) =>
        block(`${dayIndex + 1}. ${tr.tour.day}`, [
          group([
            row({
              title: day.title,
              subtitle: day.summary,
              icon: { name: 'calendar', tone: 'brown' },
              onClick: () => editDay(context, tourId, dayIndex, day),
            }),
          ]),
          group(
            day.stops.map((stop, stopIndex) =>
              row({
                title: stop.name,
                subtitle: [
                  tr.route.kinds[stop.kind],
                  stop.durationMinutes ? formatMinutes(stop.durationMinutes) : null,
                ]
                  .filter(Boolean)
                  .join(', '),
                lead: el('span', { class: 'row__thumb' }, [scene(stop.scene)]),
                onClick: () => editStop(context, tourId, dayIndex, stopIndex, stop),
              }),
            ),
          ),
        ]),
      );
      return screen(
        {
          title: tr.tour.itinerary,
          subtitle: data.title,
          back: { href: `#/turlar/${tourId}`, label: data.destination },
        },
        [...days, el('p', { class: 'block__foot', text: tr.admin.program.note })],
      );
    },
  };
}

function editDay(
  context: AppContext,
  tourId: string,
  dayIndex: number,
  day: { title: string; summary: string },
): void {
  const title = el('input', {
    attrs: { type: 'text', maxlength: '80', autocomplete: 'off', autofocus: '' },
  });
  const summary = el('textarea', { attrs: { rows: '4', maxlength: '400' } });
  title.value = day.title;
  summary.value = day.summary;
  const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
  const form = el('form', { class: 'sheet__form', attrs: { novalidate: '', id: 'day-form' } }, [
    field({ label: tr.admin.program.dayTitle, control: title }),
    field({ label: tr.admin.program.daySummary, control: summary }),
    error,
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (title.value.trim() === '' || summary.value.trim() === '') {
      error.textContent = tr.admin.ui.required;
      return;
    }
    keep(context, error, () =>
      context.catalog.change(
        tourId,
        setDay(dayIndex, { title: title.value.trim(), summary: summary.value.trim() }),
      ),
    );
  });
  context.sheet.open({
    title: `${dayIndex + 1}. ${tr.tour.day}`,
    body: [form],
    footer: [
      button({
        label: tr.admin.ui.save,
        type: 'submit',
        size: 'lg',
        block: true,
        attrs: { form: 'day-form' },
      }),
    ],
  });
}

const MAX_FACTS = 3;

/** What is told about a stop: its name, a sentence about it, how long it takes, its picture and facts. */
function editStop(
  context: AppContext,
  tourId: string,
  dayIndex: number,
  stopIndex: number,
  stop: StopData,
): void {
  const name = el('input', { attrs: { type: 'text', maxlength: '80', autocomplete: 'off' } });
  const summary = el('textarea', { attrs: { rows: '3', maxlength: '300' } });
  const duration = el('input', {
    attrs: { type: 'number', inputmode: 'numeric', min: '5', max: '1440', step: '5' },
  });
  name.value = stop.name;
  summary.value = stop.summary;
  duration.value = stop.durationMinutes === undefined ? '' : String(stop.durationMinutes);

  let chosenScene: SceneKey = stop.scene;
  const scenePicker = el(
    'div',
    { class: 'scene-strip', attrs: { role: 'radiogroup', 'aria-label': tr.admin.tour.picture } },
    SCENE_KEYS.map((key) =>
      el(
        'button',
        {
          class: 'scene-grid__item',
          attrs: {
            type: 'button',
            role: 'radio',
            'aria-checked': String(key === chosenScene),
            'aria-label': tr.admin.scenes[key],
          },
          on: {
            click: (event) => {
              chosenScene = key;
              for (const item of scenePicker.querySelectorAll('[role="radio"]')) {
                item.setAttribute('aria-checked', String(item === event.currentTarget));
              }
            },
          },
        },
        [scene(key)],
      ),
    ),
  );

  const facts = Array.from({ length: MAX_FACTS }, (_, index) => {
    const label = el('input', {
      attrs: {
        type: 'text',
        maxlength: '30',
        autocomplete: 'off',
        'aria-label': tr.admin.program.factLabel(index + 1),
      },
    });
    const value = el('input', {
      attrs: {
        type: 'text',
        maxlength: '40',
        autocomplete: 'off',
        'aria-label': tr.admin.program.factValue(index + 1),
      },
    });
    label.value = stop.facts?.[index]?.label ?? '';
    value.value = stop.facts?.[index]?.value ?? '';
    return { label, value };
  });

  const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
  const form = el('form', { class: 'sheet__form', attrs: { novalidate: '', id: 'stop-form' } }, [
    field({ label: tr.admin.program.stopName, control: name }),
    field({ label: tr.admin.program.stopSummary, control: summary }),
    field({
      label: tr.admin.program.duration,
      control: duration,
      hint: tr.admin.program.durationHint,
    }),
    el('fieldset', { class: 'field' }, [
      el('legend', { text: tr.admin.tour.picture }),
      scenePicker,
    ]),
    el('fieldset', { class: 'field' }, [
      el('legend', { text: tr.admin.program.facts }),
      el('p', { class: 'field__hint', text: tr.admin.program.factsHint }),
      ...facts.map(({ label, value }) => el('div', { class: 'fact-pair' }, [label, value])),
    ]),
    error,
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const minutes = duration.value.trim() === '' ? undefined : Number(duration.value);
    if (name.value.trim() === '' || summary.value.trim() === '') {
      error.textContent = tr.admin.ui.required;
      return;
    }
    if (minutes !== undefined && (!Number.isInteger(minutes) || minutes <= 0)) {
      error.textContent = tr.admin.program.durationError;
      return;
    }
    const filled = facts
      .map(({ label, value }) => ({ label: label.value.trim(), value: value.value.trim() }))
      .filter((fact) => fact.label !== '' || fact.value !== '');
    if (filled.some((fact) => fact.label === '' || fact.value === '')) {
      error.textContent = tr.admin.program.factError;
      return;
    }
    keep(context, error, () =>
      context.catalog.change(
        tourId,
        setStop(dayIndex, stopIndex, {
          name: name.value.trim(),
          summary: summary.value.trim(),
          durationMinutes: minutes,
          scene: chosenScene,
          facts: filled,
        }),
      ),
    );
  });
  context.sheet.open({
    title: stop.name,
    body: [form],
    footer: [
      button({
        label: tr.admin.ui.save,
        type: 'submit',
        size: 'lg',
        block: true,
        attrs: { form: 'stop-form' },
      }),
    ],
  });
}

/** What the price covers, or what it does not: lines that can be added, changed, moved and removed. */
export function listScreen(tourId: string, which: 'dahil' | 'haric'): Screen | null {
  const list = which === 'dahil' ? 'included' : 'excluded';
  const title = which === 'dahil' ? tr.tour.included : tr.tour.excluded;
  return {
    section: 'turlar',
    title,
    render(context: AppContext) {
      const data = context.catalog.snapshot(tourId);
      if (!data) return missing(tourId);
      const items = data[list];
      const save = (next: readonly string[], done: string = tr.admin.ui.saved): void => {
        try {
          context.catalog.change(tourId, setList(list, next));
        } catch (problem) {
          if (!(problem instanceof InvalidTourError)) throw problem;
          context.toast.show(tr.admin.list.keepOne);
          return;
        }
        tap();
        context.refresh();
        context.toast.show(done);
      };
      const move = (index: number, by: number): void => {
        const next = [...items];
        const [item] = next.splice(index, 1);
        if (item === undefined) return;
        next.splice(index + by, 0, item);
        save(next, tr.admin.list.moved);
      };
      const rows = items.map((item, index) =>
        el('div', { class: 'row row--item' }, [
          el(
            'button',
            {
              class: 'row__main',
              attrs: { type: 'button' },
              on: {
                click: () =>
                  editText(context, {
                    title,
                    label: tr.admin.list.line,
                    value: item,
                    multiline: true,
                    maxLength: 200,
                    save: (text) =>
                      save(
                        items.map((existing, position) => (position === index ? text : existing)),
                      ),
                  }),
              },
            },
            [el('span', { class: 'row__title', text: item })],
          ),
          el('span', { class: 'row__tools' }, [
            index > 0
              ? iconButton({
                  icon: 'arrowUp',
                  label: tr.admin.list.moveUp,
                  onClick: () => move(index, -1),
                })
              : null,
            index < items.length - 1
              ? iconButton({
                  icon: 'arrowDown',
                  label: tr.admin.list.moveDown,
                  onClick: () => move(index, 1),
                })
              : null,
            iconButton({
              icon: 'trash',
              label: tr.admin.ui.delete,
              onClick: () =>
                save(
                  items.filter((_, position) => position !== index),
                  tr.admin.list.removedLine,
                ),
            }),
          ]),
        ]),
      );
      const input = el('input', {
        attrs: {
          type: 'text',
          maxlength: '200',
          autocomplete: 'off',
          placeholder: tr.admin.list.newLine,
          'aria-label': tr.admin.list.newLine,
        },
      });
      const add = el('form', { class: 'add-line', attrs: { novalidate: '' } }, [
        input,
        el('button', { class: 'btn btn--primary', attrs: { type: 'submit' } }, [
          icon('plus'),
          el('span', { text: tr.admin.ui.add }),
        ]),
      ]);
      add.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (text === '') return;
        save([...items, text], tr.admin.list.added);
      });
      return screen(
        {
          title,
          subtitle: data.title,
          back: { href: `#/turlar/${tourId}`, label: data.destination },
        },
        [group(rows), add],
      );
    },
  };
}

/** The hotels of a tour, each with its town, stars, nights and board. */
export function hotelsScreen(tourId: string): Screen {
  return {
    section: 'turlar',
    title: tr.tour.lodging,
    render(context: AppContext) {
      const data = context.catalog.snapshot(tourId);
      if (!data) return missing(tourId);
      const save = (hotels: readonly HotelData[], done: string): boolean => {
        try {
          context.catalog.change(tourId, setHotels(hotels));
        } catch (problem) {
          if (!(problem instanceof InvalidTourError)) throw problem;
          return false;
        }
        tap();
        context.refresh();
        context.toast.show(done);
        return true;
      };
      const rows = data.hotels.map((hotel, index) =>
        row({
          title: hotel.name,
          subtitle: `${hotel.location}, ${hotel.nights} ${tr.tour.nightsUnit}, ${hotel.board}`,
          value: '★'.repeat(hotel.stars),
          icon: { name: 'bed', tone: 'brown' },
          onClick: () =>
            editHotel(
              context,
              hotel,
              (next) =>
                save(
                  data.hotels.map((item, position) => (position === index ? next : item)),
                  tr.admin.ui.saved,
                ),
              () =>
                save(
                  data.hotels.filter((_, position) => position !== index),
                  tr.admin.hotels.removed,
                ),
            ),
        }),
      );
      return screen(
        {
          title: tr.tour.lodging,
          subtitle: data.title,
          back: { href: `#/turlar/${tourId}`, label: data.destination },
        },
        [
          data.hotels.length === 0
            ? el('p', { class: 'block__empty', text: tr.admin.hotels.none })
            : group(rows),
          button({
            label: tr.admin.hotels.add,
            icon: 'plus',
            variant: 'tonal',
            block: true,
            onClick: () =>
              editHotel(context, null, (next) =>
                save([...data.hotels, next], tr.admin.hotels.added),
              ),
          }),
          el('p', { class: 'block__foot', text: tr.admin.hotels.note(formatNumber(data.nights)) }),
        ],
      );
    },
  };
}

function editHotel(
  context: AppContext,
  hotel: HotelData | null,
  save: (hotel: HotelData) => boolean,
  remove?: () => boolean,
): void {
  const name = el('input', { attrs: { type: 'text', maxlength: '80', autocomplete: 'off' } });
  const location = el('input', { attrs: { type: 'text', maxlength: '60', autocomplete: 'off' } });
  const stars = el('select');
  stars.append(
    ...[5, 4, 3, 2, 1].map((count) =>
      el('option', { text: tr.admin.hotels.stars(count), attrs: { value: String(count) } }),
    ),
  );
  const nights = el('input', {
    attrs: { type: 'number', inputmode: 'numeric', min: '1', max: '30', step: '1' },
  });
  const board = el('input', {
    attrs: { type: 'text', maxlength: '40', autocomplete: 'off', list: 'board-options' },
  });
  const boards = el(
    'datalist',
    { attrs: { id: 'board-options' } },
    tr.admin.hotels.boards.map((value) => el('option', { attrs: { value } })),
  );
  name.value = hotel?.name ?? '';
  location.value = hotel?.location ?? '';
  stars.value = String(hotel?.stars ?? 4);
  nights.value = String(hotel?.nights ?? 1);
  board.value = hotel?.board ?? tr.admin.hotels.boards[0] ?? '';
  const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
  const form = el('form', { class: 'sheet__form', attrs: { novalidate: '', id: 'hotel-form' } }, [
    field({ label: tr.admin.hotels.name, control: name }),
    field({ label: tr.admin.hotels.location, control: location }),
    field({ label: tr.admin.hotels.starsLabel, control: stars }),
    field({ label: tr.admin.hotels.nights, control: nights }),
    field({ label: tr.admin.hotels.board, control: board }),
    boards,
    error,
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const next: HotelData = {
      name: name.value.trim(),
      location: location.value.trim(),
      stars: Number(stars.value),
      nights: Number(nights.value),
      board: board.value.trim(),
    };
    if (
      !next.name ||
      !next.location ||
      !next.board ||
      !Number.isInteger(next.nights) ||
      next.nights < 1
    ) {
      error.textContent = tr.admin.ui.required;
      return;
    }
    if (save(next)) void context.sheet.close();
    else error.textContent = tr.admin.ui.invalid;
  });
  context.sheet.open({
    title: hotel ? hotel.name : tr.admin.hotels.add,
    body: [form],
    footer: [
      button({
        label: tr.admin.ui.save,
        type: 'submit',
        size: 'lg',
        block: true,
        attrs: { form: 'hotel-form' },
      }),
      remove
        ? button({
            label: tr.admin.hotels.remove,
            variant: 'danger',
            block: true,
            onClick: () => {
              if (remove()) void context.sheet.close();
            },
          })
        : null,
    ],
  });
}
