import React, { useEffect } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor, TouchSensor, KeyboardSensor, DragOverlay } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { usePlannerDnd } from '@/hooks/usePlannerDnd';
import { usePlannerStore } from '@/lib/store';
import { DragPreviewCard } from './DragPreviewCard';

export function PlannerDndProvider({ children }: { children: React.ReactNode }) {
  const { activeId, activeData, handleDragStart, handleDragEnd } = usePlannerDnd();

  // The week feed must hold still while something is in the air: dnd-kit's
  // auto-scroll is off, and the page itself is frozen via a root-level class
  // so wheel and touch scrolling cannot move the drop targets either.
  useEffect(() => {
    const root = document.documentElement;
    if (activeId) root.classList.add('is-dragging');
    else root.classList.remove('is-dragging');
    return () => root.classList.remove('is-dragging');
  }, [activeId]);
  
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
    <DndContext autoScroll={false} sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {children}
      <DragOverlay dropAnimation={null}>
        {activeId ? <DragPreviewCard typeId={preview.typeId} tag={preview.tag} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
