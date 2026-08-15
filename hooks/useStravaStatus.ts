'use client';

import { create } from 'zustand';

/**
 * Where Strava sync is up to, kept outside the sync hook itself — same shape,
 * and for the same reason, as `useCalendarSyncStatus`: the hook runs once at
 * the top of the planner, and the integrations modal is somewhere else entirely
 * and still needs to show what it is doing and ask it to run again.
 */
export type StravaSyncStatus =
  /** Not connected in this browser, or not set up on this server. */
  | 'off'
  /** Connected, waiting for the calendar to settle before reading. */
  | 'waiting'
  | 'reading'
  | 'synced'
  | 'error';

interface StravaSyncState {
  status: StravaSyncStatus;
  /** How many recordings the last read wrote into the plan. */
  applied: number;
  /** Bumped to ask the running sync to read Strava again. */
  resyncNonce: number;
  setStatus: (status: StravaSyncStatus) => void;
  setApplied: (applied: number) => void;
  resync: () => void;
}

export const useStravaSyncStore = create<StravaSyncState>((set) => ({
  status: 'off',
  applied: 0,
  resyncNonce: 0,
  setStatus: (status) => set({ status }),
  setApplied: (applied) => set({ applied }),
  resync: () => set((state) => ({ resyncNonce: state.resyncNonce + 1 })),
}));

export function useStravaSyncStatus() {
  const status = useStravaSyncStore((state) => state.status);
  const applied = useStravaSyncStore((state) => state.applied);
  const resync = useStravaSyncStore((state) => state.resync);
  return { status, applied, resync };
}
