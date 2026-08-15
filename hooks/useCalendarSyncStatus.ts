'use client';

import { create } from 'zustand';

/**
 * Where calendar sync is up to, kept outside the sync hook itself.
 *
 * `useCalendarSync` runs once, at the top of the planner. The integrations
 * modal is somewhere else entirely and still needs to show what sync is doing
 * and ask for a fresh pull, so the status lives in a store both can reach.
 */
export type CalendarSyncStatus = 'off' | 'pulling' | 'syncing' | 'synced' | 'error';

interface CalendarSyncState {
  status: CalendarSyncStatus;
  /** Bumped to ask the running sync for a fresh pull. */
  resyncNonce: number;
  /** Bumped to make the running sync forget what it has already written. */
  baselineNonce: number;
  setStatus: (status: CalendarSyncStatus) => void;
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
  resyncNonce: 0,
  baselineNonce: 0,
  setStatus: (status) => set({ status }),
  resync: () => set((state) => ({ resyncNonce: state.resyncNonce + 1 })),
  forgetBaseline: () => set((state) => ({ baselineNonce: state.baselineNonce + 1 })),
}));

export function useCalendarSyncStatus() {
  const status = useCalendarSyncStore((state) => state.status);
  const resync = useCalendarSyncStore((state) => state.resync);
  return { status, resync };
}
