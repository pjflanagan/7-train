import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createEvent,
  eventPropsFromEvent,
  EventDraft,
  GoogleEvent,
} from '@/lib/googleCalendar';
import { ActivitySnapshot } from '@/lib/types';

const snapshot: ActivitySnapshot = {
  name: 'Swimming',
  icon: 'swim',
  metric: 'distance',
  unit: 'yards',
  color: '#0ea5e9',
  paceMinutes: 2,
  paceDistance: 100,
  typicalDurationMinutes: null,
  workoutTypes: ['Drills', 'Intervals'],
};

const draft: EventDraft = {
  eventId: 'event-1',
  typeId: 'swim',
  title: 'Swimming',
  subType: 'Drills',
  value: 1500,
  start: '2026-08-17T07:00:00',
  end: '2026-08-17T07:45:00',
  timeZone: 'America/New_York',
  weekStart: '2026-08-17',
  activitySnapshot: snapshot,
};

/** Captures the body `createEvent` sends, without touching the network. */
async function writtenProps(withDraft: EventDraft): Promise<Record<string, string>> {
  let body: string | undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      body = init.body as string;
      return { ok: true, status: 200, json: async () => ({ id: 'google-1' }) };
    })
  );
  await createEvent('token', 'cal-1', withDraft);
  return JSON.parse(body!).extendedProperties.private;
}

/** A Google event as it comes back, built from what we would have written. */
const eventWith = (props: Record<string, string>): GoogleEvent => ({
  id: 'google-1',
  extendedProperties: { private: props },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('what an event carries in Google', () => {
  it('round-trips the activity copy, its frozen flag, and the week', async () => {
    const props = await writtenProps({ ...draft, activityFrozen: true });
    const read = eventPropsFromEvent(eventWith(props));

    expect(read).toMatchObject({
      eventId: 'event-1',
      typeId: 'swim',
      workoutType: 'Drills',
      value: 1500,
      weekStart: '2026-08-17',
      activityFrozen: true,
    });
    expect(read?.activitySnapshot).toEqual(snapshot);
  });

  it('reads a tracking event as not frozen', async () => {
    const props = await writtenProps(draft);
    expect(eventPropsFromEvent(eventWith(props))?.activityFrozen).toBe(false);
  });

  it('drops the sub-kinds rather than the whole copy when it will not fit', async () => {
    // Google caps a private property at 1024 bytes, and `workoutTypes` is the
    // only unbounded part of a snapshot.
    const props = await writtenProps({
      ...draft,
      activitySnapshot: {
        ...snapshot,
        workoutTypes: Array.from({ length: 200 }, (_, i) => `A very long workout type name ${i}`),
      },
    });

    const read = eventPropsFromEvent(eventWith(props));
    expect(read?.activitySnapshot?.name).toBe('Swimming');
    expect(read?.activitySnapshot?.unit).toBe('yards');
    expect(read?.activitySnapshot?.workoutTypes).toEqual([]);
  });

  it('treats an unreadable copy as absent rather than failing the pull', () => {
    const read = eventPropsFromEvent(
      eventWith({ workoutTypeId: 'swim', workoutActivity: '{not json' })
    );
    expect(read?.typeId).toBe('swim');
    expect(read?.activitySnapshot).toBeUndefined();
  });

  it('ignores an event that is not one of ours', () => {
    expect(eventPropsFromEvent(eventWith({ somethingElse: 'x' }))).toBeNull();
    expect(eventPropsFromEvent({ id: 'g' })).toBeNull();
  });
});
