import { useMemo } from 'react';
import { usePlannerStore, noteKey } from '@/lib/store';
import { DAYS } from '@/lib/constants';
import { WeekStartsOn } from '@/lib/dates';

type DayName = typeof DAYS[number];

export const useGoals = () => usePlannerStore((state) => state.goals);
export const useGoal = (id: string) => usePlannerStore((state) => state.goals.find(g => g.id === id));

export const useDayItems = (day: DayName, weekStart: string) => {
  const items = usePlannerStore((state) => state.items);
  return useMemo(() => {
    return items.filter(i => i.day === day && i.weekStart === weekStart);
  }, [items, day, weekStart]);
};

export const useNote = (day: DayName, weekStart: string) =>
  usePlannerStore((state) => state.notes[noteKey(weekStart, day)] || '');

export const useLinks = () => usePlannerStore((state) => state.links);

export const useWeekStartsOn = () =>
  usePlannerStore((state) => (state.weekStartsOn ?? 1) as WeekStartsOn);
