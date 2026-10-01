import type { Money } from '@/domain/shared/Money';

const LOCALE = 'tr-TR';

const moneyFormat = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});
const numberFormat = new Intl.NumberFormat(LOCALE);
const percentFormat = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 });
const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const fullDateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthYearFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayWeekdayFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  timeZone: 'UTC',
});
const weekdayDateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  weekday: 'long',
  timeZone: 'UTC',
});

/** Calendar dates are parsed as UTC so the day never shifts with the viewer's time zone. */
function parseIsoDate(iso: string): Date {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid ISO date: ${iso}`);
  }
  return date;
}

export function formatMoney(money: Money): string {
  return moneyFormat.format(money.lira);
}

/** A lira amount that is not a Money value, such as a figure counting up on screen. */
export function formatLira(lira: number): string {
  return moneyFormat.format(lira);
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatPercent(ratio: number): string {
  return percentFormat.format(ratio);
}

export function formatKm(km: number): string {
  return `${numberFormat.format(km)} km`;
}

/** "16 Ekim 2026 Cuma" */
export function formatDate(iso: string): string {
  return weekdayDateFormat.format(parseIsoDate(iso));
}

/** "Eylül 2026" */
export function formatMonthYear(iso: string): string {
  return monthYearFormat.format(parseIsoDate(iso));
}

/** "18 Eylül Cuma" */
export function formatDayAndWeekday(iso: string): string {
  return dayWeekdayFormat.format(parseIsoDate(iso));
}

/** "16-18 Ekim 2026", "30 Ekim-1 Kasım 2026" or, for a single day, "4 Ekim 2026 Pazar". */
export function formatDateRange(startIso: string, endIso: string): string {
  if (startIso === endIso) return formatDate(startIso);
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${start.getUTCDate()}-${fullDateFormat.format(end)}`;
  }
  return `${dayMonthFormat.format(start)}-${fullDateFormat.format(end)}`;
}

/** TDK writes clock times with a full stop: "07.00". */
export function formatTime(time: string): string {
  return time.replace(':', '.');
}

/** "45 dakika", "1 saat", "2 saat 30 dakika" */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} dakika`;
  return rest === 0 ? `${hours} saat` : `${hours} saat ${rest} dakika`;
}

/** "48 saniye", "1 dakika 12 saniye" */
export function formatSeconds(seconds: number): string {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (minutes === 0) return `${rest} saniye`;
  return rest === 0 ? `${minutes} dakika` : `${minutes} dakika ${rest} saniye`;
}

export function formatDuration(nights: number, days: number): string {
  return nights === 0 ? 'Günübirlik' : `${nights} Gece ${days} Gün`;
}

// The agency works on Turkish time; en-CA happens to write dates as YYYY-MM-DD.
const turkishCalendarDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date in Turkey at the given moment, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return turkishCalendarDate.format(now);
}

/** The calendar date in Turkey of an ISO 8601 timestamp, as YYYY-MM-DD. */
export function dateOfInstant(instant: string): string {
  return turkishCalendarDate.format(new Date(instant));
}
