import { describe, expect, it } from 'vitest';
import { BookingService, type PassengerDraft } from '@/application/BookingService';
import type { Passenger } from '@/domain/booking/Passenger';
import type { PassengerRepository } from '@/domain/booking/PassengerRepository';
import { Phone } from '@/domain/booking/Phone';
import { GeoPoint } from '@/domain/geo/GeoPoint';
import { Money } from '@/domain/shared/Money';
import { Departure } from '@/domain/tour/Departure';
import { Tour } from '@/domain/tour/Tour';
import { SeatLayout } from '@/domain/vehicle/SeatLayout';

class MemoryRepository implements PassengerRepository {
  private items: Passenger[] = [];
  findAll(): readonly Passenger[] {
    return this.items;
  }
  save(passenger: Passenger): void {
    this.items = [...this.items.filter((item) => item.id !== passenger.id), passenger];
  }
  remove(passengerId: string): void {
    this.items = this.items.filter((item) => item.id !== passengerId);
  }
  replaceAll(passengers: readonly Passenger[]): void {
    this.items = [...passengers];
  }
}

const layout = SeatLayout.of('2+1');

function tour(): Tour {
  const departure = (id: string, startDate: string, bookedSeats: number[]) =>
    new Departure({
      id,
      tourId: 't',
      startDate,
      endDate: startDate,
      time: '07:00',
      meetingPoint: 'Kızılay',
      layout,
      bookedSeats,
    });
  return new Tour({
    id: 't',
    title: 'Tur',
    category: 'kultur',
    summary: '',
    emblem: 'konak',
    scene: 'konak',
    destination: 'D',
    nights: 0,
    distanceFromOriginKm: 100,
    price: Money.fromLira(1000),
    singleSupplement: null,
    included: [],
    excluded: [],
    hotels: [],
    days: [
      {
        number: 1,
        title: '',
        summary: '',
        stops: [
          {
            id: 'a',
            name: 'A',
            kind: 'departure',
            location: new GeoPoint(39.9, 32.8),
            summary: '',
            scene: 'sehir',
            facts: [],
          },
        ],
      },
    ],
    departures: [
      departure('past', '2026-10-01', []),
      departure('soon', '2026-11-06', [1, 2]),
      departure('later', '2026-12-04', []),
    ],
  });
}

function service(): BookingService {
  let counter = 0;
  return new BookingService(
    [tour()],
    new MemoryRepository(),
    () => new Date('2026-10-20T09:00:00Z'),
    () => `id-${(counter += 1)}`,
  );
}

const draft = (overrides: Partial<PassengerDraft> = {}): PassengerDraft => ({
  departureId: 'soon',
  fullName: 'Ayşe Yılmaz',
  phone: '0532 000 00 01',
  seatNumber: 5,
  depositLira: 500,
  paymentMethod: 'nakit',
  note: '',
  ...overrides,
});

