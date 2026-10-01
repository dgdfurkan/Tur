import { describe, expect, it } from 'vitest';
import type { JourneyData } from '@/application/dto/JourneyData';
import { fingerprint } from '@/application/fingerprint';
import {
  checkJourney,
  InvalidJourneyError,
  JourneyArchiveEditor,
  journeyId,
} from '@/application/JourneyArchiveEditor';
import { removeMoment, saveMoment, setJourneyDetails } from '@/application/journeyEdits';
import { JOURNEY_DRAFTS_KEY } from '@/infrastructure/storage/keys';
import { LocalJourneyDrafts } from '@/infrastructure/storage/LocalJourneyDrafts';
import { memoryStorage, publishedJourneys } from '../support/stores';

function editor(storage = memoryStorage()) {
  const drafts = new LocalJourneyDrafts(storage);
  return {
    storage,
    drafts,
    archive: new JourneyArchiveEditor(
      publishedJourneys(),
      drafts,
      () => new Date('2026-10-01T09:00:00Z'),
    ),
  };
}

const recorded: JourneyData = {
  tour: 'ege-klasikleri',
  title: 'Ege Klasikleri Turu',
  scene: 'kutuphane',
  startDate: '2026-09-03',
  endDate: '2026-09-06',
  group: 'kurum',
  guests: 28,
  distanceKm: 1540,
  story: 'Bir şirketin çalışanlarıyla dört günlük Ege programı tamamlandı.',
  moments: [],
};

describe('journey content', () => {
  it('passes the rules for every published journey', () => {
    for (const journey of publishedJourneys()) {
      expect(() => checkJourney(journey)).not.toThrow();
    }
  });

  it('names a journey after its first day and tour, numbering a repeat', () => {
    const taken = new Set(['2026-09-03-ege-klasikleri', '2026-09-03-ege-klasikleri-2']);
    expect(journeyId(recorded, (id) => taken.has(id))).toBe('2026-09-03-ege-klasikleri-3');
    expect(journeyId(recorded, () => false)).toBe('2026-09-03-ege-klasikleri');
  });
});

describe('JourneyArchiveEditor', () => {
  it('lists the published journeys, the latest first', () => {
    const { archive } = editor();
    const dates = archive.journeys().map((journey) => journey.startDate);
    expect(dates).toHaveLength(publishedJourneys().length);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('keeps a change to a published journey as a draft over it', () => {
    const { archive } = editor();
    const id = '2026-09-18-kapadokya';
    archive.change(id, setJourneyDetails({ guests: 44 }));
    expect(archive.journey(id)?.guests).toBe(44);
    expect(archive.isChanged(id)).toBe(true);
    expect(archive.isNew(id)).toBe(false);
    expect(archive.isStale(id)).toBe(false);
  });

  it('drops the draft when a journey is changed back to what the site shows', () => {
    const { archive, storage } = editor();
    const id = '2026-09-18-kapadokya';
    const guests = archive.journey(id)?.guests ?? 0;
    archive.change(id, setJourneyDetails({ guests: guests + 1 }));
    archive.change(id, setJourneyDetails({ guests }));
    expect(archive.isChanged(id)).toBe(false);
    expect(storage.read(JOURNEY_DRAFTS_KEY)).toBeNull();
  });

  it('records a new journey that only the panel has, and forgets it on request', () => {
    const { archive } = editor();
    const journey = archive.create(recorded);
    expect(journey.id).toBe('2026-09-03-ege-klasikleri');
    expect(archive.isNew(journey.id)).toBe(true);
    // It takes its place among the published ones by date.
    const ids = archive.journeys().map((item) => item.id);
    expect(ids.indexOf(journey.id)).toBe(ids.indexOf('2026-09-18-kapadokya') + 1);

    archive.change(journey.id, setJourneyDetails({ guests: 30 }));
    expect(archive.isNew(journey.id)).toBe(true);
    expect(archive.journey(journey.id)?.guests).toBe(30);

    archive.remove(journey.id);
    expect(archive.journey(journey.id)).toBeUndefined();
  });

  it('only hides a published journey; it cannot remove it', () => {
    const { archive } = editor();
    expect(() => archive.remove('2026-09-18-kapadokya')).toThrow(InvalidJourneyError);
  });

  it('adds, changes and removes moments within the days of the journey', () => {
    const { archive } = editor();
    const id = '2026-08-29-safranbolu-amasra';
    const before = archive.snapshot(id)?.moments.length ?? 0;
    archive.change(
      id,
      saveMoment(null, { day: 2, place: 'Çekiciler Çarşısı', scene: 'carsi', note: '' }),
    );
    expect(archive.snapshot(id)?.moments).toHaveLength(before + 1);
    archive.change(
      id,
      saveMoment(before, { day: 2, place: 'Bartın', scene: 'sehir', note: 'Mola.' }),
    );
    expect(archive.snapshot(id)?.moments[before]?.place).toBe('Bartın');
    archive.change(id, removeMoment(before));
    expect(archive.snapshot(id)?.moments).toHaveLength(before);

    expect(() =>
      archive.change(id, saveMoment(null, { day: 3, place: 'Ankara', scene: 'sehir', note: '' })),
    ).toThrow(InvalidJourneyError);
  });

  it('refuses a change that breaks the rules and keeps nothing', () => {
    const { archive, storage } = editor();
    const id = '2026-09-18-kapadokya';
    expect(() => archive.change(id, setJourneyDetails({ endDate: '2026-09-01' }))).toThrow(
      InvalidJourneyError,
    );
    expect(() => archive.change(id, setJourneyDetails({ story: '' }))).toThrow(InvalidJourneyError);
    expect(storage.read(JOURNEY_DRAFTS_KEY)).toBeNull();
  });

  it('notices when the site has published a newer version under a draft', () => {
    const storage = memoryStorage();
    const { drafts } = editor(storage);
    const [published] = publishedJourneys();
    if (!published) throw new Error('no journeys');
    drafts.save({
      [published.id]: {
        base: fingerprint({ ...published, guests: published.guests + 5 }),
        journey: { ...published, guests: 1 },
        updatedAt: '2026-09-30T10:00:00.000Z',
      },
    });
    const { archive } = editor(storage);
    expect(archive.isStale(published.id)).toBe(true);
    archive.discard(published.id);
    expect(archive.journey(published.id)?.guests).toBe(published.guests);
  });

  it('drops a stored draft that breaks the rules', () => {
    const storage = memoryStorage();
    storage.write(
      JOURNEY_DRAFTS_KEY,
      JSON.stringify({
        broken: { base: null, journey: { id: 'broken', title: '' }, updatedAt: 'x' },
        '2026-09-03-ege-klasikleri': {
          base: null,
          journey: { ...recorded, id: '2026-09-03-ege-klasikleri' },
          updatedAt: '2026-09-30T10:00:00.000Z',
        },
      }),
    );
    expect(Object.keys(new LocalJourneyDrafts(storage).load())).toEqual([
      '2026-09-03-ege-klasikleri',
    ]);
  });
});
