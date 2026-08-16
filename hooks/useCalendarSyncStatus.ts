'use client';

import { create } from 'zustand';
import { useGoogleAccount } from '@/hooks/useAuth';
import { useUserSettled } from '@/hooks/useUserSync';

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
   * Whether the first pull of this page load has come back — success or
   * failure. Anything that must not act on a stale schedule waits for this.
   *
   * `status` cannot answer that question, and the difference is the whole
   * reason this exists. `status` starts at `off` and reads `off` again for a
   * signed-out user, so "not syncing a calendar" and "has not started yet" are
   * the same value; and it returns to `synced` after every push, so `synced`
   * does not mean a pull ever happened. This only goes true once, and only
   * after a pull.
   */
  hasPulled: boolean;
  /**
   * Whether it is settled that this account has a calendar — or definitively
   * has none. False during the window where `useEnsureCalendar` is making one,
   * when there is no `googleCalendarId` yet but one is seconds away.
   */
  hasResolvedCalendar: boolean;
  setHasPulled: (hasPulled: boolean) => void;
  setHasResolvedCalendar: (hasResolved: boolean) => void;
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
  hasPulled: false,
  hasResolvedCalendar: false,
  resyncNonce: 0,
  baselineNonce: 0,
  setStatus: (status) => set({ status }),
  setHasPulled: (hasPulled) => set({ hasPulled }),
  setHasResolvedCalendar: (hasResolvedCalendar) => set({ hasResolvedCalendar }),
  markPending: () => set({ status: 'pending', pendingSince: Date.now() }),
  resync: () => set((state) => ({ resyncNonce: state.resyncNonce + 1 })),
  forgetBaseline: () => set((state) => ({ baselineNonce: state.baselineNonce + 1 })),
}));

/**
 * True once the schedule is as good as it is going to get this page load —
 * either the calendar's first pull has landed, or it is settled that no pull is
 * coming.
 *
 * Strava is read against this. Google Calendar owns what was *planned*, so a
 * read that beats the pull matches recordings against whatever happened to be
 * in `localStorage` and adds duplicates for the workouts the pull was about to
 * bring in.
 *
 * The previous gate — `status === 'off' || status === 'synced'` — was true on
 * the very first render, because `off` is the store's initial value. It let
 * Strava through immediately and every time, and read like a guard while being
 * none.
 *
 * "No pull is coming" has to account for the calendar arriving late: a signed
 * in user may have no `googleCalendarId` yet because `useEnsureCalendar` is
 * still making one, and treating that as "never" would be the same early read
 * by another route. So it is only settled once the account's own state is
 * settled and the calendar question has actually been answered.
 */
export function useCalendarSettled(): boolean {
  const hasPulled = useCalendarSyncStore((state) => state.hasPulled);
  const hasResolvedCalendar = useCalendarSyncStore((state) => state.hasResolvedCalendar);
  const isUserSettled = useUserSettled();
  const { isSignedIn, isLoading } = useGoogleAccount();

  if (hasPulled) return true;
  // Signed out is settled the moment we know it: there is no calendar to wait
  // for, and the plan in this browser is the whole of the schedule.
  if (isLoading) return false;
  if (!isSignedIn) return true;
  return isUserSettled && hasResolvedCalendar;
}

export function useCalendarSyncStatus() {
  const status = useCalendarSyncStore((state) => state.status);
  const pendingSince = useCalendarSyncStore((state) => state.pendingSince);
  const resync = useCalendarSyncStore((state) => state.resync);
  return { status, pendingSince, resync };
}
