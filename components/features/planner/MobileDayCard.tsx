'use client';

import React from 'react';
import clsx from 'clsx';
import { useDayItems, useGoals, useNote, useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { useWeather } from '@/hooks/useWeather';
import { WeatherPill } from './WeatherPill';
import { getIconByKey } from '@/lib/icons';
import {
  dayHeaderLabel,
  dayNameForDate,
  getWeekStartKey,
  parseDateLocal,
} from '@/lib/dates';
import { formatTimeOfDay, startMinutesOf } from '@/lib/schedule';
import styles from './MobileDayCard.module.scss';

export interface MobileDayCardProps {
  /** YYYY-MM-DD of the day being shown. */
  dateKey: string;
  todayKey: string;
}

/**
 * One day of the plan, read-only. Mobile is for checking what is scheduled,
 * so nothing here is editable or draggable.
 */
export function MobileDayCard({ dateKey, todayKey }: MobileDayCardProps) {
  const weekStartsOn = useWeekStartsOn();
  const date = parseDateLocal(dateKey);
  const day = dayNameForDate(date);
  const weekStart = getWeekStartKey(date, weekStartsOn);

  const items = useDayItems(day, weekStart);
  const goals = useGoals();
  const note = useNote(day, weekStart);
  const { data: weather } = useWeather();
  const forecast = weather?.days.find((d) => d.date === dateKey);

  const isToday = dateKey === todayKey;
  const isPast = dateKey < todayKey;

  return (
    <section className={clsx(styles.card, isToday && styles.isToday, isPast && styles.isPast)}>
      <header className={styles.header}>
        <h2 className={styles.title}>{dayHeaderLabel(dateKey, todayKey)}</h2>
        {forecast && (
          <WeatherPill
            code={forecast.code}
            tempMax={forecast.tempMax}
            unit={weather?.unit ?? ''}
          />
        )}
      </header>

      {items.length === 0 && !note && <p className={styles.empty}>Rest day</p>}

      {items.length > 0 && (
        <ul className={styles.items}>
          {items.map((item) => {
            const goal = goals.find((g) => g.id === item.typeId);
            if (!goal) return null;
            const Icon = getIconByKey(goal.icon);

            return (
              <li
                key={item.id}
                className={styles.item}
                style={{ borderColor: goal.color, backgroundColor: `${goal.color}10` }}
              >
                <Icon className={styles.icon} style={{ color: goal.color }} />
                <span className={styles.itemName}>
                  <span className={styles.time}>{formatTimeOfDay(startMinutesOf(item))}</span>
                  {goal.name}
                  {item.workoutType && (
                    <span className={styles.subType}>{item.workoutType}</span>
                  )}
                </span>
                {/* A "times" goal is always one occurrence, so "1 times" is noise. */}
                {goal.metric !== 'times' && item.value > 0 && (
                  <span className={styles.value}>
                    {item.value}
                    <span className={styles.unit}>{goal.unit}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {note && <p className={styles.note}>{note}</p>}
    </section>
  );
}
