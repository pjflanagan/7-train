import React from 'react';
import { useWeekActivities } from '@/hooks/usePlannerSelectors';
import { resolveEventActivity } from '@/lib/activitySnapshot';
import { ScheduledEvent } from '@/lib/types';
import { getIconByKey } from '@/lib/icons';
import styles from './DragPreviewCard.module.scss';

export interface DragPreviewCardProps {
  /** The workout type being dragged, when the drag carries one. */
  typeId?: string;
  /** The week the drag started in — an activity is always one week's copy. */
  weekStart?: string;
  /** Sub-tag, for a sub-tag drag — shown instead of the bare activity name. */
  tag?: string;
  /** The dragged event's own copy of its activity, when the drag carries one. */
  activitySnapshot?: ScheduledEvent['activitySnapshot'];
  /** Whether that copy has stopped tracking the week's activity. */
  activityFrozen?: boolean;
}

/** What rides under the cursor: the activity's icon, name, and colour. */
export function DragPreviewCard({
  typeId,
  weekStart,
  tag,
  activitySnapshot,
  activityFrozen
}: DragPreviewCardProps) {
  const activities = useWeekActivities(weekStart ?? '');
  const activity = resolveEventActivity(
    { typeId: typeId ?? '', activitySnapshot, activityFrozen },
    activities
  );

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
