import { useState } from 'react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { usePlannerStore } from '../lib/store';
import { DAYS } from '../lib/constants';

export interface PlannerDndData {
  kind: 'goal' | 'subtag' | 'item' | 'column';
  typeId?: string;
  tag?: string;
  itemId?: string;
  day?: typeof DAYS[number];
  week?: 1 | 2;
}

export function usePlannerDnd() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<PlannerDndData | null>(null);

  const addItem = usePlannerStore(state => state.addItem);
  const moveItem = usePlannerStore(state => state.moveItem);
  const reorderDay = usePlannerStore(state => state.reorderDay);
  const items = usePlannerStore(state => state.items);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveData(event.active.data.current as PlannerDndData);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveData(null);

    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as PlannerDndData | undefined;
    const overData = over.data.current as PlannerDndData | undefined;

    if (!activeData || !overData) return;

    if (activeData.kind === 'goal' && overData.kind === 'column') {
      if (activeData.typeId && overData.day && overData.week) {
        addItem({ typeId: activeData.typeId, day: overData.day, week: overData.week, value: 1 });
      }
    } else if (activeData.kind === 'subtag' && overData.kind === 'column') {
      if (activeData.typeId && activeData.tag && overData.day && overData.week) {
        addItem({ typeId: activeData.typeId, workoutType: activeData.tag, day: overData.day, week: overData.week, value: 1 });
      }
    } else if (activeData.kind === 'item') {
      const activeItem = items.find(i => i.id === activeData.itemId);
      if (!activeItem) return;

      if (overData.kind === 'item') {
        const overItem = items.find(i => i.id === overData.itemId);
        if (!overItem) return;
        if (activeItem.day === overItem.day && activeItem.week === overItem.week) {
          // Same column
          const dayItems = items.filter(i => i.day === activeItem.day && i.week === activeItem.week);
          const oldIndex = dayItems.findIndex(i => i.id === activeItem.id);
          const newIndex = dayItems.findIndex(i => i.id === overItem.id);
          if (oldIndex !== newIndex) {
            reorderDay(activeItem.day, activeItem.week, oldIndex, newIndex);
          }
        } else {
          // Different column, insert at specific index
          const targetDayItems = items.filter(i => i.day === overItem.day && i.week === overItem.week);
          const newIndex = targetDayItems.findIndex(i => i.id === overItem.id);
          moveItem(activeItem.id, overItem.day, overItem.week, newIndex);
        }
      } else if (overData.kind === 'column') {
        if (overData.day && overData.week && (activeItem.day !== overData.day || activeItem.week !== overData.week)) {
          moveItem(activeItem.id, overData.day, overData.week);
        }
      }
    }
  };

  return { activeId, activeData, handleDragStart, handleDragEnd };
}
