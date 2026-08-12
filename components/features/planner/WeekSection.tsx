import { WeekProgressBar } from './WeekProgressBar';
import { WeekActions } from './WeekActions';
import { GoalStrip } from './GoalStrip';
import { DayColumn } from './DayColumn';
import { useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { useTileGridHeight } from '@/hooks/useTileGridHeight';
import { orderedDays, weekLabel, formatDateLocal, dateForDay } from '@/lib/dates';
import styles from './WeekSection.module.scss';

export interface WeekSectionProps {
  weekStart: string;
  /** The week key containing today, used to label this one relative to now. */
  currentWeekStart: string;
}

export function WeekSection({ weekStart, currentWeekStart }: WeekSectionProps) {
  const weekStartsOn = useWeekStartsOn();
  const days = orderedDays(weekStartsOn);
  const todayKey = formatDateLocal(new Date());

  // Snap the week to a whole number of tile units so the wall runs unbroken
  // into the next week.
  const { contentRef, minHeight } = useTileGridHeight();

  return (
    <section className={styles.section} style={{ minHeight }}>
      <div className={styles.inner} ref={contentRef}>
        <header className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <h2 className={styles.header}>{weekLabel(weekStart, currentWeekStart)}</h2>
            <WeekActions weekStart={weekStart} />
          </div>
          <WeekProgressBar weekStart={weekStart} />
        </header>
        <GoalStrip weekStart={weekStart} />
        <div className={styles.grid}>
          {days.map(day => (
            <DayColumn
              key={day}
              day={day}
              weekStart={weekStart}
              isToday={formatDateLocal(dateForDay(weekStart, day, weekStartsOn)) === todayKey}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
