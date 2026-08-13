import type { Modifier } from '@dnd-kit/core';
import { getEventCoordinates } from '@dnd-kit/utilities';

/**
 * Re-centers the drag overlay on the pointer, instead of dnd-kit's default of
 * keeping it wherever it was grabbed on the source element. A wide card
 * (a target chip's header, an event's drag band) can be grabbed far from its
 * icon, and without this the overlay trails behind by that same offset —
 * putting it a column or more away from where the drop actually lands.
 */
export const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !activatorEvent) return transform;

  const activatorCoordinates = getEventCoordinates(activatorEvent);
  if (!activatorCoordinates) return transform;

  const offsetX = activatorCoordinates.x - draggingNodeRect.left;
  const offsetY = activatorCoordinates.y - draggingNodeRect.top;

  return {
    ...transform,
    x: transform.x + offsetX - draggingNodeRect.width / 2,
    y: transform.y + offsetY - draggingNodeRect.height / 2
  };
};
