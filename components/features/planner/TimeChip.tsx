'use client';

import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { usePlannerStore } from '@/lib/store';
import { CalendarItem, WorkoutType } from '@/lib/types';
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
  item: CalendarItem;
  goal: WorkoutType;
  /**
   * Takes the place of the length control. A duration goal's own value _is_ its
   * length, so it puts its number entry here rather than showing both and
   * letting them disagree.
   */
  trailing?: React.ReactNode;
}

/**
 * When a workout happens, and how long it runs.
 *
 * Drag either chip up or down in quarter hours — the first moves the workout
 * through the day, the second stretches or shrinks it; arrow keys do the same
 * for anyone not using a pointer. Both are mirrored to Google Calendar. Until
 * someone sets a length, it is the goal's own number for a duration goal and
 * an estimate otherwise.
 */
export function TimeChip({ item, goal, trailing }: TimeChipProps) {
  const setItemTime = usePlannerStore((state) => state.setItemTime);
  const nudgeItemTime = usePlannerStore((state) => state.nudgeItemTime);
  const setItemDuration = usePlannerStore((state) => state.setItemDuration);
  const nudgeItemDuration = usePlannerStore((state) => state.nudgeItemDuration);
  const [dragging, setDragging] = useState<'time' | 'duration' | null>(null);
  const dragRef = useRef<{ startY: number; minutes: number } | null>(null);

  const startMinutes = startMinutesOf(item);
  const duration = durationMinutesOf(item, goal);
  const isExact = isExactDuration(item, goal);

  function beginDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    which: 'time' | 'duration',
    minutes: number
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    // Dragging the chip must not also drag the card out of its column, so the
    // pointer is captured here and never reaches the sortable listeners.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, minutes };
    setDragging(which);
  }

  const handleTimeDown = (event: React.PointerEvent<HTMLButtonElement>) =>
    beginDrag(event, 'time', startMinutes);

  const handleDurationDown = (event: React.PointerEvent<HTMLButtonElement>) =>
    beginDrag(event, 'duration', duration);

  const handleTimeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || dragging !== 'time') return;
    const slots = Math.round((event.clientY - drag.startY) / PIXELS_PER_SLOT);
    const next = clampStartMinutes(drag.minutes + slots * SLOT_MINUTES);
    if (next !== startMinutes) setItemTime(item.id, next);
  };

  const handleDurationMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || dragging !== 'duration') return;
    // Dragging down lengthens the workout, the way the bottom edge of an event
    // behaves in a calendar.
    const slots = Math.round((event.clientY - drag.startY) / PIXELS_PER_SLOT);
    const next = clampDuration(drag.minutes + slots * SLOT_MINUTES);
    if (next !== duration) setItemDuration(item.id, next);
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(null);
  };

  function arrowKeys(
    event: React.KeyboardEvent<HTMLButtonElement>,
    nudge: (id: string, slots: number) => void
  ) {
    const step = event.shiftKey ? 4 : 1;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      nudge(item.id, -step);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      nudge(item.id, step);
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
        onKeyDown={(e) => arrowKeys(e, nudgeItemTime)}
        aria-label={`Start time ${formatTimeOfDay(startMinutes)}. Drag or use arrow keys to change.`}
      >
        {formatTimeOfDay(startMinutes)}
      </button>
      {trailing ?? (
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
          onKeyDown={(e) => arrowKeys(e, nudgeItemDuration)}
          title={isExact ? undefined : 'Estimated'}
          aria-label={`Length ${formatDuration(duration)}. Drag or use arrow keys to change.`}
        >
          {formatDuration(duration)}
        </button>
      )}
    </div>
  );
}
