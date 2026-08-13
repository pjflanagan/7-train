'use client';

import React, { useEffect } from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { useActivities } from '@/hooks/usePlannerSelectors';
import { useHorizontalOverflow } from '@/hooks/useHorizontalOverflow';
import { TargetChip } from './TargetChip/TargetChip';
import styles from './TargetStrip.module.scss';

export function TargetStrip({ weekStart }: { weekStart: string }) {
  const activities = useActivities();
  const { ref, canScrollLeft, canScrollRight, scrollBy, measure } =
    useHorizontalOverflow<HTMLDivElement>();

  // Adding or removing an activity changes scrollWidth without resizing the rail.
  useEffect(measure, [measure, activities.length]);

  return (
    <div className={styles.wrapper}>
      {canScrollLeft && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.left}`}
          aria-label="Scroll targets left"
          onClick={() => scrollBy(-1)}
        >
          <MdChevronLeft size={20} />
        </button>
      )}

      <div className={styles.strip} ref={ref}>
        {activities.map(activity => (
          <TargetChip key={activity.id} activity={activity} weekStart={weekStart} />
        ))}
      </div>

      {canScrollRight && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.right}`}
          aria-label="Scroll targets right"
          onClick={() => scrollBy(1)}
        >
          <MdChevronRight size={20} />
        </button>
      )}
    </div>
  );
}
