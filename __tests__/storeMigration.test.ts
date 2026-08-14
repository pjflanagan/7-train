import { describe, it, expect } from 'vitest';
import { migrateStore } from '@/lib/migrate';
import { getWeekStartKey, addWeeks } from '@/lib/dates';

const thisWeek = getWeekStartKey(new Date(), 1);
const nextWeek = addWeeks(thisWeek, 1);

type MigratedEvent = { id: string; weekStart?: string; week?: number };
type Migrated = { events: MigratedEvent[]; notes: Record<string, string>; weekStartsOn: number };

// v1 and v2 wrote the schedule under `items` and the activities under `goals`;
// the v3 rename is what turns those into `events` and `activities`.
const v1 = {
  items: [
    { id: '1', typeId: 'a', day: 'monday', week: 1, value: 1 },
    { id: '2', typeId: 'b', day: 'tuesday', week: 2, value: 2 },
    { id: '3', typeId: 'c', day: 'friday', value: 3 }, // no week -> week 1
  ],
  notes: { 'monday-1': 'first', 'tuesday-2': 'second' },
};

describe('migrateStore v1 -> v2', () => {
  it('anchors week 1 to the current week and week 2 to the next', () => {
    const result = migrateStore(v1, 1) as Migrated;
    const byId = Object.fromEntries(result.events.map(i => [i.id, i]));

    expect(byId['1'].weekStart).toBe(thisWeek);
    expect(byId['2'].weekStart).toBe(nextWeek);
    expect(byId['3'].weekStart).toBe(thisWeek);
  });

  it('drops the obsolete relative slot', () => {
    const result = migrateStore(v1, 1) as Migrated;
    result.events.forEach(event => expect(event.week).toBeUndefined());
  });

  it('rekeys notes from day-week to weekStart-day', () => {
    const result = migrateStore(v1, 1) as Migrated;

    expect(result.notes[`${thisWeek}-monday`]).toBe('first');
    expect(result.notes[`${nextWeek}-tuesday`]).toBe('second');
    expect(result.notes['monday-1']).toBeUndefined();
  });

  it('defaults the week start to Monday', () => {
    const result = migrateStore(v1, 1) as Migrated;
    expect(result.weekStartsOn).toBe(1);
  });
});

describe('migrateStore v2 -> v3', () => {
  const v2 = {
    goals: [{ id: 'a', name: 'Running' }],
    items: [{ id: '1', weekStart: '2020-01-06' }],
    notes: { x: 'note' },
    weeklyTargets: { 'w:a': 3 },
  };

  it('renames goals to activities and items to events', () => {
    const result = migrateStore(v2, 2) as Record<string, unknown>;

    expect(result.activities).toEqual(v2.goals);
    // Later steps add fields of their own, so this is about the rename only.
    expect(result.events).toMatchObject(v2.items);
    expect(result.goals).toBeUndefined();
    expect(result.items).toBeUndefined();
  });

  it('carries everything else across untouched', () => {
    const result = migrateStore(v2, 2) as Record<string, unknown>;

    expect(result.notes).toEqual(v2.notes);
    // The v2 target survives as the week's own copy of the activity, aiming
    // at the same number.
    expect(result.weeklyTargets).toBeUndefined();
    expect((result.weekActivities as Record<string, { target: number }>)['w:a'].target).toBe(3);
  });

  it('renames on the way through a v1 migration too', () => {
    const result = migrateStore(v1, 1) as Migrated;
    expect(result.events).toHaveLength(3);
  });

  it('carries an already-migrated schedule through unchanged', () => {
    const v3 = { activities: [], events: [{ id: '1', weekStart: '2020-01-06' }], notes: {} };
    const result = migrateStore(v3, 3) as Record<string, unknown>;
    expect(result.activities).toEqual(v3.activities);
    expect(result.events).toMatchObject(v3.events);
    expect(result.notes).toEqual(v3.notes);
  });
});

