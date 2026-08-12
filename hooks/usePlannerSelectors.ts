import { useMemo } from 'react';
import { usePlannerStore } from '@/lib/store';
import { DAYS } from '@/lib/constants';

export const useGoals = () => usePlannerStore((state) => state.goals);
export const useGoal = (id: string) => usePlannerStore((state) => state.goals.find(g => g.id === id));

export const useDayItems = (day: typeof DAYS[number], week: 1 | 2) => {
  const items = usePlannerStore((state) => state.items);
  return useMemo(() => {
    return items.filter(i => i.day === day && i.week === week);
  }, [items, day, week]);
};

export const useNote = (day: typeof DAYS[number], week: 1 | 2) => 
  usePlannerStore((state) => state.notes[`${day}-${week}`] || '');

export const useLinks = () => usePlannerStore((state) => state.links);
