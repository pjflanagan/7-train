'use client';

import React from 'react';
import { usePlannerStore } from '@/lib/store';
import { useUse24HourClock } from '@/hooks/usePlannerSelectors';
import { ScheduledEvent, Activity } from '@/lib/types';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import {
  clampDuration,
  clampStartMinutes,
  durationMinutesOf,
  formatChipTime,
  isExactDuration,
  startMinutesOf,
} from '@/lib/schedule';
import styles from './TimeChip.module.scss';

export interface TimeChipProps {
  event: ScheduledEvent;
  activity: Activity;
  /**
   * Off for an activity measured in time, where the event's own value already
   * says how long it runs — a second length field would be the same fact twice.
   * When it happens is still the card's to set either way.
   */
  showDuration?: boolean;
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
export function TimeChip({ event, activity, showDuration = true }: TimeChipProps) {
  const setEventTime = usePlannerStore((state) => state.setEventTime);
  const setEventDuration = usePlannerStore((state) => state.setEventDuration);
  const use24Hour = useUse24HourClock();

  const startMinutes = startMinutesOf(event);
  const duration = durationMinutesOf(event, activity);
  const isExact = isExactDuration(event, activity);

  return (
    <div className={styles.row} onPointerDown={(e) => e.stopPropagation()}>
      <div className={styles.timeField}>
        <input
          type="time"
          className={styles.timeInput}
          value={toTimeInputValue(startMinutes)}
          step={900}
          onChange={(e) => {
            const minutes = fromTimeInputValue(e.target.value);
            if (minutes !== null) setEventTime(event.id, clampStartMinutes(minutes));
          }}
          // Chrome/Edge open the native editor on focus; browsers without
          // `showPicker` just fall back to a plain focused field.
          onFocus={(e) => e.currentTarget.showPicker?.()}
          aria-label={`Start time, in ${use24Hour ? '24' : '12'}-hour clock`}
        />
        {/* The field's own value renders in the browser's fixed format (always
            "05:30 PM"); this sits over it so the card can show its own
            tighter "5:30pm" instead. Clicks pass through to the input beneath. */}
        <span className={styles.timeDisplay} aria-hidden="true">
          {formatChipTime(startMinutes, use24Hour)}
        </span>
      </div>
      {showDuration && (
      <div className={styles.durationField}>
        <InlineNumberInput
          value={duration}
          onCommit={(val) => setEventDuration(event.id, clampDuration(val))}
          className={styles.chip}
          title={isExact ? undefined : 'Estimated'}
          aria-label="Length, in minutes"
        />
        <span className={styles.durationUnit}>mins</span>
      </div>
      )}
    </div>
  );
}
