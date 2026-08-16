'use client';

import React from 'react';
import clsx from 'clsx';
import { useWeekActivities, useDayEvents, useNote, useWeekStartsOn, useUse24HourClock } from '@/hooks/usePlannerSelectors';
import { resolveEventActivity } from '@/lib/activitySnapshot';
import { useWeather } from '@/hooks/useWeather';
import { WeatherPill } from '@/components/PlannerPage/WeatherPill/WeatherPill';
import { StravaLink } from '@/components/PlannerPage/StravaLink/StravaLink';
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
  const use24Hour = useUse24HourClock();
  const date = parseDateLocal(dateKey);
  const day = dayNameForDate(date);
  const weekStart = getWeekStartKey(date, weekStartsOn);

  const events = useDayEvents(day, weekStart);
  const activities = useWeekActivities(weekStart);
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

      {events.length === 0 && !note && <p className={styles.empty}>Rest day</p>}

      {events.length > 0 && (
        <ul className={styles.events}>
          {events.map((event) => {
            const activity = resolveEventActivity(event, activities);
            if (!activity) return null;
            const Icon = getIconByKey(activity.icon);

            return (
              <li
                key={event.id}
                className={styles.event}
                style={{ '--activity-color': activity.color } as React.CSSProperties}
              >
                <Icon className={styles.icon} />
                <span className={styles.eventName}>
                  <span className={styles.time}>{formatTimeOfDay(startMinutesOf(event), use24Hour)}</span>
                  {activity.name}
                  {event.workoutType && (
                    <span className={styles.subType}>{event.workoutType}</span>
                  )}
                </span>
                {/* An "instance" activity is always one occurrence, so "1 sessions" is noise. */}
                {activity.metric !== 'instance' && event.value > 0 && (
                  <span className={styles.value}>
                    {event.value}
                    <span className={styles.unit}>{activity.unit}</span>
                  </span>
                )}
                {/* Done, and a way through to the recording it was done as. */}
                {event.stravaActivityId != null && (
                  <StravaLink
                    stravaActivityId={event.stravaActivityId}
                    className={styles.strava}
                  />
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
