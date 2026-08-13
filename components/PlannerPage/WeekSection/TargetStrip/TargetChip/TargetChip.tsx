'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { useDraggable } from '@dnd-kit/core';
import { MdLink } from 'react-icons/md';
import { Activity } from '@/lib/types';
import { useWeekProgress } from '@/hooks/useWeekProgress';
import { useScheduledSubTags } from '@/hooks/usePlannerSelectors';
import { usePlannerStore } from '@/lib/store';
import { getIconByKey } from '@/lib/icons';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import { RemovableCard } from '@/components/elements/RemovableCard/RemovableCard';
import { ActivityLinksPickerModal } from '@/components/PlannerPage/ActivityLinksPickerModal/ActivityLinksPickerModal';
import { SubTagChip } from './SubTagChip/SubTagChip';
import styles from './TargetChip.module.scss';

export function TargetChip({ activity, weekStart }: { activity: Activity; weekStart: string }) {
  const { progressMap } = useWeekProgress(weekStart);
  const setActivityTarget = usePlannerStore(state => state.setActivityTarget);
  const removeWeekActivity = usePlannerStore(state => state.removeWeekActivity);
  const progress = progressMap[activity.id];
  const scheduledSubTags = useScheduledSubTags(weekStart, activity.id);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const hasLinks = Boolean(activity.links && activity.links.length > 0);
  // Sub-types are the only thing that ever went below the band, so without them
  // the chip is the band and nothing else.
  const hasBody = Boolean(activity.workoutTypes && activity.workoutTypes.length > 0);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    // Every week renders its own strip, so the id has to carry the week —
    // duplicate draggable ids make dnd-kit resolve the drag to whichever copy
    // registered last (the bottom-most week).
    id: `activity-${weekStart}-${activity.id}`,
    data: { kind: 'activity', typeId: activity.id, weekStart },
  });

  return (
    <RemovableCard
      // The chip is a grid item in the rail, so the wrapper is what has to
      // claim both rows when the chip is a tall one.
      className={clsx(hasBody && styles.hasBody)}
      label={`Remove ${activity.name} from this week`}
      onRemove={() => removeWeekActivity(weekStart, activity.id)}
    >
    <div
      ref={setNodeRef}
      className={styles.chip}
      style={{ '--activity-color': activity.color, opacity: isDragging ? 0.5 : 1 } as React.CSSProperties}
    >
      <div className={styles.header} {...attributes} {...listeners}>
        {/* The tally's progress fills the band it is written on, so the week's
            standing costs no vertical room of its own. */}
        {!activity.optional && (
          <span
            className={styles.progressFill}
            style={{ width: `${Math.min(100, Math.max(0, progress?.percent || 0))}%` }}
            aria-hidden="true"
          />
        )}
        <span className={styles.iconBadge}>
          {React.createElement(getIconByKey(activity.icon), { className: styles.icon })}
        </span>
        <span className={styles.name}>{activity.name}</span>
        {hasLinks && (
          <IconButton
            size="sm"
            className={styles.linkButton}
            aria-label={`${activity.name} links`}
            title="Links"
            // The header is the drag handle, so the button has to keep its own
            // pointer events from starting a drag.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setIsLinksOpen(true);
            }}
          >
            <MdLink />
          </IconButton>
        )}
        {/* Optional workouts have no weekly target, so there is no tally to
            run against and no progress to draw — the tag says so instead. */}
        {activity.optional ? (
          <span className={styles.optionalTag}>Optional</span>
        ) : (
          <span className={styles.tally}>
            {progress?.current || 0} /
            <InlineNumberInput
              value={progress?.target ?? activity.target ?? 0}
              onCommit={(val) => setActivityTarget(activity.id, val, weekStart)}
              className={styles.targetInput}
              aria-label={`${activity.name} target`}
            />
            {activity.unit}
          </span>
        )}
      </div>
      {hasBody && (
        <div className={styles.tags}>
          {activity.workoutTypes?.map(tag => (
            <SubTagChip
              key={tag}
              tag={tag}
              typeId={activity.id}
              weekStart={weekStart}
              color={activity.color}
              isScheduled={scheduledSubTags.has(tag)}
            />
          ))}
        </div>
      )}
      {hasLinks && (
        <ActivityLinksPickerModal
          isOpen={isLinksOpen}
          onClose={() => setIsLinksOpen(false)}
          activity={activity}
        />
      )}
    </div>
    </RemovableCard>
  );
}