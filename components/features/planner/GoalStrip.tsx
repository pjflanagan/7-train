'use client';

import React, { useEffect } from 'react';
import { useGoals } from '@/hooks/usePlannerSelectors';
import { useHorizontalOverflow } from '@/hooks/useHorizontalOverflow';
import { MtaArrow } from '@/components/elements/MtaArrow/MtaArrow';
import { GoalChip } from './GoalChip';
import styles from './GoalStrip.module.scss';

export function GoalStrip({ weekStart }: { weekStart: string }) {
  const goals = useGoals();
  const { ref, canScrollLeft, canScrollRight, scrollBy, measure } =
    useHorizontalOverflow<HTMLDivElement>();

  // Adding or removing a goal changes scrollWidth without resizing the rail.
  useEffect(measure, [measure, goals.length]);

  return (
    <div className={styles.wrapper}>
      {canScrollLeft && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.left}`}
          aria-label="Scroll workouts left"
          onClick={() => scrollBy(-1)}
        >
          <MtaArrow direction="left" size={26} />
        </button>
      )}

      <div className={styles.strip} ref={ref}>
        {goals.map(goal => (
          <GoalChip key={goal.id} goal={goal} weekStart={weekStart} />
        ))}
      </div>

      {canScrollRight && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.right}`}
          aria-label="Scroll workouts right"
          onClick={() => scrollBy(1)}
        >
          <MtaArrow direction="right" size={26} />
        </button>
      )}
    </div>
  );
}
