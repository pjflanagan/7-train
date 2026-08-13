'use client';

import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { MdLink } from 'react-icons/md';
import { WorkoutType } from '@/lib/types';
import { useWeekProgress } from '@/hooks/useWeekProgress';
import { useScheduledSubTags } from '@/hooks/usePlannerSelectors';
import { usePlannerStore } from '@/lib/store';
import { getIconByKey } from '@/lib/icons';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import { ProgressBar } from '@/components/elements/ProgressBar/ProgressBar';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import { GoalLinksPickerModal } from '@/components/features/goals/GoalLinksPickerModal';
import { SubTagChip } from './SubTagChip';
import styles from './GoalChip.module.scss';

export function GoalChip({ goal, weekStart }: { goal: WorkoutType; weekStart: string }) {
  const { progressMap } = useWeekProgress(weekStart);
  const setGoalTarget = usePlannerStore(state => state.setGoalTarget);
  const progress = progressMap[goal.id];
  const scheduledSubTags = useScheduledSubTags(weekStart, goal.id);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const hasLinks = Boolean(goal.links && goal.links.length > 0);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    // Every week renders its own strip, so the id has to carry the week —
    // duplicate draggable ids make dnd-kit resolve the drag to whichever copy
    // registered last (the bottom-most week).
    id: `goal-${weekStart}-${goal.id}`,
    data: { kind: 'goal', typeId: goal.id },
  });

  return (
    <div 
      ref={setNodeRef}
      className={styles.chip} 
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className={styles.header} {...attributes} {...listeners}>
        <span className={styles.iconBadge} style={{ backgroundColor: goal.color }}>
          {React.createElement(getIconByKey(goal.icon), { className: styles.icon })}
        </span>
        <span className={styles.name}>{goal.name}</span>
        {hasLinks && (
          <IconButton
            size="sm"
            className={styles.linkButton}
            aria-label={`${goal.name} links`}
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
        {goal.optional ? (
          <span className={styles.optionalTag}>Optional</span>
        ) : (
          <span className={styles.tally}>
            {progress?.current || 0} /
            <InlineNumberInput
              value={progress?.target ?? goal.target ?? 0}
              onCommit={(val) => setGoalTarget(goal.id, val, weekStart)}
              className={styles.targetInput}
              aria-label={`${goal.name} target`}
            />
            {goal.unit}
          </span>
        )}
      </div>
      {goal.workoutTypes && goal.workoutTypes.length > 0 && (
        <div className={styles.tags}>
          {goal.workoutTypes.map(tag => (
            <SubTagChip
              key={tag}
              tag={tag}
              typeId={goal.id}
              weekStart={weekStart}
              color={goal.color}
              isScheduled={scheduledSubTags.has(tag)}
            />
          ))}
        </div>
      )}
      {/* The bar closes the chip, under the sub-type pills it summarises. */}
      {!goal.optional && (
        <ProgressBar percent={progress?.percent || 0} color={goal.color} className={styles.progressBar} />
      )}
      {hasLinks && (
        <GoalLinksPickerModal
          isOpen={isLinksOpen}
          onClose={() => setIsLinksOpen(false)}
          goal={goal}
        />
      )}
    </div>
  );
}