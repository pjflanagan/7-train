import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { usePlannerStore } from '@/lib/store';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';
import { buildActivitySnapshot } from '@/lib/activitySnapshot';
import { dateForDay, formatDateLocal, getWeekStartKey } from '@/lib/dates';
import { weekActivityKey } from '@/lib/progress';
import { Activity, ScheduledEvent } from '@/lib/types';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

vi.mock('@/hooks/useAuth', () => ({
  useGoogleAccount: () => ({ scopes: [CALENDAR_SCOPE], isSignedIn: true }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const weekStart = getWeekStartKey(new Date(), 1);

const activity: Activity = {
  id: 'run',
  name: 'Running',
  icon: 'run',
  metric: 'distance',
  unit: 'miles',
  target: 20,
  color: '#f00',
};

const event: ScheduledEvent = {
  id: 'monday-run',
  typeId: activity.id,
  day: 'monday',
  weekStart,
  value: 5,
  startMinutes: 7 * 60,
  durationMinutes: 45,
  activitySnapshot: buildActivitySnapshot(activity),
};

/** The same workout, as Google would hand it back. */
function asPulled(googleEventId: string) {
  const date = formatDateLocal(dateForDay(weekStart, event.day, 1));
  return {
    googleEventId,
    eventId: event.id,
    typeId: event.typeId,
    workoutType: null,
    value: event.value,
    start: `${date}T07:00:00`,
    end: `${date}T07:45:00`,
    weekStart,
    activitySnapshot: event.activitySnapshot,
  };
}

/** Records what hits /api/calendar; the pull answers with `events`. */
function stubCalendarApi(events: ReturnType<typeof asPulled>[] = []) {
  const posts: { create: unknown[]; update: unknown[]; remove: unknown[] }[] = [];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string);
      posts.push(body);
      const eventIds: Record<string, string> = {};
      for (const draft of [...body.create, ...body.update]) {
        eventIds[draft.eventId] = `google-${draft.eventId}`;
      }
      const targetEventIds: Record<string, string> = {};
      for (const draft of body.targets ?? []) {
        targetEventIds[draft.weekStart] = `google-targets-${draft.weekStart}`;
      }
      return { ok: true, json: async () => ({ calendarId: 'cal-1', eventIds, targetEventIds }) };
    }
    return {
      ok: true,
      json: async () => ({ calendarId: 'cal-1', calendarName: 'Workouts', events, targets: [] }),
    };
  });

  vi.stubGlobal('fetch', fetchMock);
  return { posts, fetchMock };
}

const status = () => useCalendarSyncStore.getState().status;
/**
 * When the current wait started — 0 while nothing is waiting. The status alone
 * cannot answer "was a save announced": a pull overwrites it with `synced` on
 * the way out, so a countdown started underneath it leaves no trace there.
 */
const pendingSince = () => useCalendarSyncStore.getState().pendingSince;

beforeEach(() => {
  usePlannerStore.getState().clearAll();
  usePlannerStore.setState({
    googleAdoptedAt: new Date().toISOString(),
    googleCalendarId: 'cal-1',
    activities: [activity],
    events: [{ ...event, googleEventId: 'google-monday-run' }],
    weekActivities: { [weekActivityKey(weekStart, activity.id)]: { ...activity } },
  });
  useCalendarSyncStore.setState({
    status: 'off',
    pendingSince: 0,
    resyncNonce: 0,
    baselineNonce: 0,
  });
});

afterEach(() => {
  // By hand: this project does not run Vitest with globals, so nothing
  // unmounts the hook for us — and a sync left mounted goes on watching the
  // store through the next test, against the baseline it settled with.
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/**
 * The header says a save is coming, and then that it happened. Both are claims
 * about Google's copy, so both have to be answered against Google's copy rather
 * than against "the store handed out a new array".
 */
describe('what the calendar counts as a change to save', () => {
  it('announces nothing when the edit leaves the workout as it was', async () => {
    const { posts } = stubCalendarApi([asPulled('google-monday-run')]);

    renderHook(() => useCalendarSync());
    await waitFor(() => expect(status()).toBe('synced'));
    const written = posts.length;

    act(() => usePlannerStore.getState().updateEventValue(event.id, 5));

    expect(status()).toBe('synced');
    expect(pendingSince()).toBe(0);
    expect(posts.length).toBe(written);
  });

  it('announces the save the moment a real edit lands', async () => {
    stubCalendarApi([asPulled('google-monday-run')]);

    renderHook(() => useCalendarSync());
    await waitFor(() => expect(status()).toBe('synced'));

    act(() => usePlannerStore.getState().updateEventValue(event.id, 9));

    expect(status()).toBe('pending');
    expect(pendingSince()).toBeGreaterThan(0);
  });

  it('does not read a pull back to Google as an edit to send', async () => {
    // Google hands back the workout under a different id than the one this
    // browser holds, so the pull really does change the plan.
    const { posts } = stubCalendarApi([asPulled('google-elsewhere')]);

    renderHook(() => useCalendarSync());
    await waitFor(() => expect(status()).toBe('synced'));

    expect(usePlannerStore.getState().events[0].googleEventId).toBe('google-elsewhere');
    expect(status()).toBe('synced');
    expect(pendingSince()).toBe(0);
    expect(posts).toHaveLength(0);
  });

  it('does not read its own push back as an edit to send', async () => {
    // Nothing in Google yet: handing the plan over creates the workout, and the
    // push comes back with the id it was given.
    usePlannerStore.setState({ events: [event], googleAdoptedAt: null });
    const { posts } = stubCalendarApi([asPulled('google-monday-run')]);

    renderHook(() => useCalendarSync());
    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    await waitFor(() => expect(status()).toBe('synced'));

    expect(usePlannerStore.getState().events[0].googleEventId).toBe('google-monday-run');
    // Learning that id is bookkeeping, not an edit. It used to start another
    // countdown, for a push that would find nothing to write.
    expect(pendingSince()).toBe(0);
    expect(posts).toHaveLength(1);
  });
});
