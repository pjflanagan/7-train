'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { useWeekActivities, useDayEvents, useNote, useWeekStartsOn, useUse24HourClock } from '@/hooks/usePlannerSelectors';
import { resolveEventActivity } from '@/lib/activitySnapshot';
import { useWeather } from '@/hooks/useWeather';
import { WeatherPill } from '@/components/PlannerPage/WeatherPill/WeatherPill';
import { StravaLink } from '@/components/PlannerPage/StravaLink/StravaLink';
import { AddEventZone } from '@/components/PlannerPage/AddEventZone/AddEventZone';
import { getIconByKey } from '@/lib/icons';
import {
  dayHeaderLabel,
  dayNameForDate,
  getWeekStartKey,
  parseDateLocal,
} from '@/lib/dates';
import { formatTimeOfDay, startMinutesOf } from '@/lib/schedule';
import { EditEventModal } from './EditEventModal/EditEventModal';
import styles from './MobileDayCard.module.scss';
import { COPY } from '@/lib/copy';

export interface MobileDayCardProps {
  /** YYYY-MM-DD of the day being shown. */
  dateKey: string;
  todayKey: string;
}

/**
 * One day of the plan. Workouts can be added to it, tapped open to be moved to
 * another date or deleted, and their numbers changed — the plan lives in Google
 * Calendar now, so a phone is no longer just for reading it.
 *
 * What a phone deliberately cannot do is set the week's targets: that is
 * planning a whole week at once, which wants the board.
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
  const [editingId, setEditingId] = useState<string | null>(null);

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
                {/* The row is the way in to everything editable about the
                    workout. The Strava mark is a link out, so it stays beside
                    the button rather than inside it. */}
                <button
                  type="button"
                  className={styles.open}
                  onClick={() => setEditingId(event.id)}
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
                </button>
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

      {/* Named, unlike the board's wordless slot: there is no hover on a phone
          to explain a bare dashed strip. */}
      <AddEventZone
        day={day}
        weekStart={weekStart}
        className={styles.addEvent}
        label={COPY.events.addLabel}
      />

      {note && <p className={styles.note}>{note}</p>}

      <EditEventModal eventId={editingId} onClose={() => setEditingId(null)} />
    </section>
  );
}
