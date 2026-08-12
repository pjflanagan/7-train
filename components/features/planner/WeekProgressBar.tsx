import React from 'react';
import { useWeekProgress } from '@/hooks/useWeekProgress';
import { ProgressBar } from '@/components/elements/ProgressBar/ProgressBar';
import styles from './WeekProgressBar.module.scss';

export function WeekProgressBar({ weekStart }: { weekStart: string }) {
  const { overall } = useWeekProgress(weekStart);
  return (
    <div className={styles.container}>
      <span className={styles.label}>Progress: {Math.round(overall.percent)}%</span>
      <ProgressBar percent={overall.percent} color="var(--accent-primary)" />
    </div>
  );
}