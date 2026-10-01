import type { JourneySnapshot, MomentData } from '@/application/dto/JourneyData';
import { InvalidJourneyError } from '@/application/JourneyArchiveEditor';
import { removeMoment, saveMoment, setJourneyDetails } from '@/application/journeyEdits';
import {
  JOURNEY_GROUPS,
  totalsOf,
  type Journey,
  type JourneyGroup,
} from '@/domain/journey/Journey';
import type { SceneKey, Tour } from '@/domain/tour/Tour';
import { pageUrl } from '@/config/paths';
import { tr } from '@/i18n/tr';
import { formatDateRange, formatDayAndWeekday, formatKm, formatNumber } from '@/shared/format';
import { href, type AppContext, type Screen } from '../context';
import { el } from '../ui/dom';
import {
  block,
  button,
  emptyState,
  fab,
  field,
  group,
  iconButton,
  row,
  scene,
  sceneStrip,
  screen,
  segmented,
  stagger,
  toggleRow,
} from '../ui/kit';
import { tap } from '../ui/motion';
import { journeyRow } from '../ui/parts';
import { attempt, editChoice, editNumber, editText, pickScene } from './editSheets';

const DAY_MS = 86_400_000;

/** The ISO date some days after another. */
function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const toArchive = { href: '#/gecmis', label: tr.admin.journeys.title } as const;

/** Every past journey, the latest first, each opening to be managed. */
export function journeysScreen(): Screen {
  return {
    section: 'turlar',
    title: tr.admin.journeys.title,
    render(context: AppContext, entering: boolean) {
      const journeys = context.journeys.journeys();
      const add = fab(tr.admin.journeys.add, href('/gecmis/yeni'));
      const back = { href: '#/turlar', label: tr.admin.nav.tours };
      if (journeys.length === 0) {
        return screen({ title: tr.admin.journeys.title, back }, [
          emptyState({
            art: 'seyir',
            title: tr.admin.journeys.emptyTitle,
            text: tr.admin.journeys.emptyText,
            action: button({
              label: tr.admin.journeys.add,
              icon: 'plus',
              href: href('/gecmis/yeni'),
            }),
          }),
          add,
        ]);
      }
      const totals = totalsOf(journeys);
      const rows = journeys.map((journey) =>
        journeyRow(journey, {
          hidden: context.settings.isJourneyHidden(journey.id),
          isNew: context.journeys.isNew(journey.id),
          changed: context.journeys.isChanged(journey.id),
        }),
      );
      return screen(
        {
          title: tr.admin.journeys.title,
          subtitle: tr.admin.journeys.subtitle(
            formatNumber(totals.count),
            formatNumber(totals.guests),
          ),
          back,
        },
        [group(entering ? stagger(rows) : rows, 'group--tours'), add],
      );
    },
  };
}

