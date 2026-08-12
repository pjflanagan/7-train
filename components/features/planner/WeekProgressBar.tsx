import React from 'react';
import { useWeekProgress } from '../../../hooks/useWeekProgress';
import { ProgressBar } from '../../elements/ProgressBar/ProgressBar';
import styles from './WeekProgressBar.module.scss';

export function WeekProgressBar({ week }: { week: 1 | 2 }) {
  const { overall } = useWeekProgress(week);
  return (
    <div className={styles.container}>
      <span className={styles.label}>Progress: {Math.round(overall.percent)}%</span>
      <ProgressBar percent={overall.percent} color="var(--accent-primary)" />
    </div>
  );
}