import { useMemo } from 'react';
import { usePlannerStore } from '@/lib/store';
import { useWeekActivities } from '@/hooks/usePlannerSelectors';
import { calculateProgress, getOverallProgress } from '@/lib/progress';

export function useWeekProgress(weekStart: string) {
  // Only what this week is aiming at. An activity with no target here isn't at
  // 0% or at 100% — it simply isn't part of this week's plan.
  const activities = useWeekActivities(weekStart);
  const allEvents = usePlannerStore(state => state.events);

  const events = useMemo(() => {
    return allEvents.filter(i => i.weekStart === weekStart);
  }, [allEvents, weekStart]);

  const progressMap = useMemo(
    () => calculateProgress(activities, events),
    [activities, events]
  );
  const overall = useMemo(() => getOverallProgress(progressMap), [progressMap]);

  return { progressMap, overall };
}
