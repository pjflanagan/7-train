'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import { DAYS } from '@/lib/constants';
import { useDayEvents } from '@/hooks/usePlannerSelectors';
import { AddEventZone } from '@/components/PlannerPage/AddEventZone/AddEventZone';
import { DayHeader } from './DayHeader/DayHeader';
import { DayNotes } from './DayNotes/DayNotes';
import { EventCard } from './EventCard/EventCard';
import styles from './DayColumn.module.scss';

export interface DayColumnProps {
  day: typeof DAYS[number];
  weekStart: string;
  /** The calendar date this column stands for. */
  date: Date;
  isToday?: boolean;
}

export function DayColumn({ day, weekStart, date, isToday }: DayColumnProps) {
  const events = useDayEvents(day, weekStart);

  // One droppable for the whole cell, label and cards included: the header is
  // part of the day, so aiming at it is aiming at the day, and a card is the
  // only thing sitting on one. Nothing inside the column is a drop target of
  // its own — a drop asks which day, not which position — so this is always the
  // innermost droppable under the pointer and answers for the whole cell.
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${weekStart}-${day}`,
    data: { kind: 'column', day, weekStart },
  });

  return (
    <div
      className={clsx(styles.column, isOver && styles.isOver, isToday && styles.isToday)}
      ref={setNodeRef}
    >
      <DayHeader day={day} date={date} isToday={isToday} />
      <div className={styles.itemsList}>
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
        <AddEventZone day={day} weekStart={weekStart} />
      </div>
      <DayNotes day={day} weekStart={weekStart} />
    </div>
  );
}
