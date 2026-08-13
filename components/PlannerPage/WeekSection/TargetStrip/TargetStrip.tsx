'use client';

import React, { useEffect } from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { useWeekActivities } from '@/hooks/usePlannerSelectors';
import { useHorizontalOverflow } from '@/hooks/useHorizontalOverflow';
import { addWeeks } from '@/lib/dates';
import { TargetChip } from './TargetChip/TargetChip';
import { AddTargetCard } from './AddTargetCard/AddTargetCard';
import { CopyActivitiesCard } from './CopyActivitiesCard/CopyActivitiesCard';
import styles from './TargetStrip.module.scss';

export function TargetStrip({ weekStart }: { weekStart: string }) {
  const activities = useWeekActivities(weekStart);
  const isEmpty = activities.length === 0;
  // Offered only when there is actually something back there to pull forward.
  const hasPreviousTargets = useWeekActivities(addWeeks(weekStart, -1)).length > 0;
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

      {/* Nothing in the rail but the placeholders, and they are all one line
          tall — the second row would only ever hold empty space. */}
      <div className={`${styles.strip} ${isEmpty ? styles.isEmpty : ''}`} ref={ref}>
        {/* A week aiming at nothing yet leads with the template, since filling
            it from "my weekly targets" is how a week usually starts. */}
        {isEmpty && <CopyActivitiesCard weekStart={weekStart} from="default" />}
        {isEmpty && hasPreviousTargets && (
          <CopyActivitiesCard weekStart={weekStart} from="previous" />
        )}
        {activities.map(activity => (
          <TargetChip key={activity.id} activity={activity} weekStart={weekStart} />
        ))}
        {/* Last in the rail, and on an empty week the second of the two
            placeholders — so there is always somewhere to start. */}
        <AddTargetCard weekStart={weekStart} showLabel={isEmpty} />
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
