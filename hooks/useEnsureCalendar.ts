'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { COPY } from '@/lib/copy';
import { usePlannerStore } from '@/lib/store';
import { usePlannerHydrated } from '@/hooks/usePlannerHydrated';
import { useGoogleAccount } from '@/hooks/useAuth';
import { useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';
import { useUserSettled } from '@/hooks/useUserSync';
import { GOOGLE_INTEGRATIONS, isIntegrationConnected } from '@/lib/google';

/**
 * Makes sure the account has a `Workouts` calendar, without asking.
 *
 * This used to be a question — `CalendarSetupModal`, "where should your workouts
 * go?" — and it had to be, because the only copy of `googleCalendarId` lived in
 * one browser's `localStorage`. Creating one whenever the id was missing meant a
 * second browser, a private window or a cleared cache each made its *own*
 * calendar, splitting the plan across both permanently. Asking was the least bad
 * way to stop that.
 *
 * The settings table removed the reason. The id now hangs off the Google
 * account, so a browser with no calendar id is not a browser that needs a new
 * calendar — it is a browser that has not read its settings yet. Once it has,
 * "still no calendar" means exactly what it says, and there is nothing to ask.
 *
 * Which is why `useUserSettled` is the load-bearing part of this: creating
 * before the settings pull lands would rebuild the very bug the pull exists to
 * prevent.
 */
export function useEnsureCalendar(): void {
  const { scopes, isSignedIn } = useGoogleAccount();
  const isHydrated = usePlannerHydrated();
  const isUserSettled = useUserSettled();
  const calendarId = usePlannerStore((state) => state.googleCalendarId);

  const isConnected =
    isHydrated && isSignedIn && isIntegrationConnected(scopes, GOOGLE_INTEGRATIONS.calendar);

  /**
   * One attempt per connected session. Deliberately *not* cleared when the
   * attempt fails: a failed create that reset this would be retried on the next
   * render, and a create that is failing slowly would make a calendar per
   * render once it started succeeding again.
   */
  const hasAttemptedRef = useRef(false);

  const setHasResolvedCalendar = useCalendarSyncStore((state) => state.setHasResolvedCalendar);

  useEffect(() => {
    if (!isConnected) {
      hasAttemptedRef.current = false;
      // Not hydrated yet is "we do not know"; anything else here means the
      // account is not getting a calendar, which is an answer.
      setHasResolvedCalendar(isHydrated);
      return;
    }
    // The settings pull may be about to hand us one. Anything else is a guess.
    if (!isUserSettled) return;
    if (calendarId) {
      setHasResolvedCalendar(true);
      return;
    }
    if (hasAttemptedRef.current) return;

    hasAttemptedRef.current = true;
    let cancelled = false;

    const create = async () => {
      const response = await fetch('/api/calendar/create', { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? 'Could not create a calendar');
      if (cancelled) return;

      // A new calendar is empty, so this device's plan is the only one there
      // is — leaving `googleAdoptedAt` unset is what makes sync upload all of
      // it. Storing the id is itself a settings change, so `useUserSync` picks
      // it up and the next device inherits it rather than making a second one.
      const store = usePlannerStore.getState();
      store.setGoogleCalendarId(body.calendarId);
      // The pull refreshes this, but it is a few seconds away and the modal
      // should not be showing a blank calendar in the meantime.
      store.setGoogleCalendarName(body.calendarName ?? null);
      useCalendarSyncStore.getState().resync();
    };

    create()
      .catch((error) => {
        if (cancelled) return;
        console.error('Creating the Workouts calendar failed', error);
        toast.error(COPY.calendar.createFailed);
      })
      .finally(() => {
        // Resolved either way. A failed create still answers the question for
        // this page load — there is no calendar — and anything waiting on the
        // answer (Strava, above all) would otherwise wait for ever.
        if (!cancelled) setHasResolvedCalendar(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected, isHydrated, isUserSettled, calendarId, setHasResolvedCalendar]);
}
