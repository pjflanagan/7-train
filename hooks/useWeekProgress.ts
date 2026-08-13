import { useMemo } from 'react';
import { usePlannerStore } from '@/lib/store';
import { calculateProgress, getOverallProgress } from '@/lib/progress';

export function useWeekProgress(weekStart: string) {
  const goals = usePlannerStore(state => state.goals);
  const allItems = usePlannerStore(state => state.items);
  const weeklyTargets = usePlannerStore(state => state.weeklyTargets);

  const items = useMemo(() => {
    return allItems.filter(i => i.weekStart === weekStart);
  }, [allItems, weekStart]);

  const progressMap = useMemo(
    () => calculateProgress(goals, items, weekStart, weeklyTargets),
    [goals, items, weekStart, weeklyTargets]
  );
  const overall = useMemo(() => getOverallProgress(progressMap), [progressMap]);

  return { progressMap, overall };
}
