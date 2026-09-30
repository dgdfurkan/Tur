import { describe, expect, it } from 'vitest';
import { Money } from '@/domain/shared/Money';

describe('Money', () => {
  it('stores lira as whole kuruş', () => {
    expect(Money.fromLira(9850).kurus).toBe(985_000);
    expect(Money.fromLira(0.1).add(Money.fromLira(0.2)).kurus).toBe(30);
  });

  it('adds and multiplies without drifting', () => {
    const price = Money.fromLira(1450);
    expect(price.multiply(3).lira).toBe(4350);
    expect(price.add(Money.fromLira(500)).equals(Money.fromLira(1950))).toBe(true);
  });

  it('rejects negative and fractional kuruş', () => {
    expect(() => Money.fromLira(-1)).toThrow(RangeError);
    expect(() => Money.fromKurus(10.5)).toThrow(RangeError);
    expect(() => Money.zero().multiply(-2)).toThrow(RangeError);
  });
});
