'use client';

import React, { useState } from 'react';
import { usePlannerStore } from '@/lib/store';
import { useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';
import { Button } from '@/components/elements/Button/Button';
import { TextInput } from '@/components/elements/TextInput/TextInput';
import styles from './CalendarPicker.module.scss';

/**
 * Which calendar the workouts go in, and a way to change it.
 *
 * We are not allowed to search for a calendar by name — listing calendars needs
 * a scope that reads every calendar the user owns, which this app deliberately
 * does not ask for. So the id we hold is the only way back to a calendar, and
 * when it is lost the app makes a new one instead of finding the old one. This
 * is the manual way back: the user reads the id off Google Calendar and pastes
 * it in, and the duplicate can be deleted.
 */
export const CalendarPicker: React.FC = () => {
  const calendarId = usePlannerStore((state) => state.googleCalendarId);
  const setGoogleCalendarId = usePlannerStore((state) => state.setGoogleCalendarId);
  const resync = useCalendarSyncStore((state) => state.resync);
  const forgetBaseline = useCalendarSyncStore((state) => state.forgetBaseline);

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const start = () => {
    setValue(calendarId ?? '');
    setError(null);
    setIsEditing(true);
  };

  const save = async () => {
    const wanted = value.trim();
    if (!wanted) {
      setError('Paste a calendar ID first.');
      return;
    }

    setIsChecking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/calendar/verify?calendarId=${encodeURIComponent(wanted)}`
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? 'Could not check that calendar');
      if (!body.found) {
        setError('No calendar with that ID, or it is not one this app created.');
        return;
      }

      // The old calendar's event ids mean nothing in the new one. Forgetting
      // what we had written stops the next push from trying to delete events
      // over there, and the events themselves are rewritten into the new
      // calendar as the push finds them missing.
      forgetBaseline();
      setGoogleCalendarId(body.calendarId);
      setIsEditing(false);
      resync();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not check that calendar');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className={styles.picker}>
      <div className={styles.current}>
        <span className={styles.label}>Calendar</span>
        <span className={styles.value}>{calendarId ?? 'Not created yet'}</span>
      </div>

      {isEditing ? (
        <>
          <TextInput
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="abc123@group.calendar.google.com"
            aria-label="Calendar ID"
            error={error ?? undefined}
            autoFocus
          />
          <p className={styles.help}>
            In Google Calendar, open the calendar&apos;s settings and copy the calendar ID
            under &quot;Integrate calendar&quot;.
          </p>
          <div className={styles.actions}>
            <Button variant="primary" onClick={save} disabled={isChecking}>
              {isChecking ? 'Checking…' : 'Use this calendar'}
            </Button>
            <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={isChecking}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" onClick={start}>
          Use an existing calendar
        </Button>
      )}
    </div>
  );
};
