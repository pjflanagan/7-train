'use client';

import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { usePlannerStore } from '@/lib/store';
import { useUse24HourClock } from '@/hooks/usePlannerSelectors';
import { ScheduledEvent, Activity } from '@/lib/types';
import {
  clampDuration,
  clampStartMinutes,
  durationMinutesOf,
  formatDuration,
  formatTimeOfDay,
  isExactDuration,
  SLOT_MINUTES,
  startMinutesOf,
} from '@/lib/schedule';
import styles from './TimeChip.module.scss';

/** Pixels of vertical drag per quarter hour. Small enough to reach 6am to 9pm. */
const PIXELS_PER_SLOT = 6;

export interface TimeChipProps {
  event: ScheduledEvent;
  activity: Activity;
}

/**
 * When a workout happens, and how long it runs.
 *
 * Drag either chip up or down in quarter hours — the first moves the workout
 * through the day, the second stretches or shrinks it; arrow keys do the same
 * for anyone not using a pointer. Both are mirrored to Google Calendar. Until
 * someone sets a length, it is the activity's own number for a duration activity and
 * an estimate otherwise.
 */
export function TimeChip({ event, activity }: TimeChipProps) {
  const setEventTime = usePlannerStore((state) => state.setEventTime);
  const nudgeEventTime = usePlannerStore((state) => state.nudgeEventTime);
  const setEventDuration = usePlannerStore((state) => state.setEventDuration);
  const nudgeEventDuration = usePlannerStore((state) => state.nudgeEventDuration);
  const [dragging, setDragging] = useState<'time' | 'duration' | null>(null);
  const dragRef = useRef<{ startY: number; minutes: number } | null>(null);
  const use24Hour = useUse24HourClock();

  const startMinutes = startMinutesOf(event);
  const duration = durationMinutesOf(event, activity);
  const isExact = isExactDuration(event, activity);

  function beginDrag(
    e: React.PointerEvent<HTMLButtonElement>,
    which: 'time' | 'duration',
    minutes: number
  ) {
    if (e.button !== 0) return;
    e.preventDefault();
    // Dragging the chip must not also drag the card out of its column, so the
    // pointer is captured here and never reaches the sortable listeners.
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, minutes };
    setDragging(which);
  }

  const handleTimeDown = (e: React.PointerEvent<HTMLButtonElement>) =>
    beginDrag(e, 'time', startMinutes);

  const handleDurationDown = (e: React.PointerEvent<HTMLButtonElement>) =>
    beginDrag(e, 'duration', duration);

  const handleTimeMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || dragging !== 'time') return;
    const slots = Math.round((e.clientY - drag.startY) / PIXELS_PER_SLOT);
    const next = clampStartMinutes(drag.minutes + slots * SLOT_MINUTES);
    if (next !== startMinutes) setEventTime(event.id, next);
  };

  const handleDurationMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || dragging !== 'duration') return;
    // Dragging down lengthens the workout, the way the bottom edge of an event
    // behaves in a calendar.
    const slots = Math.round((e.clientY - drag.startY) / PIXELS_PER_SLOT);
    const next = clampDuration(drag.minutes + slots * SLOT_MINUTES);
    if (next !== duration) setEventDuration(event.id, next);
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDragging(null);
  };

  function arrowKeys(
    e: React.KeyboardEvent<HTMLButtonElement>,
    nudge: (id: string, slots: number) => void
  ) {
    const step = e.shiftKey ? 4 : 1;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      nudge(event.id, -step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nudge(event.id, step);
    }
  }

  return (
    <div className={styles.row}>
      <button
        type="button"
        className={clsx(styles.chip, dragging === 'time' && styles.isDragging)}
        onPointerDown={handleTimeDown}
        onPointerMove={handleTimeMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => arrowKeys(e, nudgeEventTime)}
        aria-label={`Start time ${formatTimeOfDay(startMinutes, use24Hour)}. Drag or use arrow keys to change.`}
      >
        {formatTimeOfDay(startMinutes, use24Hour)}
      </button>
      <button
        type="button"
        className={clsx(
          styles.chip,
          styles.duration,
          dragging === 'duration' && styles.isDragging
        )}
        onPointerDown={handleDurationDown}
        onPointerMove={handleDurationMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => arrowKeys(e, nudgeEventDuration)}
        title={isExact ? undefined : 'Estimated'}
        aria-label={`Length ${formatDuration(duration)}. Drag or use arrow keys to change.`}
      >
        {formatDuration(duration)}
      </button>
    </div>
  );
}
