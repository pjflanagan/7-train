import React from 'react';
import { useActivity } from '@/hooks/usePlannerSelectors';
import { getIconByKey } from '@/lib/icons';
import styles from './DragPreviewCard.module.scss';

export interface DragPreviewCardProps {
  /** The workout type being dragged, when the drag carries one. */
  typeId?: string;
  /** Sub-tag, for a sub-tag drag — shown instead of the bare activity name. */
  tag?: string;
}

/** What rides under the cursor: the activity's icon, name, and colour. */
export function DragPreviewCard({ typeId, tag }: DragPreviewCardProps) {
  const activity = useActivity(typeId ?? '');

  if (!activity) return <div className={styles.preview}>{tag ?? 'Workout'}</div>;

  const Icon = getIconByKey(activity.icon);

  return (
    <div
      className={styles.preview}
      style={{ '--activity-color': activity.color } as React.CSSProperties}
    >
      <span className={styles.iconBadge}>
        <Icon className={styles.icon} />
      </span>
      <span className={styles.name}>{activity.name}</span>
      {tag && <span className={styles.tag}>{tag}</span>}
    </div>
  );
}
