'use client';

import React from 'react';
import { MdCalendarMonth } from 'react-icons/md';
import { usePlannerStore } from '@/lib/store';
import { GOOGLE_CALENDAR_URL } from '@/lib/google';
import styles from './GoogleCalendarLink.module.scss';
import { COPY } from '@/lib/copy';

/**
 * The way out to Google Calendar, beside the sync pill that says the plan is
 * kept there.
 *
 * It earns its place in the header because the app no longer sets start times:
 * moving a workout through the day is done in Google Calendar, so "open Google
 * Calendar" went from a thing you might want to a step in an ordinary edit.
 *
 * Shown only once there is a calendar to open. Signed out, or signed in with
 * calendar sync never switched on, this would point at a calendar with none of
 * the user's workouts in it.
 */
export function GoogleCalendarLink() {
  const calendarId = usePlannerStore((state) => state.googleCalendarId);
  if (!calendarId) return null;

  return (
    <a
      className={styles.link}
      href={GOOGLE_CALENDAR_URL}
      target="_blank"
      rel="noreferrer noopener"
      title={COPY.calendar.open}
      aria-label={COPY.calendar.open}
    >
      <MdCalendarMonth aria-hidden="true" />
    </a>
  );
}
