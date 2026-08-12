import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { WorkoutType } from '../../../lib/types';
import { useWeekProgress } from '../../../hooks/useWeekProgress';
import { usePlannerStore } from '../../../lib/store';
import { getIconByKey } from '../../../lib/icons';
import { InlineNumberInput } from '../../elements/InlineNumberInput/InlineNumberInput';
import { ProgressBar } from '../../elements/ProgressBar/ProgressBar';
import { SubTagChip } from './SubTagChip';
import styles from './GoalChip.module.scss';

export function GoalChip({ goal, week }: { goal: WorkoutType; week: 1 | 2 }) {
  const { progressMap } = useWeekProgress(week);
  const setGoalTarget = usePlannerStore(state => state.setGoalTarget);
  const progress = progressMap[goal.id];
  const Icon = getIconByKey(goal.icon);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `goal-${goal.id}`,
    data: { kind: 'goal', typeId: goal.id },
  });

  return (
    <div 
      ref={setNodeRef}
      className={styles.chip} 
      style={{ 
        borderColor: goal.color,
        opacity: isDragging ? 0.5 : 1 
      }}
    >
      <div className={styles.header} {...attributes} {...listeners} style={{ cursor: 'grab' }}>
        <Icon className={styles.icon} style={{ color: goal.color }} />
        <span className={styles.name}>{goal.name}</span>
      </div>
      <div className={styles.targetSection}>
        <InlineNumberInput
          value={goal.target || 0}
          onCommit={(val) => setGoalTarget(goal.id, val)}
          className={styles.targetInput}
        />
        <span className={styles.unit}>{goal.unit}</span>
      </div>
      <div className={styles.progressText}>
        {progress?.current || 0} / {goal.target || 0} {goal.unit}
      </div>
      <ProgressBar percent={progress?.percent || 0} color={goal.color} className={styles.progressBar} />
      {goal.workoutTypes && goal.workoutTypes.length > 0 && (
        <div className={styles.tags}>
          {goal.workoutTypes.map(tag => (
            <SubTagChip key={tag} tag={tag} typeId={goal.id} />
          ))}
        </div>
      )}
    </div>
  );
}