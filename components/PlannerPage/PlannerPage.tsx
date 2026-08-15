'use client';

import { LuArrowUp, LuArrowDown } from 'react-icons/lu';
import { AppShell } from './AppShell/AppShell';
import { Spinner } from '@/components/elements/Spinner/Spinner';
import { WeekSection } from './WeekSection/WeekSection';
import { useHydrated } from '@/hooks/useHydrated';
import { usePlannerStore } from '@/lib/store';
import { useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { useInfiniteWeeks } from '@/hooks/useInfiniteWeeks';
import { PlannerDndProvider } from './PlannerDndProvider/PlannerDndProvider';
import { MobileDayFeed } from './MobileDayFeed/MobileDayFeed';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useInitWeather } from '@/hooks/useWeather';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useStravaSync } from '@/hooks/useStrava';
import { useStravaConnectOutcome } from '@/hooks/useStravaConnectOutcome';
import { useScheduleFocusTriggers } from '@/hooks/useScheduleFocus';
import { getWeekStartKey } from '@/lib/dates';
import styles from './PlannerPage.module.scss';

function WeekFeed() {
  const weekStartsOn = useWeekStartsOn();
  const currentWeekStart = getWeekStartKey(new Date(), weekStartsOn);

  const {
    weeks,
    scrollRef,
    currentWeekRef,
    loadEarlier,
    loadLater,
    isCurrentWeekVisible,
    currentWeekDirection,
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
          <button type="button" className={styles.loadMore} onClick={loadEarlier}>
            Show more past weeks
          </button>
          {weeks.map((weekStart) => (
            <div
              key={weekStart}
              ref={weekStart === currentWeekStart ? currentWeekRef : undefined}
            >
              <WeekSection weekStart={weekStart} currentWeekStart={currentWeekStart} />
            </div>
          ))}
          <button type="button" className={styles.loadMore} onClick={loadLater}>
            Show more upcoming weeks
          </button>
        </div>
      </div>

      {!isCurrentWeekVisible && (
        <button
          type="button"
          className={styles.jumpToToday}
          onClick={scrollToCurrentWeek}
        >
          {currentWeekDirection === 'up' ? (
            <LuArrowUp size={18} aria-hidden="true" />
          ) : (
            <LuArrowDown size={18} aria-hidden="true" />
          )}
          Jump to today
        </button>
      )}
    </div>
  );
}

export function PlannerPage() {
  const isHydrated = useHydrated() && usePlannerStore.persist.hasHydrated();
  const isMobile = useIsMobile();
  useInitWeather();
  useCalendarSync();
  useStravaSync();
  useStravaConnectOutcome();

  if (!isHydrated) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  // Phones get the read-only day feed: no drag-and-drop, no week chrome.
  if (isMobile) {
    return (
      <AppShell>
        <MobileDayFeed />
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
