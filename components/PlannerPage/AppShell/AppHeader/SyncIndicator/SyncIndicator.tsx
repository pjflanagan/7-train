'use client';

import React from 'react';
import clsx from 'clsx';
import { MdSync, MdSyncProblem } from 'react-icons/md';
import { useCalendarSyncStatus } from '@/hooks/useCalendarSyncStatus';
import styles from './SyncIndicator.module.scss';

const LABEL = {
  pulling: 'Reading your calendar…',
  syncing: 'Saving to your calendar…',
  error: 'Could not sync — try again',
} as const;

/**
 * Whether calendar sync is doing anything, in the header.
 *
 * Deliberately quiet: it appears while sync is working and when it has failed,
 * and shows nothing at all when everything is up to date or the calendar is not
 * connected. A permanent green tick would be noise on every screen.
 *
 * A failure is a button, because the only useful response to it is to retry.
 */
export const SyncIndicator: React.FC = () => {
  const { status, resync } = useCalendarSyncStatus();

  if (status === 'off' || status === 'synced') return null;

  const isError = status === 'error';
  const label = LABEL[status];

  if (isError) {
    return (
      <button
        type="button"
        className={clsx(styles.indicator, styles.error)}
        onClick={resync}
        aria-label={label}
        title={label}
      >
        <MdSyncProblem aria-hidden="true" />
      </button>
    );
  }

  return (
    <span
      className={styles.indicator}
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
    >
      <MdSync className={styles.spinning} aria-hidden="true" />
    </span>
  );
};
