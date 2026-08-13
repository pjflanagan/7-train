/**
 * Time of day for scheduled items, and how long each one is expected to take.
 *
 * A planner item only ever knew which day it was on. Google Calendar needs a
 * start and an end, so every item now carries a start time in minutes from
 * local midnight, and a duration we either read off the goal or estimate.
 */

import { CalendarItem, WorkoutType } from './types';

/** Times snap to quarter hours, both when dragged and when read back from Google. */
export const SLOT_MINUTES = 15;

/** Where an item lands when nothing — not even a setting — has said otherwise. */
export const DEFAULT_START_MINUTES = 7 * 60;

/** Latest start we allow, so a workout never runs past midnight unseen. */
export const MAX_START_MINUTES = 23 * 60 + 45;

/** How long a workout with no better signal is assumed to run. */
const FALLBACK_DURATION_MINUTES = 45;

/** Minutes per mile, by goal icon. Rough, and only ever used as an estimate. */
const PACE_PER_MILE: Record<string, number> = {
  run: 9,
  walk: 18,
  hike: 25,
  bike: 4,
  swim: 35,
  ski: 6,
  row: 6,
};

const KM_PER_MILE = 0.621371;

export function snapToSlot(minutes: number): number {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

/** Snap up, so an estimated length never books less time than it needs. */
export function ceilToSlot(minutes: number): number {
  return Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

export function clampStartMinutes(minutes: number): number {
  return Math.min(MAX_START_MINUTES, Math.max(0, snapToSlot(minutes)));
}

/** The start time of an item, falling back to the default slot. */
export function startMinutesOf(item: CalendarItem): number {
  return clampStartMinutes(item.startMinutes ?? DEFAULT_START_MINUTES);
}

/** "7:00 AM", in the viewer's locale. */
export function formatTimeOfDay(minutes: number): string {
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Earliest and latest a default start time may be set to. */
const START_OPTION_FROM = 4 * 60;
const START_OPTION_TO = 22 * 60;

/**
 * The times offered as a default start, on the half hour. Quarter hours are
 * draggable per workout; a list of 73 of them is not a setting anyone reads.
 */
export function startTimeOptions(): { value: number; label: string }[] {
  const options = [];
  for (let minutes = START_OPTION_FROM; minutes <= START_OPTION_TO; minutes += 30) {
    options.push({ value: minutes, label: formatTimeOfDay(minutes) });
  }
  return options;
}

/** "45 min" / "1h 30m", for the duration line on a card. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function isMetricUnit(unit: string): boolean {
  return /^k(m|ilomet)/i.test(unit.trim());
}

function isHourUnit(unit: string): boolean {
  return /^h(r|our)/i.test(unit.trim());
}

/**
 * How long the item should block out on the calendar.
 *
 * A `duration` goal already says so — its value _is_ the length, so the
 * calendar reflects it exactly. Distance goals multiply out the goal's typical
 * pace, and `times` goals use its typical session length; both round up to the
 * next quarter hour. Either falls back to a rough guess when the goal has not
 * been told what is typical.
 */
export function estimateDurationMinutes(
  item: Pick<CalendarItem, 'value'>,
  goal: WorkoutType | undefined
): number {
  if (!goal) return FALLBACK_DURATION_MINUTES;

  const value = Number(item.value) || 0;

  if (goal.metric === 'duration') {
    const minutes = isHourUnit(goal.unit) ? value * 60 : value;
    // Exact, not estimated — only the floor and the quarter-hour snap apply.
    return Math.max(SLOT_MINUTES, snapToSlot(minutes));
  }

  if (goal.metric === 'times' && goal.typicalDurationMinutes) {
    return clampDuration(ceilToSlot(goal.typicalDurationMinutes));
  }

  if (goal.metric === 'distance' && value > 0) {
    // A pace the user gave is per the goal's own unit; the per-icon table is
    // per mile, so only that one needs the distance converting first.
    const minutes = goal.paceMinutes
      ? value * goal.paceMinutes
      : (isMetricUnit(goal.unit) ? value * KM_PER_MILE : value) *
        (PACE_PER_MILE[goal.icon] ?? PACE_PER_MILE.run);
    return Math.max(SLOT_MINUTES, ceilToSlot(minutes));
  }

  return FALLBACK_DURATION_MINUTES;
}

/** Shortest and longest a workout may be dragged to. */
export const MIN_DURATION_MINUTES = SLOT_MINUTES;
export const MAX_DURATION_MINUTES = 8 * 60;

export function clampDuration(minutes: number): number {
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, snapToSlot(minutes)));
}

/**
 * How long the item actually blocks out: what someone set by hand, or the
 * estimate when they never touched it.
 */
export function durationMinutesOf(
  item: Pick<CalendarItem, 'value' | 'durationMinutes'>,
  goal: WorkoutType | undefined
): number {
  return item.durationMinutes != null
    ? clampDuration(item.durationMinutes)
    : estimateDurationMinutes(item, goal);
}

/** True when the duration is set or read off the goal rather than guessed. */
export function isExactDuration(
  item: Pick<CalendarItem, 'durationMinutes'>,
  goal: WorkoutType | undefined
): boolean {
  return item.durationMinutes != null || goal?.metric === 'duration';
}

/** Sort a day's items by start time, keeping insertion order for ties. */
export function byStartTime(items: CalendarItem[]): CalendarItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        startMinutesOf(a.item) - startMinutesOf(b.item) || a.index - b.index
    )
    .map(({ item }) => item);
}
