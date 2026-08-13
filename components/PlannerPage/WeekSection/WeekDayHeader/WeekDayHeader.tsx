'use client';

import React from 'react';
import clsx from 'clsx';
import { DAYS } from '@/lib/constants';
import { useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { useWeather } from '@/hooks/useWeather';
import { WeatherPill } from '@/components/PlannerPage/WeatherPill/WeatherPill';
import { dateForDay, formatDateLocal, orderedDays, shortDayLabel } from '@/lib/dates';
import styles from './WeekDayHeader.module.scss';

export interface WeekDayHeaderProps {
  weekStart: string;
  /** Today's date key, so the current day can be marked. */
  todayKey: string;
}

/** Day name, date, and forecast, sitting over each column of the week grid. */
export function WeekDayHeader({ weekStart, todayKey }: WeekDayHeaderProps) {
  const weekStartsOn = useWeekStartsOn();
  const days = orderedDays(weekStartsOn);
  const { data: weather } = useWeather();

  return (
    <div className={styles.row}>
      {days.map((day: typeof DAYS[number]) => {
        const date = dateForDay(weekStart, day, weekStartsOn);
        const dateKey = formatDateLocal(date);
        const isToday = dateKey === todayKey;
        const forecast = weather?.days.find(d => d.date === dateKey);

        return (
          <div key={day} className={clsx(styles.day, isToday && styles.isToday)}>
            <span className={styles.dayName}>{shortDayLabel(day)}</span>
            <span className={styles.date}>{date.getDate()}</span>
            {forecast && (
              <span className={styles.weather}>
                <WeatherPill
                  code={forecast.code}
                  tempMax={forecast.tempMax}
                  unit={weather?.unit ?? ''}
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
