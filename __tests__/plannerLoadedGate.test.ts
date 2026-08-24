import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlannerLoaded } from '@/hooks/usePlannerLoaded';
import { useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';
import { useUserSyncStore } from '@/hooks/useUserSync';
import { usePlannerStore } from '@/lib/store';
import { GOOGLE_INTEGRATIONS } from '@/lib/google';

/**
 * The gate the planner draws behind, and the replacement for the hydration one.
 *
 * Every case is the same question — "could the backend still hand us a plan?" —
 * and getting it wrong is visible either way round: too eager shows an empty
 * week to someone who has one, and too cautious leaves a spinner up for ever on
 * a load where nothing is coming. Every branch must reach an answer, failures
 * included.
 */

const account = {
  isSignedIn: true,
  isLoading: false,
  name: null,
  email: null,
  image: null,
  scopes: [...GOOGLE_INTEGRATIONS.calendar.scopes],
  needsReauth: false,
};

vi.mock('@/hooks/useAuth', () => ({
  useGoogleAccount: () => account,
}));

function reset() {
  useCalendarSyncStore.setState({ hasPulled: false, hasResolvedCalendar: false });
  useUserSyncStore.setState({ status: 'off', hasPulled: false });
  usePlannerStore.getState().clearForSignOut();
  Object.assign(account, {
    isSignedIn: true,
    isLoading: false,
    scopes: [...GOOGLE_INTEGRATIONS.calendar.scopes],
  });
}

/** The settings pull has landed; the schedule has not. */
function userPulled() {
  useUserSyncStore.setState({ status: 'synced', hasPulled: true });
}

describe('usePlannerLoaded', () => {
  beforeEach(reset);

  it('is false while the session is still loading', () => {
    // Signed out and not-yet-known are different answers, and the store is
    // empty in both — which is why this cannot be read off the store.
    account.isLoading = true;
    account.isSignedIn = false;
    const { result } = renderHook(() => usePlannerLoaded());
    expect(result.current).toBe(false);
  });

  it('is false for a signed out browser, which has no plan at all', () => {
    // Not "loaded, and it happens to be empty": there is nothing to load and
    // nowhere to keep it. `PlannerPage` catches this ahead of the spinner and
    // shows the sign in, so this never leaves one up.
    account.isSignedIn = false;
    const { result } = renderHook(() => usePlannerLoaded());
    expect(result.current).toBe(false);
  });

  it('is false on the first render of a signed in user', () => {
    const { result } = renderHook(() => usePlannerLoaded());
    expect(result.current).toBe(false);
  });

  it('is false while the calendar is being made', () => {
    // Settings in, no calendar id yet, and `useEnsureCalendar` mid-flight — one
    // is seconds away, so an empty week here would be a lie.
    act(() => userPulled());
    const { result } = renderHook(() => usePlannerLoaded());
    expect(result.current).toBe(false);
  });

  it('is false once the calendar is known but its first pull has not landed', () => {
    act(() => {
      userPulled();
      useCalendarSyncStore.getState().setHasResolvedCalendar(true);
      usePlannerStore.getState().setGoogleCalendarId('abc@group.calendar.google.com');
    });
    const { result } = renderHook(() => usePlannerLoaded());
    expect(result.current).toBe(false);
  });

  it('is true once the schedule lands', () => {
    act(() => {
      userPulled();
      useCalendarSyncStore.getState().setHasResolvedCalendar(true);
      usePlannerStore.getState().setGoogleCalendarId('abc@group.calendar.google.com');
    });
    const { result, rerender } = renderHook(() => usePlannerLoaded());
    expect(result.current).toBe(false);

    act(() => {
      useCalendarSyncStore.getState().setHasPulled(true);
    });
    rerender();
    expect(result.current).toBe(true);
  });

  it('is true when the account will never have a calendar', () => {
    // The create was tried and failed, or there is no database to remember one.
    // Nothing further is coming this load, so the planner draws what it has.
    act(() => {
      userPulled();
      useCalendarSyncStore.getState().setHasResolvedCalendar(true);
    });
    const { result } = renderHook(() => usePlannerLoaded());
    expect(result.current).toBe(true);
  });

  it('is true when the calendar scope was never granted', () => {
    // An id from the settings row, but no permission to read the calendar with:
    // no pull can happen, so waiting for one would be waiting for ever.
    act(() => {
      userPulled();
      useCalendarSyncStore.getState().setHasResolvedCalendar(true);
      usePlannerStore.getState().setGoogleCalendarId('abc@group.calendar.google.com');
    });
    account.scopes = [];
    const { result } = renderHook(() => usePlannerLoaded());
    expect(result.current).toBe(true);
  });

  it('is true when the settings pull failed outright', () => {
    // `useUserSettled` goes true on failure as well as success, and the planner
    // follows it: a broken pull is an answer, and an app that never renders is
    // worse than one rendering what little it has.
    act(() => {
      useUserSyncStore.setState({ status: 'error', hasPulled: true });
      useCalendarSyncStore.getState().setHasResolvedCalendar(true);
    });
    const { result } = renderHook(() => usePlannerLoaded());
    expect(result.current).toBe(true);
  });
});
