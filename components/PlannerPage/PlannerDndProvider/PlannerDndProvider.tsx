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

  // A scheduled card only carries its item id, so the workout type has to be
  // looked up to draw the same preview as a strip drag.
  const draggedItem = usePlannerStore(state =>
    activeData?.kind === 'item'
      ? state.items.find(i => i.id === activeData.itemId)
      : undefined
  );

  const preview =
    activeData?.kind === 'item'
      ? { typeId: draggedItem?.typeId, tag: draggedItem?.workoutType ?? undefined }
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
