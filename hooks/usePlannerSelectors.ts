import { useMemo } from 'react';
import { usePlannerStore, noteKey } from '@/lib/store';
import { DAYS } from '@/lib/constants';
import { WeekStartsOn } from '@/lib/dates';
import { byStartTime, DEFAULT_START_MINUTES } from '@/lib/schedule';

type DayName = typeof DAYS[number];

export const useActivities = () => usePlannerStore((state) => state.activities);
export const useActivity = (id: string) => usePlannerStore((state) => state.activities.find(g => g.id === id));

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
