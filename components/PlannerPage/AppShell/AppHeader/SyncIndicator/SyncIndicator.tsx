'use client';

import React from 'react';
import clsx from 'clsx';
import { MdCheck, MdSave, MdSync, MdSyncProblem } from 'react-icons/md';
import { SYNC_DEBOUNCE_MS, useCalendarSyncStatus } from '@/hooks/useCalendarSyncStatus';
import styles from './SyncIndicator.module.scss';

/**
 * What calendar sync is doing, in the header, and the way to ask it to look
 * again.
 *
 * The three states are one story told in order: an edit is held for a moment,
 * then sent, then confirmed. The border travelling round the pill is the
 * holding period running out, so the wait reads as deliberate rather than as
 * the app having missed the change.
 *
 * Pressing it re-reads the calendar. Nothing polls Google — a workout moved in
 * Google Calendar shows up here when someone asks for it, which is what this
 * is for.
 */
export const SyncIndicator: React.FC = () => {
  const { status, pendingSince, resync } = useCalendarSyncStatus();

  if (status === 'off') return null;

  const isBusy = status === 'pulling' || status === 'syncing';

  const content =
    status === 'error' ? (
      <>
        <span className={styles.text}>Could not save</span>
        <MdSyncProblem className={styles.icon} aria-hidden="true" />
      </>
    ) : status === 'pending' ? (
      <>
        <span className={styles.text}>Unsaved changes</span>
        <MdSave className={styles.icon} aria-hidden="true" />
      </>
    ) : status === 'synced' ? (
      <>
        <span className={styles.text}>Saved</span>
        <MdCheck className={styles.icon} aria-hidden="true" />
      </>
    ) : (
      // Pulling and pushing are both "talking to Google" as far as the header
      // is concerned.
      <>
        <span className={styles.text}>Syncing…</span>
        <MdSync className={clsx(styles.icon, styles.spinning)} aria-hidden="true" />
      </>
    );

  return (
    <button
      type="button"
      className={clsx(styles.pill, status === 'error' && styles.error)}
      onClick={resync}
      disabled={isBusy}
      title={
        status === 'error'
          ? 'Could not save — press to try again'
          : 'Press to check your calendar for changes'
      }
    >
      {status === 'pending' ? (
        // Keyed on the moment the wait started, so every fresh edit replays the
        // sweep from nothing rather than continuing the last one.
        <span
          key={pendingSince}
          className={clsx(styles.border, styles.countdown)}
          style={{ animationDuration: `${SYNC_DEBOUNCE_MS}ms` }}
          aria-hidden="true"
        />
      ) : (
        <span className={styles.border} aria-hidden="true" />
      )}
      <span className={styles.face}>{content}</span>
    </button>
  );
};
