'use client';

import React, { useEffect } from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { useGoals } from '@/hooks/usePlannerSelectors';
import { useHorizontalOverflow } from '@/hooks/useHorizontalOverflow';
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
          <MdChevronLeft size={20} />
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
          <MdChevronRight size={20} />
        </button>
      )}
    </div>
  );
}
