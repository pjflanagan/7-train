'use client';

import React from 'react';
import { useWeekProgress } from '@/hooks/useWeekProgress';
import styles from './WeekProgressBar.module.scss';

export function WeekProgressBar({ weekStart }: { weekStart: string }) {
  const { overall } = useWeekProgress(weekStart);
  const percent = Math.min(100, Math.max(0, overall.percent));

  // Nothing targeted this week, so there is no progress to be at.
  if (overall.total === 0) return null;

  return (
    <div
      className={styles.container}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Week progress"
    >
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.label}>{Math.round(percent)}%</span>
    </div>
  );
}
