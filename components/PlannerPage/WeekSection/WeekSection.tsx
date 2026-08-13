import { WeekProgressBar } from './WeekProgressBar/WeekProgressBar';
import { WeekActions } from './WeekActions/WeekActions';
import { GoalStrip } from './GoalStrip/GoalStrip';
import { WeekDayHeader } from './WeekDayHeader/WeekDayHeader';
import { DayColumn } from './DayColumn/DayColumn';
import { useWeekStartsOn } from '@/hooks/usePlannerSelectors';
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

  return (
    <section className={styles.section}>
      <header className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h2 className={styles.header}>{weekLabel(weekStart, currentWeekStart)}</h2>
          <WeekProgressBar weekStart={weekStart} />
        </div>
        <WeekActions weekStart={weekStart} />
      </header>
      {/* The strip is the drag source for planning ahead; past weeks are read-only. */}
      {weekStart >= currentWeekStart && <GoalStrip weekStart={weekStart} />}
      <div className={styles.board}>
        <WeekDayHeader weekStart={weekStart} todayKey={todayKey} />
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
