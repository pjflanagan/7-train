import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import styles from './SubTagChip.module.scss';

export function SubTagChip({ tag, typeId, color }: { tag: string; typeId: string; color?: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `subtag-${typeId}-${tag}`,
    data: { kind: 'subtag', typeId, tag },
  });

  return (
    <span
      ref={setNodeRef}
      className={styles.subtag}
      style={color ? { backgroundColor: color } : undefined}
      {...listeners}
      {...attributes}
    >
      {tag}
    </span>
  );
}
