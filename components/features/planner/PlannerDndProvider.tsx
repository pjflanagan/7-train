import React from 'react';
import { DndContext, useSensor, useSensors, PointerSensor, TouchSensor, KeyboardSensor, DragOverlay } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { usePlannerDnd } from '../../../hooks/usePlannerDnd';
import { DragPreviewCard } from './DragPreviewCard';

export function PlannerDndProvider({ children }: { children: React.ReactNode }) {
  const { activeId, activeData, handleDragStart, handleDragEnd } = usePlannerDnd();
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  let dragName = 'Item';
  if (activeData) {
     if (activeData.kind === 'goal') dragName = 'Goal';
     if (activeData.kind === 'subtag') dragName = activeData.tag || 'Subtag';
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {children}
      <DragOverlay>
        {activeId ? <DragPreviewCard name={dragName} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
