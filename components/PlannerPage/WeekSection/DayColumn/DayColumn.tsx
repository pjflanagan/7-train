import React from 'react';
import { useDroppable } from '@dnd-kit/core';
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

  const { setNodeRef, isOver } = useDroppable({
    id: `col-${weekStart}-${day}`,
    data: { kind: 'column', day, weekStart },
  });

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