/** Records a journey that has ended; a departure can fill in the tour, the dates and the guests. */
export function journeyFormScreen(options: { readonly departureId: string | null }): Screen {
  return {
    section: 'turlar',
    title: tr.admin.journeys.add,
    render(context: AppContext) {
      const tours = context.catalog.tours();
      const booking = options.departureId
        ? context.bookings.booking(options.departureId)
        : undefined;

      const tour = el('select');
      tour.append(
        ...tours.map((item) => el('option', { text: item.title, attrs: { value: item.id } })),
      );
      tour.value = booking?.tour.id ?? tours[0]?.id ?? '';
      const start = el('input', { attrs: { type: 'date', max: context.today } });
      const end = el('input', { attrs: { type: 'date', max: context.today } });
      const guests = el('input', {
        attrs: { type: 'number', inputmode: 'numeric', min: '1', max: '1000', step: '1' },
      });
      const story = el('textarea', { attrs: { rows: '4', maxlength: '700' } });
      if (booking) {
        start.value = booking.departure.startDate;
        end.value = booking.departure.endDate;
        const travelled = booking.departure.occupancy.booked;
        if (travelled > 0) guests.value = String(travelled);
      }
      const chosenTour = (): Tour | undefined => tours.find((item) => item.id === tour.value);
      // The end follows from the start and the length of the programme, until it is set by hand.
      const fillEnd = (): void => {
        const programme = chosenTour();
        if (programme && isIsoDate(start.value)) {
          end.value = addDays(start.value, programme.dayCount - 1);
        }
      };
      tour.addEventListener('change', fillEnd);
      start.addEventListener('change', fillEnd);

      const groupChoice = segmented<JourneyGroup>({
        name: 'group',
        legend: tr.admin.journeys.group,
        value: 'genel',
        choices: JOURNEY_GROUPS.map((value) => ({ value, label: tr.journeys.groups[value] })),
      });

      const form = el('form', { class: 'form', attrs: { novalidate: '' } }, [
        block(null, [
          group(
            [field({ label: tr.admin.journeys.tour, control: tour, name: 'tour' })],
            'group--form',
          ),
        ]),
        block(tr.admin.journeys.dates, [
          group(
            [
              field({ label: tr.admin.journeys.startDate, control: start, name: 'startDate' }),
              field({
                label: tr.admin.journeys.endDate,
                control: end,
                name: 'endDate',
                hint: tr.admin.journeys.endHint,
              }),
            ],
            'group--form',
          ),
        ]),
        block(tr.admin.journeys.details, [
          group(
            [
              groupChoice,
              field({ label: tr.admin.journeys.guests, control: guests, name: 'guests' }),
            ],
            'group--form',
          ),
        ]),
        block(tr.admin.journeys.story, [
          group(
            [
              field({
                label: tr.admin.journeys.story,
                control: story,
                name: 'story',
                hint: tr.admin.journeys.storyHint,
              }),
            ],
            'group--form',
          ),
        ]),
        el('div', { class: 'save-bar' }, [
          button({ label: tr.admin.journeys.create, type: 'submit', size: 'lg', block: true }),
        ]),
      ]);

      const fail = (name: string, message: string): void => {
        for (const error of form.querySelectorAll<HTMLElement>('[data-error-for]')) {
          error.textContent = error.dataset['errorFor'] === name ? message : '';
        }
        const control = form.querySelector<HTMLElement>(`[name="${name}"]`);
        control?.setAttribute('aria-invalid', 'true');
        control?.focus();
        context.toast.show(message);
      };

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        for (const control of form.querySelectorAll('[aria-invalid]')) {
          control.removeAttribute('aria-invalid');
        }
        const programme = chosenTour();
        const count = Number(guests.value);
        if (!programme) return fail('tour', tr.admin.ui.required);
        if (!isIsoDate(start.value)) return fail('startDate', tr.admin.ui.required);
        if (!isIsoDate(end.value)) return fail('endDate', tr.admin.ui.required);
        if (end.value < start.value) return fail('endDate', tr.admin.journeys.datesError);
        if (end.value > context.today) return fail('endDate', tr.admin.journeys.futureError);
        if (!Number.isInteger(count) || count < 1 || count > 1000) {
          return fail('guests', tr.admin.ui.between(formatNumber(1), formatNumber(1000)));
        }
        if (story.value.trim() === '') return fail('story', tr.admin.ui.required);
        const chosenGroup = new FormData(form).get('group');
        try {
          const journey = context.journeys.create({
            tour: programme.id,
            title: programme.title,
            scene: programme.scene,
            startDate: start.value,
            endDate: end.value,
            group: JOURNEY_GROUPS.find((value) => value === chosenGroup) ?? 'genel',
            guests: count,
            distanceKm: programme.routeDistanceKm,
            story: story.value.trim(),
            moments: [],
          });
          tap();
          context.toast.show(tr.admin.journeys.created);
          context.go(`/gecmis/${journey.id}`, { replace: true });
        } catch (problem) {
          if (!(problem instanceof InvalidJourneyError)) throw problem;
          context.toast.show(tr.admin.ui.invalid);
        }
      });

      return screen({ title: tr.admin.journeys.add, back: toArchive }, [form]);
    },
  };
}

