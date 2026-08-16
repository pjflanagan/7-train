import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalendarSettled, useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';
import { useUserSyncStore } from '@/hooks/useUserSync';

/**
 * The gate Strava reads behind.
 *
 * Every case here is really the same question — "could the calendar still
 * change the schedule?" — and the answer decides whether a Strava read matches
 * recordings against the real plan or against whatever was in `localStorage`.
 */

const account = {
  isSignedIn: true,
  isLoading: false,
  name: null,
  email: null,
  image: null,
  scopes: [],
  needsReauth: false,
};

vi.mock('@/hooks/useAuth', () => ({
  useGoogleAccount: () => account,
}));

function reset() {
  useCalendarSyncStore.setState({
    status: 'off',
    hasPulled: false,
    hasResolvedCalendar: false,
  });
  useUserSyncStore.setState({ status: 'off', hasPulled: false });
  Object.assign(account, { isSignedIn: true, isLoading: false });
}

describe('useCalendarSettled', () => {
  beforeEach(reset);

  it('is false on the first render of a signed in user', () => {
    // The regression this exists to catch. The old gate asked whether status
    // was `off` or `synced`; `off` is the store's initial value, so it was true
    // here and Strava read before the calendar had said anything at all.
    const { result } = renderHook(() => useCalendarSettled());
    expect(useCalendarSyncStore.getState().status).toBe('off');
    expect(result.current).toBe(false);
  });

  it('is false while the calendar is being made', () => {
    // Signed in, settings pulled, but no calendar id yet — `useEnsureCalendar`
    // is mid-flight and one is seconds away.
    act(() => {
      useUserSyncStore.setState({ status: 'synced', hasPulled: true });
    });
    const { result } = renderHook(() => useCalendarSettled());
    expect(result.current).toBe(false);
  });

  it('is true once the first pull lands', () => {
    const { result, rerender } = renderHook(() => useCalendarSettled());
    expect(result.current).toBe(false);

    act(() => {
      useCalendarSyncStore.getState().setHasPulled(true);
    });
    rerender();
    expect(result.current).toBe(true);
  });

  it('is true when the pull failed, rather than waiting for ever', () => {
    act(() => {
      useCalendarSyncStore.setState({ status: 'error' });
      useCalendarSyncStore.getState().setHasPulled(true);
    });
    const { result } = renderHook(() => useCalendarSettled());
    expect(result.current).toBe(true);
  });

  it('is true when the account will never have a calendar', () => {
    act(() => {
      useUserSyncStore.setState({ status: 'synced', hasPulled: true });
      useCalendarSyncStore.getState().setHasResolvedCalendar(true);
    });
    const { result } = renderHook(() => useCalendarSettled());
    expect(result.current).toBe(true);
  });

  it('is true for a signed out user, who has no calendar to wait for', () => {
    account.isSignedIn = false;
    const { result } = renderHook(() => useCalendarSettled());
    expect(result.current).toBe(true);
  });

  it('is false while the session is still loading', () => {
    // Signed out and "not known yet" are different answers, and only one of
    // them means nothing is coming.
    account.isLoading = true;
    account.isSignedIn = false;
    const { result } = renderHook(() => useCalendarSettled());
    expect(result.current).toBe(false);
  });

  it('goes back to false if the calendar disconnects', () => {
    act(() => {
      useCalendarSyncStore.getState().setHasPulled(true);
    });
    const { result, rerender } = renderHook(() => useCalendarSettled());
    expect(result.current).toBe(true);

    act(() => {
      useCalendarSyncStore.getState().setHasPulled(false);
    });
    rerender();
    expect(result.current).toBe(false);
  });
});
