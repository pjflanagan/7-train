'use client';

import React from 'react';
import { MdToday } from 'react-icons/md';
import { AppShell } from '@/components/features/app/AppShell';
import { WeekSection } from './WeekSection';
import { useHydrated } from '@/hooks/useHydrated';
import { usePlannerStore } from '@/lib/store';
import { useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { useInfiniteWeeks } from '@/hooks/useInfiniteWeeks';
import { PlannerDndProvider } from './PlannerDndProvider';
import { useInitWeather } from '@/hooks/useWeather';
import { useScheduleFocusTriggers } from '@/hooks/useScheduleFocus';
import { getWeekStartKey } from '@/lib/dates';
import styles from './PlannerPage.module.scss';

function WeekFeed() {
  const weekStartsOn = useWeekStartsOn();
  const currentWeekStart = getWeekStartKey(new Date(), weekStartsOn);

  const {
    weeks,
    scrollRef,
    topSentinelRef,
    bottomSentinelRef,
    currentWeekRef,
    isCurrentWeekVisible,
    scrollToCurrentWeek,
  } = useInfiniteWeeks({ currentWeekStart });
  const focusTriggers = useScheduleFocusTriggers();

  return (
    <div className={styles.feed}>
      <div
        className={styles.scroller}
        {...focusTriggers}
        ref={(node) => {
          scrollRef.current = node;
        }}
      >
        <div className={styles.container}>
          <div ref={topSentinelRef} className={styles.sentinel} aria-hidden="true" />
          {weeks.map((weekStart) => (
            <div
              key={weekStart}
              ref={weekStart === currentWeekStart ? currentWeekRef : undefined}
            >
              <WeekSection weekStart={weekStart} currentWeekStart={currentWeekStart} />
            </div>
          ))}
          <div ref={bottomSentinelRef} className={styles.sentinel} aria-hidden="true" />
        </div>
      </div>

      {!isCurrentWeekVisible && (
        <button
          type="button"
          className={styles.jumpToToday}
          onClick={scrollToCurrentWeek}
        >
          <MdToday size={18} aria-hidden="true" />
          This week
        </button>
      )}
    </div>
  );
}

export function PlannerPage() {
  const isHydrated = useHydrated() && usePlannerStore.persist.hasHydrated();
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
        <WeekFeed />
      </PlannerDndProvider>
    </AppShell>
  );
}
