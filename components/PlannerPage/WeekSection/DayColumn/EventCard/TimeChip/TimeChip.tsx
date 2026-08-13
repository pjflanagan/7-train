'use client';

import React from 'react';
import clsx from 'clsx';
import { usePlannerStore } from '@/lib/store';
import { useUse24HourClock } from '@/hooks/usePlannerSelectors';
import { ScheduledEvent, Activity } from '@/lib/types';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import {
  clampDuration,
  clampStartMinutes,
  durationMinutesOf,
  isExactDuration,
  startMinutesOf,
} from '@/lib/schedule';
import styles from './TimeChip.module.scss';

export interface TimeChipProps {
  event: ScheduledEvent;
  activity: Activity;
}

/** "17:30" — the value format a native `<input type="time">` reads and writes. */
function toTimeInputValue(minutes: number): string {
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

function fromTimeInputValue(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * When a workout happens, and how long it runs — typed in directly rather
 * than dragged, so the header band around these two fields stays free to
 * grab and move the card instead of fighting a drag gesture for the same
 * pointer.
 */
export function TimeChip({ event, activity }: TimeChipProps) {
  const setEventTime = usePlannerStore((state) => state.setEventTime);
  const setEventDuration = usePlannerStore((state) => state.setEventDuration);
  const use24Hour = useUse24HourClock();

  const startMinutes = startMinutesOf(event);
  const duration = durationMinutesOf(event, activity);
  const isExact = isExactDuration(event, activity);

  return (
    <div className={styles.row} onPointerDown={(e) => e.stopPropagation()}>
      <input
        type="time"
        className={styles.chip}
        value={toTimeInputValue(startMinutes)}
        step={900}
        onChange={(e) => {
          const minutes = fromTimeInputValue(e.target.value);
          if (minutes !== null) setEventTime(event.id, clampStartMinutes(minutes));
        }}
        // The 24-hour clock setting only governs our own formatted display —
        // a native control renders in whatever the browser/OS prefers.
        aria-label={`Start time, in ${use24Hour ? '24' : '12'}-hour clock`}
      />
      <InlineNumberInput
        value={duration}
        onCommit={(val) => setEventDuration(event.id, clampDuration(val))}
        className={clsx(styles.chip, styles.duration)}
        title={isExact ? undefined : 'Estimated'}
        aria-label="Length, in minutes"
      />
    </div>
  );
}
