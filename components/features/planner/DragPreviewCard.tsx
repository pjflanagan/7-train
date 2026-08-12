import React from 'react';
import styles from './DragPreviewCard.module.scss';

export function DragPreviewCard({ name }: { name: string }) {
  return (
    <div className={styles.preview}>
      {name}
    </div>
  );
}
