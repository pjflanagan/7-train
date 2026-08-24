'use client';

import { usePlannerStore } from '@/lib/store';
import { useIsMounted } from '@/hooks/useIsMounted';
import { useGoogleAccount } from '@/hooks/useAuth';
import { useUserSettled } from '@/hooks/useUserSync';
import { useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';
import { GOOGLE_INTEGRATIONS, isIntegrationConnected } from '@/lib/google';

/**
 * True once the plan on screen is the backend's plan — or once it is settled
 * that no plan is coming.
 *
 * This replaces `usePlannerHydrated`, and it is the same question asked of a
 * different source. That hook waited for `localStorage` to be read into the
 * store, because until then `getState()` answered with seeded defaults and
 * every loop would have acted on them. Nothing is read from the browser any
 * more, so the store starts genuinely empty — and empty is no longer "not
 * ready", it is a real answer for a signed out browser and a wrong one for a
 * signed in user whose week is still in flight.
 *
 * So the wait moved rather than disappeared: what the planner must not do is
 * draw an empty week at someone who has one. Every branch below ends in an
 * answer, including the failures — a pull that errored has still answered.
 *
 * It also keeps the one thing hydration gating gave us for free: the planner is
 * never drawn on the server or in the first client render, so nothing under it
 * has to make its server answer match its client one. `useIsMobile` and the
 * week grid's `new Date()` both rely on that.
 */

export function usePlannerLoaded(): boolean {
  const isMounted = useIsMounted();
  const { scopes, isSignedIn, isLoading } = useGoogleAccount();
  const isUserSettled = useUserSettled();
  const hasPulled = useCalendarSyncStore((state) => state.hasPulled);
  const hasResolvedCalendar = useCalendarSyncStore((state) => state.hasResolvedCalendar);
  const calendarId = usePlannerStore((state) => state.googleCalendarId);

  // The server has fetched nothing and cannot; so has this render.
  if (!isMounted) return false;
  // Signed out and not-yet-known are different answers, and only one of them
  // means nothing is coming.
  if (isLoading) return false;
  // Nobody to fetch a plan for, so there is no plan and never will be on this
  // load. `PlannerPage` catches this case ahead of the spinner and shows the
  // sign in instead — an empty week is not what a signed out browser gets.
  if (!isSignedIn) return false;
  // The settings and "My activities" are still on their way.
  if (!isUserSettled) return false;
  // The schedule landed, or the pull failed and none is coming this load.
  if (hasPulled) return true;

  // No pull is coming: either this account has no calendar, or the browser has
  // not been granted the scope to read it. Until `useEnsureCalendar` has
  // answered that question, a missing calendar id means "not asked yet".
  const isCalendarConnected =
    Boolean(calendarId) && isIntegrationConnected(scopes, GOOGLE_INTEGRATIONS.calendar);
  return hasResolvedCalendar && !isCalendarConnected;
}
