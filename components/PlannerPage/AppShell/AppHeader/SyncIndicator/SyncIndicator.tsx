'use client';

import React from 'react';
import clsx from 'clsx';
import { MdCheck, MdSave, MdSync, MdSyncProblem } from 'react-icons/md';
import {
  CalendarSyncStatus,
  SYNC_DEBOUNCE_MS,
  useCalendarSyncStatus,
} from '@/hooks/useCalendarSyncStatus';
import { COPY } from '@/lib/copy';
import styles from './SyncIndicator.module.scss';

/** Keyed by the status union, so a new state cannot forget to bring an icon. */
const ICONS: Record<CalendarSyncStatus, React.ComponentType<{ className?: string }>> = {
  off: MdSync,
  pending: MdSave,
  pulling: MdSync,
  syncing: MdSync,
  synced: MdCheck,
  error: MdSyncProblem,
};

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
  // Pulling and pushing are both "talking to Google" as far as the header is
  // concerned, so they share a label and an icon.
  const Icon = ICONS[status];

  const content = (
    <>
      <span className={styles.text}>{COPY.sync.label[status]}</span>
      <Icon
        className={clsx(styles.icon, isBusy && styles.spinning)}
        aria-hidden="true"
      />
    </>
  );

  return (
    <button
      type="button"
      className={clsx(styles.pill, status === 'error' && styles.error)}
      onClick={resync}
      disabled={isBusy}
      title={status === 'error' ? COPY.sync.actionError : COPY.sync.action}
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