/** One past journey, to be managed: whether the site shows it, what it says and its moments. */
export function journeyScreen(journeyId: string): Screen {
  return {
    section: 'turlar',
    title: tr.admin.journeys.title,
    render(context: AppContext) {
      const journey = context.journeys.journey(journeyId);
      const data = context.journeys.snapshot(journeyId);
      if (!journey || !data) {
        return screen({ title: tr.admin.journeys.title, back: toArchive }, [
          el('p', { class: 'block__empty', text: tr.admin.tour.missing }),
        ]);
      }
      const change = (edit: Parameters<typeof context.journeys.change>[1]): void => {
        context.journeys.change(journeyId, edit);
      };
      const hidden = context.settings.isJourneyHidden(journeyId);
      const isNew = context.journeys.isNew(journeyId);
      const tour = context.catalog.tour(journey.tourId);

      // Moments are listed by day; each keeps its place in the record, which is how it is changed.
      const moments = data.moments
        .map((moment, index) => ({ moment, index }))
        .sort((a, b) => a.moment.day - b.moment.day)
        .map(({ moment, index }) =>
          row({
            title: moment.place,
            subtitle: [
              tr.admin.journeys.dayOption(
                moment.day,
                formatDayAndWeekday(journey.dateOfDay(moment.day)),
              ),
              moment.note,
            ]
              .filter(Boolean)
              .join(': '),
            lead: el('span', { class: 'row__thumb' }, [scene(moment.scene)]),
            onClick: () => editMoment(context, journey, index, tour),
          }),
        );

      return screen(
        {
          title: journey.title,
          subtitle: formatDateRange(journey.startDate, journey.endDate),
          back: toArchive,
          art: journey.scene,
          actions: isNew
            ? []
            : [
                iconButton({
                  icon: 'external',
                  label: tr.admin.journeys.openOnSite,
                  href: pageUrl(`gecmis-turlar/${journey.id}`),
                }),
              ],
        },
        [
          context.journeys.isStale(journeyId)
            ? el('div', { class: 'notice' }, [
                el('p', { text: tr.admin.journeys.stale }),
                button({
                  label: tr.admin.journeys.useSite,
                  variant: 'secondary',
                  onClick: () => {
                    context.journeys.discard(journeyId);
                    context.refresh();
                  },
                }),
              ])
            : null,
          group([
            toggleRow({
              title: tr.admin.journeys.visible,
              subtitle: hidden ? tr.admin.journeys.hiddenHint : tr.admin.journeys.visibleHint,
              checked: !hidden,
              icon: { name: hidden ? 'eyeOff' : 'eye', tone: hidden ? 'grey' : 'green' },
              onChange: (visible) => {
                context.settings.setJourneyHidden(journeyId, !visible);
                tap();
                context.refresh();
                context.toast.show(
                  visible ? tr.admin.journeys.shownNow : tr.admin.journeys.hiddenNow,
                );
              },
            }),
          ]),

          block(tr.admin.journeys.details, [
            group([
              row({
                title: tr.admin.journeys.name,
                subtitle: journey.title,
                icon: { name: 'ticket', tone: 'blue' },
                onClick: () =>
                  editText(context, {
                    title: tr.admin.journeys.name,
                    label: tr.admin.journeys.name,
                    value: journey.title,
                    maxLength: 80,
                    save: (title) => change(setJourneyDetails({ title })),
                  }),
              }),
              row({
                title: tr.admin.journeys.dates,
                value: formatDateRange(journey.startDate, journey.endDate),
                icon: { name: 'calendar', tone: 'blue' },
                onClick: () => editDates(context, journeyId, data),
              }),
              row({
                title: tr.admin.journeys.group,
                value: tr.journeys.groups[journey.group],
                icon: { name: 'users', tone: 'brown' },
                onClick: () =>
                  editChoice<JourneyGroup>(context, {
                    title: tr.admin.journeys.group,
                    value: journey.group,
                    choices: JOURNEY_GROUPS.map((value) => ({
                      value,
                      label: tr.journeys.groups[value],
                    })),
                    save: (value) => change(setJourneyDetails({ group: value })),
                  }),
              }),
              row({
                title: tr.admin.journeys.guests,
                value: el('span', { class: 'tabular', text: formatNumber(journey.guests) }),
                icon: { name: 'users', tone: 'green' },
                onClick: () =>
                  editNumber(context, {
                    title: tr.admin.journeys.guests,
                    label: tr.admin.journeys.guests,
                    value: journey.guests,
                    min: 1,
                    max: 1000,
                    save: (count) => change(setJourneyDetails({ guests: count ?? journey.guests })),
                  }),
              }),
              row({
                title: tr.admin.journeys.distance,
                value: formatKm(journey.distanceKm),
                icon: { name: 'route', tone: 'grey' },
                onClick: () =>
                  editNumber(context, {
                    title: tr.admin.journeys.distance,
                    label: tr.admin.journeys.distanceLabel,
                    value: journey.distanceKm,
                    min: 1,
                    max: 20_000,
                    save: (km) =>
                      change(setJourneyDetails({ distanceKm: km ?? journey.distanceKm })),
                  }),
              }),
              row({
                title: tr.admin.journeys.picture,
                lead: el('span', { class: 'row__thumb' }, [scene(journey.scene)]),
                value: tr.admin.scenes[journey.scene],
                onClick: () =>
                  pickScene(context, {
                    title: tr.admin.journeys.picture,
                    value: journey.scene,
                    save: (key) => change(setJourneyDetails({ scene: key })),
                  }),
              }),
            ]),
          ]),

          block(tr.admin.journeys.story, [
            group([
              row({
                title: tr.admin.journeys.story,
                subtitle: journey.story,
                icon: { name: 'list', tone: 'blue' },
                onClick: () =>
                  editText(context, {
                    title: tr.admin.journeys.story,
                    label: tr.admin.journeys.story,
                    value: journey.story,
                    multiline: true,
                    maxLength: 700,
                    hint: tr.admin.journeys.storyHint,
                    save: (story) => change(setJourneyDetails({ story })),
                  }),
              }),
            ]),
          ]),

          block(
            tr.admin.journeys.moments,
            [
              moments.length === 0
                ? el('p', { class: 'block__empty', text: tr.admin.journeys.noMoments })
                : group(moments),
            ],
            {
              action: el('button', {
                class: 'block__link',
                text: tr.admin.journeys.addMoment,
                attrs: { type: 'button' },
                on: { click: () => editMoment(context, journey, null, tour) },
              }),
              footnote: tr.admin.journeys.momentsHint,
            },
          ),

          isNew || context.journeys.isChanged(journeyId)
            ? block(
                null,
                [
                  group([
                    row({
                      title: isNew ? tr.admin.journeys.remove : tr.admin.journeys.discard,
                      icon: { name: isNew ? 'trash' : 'refresh', tone: 'red' },
                      danger: true,
                      onClick: () =>
                        void context
                          .confirm({
                            title: isNew ? tr.admin.journeys.remove : tr.admin.journeys.discard,
                            text: isNew
                              ? tr.admin.journeys.removeText
                              : tr.admin.journeys.discardText,
                            confirm: isNew ? tr.admin.journeys.remove : tr.admin.journeys.discard,
                            danger: true,
                          })
                          .then((yes) => {
                            if (!yes) return;
                            if (isNew) {
                              context.journeys.remove(journeyId);
                              context.toast.show(tr.admin.journeys.removed);
                              context.back('/gecmis');
                            } else {
                              context.journeys.discard(journeyId);
                              context.refresh();
                              context.toast.show(tr.admin.journeys.discarded);
                            }
                          }),
                    }),
                  ]),
                ],
                {
                  footnote: isNew ? tr.admin.journeys.newNote : tr.admin.journeys.changedNote,
                },
              )
            : null,
        ],
      );
    },
  };
}

