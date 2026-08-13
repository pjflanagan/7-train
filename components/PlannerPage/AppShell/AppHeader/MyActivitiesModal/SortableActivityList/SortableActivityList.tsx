import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Activity } from '@/lib/types';
import { ActivityRow } from './ActivityRow/ActivityRow';
import styles from './SortableActivityList.module.scss';

export interface SortableActivityListProps {
  activities: Activity[];
  onReorder: (oldIndex: number, newIndex: number) => void;
}

export const SortableActivityList: React.FC<SortableActivityListProps> = ({ activities, onReorder }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = activities.findIndex((g) => g.id === active.id);
      const newIndex = activities.findIndex((g) => g.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={activities.map((g) => g.id)} strategy={verticalListSortingStrategy}>
        <div className={styles.list}>
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
