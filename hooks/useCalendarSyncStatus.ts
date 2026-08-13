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
  setStatus: (status: CalendarSyncStatus) => void;
  resync: () => void;
}

export const useCalendarSyncStore = create<CalendarSyncState>((set) => ({
  status: 'off',
  resyncNonce: 0,
  setStatus: (status) => set({ status }),
  resync: () => set((state) => ({ resyncNonce: state.resyncNonce + 1 })),
}));

export function useCalendarSyncStatus() {
  const status = useCalendarSyncStore((state) => state.status);
  const resync = useCalendarSyncStore((state) => state.resync);
  return { status, resync };
}
