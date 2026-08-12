import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import styles from './SubTagChip.module.scss';

export function SubTagChip({ tag, typeId }: { tag: string; typeId: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `subtag-${typeId}-${tag}`,
    data: { kind: 'subtag', typeId, tag },
  });

  return (
    <span
      ref={setNodeRef}
      className={styles.subtag}
      {...listeners}
      {...attributes}
    >
      {tag}
    </span>
  );
}
