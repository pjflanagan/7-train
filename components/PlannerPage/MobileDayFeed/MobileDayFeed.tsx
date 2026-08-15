'use client';

import React from 'react';
import { LuArrowUp, LuArrowDown } from 'react-icons/lu';
import { MobileDayCard } from './MobileDayCard/MobileDayCard';
import { useInfiniteDays } from '@/hooks/useInfiniteDays';
import { formatDateLocal } from '@/lib/dates';
import styles from './MobileDayFeed.module.scss';

/**
 * The mobile planner: a read-only day-by-day scroll that starts on today.
 * No week chrome, no activity strip, no editing — phones are for looking things up.
 */
export function MobileDayFeed() {
  const todayKey = formatDateLocal(new Date());
  const {
    days,
    scrollRef,
    todayRef,
    loadEarlier,
    loadLater,
    isTodayVisible,
    todayDirection,
    scrollToToday,
  } = useInfiniteDays({ todayKey });

  return (
    <div className={styles.feed}>
      <div
        className={styles.scroller}
        ref={(node) => {
          scrollRef.current = node;
        }}
      >
        <button type="button" className={styles.loadMore} onClick={loadEarlier}>
          Show more past days
        </button>
        {days.map((dateKey) => (
          <div key={dateKey} ref={dateKey === todayKey ? todayRef : undefined}>
            <MobileDayCard dateKey={dateKey} todayKey={todayKey} />
          </div>
        ))}
        <button type="button" className={styles.loadMore} onClick={loadLater}>
          Show more upcoming days
        </button>
      </div>

      {!isTodayVisible && (
        <button
          type="button"
          className={styles.jumpToToday}
          onClick={() => scrollToToday()}
        >
          {todayDirection === 'up' ? (
            <LuArrowUp size={16} aria-hidden="true" />
          ) : (
            <LuArrowDown size={16} aria-hidden="true" />
          )}
          Today
        </button>
      )}
    </div>
  );
}
