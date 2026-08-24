import { describe, it, expect, beforeEach } from 'vitest';
import { usePlannerStore } from '@/lib/store';
import { DEFAULT_START_MINUTES } from '@/lib/schedule';

/**
 * The plan is not cached in the browser.
 *
 * It used to be, under `localStorage['workout-week']`, and that cache was a
 * fourth copy of the plan that nothing could correct: it outlived a sign out,
 * so the next person saw the last one's week, and it was what a fresh sign in
 * pushed up as *their* activities. The backend is the plan now, and this is the
 * test that says so.
 */

describe('the store keeps nothing in the browser', () => {
  beforeEach(() => {
    localStorage.clear();
    usePlannerStore.getState().clearForSignOut();
  });

  it('starts blank, with no sample plan and no activities', () => {
    const state = usePlannerStore.getState();
    expect(state.activities).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.weekActivities).toEqual({});
    expect(state.links).toEqual([]);
    expect(state.googleCalendarId).toBeNull();
  });

  it('still renders against real settings while the server is being asked', () => {
    // Blank is not "unset": the week grid has to be drawn with *some* clock and
    // week start before the pull lands, and these are what it draws with.
    const state = usePlannerStore.getState();
    expect(state.weekStartsOn).toBe(1);
    expect(state.tempUnit).toBe('F');
    expect(state.defaultStartMinutes).toBe(DEFAULT_START_MINUTES);
  });

  it('writes nothing to localStorage when the plan is edited', () => {
    usePlannerStore.getState().addActivity({
      id: 'type-swim',
      name: 'Swim',
      icon: 'swim',
      metric: 'distance',
      unit: 'yards',
      target: 4000,
      color: '#00A2C7',
      workoutTypes: [],
    });
    usePlannerStore.getState().addEvent({
      typeId: 'type-swim',
      day: 'monday',
      weekStart: '2026-08-24',
      value: 1000,
      workoutType: null,
    });

    expect(usePlannerStore.getState().events).toHaveLength(1);
    expect(localStorage.length).toBe(0);
    expect(localStorage.getItem('workout-week')).toBeNull();
  });

  it('has no persist middleware to rehydrate from', () => {
    // Anything reaching for `.persist` is reaching for the cache that was
    // removed; it is gone rather than merely unused.
    expect('persist' in usePlannerStore).toBe(false);
  });

  it('takes the account with it when the user signs out', () => {
    const store = usePlannerStore.getState();
    store.setGoogleCalendarId('abc@group.calendar.google.com');
    store.addLink({ id: 'link-1', title: 'Pool', url: 'https://example.com' });

    usePlannerStore.getState().clearForSignOut();

    const after = usePlannerStore.getState();
    expect(after.links).toEqual([]);
    // Unlike the two danger-zone wipes, which keep it so the next sync reuses
    // the same calendar rather than making a second one.
    expect(after.googleCalendarId).toBeNull();
  });

  it('keeps the calendar id through a local wipe, which is not a sign out', () => {
    usePlannerStore.getState().setGoogleCalendarId('abc@group.calendar.google.com');
    usePlannerStore.getState().clearAll();
    expect(usePlannerStore.getState().googleCalendarId).toBe(
      'abc@group.calendar.google.com'
    );
  });

  it('puts the sample plan back on a full reset, which a new account starts from', () => {
    usePlannerStore.getState().resetAll();
    const state = usePlannerStore.getState();
    expect(state.activities.length).toBeGreaterThan(0);
    expect(state.events.length).toBeGreaterThan(0);
    expect(localStorage.length).toBe(0);
  });
});