describe('BookingService', () => {
  it('lists upcoming departures soonest first', () => {
    const ids = service()
      .bookings('2026-10-20')
      .map((booking) => booking.departure.id);
    expect(ids).toEqual(['soon', 'later']);
  });

  it('records a passenger and counts the seat as taken', () => {
    const bookings = service();
    const result = bookings.addPassenger(draft());
    expect(result.ok).toBe(true);

    const booking = bookings.booking('soon');
    expect(booking?.passengers.map((p) => p.fullName)).toEqual(['Ayşe Yılmaz']);
    expect(booking?.departure.occupancy.booked).toBe(3);
    expect(booking?.departure.isBooked(5)).toBe(true);
  });

  it('explains every problem with a draft at once', () => {
    const result = service().addPassenger(
      draft({
        departureId: 'yok',
        fullName: 'Ayşe',
        phone: '123',
        seatNumber: null,
        depositLira: -5,
        paymentMethod: 'çek',
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        departureId: 'required',
        fullName: 'invalid',
        phone: 'invalid',
        seatNumber: 'required',
        depositLira: 'invalid',
        paymentMethod: 'required',
      },
    });
  });

  it('refuses a seat that is sold on the site or already recorded', () => {
    const bookings = service();
    expect(bookings.addPassenger(draft({ seatNumber: 1 }))).toMatchObject({
      errors: { seatNumber: 'taken' },
    });
    bookings.addPassenger(draft());
    expect(bookings.addPassenger(draft({ fullName: 'Ali Demir' }))).toMatchObject({
      errors: { seatNumber: 'taken' },
    });
    expect(bookings.addPassenger(draft({ seatNumber: 99 }))).toMatchObject({
      errors: { seatNumber: 'invalid' },
    });
  });

  it('summarises passengers, deposits and free seats', () => {
    const bookings = service();
    bookings.addPassenger(draft());
    bookings.addPassenger(draft({ fullName: 'Ali Demir', seatNumber: 6, depositLira: 1000 }));
    expect(bookings.summary('2026-10-20')).toMatchObject({
      departureCount: 2,
      passengerCount: 2,
      freeSeats: 41 - 4 + 41,
    });
    expect(bookings.summary('2026-10-20').depositTotal.lira).toBe(1500);
  });

  it('removes a passenger and restores it only while the seat is still free', () => {
    const bookings = service();
    const added = bookings.addPassenger(draft());
    if (!added.ok) throw new Error('setup failed');

    const removed = bookings.removePassenger(added.passenger.id);
    expect(removed?.id).toBe(added.passenger.id);
    expect(bookings.booking('soon')?.passengers).toHaveLength(0);

    expect(removed && bookings.restorePassenger(removed)).toBe(true);
    bookings.removePassenger(added.passenger.id);
    bookings.addPassenger(draft({ fullName: 'Ali Demir' }));
    expect(removed && bookings.restorePassenger(removed)).toBe(false);
  });

  it('changes a record, which keeps its identity and may keep or give up its seat', () => {
    const bookings = service();
    const added = bookings.addPassenger(draft());
    if (!added.ok) throw new Error('setup failed');
    const original = added.passenger;

    // Its own seat is no clash with itself.
    const renamed = bookings.updatePassenger(original, draft({ fullName: 'Ayşe Kaya' }));
    expect(renamed).toMatchObject({
      ok: true,
      passenger: { id: original.id, createdAt: original.createdAt, fullName: 'Ayşe Kaya' },
    });
    expect(bookings.booking('soon')?.passengers).toHaveLength(1);

    // Moving to another departure frees the seat on the first one.
    expect(
      bookings.updatePassenger(original, draft({ departureId: 'later', seatNumber: 1 })).ok,
    ).toBe(true);
    expect(bookings.booking('soon')?.departure.isBooked(5)).toBe(false);
    expect(bookings.booking('later')?.passengers.map((passenger) => passenger.id)).toEqual([
      original.id,
    ]);
  });

  it('does not let a changed record take a seat that someone else holds', () => {
    const bookings = service();
    const first = bookings.addPassenger(draft());
    if (!first.ok) throw new Error('setup failed');
    bookings.addPassenger(draft({ fullName: 'Ali Demir', seatNumber: 6 }));

    for (const seatNumber of [6, 1]) {
      expect(bookings.updatePassenger(first.passenger, draft({ seatNumber }))).toMatchObject({
        ok: false,
        errors: { seatNumber: 'taken' },
      });
    }
    expect(bookings.booking('soon')?.passengers.map((passenger) => passenger.seatNumber)).toEqual([
      5, 6,
    ]);
  });

  it('clears every record', () => {
    const bookings = service();
    bookings.addPassenger(draft());
    bookings.clear();
    expect(bookings.summary('2026-10-20').passengerCount).toBe(0);
  });
});

describe('Phone', () => {
  it('normalises the ways a number is typed', () => {
    for (const input of ['0532 000 00 01', '+90 532 000 00 01', '5320000001', '0(532)000-00-01']) {
      expect(Phone.parse(input)?.digits).toBe('5320000001');
    }
    expect(Phone.parse('0532 000 00 01')?.format()).toBe('0 (532) 000 00 01');
  });

  it('rejects numbers that are too short or start with an impossible code', () => {
    expect(Phone.parse('0532 000 00')).toBeNull();
    expect(Phone.parse('0132 000 00 01')).toBeNull();
    expect(Phone.parse('')).toBeNull();
  });
});
