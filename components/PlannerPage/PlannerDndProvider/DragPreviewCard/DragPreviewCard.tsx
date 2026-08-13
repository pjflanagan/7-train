import React from 'react';
import { useGoal } from '@/hooks/usePlannerSelectors';
import { getIconByKey } from '@/lib/icons';
import styles from './DragPreviewCard.module.scss';

export interface DragPreviewCardProps {
  /** The workout type being dragged, when the drag carries one. */
  typeId?: string;
  /** Sub-tag, for a sub-tag drag — shown instead of the bare goal name. */
  tag?: string;
}

/** What rides under the cursor: the goal's icon, name, and colour. */
export function DragPreviewCard({ typeId, tag }: DragPreviewCardProps) {
  const goal = useGoal(typeId ?? '');

  if (!goal) return <div className={styles.preview}>{tag ?? 'Workout'}</div>;

  const Icon = getIconByKey(goal.icon);

  return (
    <div
      className={styles.preview}
      style={{ '--goal-color': goal.color } as React.CSSProperties}
    >
      <span className={styles.iconBadge}>
        <Icon className={styles.icon} />
      </span>
      <span className={styles.name}>{goal.name}</span>
      {tag && <span className={styles.tag}>{tag}</span>}
    </div>
  );
}
