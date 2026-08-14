import React from 'react';
import { DndContext, useSensor, useSensors, PointerSensor, TouchSensor, KeyboardSensor, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { usePlannerDnd } from '@/hooks/usePlannerDnd';
import { usePlannerStore } from '@/lib/store';
import { snapCenterToCursor } from '@/lib/dndModifiers';
import { DragPreviewCard } from './DragPreviewCard/DragPreviewCard';

export function PlannerDndProvider({ children }: { children: React.ReactNode }) {
  const { activeId, activeData, handleDragStart, handleDragEnd, handleDragCancel } =
    usePlannerDnd();

  // Auto-scroll stays off — the week feed pages more weeks in as it scrolls,
  // so a drag that scrolls the feed loads content the drag never asked for.
  // The feed is otherwise left alone: dnd-kit re-measures droppables on scroll.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // A scheduled card only carries its event id, so the workout type has to be
  // looked up to draw the same preview as a strip drag.
  const draggedEvent = usePlannerStore(state =>
    activeData?.kind === 'event'
      ? state.events.find(i => i.id === activeData.eventId)
      : undefined
  );

  // Every drag happens inside one week, and an activity is only ever that
  // week's copy of it, so the preview has to be told which week to read.
  const preview =
    activeData?.kind === 'event'
      ? {
          typeId: draggedEvent?.typeId,
          weekStart: draggedEvent?.weekStart,
          tag: draggedEvent?.workoutType ?? undefined,
          activitySnapshot: draggedEvent?.activitySnapshot,
          activityFrozen: draggedEvent?.activityFrozen,
        }
      : { typeId: activeData?.typeId, weekStart: activeData?.weekStart, tag: activeData?.tag };

  return (
    <DndContext
      autoScroll={false}
      sensors={sensors}
      // The overlay is re-centered on the pointer (see snapCenterToCursor), so
      // hit-testing has to follow the same point rather than the source
      // element's own translated rect — otherwise the drop target and the
      // visible chip disagree about where the drag actually is.
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeId ? (
          <DragPreviewCard
            typeId={preview.typeId}
            weekStart={preview.weekStart}
            tag={preview.tag}
            activitySnapshot={'activitySnapshot' in preview ? preview.activitySnapshot : undefined}
            activityFrozen={'activityFrozen' in preview ? preview.activityFrozen : undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