/** The dates of a journey; a moment left outside the new dates keeps them from changing. */
function editDates(context: AppContext, journeyId: string, data: JourneySnapshot): void {
  const start = el('input', { attrs: { type: 'date', max: context.today, autofocus: '' } });
  const end = el('input', { attrs: { type: 'date', max: context.today } });
  start.value = data.startDate;
  end.value = data.endDate;
  const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
  const form = el('form', { class: 'sheet__form', attrs: { novalidate: '', id: 'dates-form' } }, [
    field({ label: tr.admin.journeys.startDate, control: start }),
    field({ label: tr.admin.journeys.endDate, control: end }),
    error,
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!isIsoDate(start.value) || !isIsoDate(end.value)) {
      error.textContent = tr.admin.ui.required;
      return;
    }
    if (end.value < start.value) {
      error.textContent = tr.admin.journeys.datesError;
      return;
    }
    if (end.value > context.today) {
      error.textContent = tr.admin.journeys.futureError;
      return;
    }
    const days = Math.round((Date.parse(end.value) - Date.parse(start.value)) / DAY_MS) + 1;
    if (data.moments.some((moment) => moment.day > days)) {
      error.textContent = tr.admin.journeys.momentsOutside;
      return;
    }
    attempt(
      context,
      error,
      () =>
        context.journeys.change(
          journeyId,
          setJourneyDetails({ startDate: start.value, endDate: end.value }),
        ),
      tr.admin.ui.saved,
    );
  });
  context.sheet.open({
    title: tr.admin.journeys.dates,
    body: [form],
    footer: [
      button({
        label: tr.admin.ui.save,
        type: 'submit',
        size: 'lg',
        block: true,
        attrs: { form: 'dates-form' },
      }),
    ],
  });
}

