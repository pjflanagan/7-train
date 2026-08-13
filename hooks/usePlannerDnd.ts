import { useState } from 'react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { usePlannerStore } from '@/lib/store';
import { DAYS } from '@/lib/constants';
import { defaultEventValue } from '@/lib/progress';

export interface PlannerDndData {
  kind: 'activity' | 'subtag' | 'event' | 'column';
  typeId?: string;
  tag?: string;
  eventId?: string;
  day?: typeof DAYS[number];
  weekStart?: string;
}

export function usePlannerDnd() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<PlannerDndData | null>(null);

  const addEvent = usePlannerStore(state => state.addEvent);
  const moveEvent = usePlannerStore(state => state.moveEvent);
  const reorderDay = usePlannerStore(state => state.reorderDay);
  const events = usePlannerStore(state => state.events);
  const activities = usePlannerStore(state => state.activities);
  const weeklyTargets = usePlannerStore(state => state.weeklyTargets);

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

    if (activeData.kind === 'activity' && overData.kind === 'column') {
      if (activeData.typeId && overData.day && overData.weekStart) {
        const activity = activities.find(a => a.id === activeData.typeId);
        const value = activity ? defaultEventValue(activity, overData.weekStart, weeklyTargets, activities) : 1;
        addEvent({ typeId: activeData.typeId, day: overData.day, weekStart: overData.weekStart, value });
      }
    } else if (activeData.kind === 'subtag' && overData.kind === 'column') {
      if (activeData.typeId && activeData.tag && overData.day && overData.weekStart) {
        const activity = activities.find(a => a.id === activeData.typeId);
        const value = activity ? defaultEventValue(activity, overData.weekStart, weeklyTargets, activities) : 1;
        addEvent({ typeId: activeData.typeId, workoutType: activeData.tag, day: overData.day, weekStart: overData.weekStart, value });
      }
    } else if (activeData.kind === 'event') {
      const activeEvent = events.find(i => i.id === activeData.eventId);
      if (!activeEvent) return;

      if (overData.kind === 'event') {
        const overEvent = events.find(i => i.id === overData.eventId);
        if (!overEvent) return;
        if (activeEvent.day === overEvent.day && activeEvent.weekStart === overEvent.weekStart) {
          // Same column
          const dayEvents = events.filter(i => i.day === activeEvent.day && i.weekStart === activeEvent.weekStart);
          const oldIndex = dayEvents.findIndex(i => i.id === activeEvent.id);
          const newIndex = dayEvents.findIndex(i => i.id === overEvent.id);
          if (oldIndex !== newIndex) {
            reorderDay(activeEvent.day, activeEvent.weekStart, oldIndex, newIndex);
          }
        } else {
          // Different column, insert at specific index
          const targetDayEvents = events.filter(i => i.day === overEvent.day && i.weekStart === overEvent.weekStart);
          const newIndex = targetDayEvents.findIndex(i => i.id === overEvent.id);
          moveEvent(activeEvent.id, overEvent.day, overEvent.weekStart, newIndex);
        }
      } else if (overData.kind === 'column') {
        if (overData.day && overData.weekStart && (activeEvent.day !== overData.day || activeEvent.weekStart !== overData.weekStart)) {
          moveEvent(activeEvent.id, overData.day, overData.weekStart);
        }
      }
    }
  };

  return { activeId, activeData, handleDragStart, handleDragEnd, handleDragCancel };
}
