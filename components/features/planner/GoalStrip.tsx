import React from 'react';
import { useGoals } from '../../../hooks/usePlannerStore';
import { GoalChip } from './GoalChip';
import styles from './GoalStrip.module.scss';

export function GoalStrip({ week }: { week: 1 | 2 }) {
  const goals = useGoals();
  return (
    <div className={styles.strip}>
      {goals.map(goal => (
        <GoalChip key={goal.id} goal={goal} week={week} />
      ))}
    </div>
  );
}