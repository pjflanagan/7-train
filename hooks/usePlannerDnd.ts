import { useState } from 'react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { usePlannerStore } from '@/lib/store';
import { DAYS } from '@/lib/constants';
import { defaultEventValue, activitiesForWeek } from '@/lib/progress';

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
  const events = usePlannerStore(state => state.events);
  // Dragging an activity onto a day drops the week's own copy of it, so the
  // starting value comes off what that week is aiming at.
  const weekActivities = usePlannerStore(state => state.weekActivities);

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
        const weekList = activitiesForWeek(overData.weekStart, weekActivities);
        const activity = weekList.find(a => a.id === activeData.typeId);
        const value = activity ? defaultEventValue(activity, weekList) : 1;
        addEvent({ typeId: activeData.typeId, day: overData.day, weekStart: overData.weekStart, value });
      }
    } else if (activeData.kind === 'subtag' && overData.kind === 'column') {
      if (activeData.typeId && activeData.tag && overData.day && overData.weekStart) {
        const weekList = activitiesForWeek(overData.weekStart, weekActivities);
        const activity = weekList.find(a => a.id === activeData.typeId);
        const value = activity ? defaultEventValue(activity, weekList) : 1;
        addEvent({ typeId: activeData.typeId, workoutType: activeData.tag, day: overData.day, weekStart: overData.weekStart, value });
      }
    } else if (activeData.kind === 'event') {
      const activeEvent = events.find(i => i.id === activeData.eventId);
      if (!activeEvent) return;

      // Dragging a workout only ever answers "which day". Whatever is under the
      // pointer names one — every draggable and droppable in the planner
      // carries the day it belongs to — so where in that day it was dropped
      // does not come into it: the day's order is its start times, and those
      // are the calendar's.
      const { day, weekStart } = overData;
      if (!day || !weekStart) return;
      if (activeEvent.day === day && activeEvent.weekStart === weekStart) return;

      moveEvent(activeEvent.id, day, weekStart);
    }
  };

  return { activeId, activeData, handleDragStart, handleDragEnd, handleDragCancel };
}
