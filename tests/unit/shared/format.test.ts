import { describe, expect, it } from 'vitest';
import { Money } from '@/domain/shared/Money';
import {
  formatDate,
  formatDateRange,
  formatDuration,
  formatKm,
  formatMinutes,
  formatMoney,
  formatPercent,
  formatTime,
  todayIso,
} from '@/shared/format';

describe('format', () => {
  it('formats money in lira without kuruş', () => {
    expect(formatMoney(Money.fromLira(9850))).toBe('₺9.850');
  });

  it('formats a date with the weekday', () => {
    expect(formatDate('2026-11-06')).toBe('6 Kasım 2026 Cuma');
  });

  it('formats date ranges within and across months', () => {
    expect(formatDateRange('2026-11-06', '2026-11-08')).toBe('6-8 Kasım 2026');
    expect(formatDateRange('2026-10-31', '2026-11-01')).toBe('31 Ekim-1 Kasım 2026');
    expect(formatDateRange('2026-10-25', '2026-10-25')).toBe('25 Ekim 2026 Pazar');
  });

  it('writes clock times with a full stop', () => {
    expect(formatTime('07:00')).toBe('07.00');
  });

  it('formats percent, distance and duration', () => {
    expect(formatPercent(0.71)).toBe('%71');
    expect(formatKm(1140)).toBe('1.140 km');
    expect(formatDuration(2, 3)).toBe('2 Gece 3 Gün');
    expect(formatDuration(0, 1)).toBe('Günübirlik');
  });

  it('formats visit lengths in hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45 dakika');
    expect(formatMinutes(60)).toBe('1 saat');
    expect(formatMinutes(150)).toBe('2 saat 30 dakika');
  });

  it('derives the ISO calendar date', () => {
    expect(todayIso(new Date('2026-09-30T10:00:00Z'))).toBe('2026-09-30');
  });
});
