import { useState } from 'react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { usePlannerStore } from '@/lib/store';
import { DAYS } from '@/lib/constants';

export interface PlannerDndData {
  kind: 'goal' | 'subtag' | 'item' | 'column';
  typeId?: string;
  tag?: string;
  itemId?: string;
  day?: typeof DAYS[number];
  weekStart?: string;
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

  /**
   * A drag that ends without a drop — Escape, or the pointer being captured by
   * a control inside the handle. Nothing moves, but the active id has to clear
   * or the drag preview is left hanging over the feed.
   */
  const handleDragCancel = () => {
    setActiveId(null);
    setActiveData(null);
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
      if (activeData.typeId && overData.day && overData.weekStart) {
        addItem({ typeId: activeData.typeId, day: overData.day, weekStart: overData.weekStart, value: 1 });
      }
    } else if (activeData.kind === 'subtag' && overData.kind === 'column') {
      if (activeData.typeId && activeData.tag && overData.day && overData.weekStart) {
        addItem({ typeId: activeData.typeId, workoutType: activeData.tag, day: overData.day, weekStart: overData.weekStart, value: 1 });
      }
    } else if (activeData.kind === 'item') {
      const activeItem = items.find(i => i.id === activeData.itemId);
      if (!activeItem) return;

      if (overData.kind === 'item') {
        const overItem = items.find(i => i.id === overData.itemId);
        if (!overItem) return;
        if (activeItem.day === overItem.day && activeItem.weekStart === overItem.weekStart) {
          // Same column
          const dayItems = items.filter(i => i.day === activeItem.day && i.weekStart === activeItem.weekStart);
          const oldIndex = dayItems.findIndex(i => i.id === activeItem.id);
          const newIndex = dayItems.findIndex(i => i.id === overItem.id);
          if (oldIndex !== newIndex) {
            reorderDay(activeItem.day, activeItem.weekStart, oldIndex, newIndex);
          }
        } else {
          // Different column, insert at specific index
          const targetDayItems = items.filter(i => i.day === overItem.day && i.weekStart === overItem.weekStart);
          const newIndex = targetDayItems.findIndex(i => i.id === overItem.id);
          moveItem(activeItem.id, overItem.day, overItem.weekStart, newIndex);
        }
      } else if (overData.kind === 'column') {
        if (overData.day && overData.weekStart && (activeItem.day !== overData.day || activeItem.weekStart !== overData.weekStart)) {
          moveItem(activeItem.id, overData.day, overData.weekStart);
        }
      }
    }
  };

  return { activeId, activeData, handleDragStart, handleDragEnd, handleDragCancel };
}
