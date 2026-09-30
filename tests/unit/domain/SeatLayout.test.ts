import { describe, expect, it } from 'vitest';
import { SeatLayout } from '@/domain/vehicle/SeatLayout';

describe('SeatLayout', () => {
  it('builds a 41-seat 2+1 coach with a door gap', () => {
    const layout = SeatLayout.of('2+1');
    expect(layout.capacity).toBe(41);
    const doorRowSeats = layout.seats.filter((seat) => seat.row === layout.doorRow);
    expect(doorRowSeats.map((seat) => seat.column)).toEqual([0, 1]);
  });

  it('builds a 46-seat 2+2 coach', () => {
    expect(SeatLayout.of('2+2').capacity).toBe(46);
  });

  it('numbers seats consecutively from the front', () => {
    const seats = SeatLayout.of('2+1').seats;
    expect(seats.map((seat) => seat.number)).toEqual(seats.map((_, index) => index + 1));
    expect(seats[0]).toMatchObject({ row: 1, column: 0 });
  });

  it('reuses one instance per layout code', () => {
    expect(SeatLayout.of('2+1')).toBe(SeatLayout.of('2+1'));
  });

  it('knows which seat numbers exist', () => {
    const layout = SeatLayout.of('2+1');
    expect(layout.hasSeat(41)).toBe(true);
    expect(layout.hasSeat(42)).toBe(false);
    expect(layout.hasSeat(0)).toBe(false);
    expect(layout.hasSeat(1.5)).toBe(false);
  });
});
