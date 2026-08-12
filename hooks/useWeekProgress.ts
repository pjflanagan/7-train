import { useMemo } from 'react';
import { usePlannerStore } from '../lib/store';
import { calculateProgress, getOverallProgress } from '../lib/progress';

export function useWeekProgress(week: 1 | 2) {
  const goals = usePlannerStore(state => state.goals);
  const items = usePlannerStore(state => state.items.filter(i => i.week === week));

  const progressMap = useMemo(() => calculateProgress(goals, items), [goals, items]);
  const overall = useMemo(() => getOverallProgress(progressMap), [progressMap]);

  return { progressMap, overall };
}
