import React from 'react';
import { DAYS } from '@/lib/constants';
import { WeekProgressBar } from './WeekProgressBar';
import { GoalStrip } from './GoalStrip';
import { DayColumn } from './DayColumn';
import styles from './WeekSection.module.scss';

export interface WeekSectionProps {
  week: 1 | 2;
}

export function WeekSection({ week }: WeekSectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.header}>Week {week}</h2>
      <WeekProgressBar week={week} />
      <GoalStrip week={week} />
      <div className={styles.grid}>
        {DAYS.map(day => (
          <DayColumn key={day} day={day} week={week} />
        ))}
      </div>
    </div>
  );
}