'use client';

import React from 'react';
import clsx from 'clsx';
import { DAYS } from '@/lib/constants';
import { useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { useWeather } from '@/hooks/useWeather';
import { dateForDay, dayLabel, formatDateLocal, orderedDays } from '@/lib/dates';
import styles from './WeekDayHeader.module.scss';

export interface WeekDayHeaderProps {
  weekStart: string;
  /** Today's date key, so the current stop can be marked. */
  todayKey: string;
}

/**
 * The week's days drawn as a subway line diagram: each day is a stop on a
 * white trunk line, labelled on an angle like a station map.
 */
export function WeekDayHeader({ weekStart, todayKey }: WeekDayHeaderProps) {
  const weekStartsOn = useWeekStartsOn();
  const days = orderedDays(weekStartsOn);
  const { data: weather } = useWeather();

  return (
    <div className={styles.panel}>
      <div className={styles.line} aria-hidden="true" />
      {days.map((day: typeof DAYS[number]) => {
        const date = dateForDay(weekStart, day, weekStartsOn);
        const dateKey = formatDateLocal(date);
        const isToday = dateKey === todayKey;
        const forecast = weather?.days.find(d => d.date === dateKey);

        return (
          <div key={day} className={styles.stop}>
            <span className={styles.dot}>{date.getDate()}</span>
            <div className={clsx(styles.labels, isToday && styles.isToday)}>
              <span className={styles.dayName}>{dayLabel(day)}</span>
              <span className={styles.weather}>
                {forecast ? `${forecast.tempMax}${weather?.unit ?? ''}` : '--'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
