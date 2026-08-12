import React from 'react';
import { useGoals } from '@/hooks/usePlannerSelectors';
import { GoalChip } from './GoalChip';
import styles from './GoalStrip.module.scss';

export function GoalStrip({ weekStart }: { weekStart: string }) {
  const goals = useGoals();
  return (
    <div className={styles.strip}>
      {goals.map(goal => (
        <GoalChip key={goal.id} goal={goal} weekStart={weekStart} />
      ))}
    </div>
  );
}