describe('migrateStore v7 -> v8', () => {
  const v7 = {
    activities: [
      { id: 'lift', metric: 'instance', unit: 'times' },
      { id: 'run', metric: 'distance', unit: 'miles' },
      { id: 'yoga', metric: 'instance', unit: 'classes' },
    ],
    weekActivities: {
      '2020-01-06:lift': { id: 'lift', metric: 'instance', unit: 'times' },
    },
    events: [
      { id: '1', activitySnapshot: { id: 'gone', metric: 'instance', unit: 'times' } },
      { id: '2' },
    ],
    history: [{ id: 'h', activitySnapshot: { id: 'gone', metric: 'instance', unit: 'times' } }],
  };

  type Unitful = { unit?: string };
  type V8 = {
    activities: Unitful[];
    weekActivities: Record<string, Unitful>;
    events: Array<{ id: string; activitySnapshot?: Unitful }>;
    history: Array<{ activitySnapshot: Unitful }>;
  };

  it('relabels the instance unit everywhere it is stored', () => {
    const result = migrateStore(v7, 7) as V8;

    expect(result.activities[0].unit).toBe('sessions');
    expect(result.weekActivities['2020-01-06:lift'].unit).toBe('sessions');
    expect(result.events[0].activitySnapshot?.unit).toBe('sessions');
    expect(result.history[0].activitySnapshot.unit).toBe('sessions');
  });

  it('leaves other metrics and hand-written units alone', () => {
    const result = migrateStore(v7, 7) as V8;

    expect(result.activities[1].unit).toBe('miles');
    expect(result.activities[2].unit).toBe('classes');
    expect(result.events[1]).toMatchObject({ id: '2' });
  });
});

describe('migrateStore v8 -> v9', () => {
  const v8 = {
    activities: [{ id: 'run', name: 'Running', icon: 'run', metric: 'distance', unit: 'miles', color: '#f00' }],
    weekActivities: {
      '2020-01-06:run': {
        id: 'run',
        name: 'Monday running',
        icon: 'run',
        metric: 'distance',
        unit: 'km',
        color: '#0f0',
      },
    },
    events: [
      { id: 'in-week', typeId: 'run', weekStart: '2020-01-06' },
      { id: 'no-target', typeId: 'run', weekStart: '2020-01-13' },
      { id: 'unknown', typeId: 'vanished', weekStart: '2020-01-13' },
      {
        id: 'tracking',
        typeId: 'run',
        weekStart: '2020-01-06',
        // Measured the same as its week, so this copy was never frozen — it is
        // only out of date.
        activitySnapshot: { name: 'Stale name', icon: 'run', metric: 'distance', unit: 'km', color: '#00f' },
      },
      {
        id: 'already',
        typeId: 'run',
        weekStart: '2020-01-06',
        activitySnapshot: { name: 'Old running', icon: 'run', metric: 'distance', unit: 'miles', color: '#00f' },
      },
    ],
  };

  type V9 = {
    events: Array<{
      id: string;
      activitySnapshot: { name: string; unit: string };
      activityFrozen?: boolean;
    }>;
  };

  const eventsById = () => {
    const result = migrateStore(v8, 8) as V9;
    return Object.fromEntries(result.events.map(e => [e.id, e]));
  };

  it('takes the copy from the event\'s own week when that week has one', () => {
    const event = eventsById()['in-week'];
    expect(event.activitySnapshot.name).toBe('Monday running');
    expect(event.activitySnapshot.unit).toBe('km');
    expect(event.activityFrozen).toBeFalsy();
  });

  it('falls back to the template for a week with no target', () => {
    const event = eventsById()['no-target'];
    expect(event.activitySnapshot.name).toBe('Running');
    expect(event.activitySnapshot.unit).toBe('miles');
  });

  it('gives an event nothing knows about a frozen placeholder', () => {
    const event = eventsById()['unknown'];
    expect(event.activitySnapshot.name).toBe('Workout');
    expect(event.activityFrozen).toBe(true);
  });

  it('refreshes a copy that was still tracking its week', () => {
    const event = eventsById()['tracking'];
    expect(event.activitySnapshot.name).toBe('Monday running');
    expect(event.activityFrozen).toBe(false);
  });

  it('keeps a copy taken because the week re-measured it, and marks it frozen', () => {
    const event = eventsById()['already'];
    expect(event.activitySnapshot.name).toBe('Old running');
    expect(event.activityFrozen).toBe(true);
  });
});
