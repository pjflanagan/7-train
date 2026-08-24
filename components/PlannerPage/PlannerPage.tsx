'use client';

import { LuArrowUp, LuArrowDown } from 'react-icons/lu';
import { AppShell } from './AppShell/AppShell';
import { Spinner } from '@/components/elements/Spinner/Spinner';
import { WeekSection } from './WeekSection/WeekSection';
import { usePlannerLoaded } from '@/hooks/usePlannerLoaded';
import { useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { useInfiniteWeeks } from '@/hooks/useInfiniteWeeks';
import { PlannerDndProvider } from './PlannerDndProvider/PlannerDndProvider';
import { MobileDayFeed } from './MobileDayFeed/MobileDayFeed';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useInitWeather } from '@/hooks/useWeather';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useEnsureCalendar } from '@/hooks/useEnsureCalendar';
import { useUserSync } from '@/hooks/useUserSync';
import { useStravaSync } from '@/hooks/useStrava';
import { useStravaConnectOutcome } from '@/hooks/useStravaConnectOutcome';
import { useSignedOutReset } from '@/hooks/useSignedOutReset';
import { useGoogleAccount } from '@/hooks/useAuth';
import { useIsMounted } from '@/hooks/useIsMounted';
import { SignInModal } from './SignInModal/SignInModal';
import { useScheduleFocusTriggers } from '@/hooks/useScheduleFocus';
import { getWeekStartKey } from '@/lib/dates';
import styles from './PlannerPage.module.scss';
import { COPY } from '@/lib/copy';

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
            {COPY.week.showEarlier}
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
            {COPY.week.showLater}
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
          {COPY.week.jumpToToday}
        </button>
      )}
    </div>
  );
}

export function PlannerPage() {
  // Nothing is cached in the browser, so the first paint has nothing to draw
  // and the plan is a network round trip away. The spinner covers that wait
  // rather than showing an empty week to someone who has one.
  const isLoaded = usePlannerLoaded();
  const isMounted = useIsMounted();
  const { isSignedIn, isLoading: isSessionLoading } = useGoogleAccount();
  const isMobile = useIsMobile();
  useInitWeather();
  useUserSync();
  useEnsureCalendar();
  useCalendarSync();
  useStravaSync();
  useStravaConnectOutcome();
  useSignedOutReset();

  // Signed out there is no plan to fetch and nowhere to keep one, so the app is
  // the sign in and nothing else — see `SignInModal`. Only once the session is
  // actually known: "not signed in yet" is the first answer `useSession` gives
  // everybody, and showing the door on it would flash it at every returning
  // user.
  if (isMounted && !isSessionLoading && !isSignedIn) return <SignInModal />;

  if (!isLoaded) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  // Phones get the day feed: no drag-and-drop, no week chrome, no targets.
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
