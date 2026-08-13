/**
 * Time of day for scheduled events, and how long each one is expected to take.
 *
 * A planner event only ever knew which day it was on. Google Calendar needs a
 * start and an end, so every event now carries a start time in minutes from
 * local midnight, and a duration we either read off the activity or estimate.
 */

import { ScheduledEvent, Activity } from './types';

/** Times snap to quarter hours, both when dragged and when read back from Google. */
export const SLOT_MINUTES = 15;

/** Where an event lands when nothing — not even a setting — has said otherwise. */
export const DEFAULT_START_MINUTES = 7 * 60;

/** Latest start we allow, so a workout never runs past midnight unseen. */
export const MAX_START_MINUTES = 23 * 60 + 45;

/** How long a workout with no better signal is assumed to run. */
const FALLBACK_DURATION_MINUTES = 45;

/** Minutes per mile, by activity icon. Rough, and only ever used as an estimate. */
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

/** The start time of an event, falling back to the default slot. */
export function startMinutesOf(event: ScheduledEvent): number {
  return clampStartMinutes(event.startMinutes ?? DEFAULT_START_MINUTES);
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

/** "7:30", from 7.5 minutes — pace reads as a clock split, not a decimal. */
export function formatPaceMinutes(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const wholeMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${wholeMinutes}:${String(seconds).padStart(2, '0')}`;
}

/** "7:30" back to 7.5 minutes. A bare number is taken as whole minutes. */
export function parsePaceMinutes(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const split = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (split) {
    return Number(split[1]) + Number(split[2]) / 60;
  }

  const whole = Number(trimmed);
  return Number.isFinite(whole) ? whole : null;
}

function isMetricUnit(unit: string): boolean {
  return /^k(m|ilomet)/i.test(unit.trim());
}

function isHourUnit(unit: string): boolean {
  return /^h(r|our)/i.test(unit.trim());
}

/**
 * How long the event should block out on the calendar.
 *
 * A `duration` activity already says so — its value _is_ the length, so the
 * calendar reflects it exactly. Distance activities multiply out the activity's typical
 * pace, and `times` activities use its typical session length; both round up to the
 * next quarter hour. Either falls back to a rough guess when the activity has not
 * been told what is typical.
 */
export function estimateDurationMinutes(
  event: Pick<ScheduledEvent, 'value'>,
  activity: Activity | undefined
): number {
  if (!activity) return FALLBACK_DURATION_MINUTES;

  const value = Number(event.value) || 0;

  if (activity.metric === 'duration') {
    const minutes = isHourUnit(activity.unit) ? value * 60 : value;
    // Exact, not estimated — only the floor and the quarter-hour snap apply.
    return Math.max(SLOT_MINUTES, snapToSlot(minutes));
  }

  if (activity.metric === 'times' && activity.typicalDurationMinutes) {
    return clampDuration(ceilToSlot(activity.typicalDurationMinutes));
  }

  if (activity.metric === 'distance' && value > 0) {
    // A pace the user gave is per the activity's own unit; the per-icon table is
    // per mile, so only that one needs the distance converting first.
    const minutes = activity.paceMinutes
      ? value * activity.paceMinutes
      : (isMetricUnit(activity.unit) ? value * KM_PER_MILE : value) *
        (PACE_PER_MILE[activity.icon] ?? PACE_PER_MILE.run);
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
 * How long the event actually blocks out: what someone set by hand, or the
 * estimate when they never touched it.
 */
export function durationMinutesOf(
  event: Pick<ScheduledEvent, 'value' | 'durationMinutes'>,
  activity: Activity | undefined
): number {
  return event.durationMinutes != null
    ? clampDuration(event.durationMinutes)
    : estimateDurationMinutes(event, activity);
}

/** True when the duration is set or read off the activity rather than guessed. */
export function isExactDuration(
  event: Pick<ScheduledEvent, 'durationMinutes'>,
  activity: Activity | undefined
): boolean {
  return event.durationMinutes != null || activity?.metric === 'duration';
}

/** Sort a day's events by start time, keeping insertion order for ties. */
export function byStartTime(events: ScheduledEvent[]): ScheduledEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort(
      (a, b) =>
        startMinutesOf(a.event) - startMinutesOf(b.event) || a.index - b.index
    )
    .map(({ event }) => event);
}
