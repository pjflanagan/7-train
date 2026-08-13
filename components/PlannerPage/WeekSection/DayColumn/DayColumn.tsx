import React from 'react';
import { useDndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import clsx from 'clsx';
import { DAYS } from '@/lib/constants';
import { useDayEvents } from '@/hooks/usePlannerSelectors';
import { AddEventZone } from './AddEventZone/AddEventZone';
import { DayNotes } from './DayNotes/DayNotes';
import { EventCard } from './EventCard/EventCard';
import styles from './DayColumn.module.scss';

export interface DayColumnProps {
  day: typeof DAYS[number];
  weekStart: string;
  isToday?: boolean;
}

export function DayColumn({ day, weekStart, isToday }: DayColumnProps) {
  const events = useDayEvents(day, weekStart);
  const eventIds = events.map(event => event.id);

  const { setNodeRef } = useDroppable({
    id: `col-${weekStart}-${day}`,
    data: { kind: 'column', day, weekStart },
  });

  // `isOver` alone only fires when the pointer is over the column's own empty
  // space: hit-testing reports the innermost droppable, so hovering one of the
  // day's cards makes the day itself stop reading as the target — exactly what
  // dragging into a day that already has workouts does the whole way across.
  // The day a drop would land in is whichever day owns whatever is under the
  // pointer, card or column alike.
  const { over } = useDndContext();
  const overData = over?.data.current as { day?: string; weekStart?: string } | undefined;
  const isOver = overData?.day === day && overData?.weekStart === weekStart;

  return (
    <div
      className={clsx(styles.column, isOver && styles.isOver, isToday && styles.isToday)}
      ref={setNodeRef}
    >
      <div className={styles.itemsList}>
        <SortableContext items={eventIds} strategy={verticalListSortingStrategy}>
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </SortableContext>
        <AddEventZone day={day} weekStart={weekStart} />
      </div>
      <DayNotes day={day} weekStart={weekStart} />
    </div>
  );
}
