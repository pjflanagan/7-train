import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import clsx from 'clsx';
import { DAYS } from '@/lib/constants';
import { useDayItems } from '@/hooks/usePlannerSelectors';
import { AddWorkoutZone } from './AddWorkoutZone/AddWorkoutZone';
import { DayNotes } from './DayNotes/DayNotes';
import { ScheduledCard } from './ScheduledCard/ScheduledCard';
import styles from './DayColumn.module.scss';

export interface DayColumnProps {
  day: typeof DAYS[number];
  weekStart: string;
  isToday?: boolean;
}

export function DayColumn({ day, weekStart, isToday }: DayColumnProps) {
  const items = useDayItems(day, weekStart);
  const itemIds = items.map(item => item.id);

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
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <ScheduledCard key={item.id} item={item} />
          ))}
        </SortableContext>
        {items.length === 0 && <AddWorkoutZone day={day} weekStart={weekStart} />}
      </div>
      <DayNotes day={day} weekStart={weekStart} />
    </div>
  );
}
