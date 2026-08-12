'use client';

import React from 'react';
import { AppShell } from '@/components/features/app/AppShell';
import { WeekSection } from './WeekSection';
import { useHydrated } from '@/hooks/useHydrated';
import { usePlannerStore } from '@/lib/store';
import { PlannerDndProvider } from './PlannerDndProvider';
import { useWeekRollover } from '@/hooks/useWeekRollover';
import { useInitWeather } from '@/hooks/useWeather';
import styles from './PlannerPage.module.scss';

export function PlannerPage() {
  const isHydrated = useHydrated() && usePlannerStore.persist.hasHydrated();
  useWeekRollover();
  useInitWeather();

  if (!isHydrated) {
    return (
      <AppShell>
        <div className={styles.loadingSkeleton}>Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PlannerDndProvider>
        <div className={styles.container}>
          <WeekSection week={1} />
          <WeekSection week={2} />
        </div>
      </PlannerDndProvider>
    </AppShell>
  );
}