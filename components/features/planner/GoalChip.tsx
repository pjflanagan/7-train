import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { WorkoutType } from '@/lib/types';
import { useWeekProgress } from '@/hooks/useWeekProgress';
import { useScheduledSubTags } from '@/hooks/usePlannerSelectors';
import { usePlannerStore } from '@/lib/store';
import { getIconByKey } from '@/lib/icons';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import { ProgressBar } from '@/components/elements/ProgressBar/ProgressBar';
import { SubTagChip } from './SubTagChip';
import styles from './GoalChip.module.scss';

export function GoalChip({ goal, weekStart }: { goal: WorkoutType; weekStart: string }) {
  const { progressMap } = useWeekProgress(weekStart);
  const setGoalTarget = usePlannerStore(state => state.setGoalTarget);
  const progress = progressMap[goal.id];
  const scheduledSubTags = useScheduledSubTags(weekStart, goal.id);

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
      <div className={styles.header} {...attributes} {...listeners} style={{ cursor: 'grab' }}>
        <span className={styles.iconBadge} style={{ backgroundColor: goal.color }}>
          {React.createElement(getIconByKey(goal.icon), { className: styles.icon })}
        </span>
        <span className={styles.name}>{goal.name}</span>
        <span className={styles.tally}>
          {progress?.current || 0} /
          <InlineNumberInput
            value={goal.target || 0}
            onCommit={(val) => setGoalTarget(goal.id, val)}
            className={styles.targetInput}
            aria-label={`${goal.name} target`}
          />
          {goal.unit}
        </span>
      </div>
      <ProgressBar percent={progress?.percent || 0} color={goal.color} className={styles.progressBar} />
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
    </div>
  );
}