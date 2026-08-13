'use client';

import React from 'react';
import { MobileDayCard } from './MobileDayCard/MobileDayCard';
import { useInfiniteDays, DAY_PAGE_SIZE } from '@/hooks/useInfiniteDays';
import { formatDateLocal } from '@/lib/dates';
import styles from './MobileDayFeed.module.scss';

/**
 * The mobile planner: a read-only day-by-day scroll that starts on today.
 * No week chrome, no goal strip, no editing — phones are for looking things up.
 */
export function MobileDayFeed() {
  const todayKey = formatDateLocal(new Date());
  const { days, scrollRef, todayRef, loadEarlier, loadLater } = useInfiniteDays({ todayKey });

  return (
    <div
      className={styles.scroller}
      ref={(node) => {
        scrollRef.current = node;
      }}
    >
      <button type="button" className={styles.loadMore} onClick={loadEarlier}>
        Show {DAY_PAGE_SIZE} earlier days
      </button>
      {days.map((dateKey) => (
        <div key={dateKey} ref={dateKey === todayKey ? todayRef : undefined}>
          <MobileDayCard dateKey={dateKey} todayKey={todayKey} />
        </div>
      ))}
      <button type="button" className={styles.loadMore} onClick={loadLater}>
        Show {DAY_PAGE_SIZE} more days
      </button>
    </div>
  );
}
