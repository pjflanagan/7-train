import { useMemo } from 'react';
import { usePlannerStore, noteKey } from '@/lib/store';
import { DAYS } from '@/lib/constants';
import { WeekStartsOn } from '@/lib/dates';
import { byStartTime } from '@/lib/schedule';

type DayName = typeof DAYS[number];

export const useGoals = () => usePlannerStore((state) => state.goals);
export const useGoal = (id: string) => usePlannerStore((state) => state.goals.find(g => g.id === id));

/** A day's items in the order they happen. */
export const useDayItems = (day: DayName, weekStart: string) => {
  const items = usePlannerStore((state) => state.items);
  return useMemo(() => {
    return byStartTime(items.filter(i => i.day === day && i.weekStart === weekStart));
  }, [items, day, weekStart]);
};

export const useNote = (day: DayName, weekStart: string) =>
  usePlannerStore((state) => state.notes[noteKey(weekStart, day)] || '');

/** True when a week has no scheduled items and no day notes. */
export const useIsWeekEmpty = (weekStart: string) =>
  usePlannerStore((state) =>
    !state.items.some(i => i.weekStart === weekStart) &&
    !DAYS.some(day => state.notes[noteKey(weekStart, day)]?.trim())
  );

/**
 * The `workoutType` sub-tags already scheduled in a week, per goal — used to
 * mute a sub-tag chip once it is on the board.
 */
export const useScheduledSubTags = (weekStart: string, typeId: string) => {
  const items = usePlannerStore((state) => state.items);
  return useMemo(() => {
    const scheduled = new Set<string>();
    for (const item of items) {
      if (item.weekStart === weekStart && item.typeId === typeId && item.workoutType) {
        scheduled.add(item.workoutType);
      }
    }
    return scheduled;
  }, [items, weekStart, typeId]);
};

export const useLinks = () => usePlannerStore((state) => state.links);

export const useWeekStartsOn = () =>
  usePlannerStore((state) => (state.weekStartsOn ?? 1) as WeekStartsOn);
