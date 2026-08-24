import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSignedOutReset } from '@/hooks/useSignedOutReset';
import { usePlannerStore } from '@/lib/store';

/**
 * Signing out takes the plan with it.
 *
 * The plan belongs to the account, not to the machine. Nothing is cached any
 * more, but a sign out is not a page load either — the session flips and React
 * carries on with the same store — so the wipe has to be done deliberately, or
 * the next person at the browser reads the last one's week and the next sign in
 * pushes it up as theirs.
 */

const account = { isSignedIn: true, isLoading: false };

vi.mock('@/hooks/useAuth', () => ({
  useGoogleAccount: () => account,
}));

const activity = {
  id: 'type-swim',
  name: 'Swim',
  icon: 'swim' as const,
  metric: 'distance' as const,
  unit: 'yards',
  target: 4000,
  color: '#00A2C7',
  workoutTypes: [],
};

describe('useSignedOutReset', () => {
  beforeEach(() => {
    usePlannerStore.getState().clearForSignOut();
    Object.assign(account, { isSignedIn: true, isLoading: false });
  });

  it('empties the plan when the account goes away', () => {
    const { rerender } = renderHook(() => useSignedOutReset());
    usePlannerStore.getState().addActivity(activity);
    usePlannerStore.getState().setGoogleCalendarId('abc@group.calendar.google.com');

    account.isSignedIn = false;
    rerender();

    expect(usePlannerStore.getState().activities).toEqual([]);
    expect(usePlannerStore.getState().googleCalendarId).toBeNull();
  });

  it('leaves a signed out browser alone', () => {
    // A load that starts signed out has nothing to clear — and clearing anyway
    // would wipe a backup someone had just imported.
    account.isSignedIn = false;
    const { rerender } = renderHook(() => useSignedOutReset());
    usePlannerStore.getState().addActivity(activity);
    rerender();

    expect(usePlannerStore.getState().activities).toEqual([activity]);
  });

  it('leaves the plan alone while the user stays signed in', () => {
    const { rerender } = renderHook(() => useSignedOutReset());
    usePlannerStore.getState().addActivity(activity);
    rerender();
    rerender();

    expect(usePlannerStore.getState().activities).toEqual([activity]);
  });
});
