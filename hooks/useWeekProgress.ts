import { useMemo } from 'react';
import { usePlannerStore } from '@/lib/store';
import { calculateProgress, getOverallProgress } from '@/lib/progress';

export function useWeekProgress(weekStart: string) {
  const activities = usePlannerStore(state => state.activities);
  const allEvents = usePlannerStore(state => state.events);
  const weeklyTargets = usePlannerStore(state => state.weeklyTargets);

  const events = useMemo(() => {
    return allEvents.filter(i => i.weekStart === weekStart);
  }, [allEvents, weekStart]);

  const progressMap = useMemo(
    () => calculateProgress(activities, events, weekStart, weeklyTargets),
    [activities, events, weekStart, weeklyTargets]
  );
  const overall = useMemo(() => getOverallProgress(progressMap), [progressMap]);

  return { progressMap, overall };
}
