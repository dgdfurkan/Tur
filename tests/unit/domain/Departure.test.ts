import { describe, expect, it } from 'vitest';
import { Departure } from '@/domain/tour/Departure';
import { Occupancy } from '@/domain/tour/Occupancy';
import { SeatLayout } from '@/domain/vehicle/SeatLayout';

const layout = SeatLayout.of('2+1');

function departure(bookedSeats: number[]): Departure {
  return new Departure({
    id: 'd1',
    tourId: 't1',
    startDate: '2026-11-06',
    endDate: '2026-11-08',
    time: '07:00',
    meetingPoint: 'Kızılay',
    layout,
    bookedSeats,
  });
}

describe('Occupancy', () => {
  it('reports remaining seats, percent and level', () => {
    expect(new Occupancy(41, 29)).toMatchObject({ remaining: 12, percent: 71, level: 'available' });
    expect(new Occupancy(41, 37).level).toBe('limited');
    expect(new Occupancy(41, 41).level).toBe('full');
  });

  it('rejects impossible counts', () => {
    expect(() => new Occupancy(41, 42)).toThrow(RangeError);
    expect(() => new Occupancy(0, 0)).toThrow(RangeError);
  });
});

describe('Departure', () => {
  it('derives occupancy from booked seats', () => {
    const d = departure([1, 2, 3]);
    expect(d.occupancy.booked).toBe(3);
    expect(d.isBooked(2)).toBe(true);
    expect(d.freeSeats).toHaveLength(38);
    expect(d.freeSeats).not.toContain(3);
  });

  it('rejects unknown and duplicate seats', () => {
    expect(() => departure([42])).toThrow(RangeError);
    expect(() => departure([5, 5])).toThrow(RangeError);
  });

  it('rejects an end date before the start date', () => {
    expect(
      () =>
        new Departure({
          id: 'd2',
          tourId: 't1',
          startDate: '2026-11-08',
          endDate: '2026-11-06',
          time: '07:00',
          meetingPoint: 'Kızılay',
          layout,
          bookedSeats: [],
        }),
    ).toThrow(RangeError);
  });

  it('adds seats without mutating the original', () => {
    const original = departure([1]);
    const updated = original.withBookedSeats([1, 2, 99]);
    expect(original.occupancy.booked).toBe(1);
    expect(updated.bookedSeats).toEqual([1, 2]);
  });

  it('is upcoming on and after today', () => {
    const d = departure([]);
    expect(d.isUpcoming('2026-11-06')).toBe(true);
    expect(d.isUpcoming('2026-11-07')).toBe(false);
  });
});
