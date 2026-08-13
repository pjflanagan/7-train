import { useMemo } from 'react';
import { usePlannerStore, noteKey } from '@/lib/store';
import { DAYS } from '@/lib/constants';
import { WeekStartsOn } from '@/lib/dates';
import { byStartTime, DEFAULT_START_MINUTES } from '@/lib/schedule';
import { resolveEventActivity } from '@/lib/activitySnapshot';
import { weekActivityKey, activitiesForWeek } from '@/lib/progress';
import { ScheduledEvent } from '@/lib/types';

type DayName = typeof DAYS[number];

export const useActivities = () => usePlannerStore((state) => state.activities);
export const useActivity = (id: string) => usePlannerStore((state) => state.activities.find(g => g.id === id));

/**
 * An event's activity — its own week's copy, else the snapshot the event took
 * when that week stopped aiming at it.
 *
 * Resolving off a snapshot builds a fresh object, so it happens in a memo
 * rather than inside the store selector, which must return a stable value.
 */
export const useEventActivity = (
  event: Pick<ScheduledEvent, 'typeId' | 'weekStart' | 'activitySnapshot'>
) => {
  const activities = useWeekActivities(event.weekStart);
  const { typeId, activitySnapshot } = event;
  return useMemo(
    () => resolveEventActivity({ typeId, activitySnapshot }, activities),
    [typeId, activitySnapshot, activities]
  );
};

/**
 * The activities a given week is actually aiming at. A week holds targets only
 * once they've been put there — copied from another week or from the defaults —
 * so a week nobody has planned yet shows no targets at all rather than a rail
 * of empty ones. Presence of the entry is what counts, not its size: an
 * optional activity legitimately aims at zero.
 */
export const useWeekActivities = (weekStart: string) => {
  const weekActivities = usePlannerStore((state) => state.weekActivities);
  return useMemo(
    () => activitiesForWeek(weekStart, weekActivities),
    [weekActivities, weekStart]
  );
};

/** One week's copy of an activity, if that week is aiming at it at all. */
export const useWeekActivity = (weekStart: string, id: string) =>
  usePlannerStore((state) => state.weekActivities?.[weekActivityKey(weekStart, id)]);

/** A day's events in the order they happen. */
export const useDayEvents = (day: DayName, weekStart: string) => {
  const events = usePlannerStore((state) => state.events);
  return useMemo(() => {
    return byStartTime(events.filter(i => i.day === day && i.weekStart === weekStart));
  }, [events, day, weekStart]);
};

export const useNote = (day: DayName, weekStart: string) =>
  usePlannerStore((state) => state.notes[noteKey(weekStart, day)] || '');

/** True when a week has no scheduled events and no day notes. */
export const useIsWeekEmpty = (weekStart: string) =>
  usePlannerStore((state) =>
    !state.events.some(i => i.weekStart === weekStart) &&
    !DAYS.some(day => state.notes[noteKey(weekStart, day)]?.trim())
  );

/**
 * The `workoutType` sub-tags already scheduled in a week, per activity — used to
 * mute a sub-tag chip once it is on the board.
 */
export const useScheduledSubTags = (weekStart: string, typeId: string) => {
  const events = usePlannerStore((state) => state.events);
  return useMemo(() => {
    const scheduled = new Set<string>();
    for (const event of events) {
      if (event.weekStart === weekStart && event.typeId === typeId && event.workoutType) {
        scheduled.add(event.workoutType);
      }
    }
    return scheduled;
  }, [events, weekStart, typeId]);
};

export const useLinks = () => usePlannerStore((state) => state.links);

export const useWeekStartsOn = () =>
  usePlannerStore((state) => (state.weekStartsOn ?? 1) as WeekStartsOn);

export const useDefaultStartMinutes = () =>
  usePlannerStore((state) => state.defaultStartMinutes ?? DEFAULT_START_MINUTES);

export const useUse24HourClock = () =>
  usePlannerStore((state) => state.use24HourClock ?? false);
