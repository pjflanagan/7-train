import { useEffect, useRef } from 'react';
import { usePlannerStore } from '@/lib/store';
import { useHydrated } from './useHydrated';

export function useWeekRollover() {
  const isHydrated = useHydrated() && usePlannerStore.persist.hasHydrated();
  const applyRollover = usePlannerStore((state) => state.applyRollover);
  const hasRolledOver = useRef(false);

  useEffect(() => {
    if (isHydrated && !hasRolledOver.current) {
      applyRollover(new Date());
      hasRolledOver.current = true;
    }
  }, [isHydrated, applyRollover]);
}
