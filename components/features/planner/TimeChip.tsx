'use client';

import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { usePlannerStore } from '@/lib/store';
import { CalendarItem, WorkoutType } from '@/lib/types';
import {
  clampStartMinutes,
  estimateDurationMinutes,
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
}

/**
 * When a workout happens, and how long it runs.
 *
 * Drag the chip up or down to move the workout through the day in quarter
 * hours; arrow keys do the same for anyone not using a pointer. The duration
 * beside it is the goal's own number for a duration goal, and an estimate
 * otherwise — the tilde says which.
 */
export function TimeChip({ item, goal }: TimeChipProps) {
  const setItemTime = usePlannerStore((state) => state.setItemTime);
  const nudgeItemTime = usePlannerStore((state) => state.nudgeItemTime);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startMinutes: number } | null>(null);

  const startMinutes = startMinutesOf(item);
  const duration = estimateDurationMinutes(item, goal);
  const isExact = isExactDuration(goal);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    // Dragging the chip must not also drag the card out of its column, so the
    // pointer is captured here and never reaches the sortable listeners.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, startMinutes };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const slots = Math.round((event.clientY - drag.startY) / PIXELS_PER_SLOT);
    const next = clampStartMinutes(drag.startMinutes + slots * SLOT_MINUTES);
    if (next !== startMinutes) setItemTime(item.id, next);
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 4 : 1;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      nudgeItemTime(item.id, -step);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      nudgeItemTime(item.id, step);
    }
  };

  return (
    <div className={styles.row}>
      <button
        type="button"
        className={clsx(styles.chip, isDragging && styles.isDragging)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        aria-label={`Start time ${formatTimeOfDay(startMinutes)}. Drag or use arrow keys to change.`}
      >
        {formatTimeOfDay(startMinutes)}
      </button>
      <span className={styles.duration} title={isExact ? undefined : 'Estimated'}>
        {isExact ? '' : '~'}
        {formatDuration(duration)}
      </span>
    </div>
  );
}
