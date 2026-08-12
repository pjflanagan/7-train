import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import clsx from 'clsx';
import styles from './SubTagChip.module.scss';

export function SubTagChip({
  tag,
  typeId,
  color,
  /** Already scheduled this week, so the chip drops its colour fill. */
  isScheduled,
}: {
  tag: string;
  typeId: string;
  color?: string;
  isScheduled?: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `subtag-${typeId}-${tag}`,
    data: { kind: 'subtag', typeId, tag },
  });

  return (
    <span
      ref={setNodeRef}
      className={clsx(styles.subtag, isScheduled && styles.isScheduled)}
      style={color && !isScheduled ? { backgroundColor: color } : undefined}
      {...listeners}
      {...attributes}
    >
      {tag}
    </span>
  );
}
