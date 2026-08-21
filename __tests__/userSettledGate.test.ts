import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserSettled, useUserSyncStore } from '@/hooks/useUserSync';

/**
 * The gate `useEnsureCalendar` waits behind before making a `Workouts`
 * calendar.
 *
 * Every case here is the same question — "could the server still tell us this
 * account already has a calendar?" — and getting it wrong does not show up as
 * an error. It shows up as a second calendar, permanently, with the plan split
 * across both and no way to search for the first.
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
  useUserSyncStore.setState({ status: 'off', hasPulled: false });
  Object.assign(account, { isSignedIn: true, isLoading: false });
}

describe('useUserSettled', () => {
  beforeEach(reset);

  it('is false on the first render of a signed in user', () => {
    // The regression this exists to catch, and the duplicate calendar bug
    // itself. The old gate asked `status === 'off' || hasPulled`, and `off` is
    // both the store's initial value and what the pull effect writes while it
    // waits on hydration or on the session. So the very first render where a
    // signed in user's plan had hydrated said "settled" — and `useEnsureCalendar`
    // made a calendar in the same commit that the pull was setting off in.
    const { result } = renderHook(() => useUserSettled());
    expect(useUserSyncStore.getState().status).toBe('off');
    expect(result.current).toBe(false);
  });

  it('is false while the pull is in flight', () => {
    act(() => {
      useUserSyncStore.setState({ status: 'pulling', hasPulled: false });
    });
    const { result } = renderHook(() => useUserSettled());
    expect(result.current).toBe(false);
  });

  it('is false while the session is still loading', () => {
    // Not yet signed in is not the same as signed out, and treating it as
    // settled is the same early create by another route.
    Object.assign(account, { isSignedIn: false, isLoading: true });
    const { result } = renderHook(() => useUserSettled());
    expect(result.current).toBe(false);
  });

  it('is true once signed out is known', () => {
    // No account, so no settings are coming and none are needed.
    Object.assign(account, { isSignedIn: false, isLoading: false });
    const { result } = renderHook(() => useUserSettled());
    expect(result.current).toBe(true);
  });

  it('is true once the first pull lands', () => {
    act(() => {
      useUserSyncStore.setState({ status: 'synced', hasPulled: true });
    });
    const { result } = renderHook(() => useUserSettled());
    expect(result.current).toBe(true);
  });

  it('is true when the deployment has no database', () => {
    // A 501 settles the question as firmly as an answer does: nothing will ever
    // arrive, so waiting longer would only mean never making a calendar at all.
    act(() => {
      useUserSyncStore.setState({ status: 'off', hasPulled: true });
    });
    const { result } = renderHook(() => useUserSettled());
    expect(result.current).toBe(true);
  });

  it('is true when the pull failed outright', () => {
    // Settled, though it failed. The server-side check in
    // `POST /api/calendar/create` is what keeps this from making a duplicate:
    // the browser genuinely does not know, so the row is asked instead.
    act(() => {
      useUserSyncStore.setState({ status: 'error', hasPulled: true });
    });
    const { result } = renderHook(() => useUserSettled());
    expect(result.current).toBe(true);
  });
});
