'use client';

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { toast } from 'sonner';
import { COPY } from '@/lib/copy';
import { usePlannerStore } from '@/lib/store';
import { usePlannerHydrated } from '@/hooks/usePlannerHydrated';
import { useCalendarSettled } from '@/hooks/useCalendarSyncStatus';
import { useStravaSyncStore } from '@/hooks/useStravaStatus';
import { buildActivitySnapshot } from '@/lib/activitySnapshot';
import { activitiesForWeek } from '@/lib/progress';
import { addWeeks, getWeekStartKey, parseDateLocal, WeekStartsOn } from '@/lib/dates';
import { STRAVA_WEEKS_BACK, StravaActivity, reconcileStrava } from '@/lib/strava';
import { stravaSportLabel } from '@/lib/stravaSports';

/**
 * Strava, read after the calendar and written into the plan.
 *
 * The order matters and is the whole reason this waits: Google Calendar is the
 * source of truth for what was planned, so reading Strava first would match
 * recordings against a stale schedule and add duplicates for workouts the pull
 * was about to bring in.
 */

interface StravaConnection {
  /** This browser holds a Strava connection. */
  isConnected: boolean;
  athleteName: string | null;
  /** True until the first status read settles — show nothing, not "connect". */
  isLoading: boolean;
  refresh: () => Promise<void>;
  disconnect: () => Promise<void>;
}

interface StravaConnectionState extends Omit<StravaConnection, 'refresh' | 'disconnect'> {
  /** Set while a status read is in flight, so mounting three readers is one call. */
  isReading: boolean;
  refresh: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useStravaConnectionStore = create<StravaConnectionState>((set, get) => ({
  isConnected: false,
  athleteName: null,
  isLoading: true,
  isReading: false,

  refresh: async () => {
    if (get().isReading) return;
    set({ isReading: true });
    try {
      const response = await fetch('/api/strava/status');
      if (!response.ok) throw new Error('Status read failed');
      const { isConnected, athleteName } = await response.json();
      set({ isConnected, athleteName, isLoading: false });
    } catch {
      // A status we cannot read is a status we cannot act on. Whether Strava is
      // configured at all comes from the server render, not from here.
      set({ isConnected: false, isLoading: false });
    } finally {
      set({ isReading: false });
    }
  },

  disconnect: async () => {
    await fetch('/api/strava/status', { method: 'DELETE' });
    set({ isConnected: false, athleteName: null });
    useStravaSyncStore.getState().setStatus('off');
  },
}));

/** The Strava connection, read once per page and shared by everyone who asks. */
export function useStravaConnection(): StravaConnection {
  const isConnected = useStravaConnectionStore((state) => state.isConnected);
  const athleteName = useStravaConnectionStore((state) => state.athleteName);
  const isLoading = useStravaConnectionStore((state) => state.isLoading);
  const refresh = useStravaConnectionStore((state) => state.refresh);
  const disconnect = useStravaConnectionStore((state) => state.disconnect);

  useEffect(() => {
    // Loading is the untouched state, and `refresh` clears it, so however many
    // components ask, the status is read once per page.
    if (useStravaConnectionStore.getState().isLoading) void refresh();
  }, [refresh]);

  return { isConnected, athleteName, isLoading, refresh, disconnect };
}

/**
 * Sends the browser to Strava's consent screen.
 *
 * A full page navigation, not a router push: `/api/strava/connect` is a route
 * handler that mints a `state` cookie and redirects off to strava.com, so there
 * is no page here for the client router to render.
 */
export function connectStrava(): void {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/api/strava/connect';
}

/**
 * Reads Strava and writes what it finds into the plan. Mount once, high in the
 * tree, next to `useCalendarSync` — anything that only wants to _watch_ it
 * should use `useStravaSyncStatus`.
 */
export function useStravaSync(): void {
  const isHydrated = usePlannerHydrated();
  const { isConnected } = useStravaConnection();
  // Google Calendar owns the schedule while it is connected, so its pull has to
  // land first — see `useCalendarSettled` for why this is not a status check.
  const isCalendarSettled = useCalendarSettled();

  const setStatus = useStravaSyncStore((state) => state.setStatus);
  const setApplied = useStravaSyncStore((state) => state.setApplied);
  const resyncNonce = useStravaSyncStore((state) => state.resyncNonce);
  const disconnect = useStravaConnectionStore((state) => state.disconnect);

  /**
   * One read per page load, and one more for each time the user asks.
   *
   * Strava allows 100 reads per fifteen minutes across the whole app — not per
   * user — so a read that fires on a state change rather than on an intent is
   * how the budget gets spent on nothing. The nonce starts at 0 and only the
   * "sync now" button moves it, so a load reads once however many times the
   * calendar settles, the plan is edited, or this re-renders.
   */
  const readNonceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isHydrated || !isConnected) {
      setStatus('off');
      // Deliberately not clearing `readNonceRef`. Connecting Strava is a full
      // page navigation through its consent screen, so a real reconnect brings
      // a fresh ref with it; the only thing clearing it here could do is let a
      // flicker in the connection state buy a second read.
      return;
    }
    if (!isCalendarSettled) {
      setStatus('waiting');
      return;
    }
    if (readNonceRef.current === resyncNonce) return;
    readNonceRef.current = resyncNonce;

    let cancelled = false;

    const sync = async () => {
      setStatus('reading');

      const store = usePlannerStore.getState();
      const weekStartsOn = (store.weekStartsOn ?? 1) as WeekStartsOn;
      const thisWeek = getWeekStartKey(new Date(), weekStartsOn);
      const from = parseDateLocal(addWeeks(thisWeek, -STRAVA_WEEKS_BACK));
      const to = parseDateLocal(addWeeks(thisWeek, 1));

      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const response = await fetch(`/api/strava/activities?${params}`);

      if (response.status === 401 || response.status === 403) {
        // The grant is gone. Drop the connection so the modal offers a connect
        // rather than a sync that can only fail.
        await disconnect();
        return;
      }
      if (!response.ok) {
        throw new Error((await response.json())?.error ?? 'Strava read failed');
      }

      const { activities } = (await response.json()) as { activities: StravaActivity[] };
      if (cancelled) return;

      const current = usePlannerStore.getState();
      const { updates, creations, unmatchedSports } = reconcileStrava({
        stravaActivities: activities,
        events: current.events,
        // A week's own activities first, then the template — a recording of
        // something this week never planned still knows what it is.
        activitiesFor: (weekStart) => [
          ...activitiesForWeek(weekStart, current.weekActivities),
          ...current.activities,
        ],
        weekStartsOn,
        buildSnapshot: buildActivitySnapshot,
      });

      current.applyStrava({ updates, creations });
      setApplied(updates.length + creations.length);
      setStatus('synced');

      // A recording no activity answers to used to vanish without a word, which
      // reads as Strava being broken. Name the sport, because the fix is to add
      // it to an activity and the user cannot guess that from silence.
      const sports = [...new Set(unmatchedSports)].map(stravaSportLabel);
      if (sports.length > 0) {
        const list = new Intl.ListFormat(undefined, { type: 'disjunction' }).format(sports);
        toast.message(COPY.strava.noActivityFor(list), {
          description: COPY.strava.noActivityHint,
        });
      }
    };

    sync().catch((error) => {
      if (cancelled) return;
      console.error('Strava sync failed', error);
      setStatus('error');
      toast.error(COPY.strava.readFailed);
    });

    return () => {
      cancelled = true;
    };
  }, [
    isHydrated,
    isConnected,
    isCalendarSettled,
    resyncNonce,
    setStatus,
    setApplied,
    disconnect,
  ]);
}
