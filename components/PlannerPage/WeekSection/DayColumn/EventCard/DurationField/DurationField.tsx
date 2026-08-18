'use client';

import React from 'react';
import clsx from 'clsx';
import { usePlannerStore } from '@/lib/store';
import { ScheduledEvent, Activity } from '@/lib/types';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import { clampDuration, durationMinutesOf, isExactDuration } from '@/lib/schedule';
import styles from './DurationField.module.scss';
import { COPY } from '@/lib/copy';

export interface DurationFieldProps {
  event: ScheduledEvent;
  activity: Activity;
  className?: string;
}

/**
 * How long a workout runs, in minutes. It sits in the card's body beside the
 * workout's own number rather than up in the header band: both are things the
 * plan says about this session, and the header is now purely what the calendar
 * has decided — a read-only start time and the grab point for the card.
 *
 * An activity measured in time doesn't get one of these at all: its value _is_
 * its length, so a second field would be the same fact twice.
 */
export function DurationField({ event, activity, className }: DurationFieldProps) {
  const setEventDuration = usePlannerStore((state) => state.setEventDuration);

  const duration = durationMinutesOf(event, activity);
  const isExact = isExactDuration(event, activity);

  return (
    <div className={clsx(styles.field, className)}>
      <InlineNumberInput
        value={duration}
        onCommit={(val) => setEventDuration(event.id, clampDuration(val))}
        className={styles.input}
        // An estimate reads the same as a set length, so the difference is
        // said rather than drawn.
        title={isExact ? undefined : COPY.events.estimated}
        aria-label={COPY.events.lengthLabel}
      />
      <span className={styles.unit}>{COPY.events.minutes}</span>
    </div>
  );
}
