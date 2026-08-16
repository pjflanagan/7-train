import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePlannerStore } from '@/lib/store';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';
import { buildActivitySnapshot } from '@/lib/activitySnapshot';
import { getWeekStartKey, addWeeks } from '@/lib/dates';
import { weekActivityKey } from '@/lib/progress';
import { Activity, ScheduledEvent } from '@/lib/types';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

vi.mock('@/hooks/useAuth', () => ({
  useGoogleAccount: () => ({ scopes: [CALENDAR_SCOPE], isSignedIn: true }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const weekStart = getWeekStartKey(new Date(), 1);
/** Far outside PULL_WEEKS_BACK (8), so no pull will ever return it. */
const ancientWeek = addWeeks(weekStart, -40);

const activity: Activity = {
  id: 'run',
  name: 'Running',
  icon: 'run',
  metric: 'distance',
  unit: 'miles',
  target: 20,
  color: '#f00',
};

const event = (id: string, week: string): ScheduledEvent => ({
  id,
  typeId: activity.id,
  day: 'monday',
  weekStart: week,
  value: 5,
  startMinutes: 7 * 60,
  activitySnapshot: buildActivitySnapshot(activity),
});

/** Records what hits /api/calendar, answering as an empty calendar would. */
function stubCalendarApi() {
  const posts: Array<{
    create: unknown[];
    update: unknown[];
    remove: unknown[];
    targets: unknown[];
  }> = [];

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
      return {
        ok: true,
        json: async () => ({ calendarId: 'cal-1', eventIds, targetEventIds }),
      };
    }
    // The pull: an empty Workouts calendar.
    return { ok: true, json: async () => ({ calendarId: 'cal-1', events: [], targets: [] }) };
  });

  vi.stubGlobal('fetch', fetchMock);
  return { posts, fetchMock };
}

beforeEach(() => {
  usePlannerStore.getState().clearAll();
  // The account has a calendar; making one is `useEnsureCalendar`'s job and
  // sync does nothing at all until it has been.
  usePlannerStore.setState({ googleAdoptedAt: null, googleCalendarId: 'cal-1' });
  useCalendarSyncStore.setState({ status: 'off', resyncNonce: 0, baselineNonce: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('handing the plan over to Google', () => {
  it('uploads every week, not just the ones a pull would cover', async () => {
    usePlannerStore.setState({
      events: [event('recent', weekStart), event('ancient', ancientWeek)],
    });
    const { posts } = stubCalendarApi();

    renderHook(() => useCalendarSync());

    await waitFor(() => expect(posts.length).toBeGreaterThan(0));

    const uploaded = posts[0].create as Array<{ eventId: string }>;
    expect(uploaded.map(d => d.eventId).sort()).toEqual(['ancient', 'recent']);
  });

  it('uploads before it pulls, so an un-uploaded week cannot be overwritten', async () => {
    usePlannerStore.setState({ events: [event('ancient', ancientWeek)] });
    const { fetchMock } = stubCalendarApi();

    renderHook(() => useCalendarSync());

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));

    const methods = fetchMock.mock.calls.map(([, init]) => (init as RequestInit)?.method ?? 'GET');
    expect(methods[0]).toBe('POST');
    expect(methods[1]).toBe('GET');
  });

  it('keeps the week outside the pull window after adopting', async () => {
    usePlannerStore.setState({ events: [event('ancient', ancientWeek)] });
    stubCalendarApi();

    renderHook(() => useCalendarSync());

    await waitFor(() => expect(usePlannerStore.getState().googleAdoptedAt).toBeTruthy());
    await waitFor(() =>
      expect(usePlannerStore.getState().events.map(e => e.id)).toEqual(['ancient'])
    );
  });

  it('uploads what each week aims at, as its own record', async () => {
    usePlannerStore.setState({
      events: [event('recent', weekStart)],
      weekActivities: { [weekActivityKey(weekStart, activity.id)]: activity },
    });
    const { posts } = stubCalendarApi();

    renderHook(() => useCalendarSync());

    await waitFor(() => expect(posts.length).toBeGreaterThan(0));

    const targets = posts[0].targets as Array<{ weekStart: string; activities: Activity[] }>;
    expect(targets).toHaveLength(1);
    expect(targets[0].weekStart).toBe(weekStart);
    expect(targets[0].activities[0].target).toBe(20);
  });

  it('does nothing at all until a calendar has been chosen', async () => {
    usePlannerStore.setState({
      events: [event('recent', weekStart)],
      googleCalendarId: null,
    });
    const { fetchMock } = stubCalendarApi();

    renderHook(() => useCalendarSync());

    // Long enough that a pull would have gone out if one were going to.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(usePlannerStore.getState().googleAdoptedAt).toBeNull();
  });

  it('does not upload the whole plan again on a later sync', async () => {
    usePlannerStore.setState({
      events: [event('recent', weekStart)],
      googleAdoptedAt: new Date().toISOString(),
    });
    const { fetchMock } = stubCalendarApi();

    renderHook(() => useCalendarSync());

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(0));
    expect((fetchMock.mock.calls[0][1] as RequestInit)?.method ?? 'GET').toBe('GET');
  });
});
