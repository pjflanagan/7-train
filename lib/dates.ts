import { DAYS } from './constants';

export type DayName = typeof DAYS[number];

/** 0 = Sunday ... 6 = Saturday, matching Date.prototype.getDay(). */
export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEK_START_OPTIONS: { value: WeekStartsOn; label: string }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD key as a local (not UTC) midnight date. */
export function parseDateLocal(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

/**
 * The date that starts the week containing `d`, given which weekday the week
 * begins on. Returns a local-midnight Date.
 */
export function getWeekStart(d: Date, weekStartsOn: WeekStartsOn = 1): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const diff = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

/** The YYYY-MM-DD key for the week containing `d`. */
export function getWeekStartKey(d: Date, weekStartsOn: WeekStartsOn = 1): string {
  return formatDateLocal(getWeekStart(d, weekStartsOn));
}

/** Shift a YYYY-MM-DD week key by `n` weeks (negative shifts backwards). */
export function addWeeks(weekStartKey: string, n: number): string {
  const date = parseDateLocal(weekStartKey);
  date.setDate(date.getDate() + n * 7);
  return formatDateLocal(date);
}

/** Whole weeks between two week keys: positive when `b` is later than `a`. */
export function weeksBetween(a: string, b: string): number {
  const ms = parseDateLocal(b).getTime() - parseDateLocal(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24 * 7));
}

/**
 * Day names in display order for a week beginning on `weekStartsOn`.
 * Day names stay absolute (monday is always Monday); only the order rotates.
 */
export function orderedDays(weekStartsOn: WeekStartsOn = 1): DayName[] {
  // DAYS is Monday-first, so Date.getDay() maps to DAYS via (getDay + 6) % 7.
  const offset = (weekStartsOn + 6) % 7;
  return [...DAYS.slice(offset), ...DAYS.slice(0, offset)];
}

/** The calendar date of `day` within the week starting at `weekStartKey`. */
export function dateForDay(
  weekStartKey: string,
  day: DayName,
  weekStartsOn: WeekStartsOn = 1
): Date {
  const date = parseDateLocal(weekStartKey);
  date.setDate(date.getDate() + orderedDays(weekStartsOn).indexOf(day));
  return date;
}

export function dayIndex(dayName: string): number {
  return DAYS.indexOf(dayName as DayName);
}

export function dayLabel(dayName: string): string {
  return dayName.charAt(0).toUpperCase() + dayName.slice(1);
}

/** "This week" / "Next week" / "Last week", else a dated label. */
export function weekLabel(weekStartKey: string, currentWeekStartKey: string): string {
  const delta = weeksBetween(currentWeekStartKey, weekStartKey);
  if (delta === 0) return 'This week';
  if (delta === 1) return 'Next week';
  if (delta === -1) return 'Last week';

  const start = parseDateLocal(weekStartKey);
  const label = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `Week of ${label}`;
}

/** e.g. "Mar 3 – Mar 9" — the secondary line under the week label. */
export function weekRangeLabel(weekStartKey: string): string {
  const start = parseDateLocal(weekStartKey);
  const end = parseDateLocal(weekStartKey);
  end.setDate(end.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}
