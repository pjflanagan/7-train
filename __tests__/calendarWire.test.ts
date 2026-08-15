import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createEvent,
  createTargetsEvent,
  eventPropsFromEvent,
  EventDraft,
  GoogleEvent,
  isTargetsEvent,
  targetsFromEvent,
  TargetsDraft,
} from '@/lib/googleCalendar';
import { Activity, ActivitySnapshot } from '@/lib/types';

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
async function writtenEvent(withDraft: EventDraft): Promise<{
  summary: string;
  extendedProperties: { private: Record<string, string> };
}> {
  let body: string | undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      body = init.body as string;
      return { ok: true, status: 200, json: async () => ({ id: 'google-1' }) };
    })
  );
  await createEvent('token', 'cal-1', withDraft);
  return JSON.parse(body!);
}

async function writtenProps(withDraft: EventDraft): Promise<Record<string, string>> {
  return (await writtenEvent(withDraft)).extendedProperties.private;
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

describe('what an event is called in Google', () => {
  it('says how far a distance event goes, after the activity and its sub-kind', async () => {
    expect((await writtenEvent(draft)).summary).toBe('Swimming: Drills — 1500 yards');
  });

  it('says the distance even when the event has no sub-kind', async () => {
    expect((await writtenEvent({ ...draft, subType: null })).summary).toBe(
      'Swimming — 1500 yards'
    );
  });

  it('leaves a duration or instance event named as it was', async () => {
    const duration = await writtenEvent({
      ...draft,
      activitySnapshot: { ...snapshot, metric: 'duration', unit: 'minutes' },
    });
    expect(duration.summary).toBe('Swimming: Drills');

    const instance = await writtenEvent({
      ...draft,
      value: 1,
      activitySnapshot: { ...snapshot, metric: 'instance', unit: 'sessions' },
    });
    expect(instance.summary).toBe('Swimming: Drills');
  });

  it('says nothing about a distance nobody has set yet', async () => {
    expect((await writtenEvent({ ...draft, value: 0 })).summary).toBe('Swimming: Drills');
  });

  it('falls back to the plain name on an event with no activity copy', async () => {
    expect((await writtenEvent({ ...draft, activitySnapshot: undefined })).summary).toBe(
      'Swimming: Drills'
    );
  });
});

describe('a week of targets in Google', () => {
  const activities: Activity[] = [
    {
      id: 'run',
      name: 'Running',
      icon: 'run',
      metric: 'distance',
      unit: 'miles',
      target: 20,
      color: '#f00',
      workoutTypes: ['Tempo'],
    },
    {
      id: 'lift',
      name: 'Lifting',
      icon: 'gym',
      metric: 'instance',
      unit: 'sessions',
      target: 3,
      color: '#0f0',
    },
  ];

  const targetsDraft: TargetsDraft = {
    weekStart: '2026-08-17',
    endDate: '2026-08-18',
    activities,
  };

  /** The all-day body `createTargetsEvent` sends, without touching the network. */
  async function writtenTargets(withDraft: TargetsDraft) {
    let body: string | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        body = init.body as string;
        return { ok: true, status: 200, json: async () => ({ id: 'google-targets' }) };
      })
    );
    await createTargetsEvent('token', 'cal-1', withDraft);
    return JSON.parse(body!);
  }

  it('round-trips a week and its activities', async () => {
    const written = await writtenTargets(targetsDraft);
    const read = targetsFromEvent({ id: 'g', ...written });

    expect(read?.weekStart).toBe('2026-08-17');
    expect(read?.activities).toEqual(activities);
  });

  it('writes one all-day day, marked free rather than busy', async () => {
    const written = await writtenTargets(targetsDraft);

    expect(written.start).toEqual({ date: '2026-08-17' });
    expect(written.end).toEqual({ date: '2026-08-18' });
    expect(written.transparency).toBe('transparent');
  });

  it('splits a week too big for one property across several', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...activities[0],
      id: `activity-${i}`,
      name: `An activity with a fairly long name ${i}`,
      workoutTypes: ['One', 'Two', 'Three'],
    }));
    const written = await writtenTargets({ ...targetsDraft, activities: many });
    const props = written.extendedProperties.private;

    expect(Number(props.workoutTargetsCount)).toBeGreaterThan(1);
    for (const [, value] of Object.entries(props)) {
      expect((value as string).length).toBeLessThanOrEqual(1024);
    }
    expect(targetsFromEvent({ id: 'g', ...written })?.activities).toEqual(many);
  });

  it('reads nothing rather than half a week when a chunk is missing', async () => {
    const written = await writtenTargets(targetsDraft);
    const props = { ...written.extendedProperties.private };
    props.workoutTargetsCount = '2'; // claims a chunk that was never written

    expect(targetsFromEvent({ id: 'g', extendedProperties: { private: props } })).toBeNull();
  });

  it('is not mistaken for a workout, and a workout is not mistaken for it', async () => {
    const written = await writtenTargets(targetsDraft);
    expect(isTargetsEvent({ id: 'g', ...written })).toBe(true);
    expect(eventPropsFromEvent({ id: 'g', ...written })).toBeNull();

    const workout = await writtenProps(draft);
    expect(isTargetsEvent(eventWith(workout))).toBe(false);
  });
});
