import type { JourneySnapshot, MomentData } from '@/application/dto/JourneyData';
import { toJourney } from '@/application/journeyMapper';
import { JOURNEY_GROUPS, type Journey, type JourneyGroup } from '@/domain/journey/Journey';
import { SCENE_KEYS, type SceneKey } from '@/domain/tour/Tour';
import { pageUrl } from '@/config/paths';
import { tr } from '@/i18n/tr';
import { JOURNEY_DRAFTS_KEY } from '@/infrastructure/storage/keys';
import type { SafeStorage } from '@/infrastructure/storage/SafeStorage';
import { formatDayAndWeekday, formatKm, formatNumber } from '@/shared/format';
import { journeyText, type JourneyField } from '@/shared/journeyText';

/** A journey as the panel keeps it on this device. */
export interface LocalJourney {
  readonly journey: Journey;
  /** Recorded in the panel and not yet on the site. */
  readonly isNew: boolean;
}

export interface LocalJourneys {
  readonly records: ReadonlyMap<string, LocalJourney>;
  readonly hidden: ReadonlySet<string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;
const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;
const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isScene = (value: unknown): value is SceneKey =>
  typeof value === 'string' && (SCENE_KEYS as readonly string[]).includes(value);
const isGroup = (value: unknown): value is JourneyGroup =>
  typeof value === 'string' && (JOURNEY_GROUPS as readonly string[]).includes(value);

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readMoment(value: unknown): MomentData | null {
  if (!isRecord(value)) return null;
  const { day, place, scene, note } = value;
  if (!isWhole(day) || !isText(place, 60) || !isScene(scene) || !isText(note, 280)) return null;
  return { day, place, scene, note };
}

function readJourney(id: string, value: unknown): Journey | null {
  if (!isRecord(value)) return null;
  const { tour, title, scene, startDate, endDate, group, guests, distanceKm, story, moments } =
    value;
  if (
    !isText(tour, 80) ||
    !isText(title, 80) ||
    !isScene(scene) ||
    !isDate(startDate) ||
    !isDate(endDate) ||
    !isGroup(group) ||
    !isWhole(guests) ||
    !isWhole(distanceKm) ||
    !isText(story, 700) ||
    !Array.isArray(moments)
  ) {
    return null;
  }
  const snapshot: JourneySnapshot = {
    id,
    tour,
    title,
    scene,
    startDate,
    endDate,
    group,
    guests,
    distanceKm,
    story,
    moments: moments.slice(0, 12).flatMap((moment) => readMoment(moment) ?? []),
  };
  try {
    return toJourney(snapshot);
  } catch {
    return null;
  }
}

/**
 * Reads the journeys the panel changed or recorded on this device, without
 * the panel's full checks: what does not have the expected shape is ignored.
 */
export function readLocalJourneys(
  storage: SafeStorage,
  hidden: ReadonlySet<string>,
): LocalJourneys {
  const records = new Map<string, LocalJourney>();
  const drafts = parse(storage.read(JOURNEY_DRAFTS_KEY));
  if (isRecord(drafts)) {
    for (const [id, entry] of Object.entries(drafts)) {
      if (!isRecord(entry) || !/^[a-z0-9-]{1,80}$/.test(id)) continue;
      const journey = readJourney(id, entry['journey']);
      if (journey) records.set(id, { journey, isNew: entry['base'] === null });
    }
  }
  return { records, hidden };
}

/** Points a picture at a drawing, if the page carries that drawing. */
function showScene(svg: Element | null, scene: SceneKey): void {
  const use = svg?.querySelector('use');
  if (use && svg?.ownerDocument.getElementById(`scene-${scene}`)) {
    use.setAttribute('href', `#scene-${scene}`);
  }
}

function fillFields(scope: Element, journey: Journey): void {
  const text = journeyText(journey);
  for (const field of scope.querySelectorAll<HTMLElement>('[data-journey-field]')) {
    const name = field.dataset['journeyField'] as JourneyField | undefined;
    if (name && name in text) field.textContent = text[name];
  }
}

function fillCard(card: HTMLElement, journey: Journey): void {
  fillFields(card, journey);
  showScene(card.querySelector('[data-scene]'), journey.scene);
  card.dataset['group'] = journey.group;
  card.dataset['km'] = String(journey.distanceKm);
  card.dataset['guests'] = String(journey.guests);
  card.dataset['start'] = journey.startDate;
}

/** Adds a journey recorded in the panel to the archive, under its year and in date order. */
function addCard(archive: Element, journey: Journey): void {
  const template = archive.querySelector<HTMLTemplateElement>('[data-journey-card-template]');
  const card = template?.content.firstElementChild?.cloneNode(true);
  if (!(card instanceof HTMLElement)) return;
  card.dataset['journeyCard'] = journey.id;
  fillCard(card, journey);
  // It has no page of its own until it is published; it leads to its tour instead.
  card.querySelector('a')?.setAttribute('href', pageUrl(`turlar/${journey.tourId}`));

  const years = archive.querySelector('[data-journey-years]');
  if (!years) return;
  let year = years.querySelector(`[data-journey-year="${journey.year}"]`);
  if (!year) {
    const yearTemplate = archive.querySelector<HTMLTemplateElement>('[data-journey-year-template]');
    const created = yearTemplate?.content.firstElementChild?.cloneNode(true);
    if (!(created instanceof HTMLElement)) return;
    created.dataset['journeyYear'] = String(journey.year);
    const label = created.querySelector('h2');
    if (label) label.textContent = String(journey.year);
    const later = [...years.children].find(
      (item) => Number((item as HTMLElement).dataset['journeyYear']) < journey.year,
    );
    years.insertBefore(created, later ?? null);
    year = created;
  }
  const list = year.querySelector('ul');
  if (!list) return;
  const before = [...list.children].find(
    (item) => ((item as HTMLElement).dataset['start'] ?? '') < journey.startDate,
  );
  list.insertBefore(card, before ?? null);
}

/** Rolls the odometer to a new figure and rewrites its caption. */
function showTotals(archive: Element, root: Document): void {
  let count = 0;
  let guests = 0;
  let km = 0;
  for (const card of archive.querySelectorAll<HTMLElement>('[data-journey-card]:not([hidden])')) {
    if (card.closest('template')) continue;
    count += 1;
    guests += Number(card.dataset['guests']) || 0;
    km += Number(card.dataset['km']) || 0;
  }
  const odometer = root.querySelector('[data-odometer]');
  if (odometer) {
    const reels = [...odometer.querySelectorAll<HTMLElement>('.odometer__reel')];
    const digits = String(Math.min(km, 10 ** reels.length - 1))
      .padStart(reels.length, '0')
      .split('');
    const lead = digits.findIndex((digit) => digit !== '0');
    reels.forEach((reel, index) => {
      reel.dataset['digit'] = digits[index] ?? '0';
      reel.parentElement?.toggleAttribute('data-lead', lead === -1 || index < lead);
    });
  }
  const caption = root.querySelector('[data-journey-totals]');
  if (caption) {
    caption.textContent = tr.journeys.totals(
      formatNumber(count),
      formatNumber(guests),
      formatKm(km),
    );
  }
}

/** Draws the journey's moments again, the way the page drew them. */
function fillMoments(page: Element, journey: Journey): void {
  const section = page.querySelector<HTMLElement>('[data-journey-moments-section]');
  const list = page.querySelector('[data-journey-moments]');
  const template = page.querySelector<HTMLTemplateElement>('[data-moment-template]');
  if (!section || !list || !template) return;
  list.replaceChildren(
    ...journey.moments.flatMap((moment) => {
      const item = template.content.firstElementChild?.cloneNode(true);
      if (!(item instanceof HTMLElement)) return [];
      showScene(item.querySelector('svg'), moment.scene);
      const set = (name: string, value: string): void => {
        const field = item.querySelector(`[data-moment-field="${name}"]`);
        if (field) field.textContent = value;
      };
      set('place', moment.place);
      set('day', tr.journeys.dayOf(moment.day, formatDayAndWeekday(journey.dateOfDay(moment.day))));
      set('note', moment.note);
      return [item];
    }),
  );
  section.hidden = journey.moments.length === 0;
}

/**
 * Shows, on the pages of this device, what the panel changed about past
 * journeys: hidden ones leave every list, changed ones read as changed, and
 * ones recorded in the panel join the archive. The pages were built without
 * them; until the panel publishes to the site, this is how a change made in
 * the office can be seen there.
 */
export function syncJourneys(root: Document, local: LocalJourneys): void {
  for (const card of root.querySelectorAll<HTMLElement>('[data-journey-card]')) {
    const id = card.dataset['journeyCard'] ?? '';
    if (local.hidden.has(id)) {
      card.hidden = true;
      continue;
    }
    const record = local.records.get(id);
    if (record) fillCard(card, record.journey);
  }

  const archive = root.querySelector('[data-journey-archive]');
  if (archive) {
    for (const { journey, isNew } of local.records.values()) {
      const shown = archive.querySelector(`[data-journey-card="${journey.id}"]`);
      if (isNew && !shown && !local.hidden.has(journey.id)) addCard(archive, journey);
    }
    showTotals(archive, root);
  }

  const page = root.querySelector<HTMLElement>('[data-journey-page]');
  const record = page ? local.records.get(page.dataset['journeyPage'] ?? '') : undefined;
  if (page && record) {
    const head = page.querySelector('[data-journey-head]');
    if (head) {
      fillFields(head, record.journey);
      showScene(head.querySelector('[data-scene]'), record.journey.scene);
    }
    fillMoments(page, record.journey);
  }
}