/**
 * A moment of the journey: where, on which day, its picture and what is told
 * about it. A stop of the tour's programme fills in the place, the day and
 * the picture at once.
 */
function editMoment(
  context: AppContext,
  journey: Journey,
  index: number | null,
  tour: Tour | undefined,
): void {
  const data = context.journeys.snapshot(journey.id);
  const existing: MomentData | undefined = index === null ? undefined : data?.moments[index];

  const place = el('input', { attrs: { type: 'text', maxlength: '60', autocomplete: 'off' } });
  const day = el('select');
  day.append(
    ...Array.from({ length: journey.dayCount }, (_, at) =>
      el('option', {
        text: tr.admin.journeys.dayOption(at + 1, formatDayAndWeekday(journey.dateOfDay(at + 1))),
        attrs: { value: String(at + 1) },
      }),
    ),
  );
  const note = el('textarea', { attrs: { rows: '3', maxlength: '280' } });
  let chosenScene: SceneKey = existing?.scene ?? journey.scene;
  const picture = sceneStrip({
    label: tr.admin.journeys.picture,
    value: chosenScene,
    onChange: (key) => {
      chosenScene = key;
    },
  });
  place.value = existing?.place ?? '';
  day.value = String(existing?.day ?? 1);
  note.value = existing?.note ?? '';

  const stops = (tour?.days ?? []).flatMap((tourDay) =>
    tourDay.stops
      .filter((stop) => stop.kind !== 'departure' && stop.kind !== 'arrival')
      .map((stop) => ({ day: tourDay.number, stop })),
  );
  const fromStop =
    stops.length > 0
      ? el('select', {}, [
          el('option', { text: tr.admin.journeys.fromStopNone, attrs: { value: '' } }),
          ...stops.map(({ day: number, stop }, at) =>
            el('option', {
              text: `${number}. ${tr.tour.day}: ${stop.name}`,
              attrs: { value: String(at) },
            }),
          ),
        ])
      : null;
  fromStop?.addEventListener('change', () => {
    const picked = stops[Number(fromStop.value)];
    if (fromStop.value === '' || !picked) return;
    place.value = picked.stop.name;
    day.value = String(Math.min(picked.day, journey.dayCount));
    chosenScene = picked.stop.scene;
    picture.select(picked.stop.scene);
  });

  const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
  const form = el('form', { class: 'sheet__form', attrs: { novalidate: '', id: 'moment-form' } }, [
    fromStop ? field({ label: tr.admin.journeys.fromStop, control: fromStop }) : null,
    field({ label: tr.admin.journeys.place, control: place }),
    field({ label: tr.admin.journeys.day, control: day }),
    el('fieldset', { class: 'field' }, [
      el('legend', { text: tr.admin.journeys.picture }),
      picture.element,
    ]),
    field({ label: tr.admin.journeys.note, control: note, hint: tr.admin.journeys.noteHint }),
    error,
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (place.value.trim() === '') {
      error.textContent = tr.admin.ui.required;
      place.focus();
      return;
    }
    attempt(
      context,
      error,
      () =>
        context.journeys.change(
          journey.id,
          saveMoment(index, {
            day: Number(day.value),
            place: place.value.trim(),
            scene: chosenScene,
            note: note.value.trim(),
          }),
        ),
      tr.admin.journeys.momentSaved,
    );
  });

  context.sheet.open({
    title: existing ? existing.place : tr.admin.journeys.addMoment,
    body: [form],
    footer: [
      button({
        label: tr.admin.ui.save,
        type: 'submit',
        size: 'lg',
        block: true,
        attrs: { form: 'moment-form' },
      }),
      index !== null
        ? button({
            label: tr.admin.journeys.removeMoment,
            variant: 'danger',
            block: true,
            onClick: () =>
              attempt(
                context,
                error,
                () => context.journeys.change(journey.id, removeMoment(index)),
                tr.admin.journeys.momentRemoved,
              ),
          })
        : null,
    ],
  });
}
