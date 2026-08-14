'use client';

import React from 'react';
import clsx from 'clsx';
import { DAYS } from '@/lib/constants';
import { useWeather } from '@/hooks/useWeather';
import { WeatherPill } from '@/components/PlannerPage/WeatherPill/WeatherPill';
import { formatDateLocal, shortDayLabel } from '@/lib/dates';
import styles from './DayHeader.module.scss';

export interface DayHeaderProps {
  day: typeof DAYS[number];
  /** The calendar date this column stands for. */
  date: Date;
  /** Today's label picks up the accent its column is already wearing. */
  isToday?: boolean;
}

/** Day name, date, and forecast, labelling the top of its own column. */
export function DayHeader({ day, date, isToday }: DayHeaderProps) {
  const { data: weather } = useWeather();
  const forecast = weather?.days.find(d => d.date === formatDateLocal(date));

  return (
    <div className={clsx(styles.header, isToday && styles.isToday)}>
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
}
