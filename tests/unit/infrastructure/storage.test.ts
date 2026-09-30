import { describe, expect, it } from 'vitest';
import { Passenger } from '@/domain/booking/Passenger';
import { Phone } from '@/domain/booking/Phone';
import { Money } from '@/domain/shared/Money';
import { CsvListExporter } from '@/infrastructure/export/CsvListExporter';
import { LocalPassengerRepository } from '@/infrastructure/storage/LocalPassengerRepository';
import { SafeStorage, type KeyValueStore } from '@/infrastructure/storage/SafeStorage';

class MemoryStore implements KeyValueStore {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

function passenger(id: string, seatNumber: number): Passenger {
  const phone = Phone.parse('0532 000 00 01');
  if (!phone) throw new Error('setup failed');
  return new Passenger({
    id,
    departureId: 'd1',
    fullName: 'Ayşe Yılmaz',
    phone,
    seatNumber,
    deposit: Money.fromLira(500),
    paymentMethod: 'nakit',
    note: 'Cam kenarı',
    createdAt: '2026-10-20T09:00:00.000Z',
  });
}

describe('SafeStorage', () => {
  it('prefixes keys and round-trips values', () => {
    const store = new MemoryStore();
    const storage = new SafeStorage(store);
    expect(storage.write('k', 'v')).toBe(true);
    expect(store.items.get('tur-demo:v1:k')).toBe('v');
    expect(storage.read('k')).toBe('v');
    storage.remove('k');
    expect(storage.read('k')).toBeNull();
  });

  it('never throws when the underlying store does', () => {
    const storage = new SafeStorage(throwingStore);
    expect(storage.read('k')).toBeNull();
    expect(storage.write('k', 'v')).toBe(false);
    expect(() => storage.remove('k')).not.toThrow();
  });
});

describe('LocalPassengerRepository', () => {
  it('saves, replaces by id and removes', () => {
    const repository = new LocalPassengerRepository(new SafeStorage(new MemoryStore()));
    repository.save(passenger('a', 5));
    repository.save(passenger('b', 6));
    repository.save(passenger('a', 7));
    expect(repository.findAll().map((p) => [p.id, p.seatNumber])).toEqual([
      ['b', 6],
      ['a', 7],
    ]);
    const stored = repository.findAll()[0];
    expect(stored?.phone.digits).toBe('5320000001');
    expect(stored?.deposit.lira).toBe(500);

    repository.remove('b');
    expect(repository.findAll().map((p) => p.id)).toEqual(['a']);
  });

  it('ignores corrupted and tampered entries', () => {
    const store = new MemoryStore();
    const storage = new SafeStorage(store);
    const repository = new LocalPassengerRepository(storage);

    storage.write('passengers', '{not json');
    expect(repository.findAll()).toEqual([]);

    storage.write('passengers', JSON.stringify({ id: 'a' }));
    expect(repository.findAll()).toEqual([]);

    repository.save(passenger('ok', 5));
    const valid = JSON.parse(storage.read('passengers') ?? '[]') as Record<string, unknown>[];
    storage.write(
      'passengers',
      JSON.stringify([
        ...valid,
        { ...valid[0], id: 'bad-phone', phone: '12' },
        { ...valid[0], id: 'bad-method', paymentMethod: 'çek' },
        { ...valid[0], id: 'bad-deposit', depositKurus: -1 },
        null,
        'text',
      ]),
    );
    expect(repository.findAll().map((p) => p.id)).toEqual(['ok']);
  });
});

describe('CsvListExporter', () => {
  const exporter = new CsvListExporter();

  it('writes a semicolon-separated file that Excel reads as UTF-8', () => {
    const csv = exporter.export({
      columns: ['Ad Soyad', 'Koltuk'],
      rows: [['Ayşe Yılmaz', '5']],
    });
    expect(csv).toBe('﻿Ad Soyad;Koltuk\r\nAyşe Yılmaz;5\r\n');
  });

  it('quotes cells that contain separators, quotes or line breaks', () => {
    const csv = exporter.export({ columns: ['Not'], rows: [['a;b'], ['say "hi"'], ['x\ny']] });
    expect(csv).toContain('"a;b"');
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain('"x\ny"');
  });

  it('neutralises cells a spreadsheet would run as a formula', () => {
    const csv = exporter.export({ columns: ['Not'], rows: [['=1+1'], ['+90 532'], ['@cmd']] });
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+90 532");
    expect(csv).toContain("'@cmd");
  });
});
