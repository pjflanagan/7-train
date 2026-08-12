import React from 'react';
import clsx from 'clsx';
import { WeekProgressBar } from './WeekProgressBar';
import { GoalStrip } from './GoalStrip';
import { DayColumn } from './DayColumn';
import { useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { orderedDays, weekLabel, weekRangeLabel, formatDateLocal, dateForDay } from '@/lib/dates';
import styles from './WeekSection.module.scss';

export interface WeekSectionProps {
  weekStart: string;
  /** The week key containing today, used to label this one relative to now. */
  currentWeekStart: string;
}

export function WeekSection({ weekStart, currentWeekStart }: WeekSectionProps) {
  const weekStartsOn = useWeekStartsOn();
  const days = orderedDays(weekStartsOn);
  const isCurrent = weekStart === currentWeekStart;
  const todayKey = formatDateLocal(new Date());

  return (
    <section className={clsx(styles.section, isCurrent && styles.isCurrent)}>
      <header className={styles.headerRow}>
        <h2 className={styles.header}>{weekLabel(weekStart, currentWeekStart)}</h2>
        <span className={styles.range}>{weekRangeLabel(weekStart)}</span>
      </header>
      <WeekProgressBar weekStart={weekStart} />
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
    </section>
  );
}
