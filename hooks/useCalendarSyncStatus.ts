'use client';

import { create } from 'zustand';

/**
 * Where calendar sync is up to, kept outside the sync hook itself.
 *
 * `useCalendarSync` runs once, at the top of the planner. The integrations
 * modal is somewhere else entirely and still needs to show what sync is doing
 * and ask for a fresh pull, so the status lives in a store both can reach.
 */
/**
 * How long a change sits before it is sent. Long enough that a run of edits is
 * one write rather than twenty, and long enough to be worth showing: the header
 * counts this window down so the wait is visible rather than mysterious.
 */
export const SYNC_DEBOUNCE_MS = 5000;

export type CalendarSyncStatus =
  | 'off'
  /** Edited, not yet sent — the debounce window is running. */
  | 'pending'
  | 'pulling'
  | 'syncing'
  | 'synced'
  | 'error';

interface CalendarSyncState {
  status: CalendarSyncStatus;
  /**
   * When the current wait started, as a timestamp. Each new edit restarts the
   * debounce, and changing this is what restarts the countdown drawn around the
   * indicator — a CSS animation only replays if the element it is on is new.
   */
  pendingSince: number;
  /** Bumped to ask the running sync for a fresh pull. */
  resyncNonce: number;
  /** Bumped to make the running sync forget what it has already written. */
  baselineNonce: number;
  setStatus: (status: CalendarSyncStatus) => void;
  /** Something changed locally; the wait before sending it starts now. */
  markPending: () => void;
  resync: () => void;
  /**
   * Drop the record of what Google already holds, without touching Google.
   *
   * Wiping the plan locally would otherwise read as "every workout was
   * deleted", and the next push would delete them all from the calendar too.
   * Clearing the plan is a local act; the calendar is left as it is, and a
   * later pull can bring it back.
   */
  forgetBaseline: () => void;
}

export const useCalendarSyncStore = create<CalendarSyncState>((set) => ({
  status: 'off',
  pendingSince: 0,
  resyncNonce: 0,
  baselineNonce: 0,
  setStatus: (status) => set({ status }),
  markPending: () => set({ status: 'pending', pendingSince: Date.now() }),
  resync: () => set((state) => ({ resyncNonce: state.resyncNonce + 1 })),
  forgetBaseline: () => set((state) => ({ baselineNonce: state.baselineNonce + 1 })),
}));

export function useCalendarSyncStatus() {
  const status = useCalendarSyncStore((state) => state.status);
  const pendingSince = useCalendarSyncStore((state) => state.pendingSince);
  const resync = useCalendarSyncStore((state) => state.resync);
  return { status, pendingSince, resync };
}
