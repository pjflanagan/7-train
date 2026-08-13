import React from 'react';
import { DndContext, useSensor, useSensors, PointerSensor, TouchSensor, KeyboardSensor, DragOverlay } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { usePlannerDnd } from '@/hooks/usePlannerDnd';
import { usePlannerStore } from '@/lib/store';
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

  const preview =
    activeData?.kind === 'event'
      ? { typeId: draggedEvent?.typeId, tag: draggedEvent?.workoutType ?? undefined }
      : { typeId: activeData?.typeId, tag: activeData?.tag };

  return (
    <DndContext
      autoScroll={false}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeId ? <DragPreviewCard typeId={preview.typeId} tag={preview.tag} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
