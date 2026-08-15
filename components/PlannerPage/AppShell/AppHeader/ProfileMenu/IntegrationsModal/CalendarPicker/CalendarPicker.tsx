'use client';

import React, { useState } from 'react';
import { usePlannerStore } from '@/lib/store';
import { useCalendarChoice } from '@/hooks/useCalendarChoice';
import { Button } from '@/components/elements/Button/Button';
import { TextInput } from '@/components/elements/TextInput/TextInput';
import styles from './CalendarPicker.module.scss';

/**
 * Which calendar the workouts go in, and a way to change it.
 *
 * We are not allowed to search for a calendar by name — listing calendars needs
 * a scope that reads every calendar the user owns, which this app deliberately
 * does not ask for. So the id we hold is the only way back to a calendar. This
 * is the way back when it is lost or wrong: the user reads the id off Google
 * Calendar and pastes it in.
 */
export const CalendarPicker: React.FC = () => {
  const calendarId = usePlannerStore((state) => state.googleCalendarId);
  const { adoptExisting, createNew, isWorking, error, setError } = useCalendarChoice();

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');

  const start = () => {
    setValue(calendarId ?? '');
    setError(null);
    setIsEditing(true);
  };

  const save = async () => {
    if (await adoptExisting(value)) setIsEditing(false);
  };

  return (
    <div className={styles.picker}>
      <div className={styles.current}>
        <span className={styles.label}>Calendar</span>
        <span className={styles.value}>{calendarId ?? 'Not chosen yet'}</span>
      </div>

      {isEditing ? (
        <>
          <TextInput
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            placeholder="abc123@group.calendar.google.com"
            aria-label="Calendar ID"
            error={error ?? undefined}
            autoFocus
          />
          <p className={styles.help}>
            In Google Calendar, open the calendar&apos;s settings and copy the calendar ID
            under &quot;Integrate calendar&quot;. What is in that calendar becomes your plan
            on this browser.
          </p>
          <div className={styles.actions}>
            <Button variant="primary" onClick={save} disabled={isWorking}>
              {isWorking ? 'Checking…' : 'Use this calendar'}
            </Button>
            <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={isWorking}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={start}>
            Use an existing calendar
          </Button>
          {!calendarId && (
            <Button variant="secondary" onClick={createNew} disabled={isWorking}>
              {isWorking ? 'Working…' : 'Make a new calendar'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
