import { describe, it, expect } from 'vitest';
import { migrateStore } from '@/lib/migrate';
import { getWeekStartKey, addWeeks } from '@/lib/dates';

const thisWeek = getWeekStartKey(new Date(), 1);
const nextWeek = addWeeks(thisWeek, 1);

type MigratedEvent = { id: string; weekStart?: string; week?: number; note?: string };
type Migrated = { events: MigratedEvent[]; notes?: Record<string, string>; weekStartsOn: number };

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

  it("rekeys notes far enough to reach the day's workout", () => {
    // v1 keyed a note `${day}-${week}` against a relative week. v2 rekeys it to
    // a real date and v11 hands it to the workout on that day, so a note
    // written in the very first shape still ends up somewhere.
    const result = migrateStore(v1, 1) as Migrated;
    const byId = Object.fromEntries(result.events.map(i => [i.id, i]));

    expect(byId['1'].note).toBe('first');   // monday of this week
    expect(byId['2'].note).toBe('second');  // tuesday of next week
    expect(result.notes).toBeUndefined();
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

    // Later steps add fields of their own, so this is about the rename only.
    expect(result.activities).toMatchObject(v2.goals);
    expect(result.events).toMatchObject(v2.items);
    expect(result.goals).toBeUndefined();
    expect(result.items).toBeUndefined();
  });

  it('carries everything else across untouched', () => {
    const result = migrateStore(v2, 2) as Record<string, unknown>;

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

describe('migrateStore v9 -> v10', () => {
  const v9 = {
    activities: [
      { id: 'run', name: 'Long run', icon: 'run' },
      { id: 'erg', name: 'Erg', icon: 'row' },
      { id: 'mob', name: 'Mobility', icon: 'heart' },
      { id: 'set', name: 'Already answered', icon: 'run', stravaSportTypes: ['TrailRun'] },
    ],
    weekActivities: {
      '2026-08-10:run': { id: 'run', name: 'Long run', icon: 'run' },
    },
  };

  const result = migrateStore(v9, 9) as Record<string, unknown>;
  const activities = result.activities as Record<string, unknown>[];
  const byId = Object.fromEntries(activities.map((a) => [a.id as string, a]));

  it('seeds the sports an activity accepts from the icon it already had', () => {
    expect(byId.run.stravaSportTypes).toEqual(['Run', 'TrailRun', 'VirtualRun']);
  });

  it('stops a rowing activity from swallowing paddle sports', () => {
    expect(byId.erg.stravaSportTypes).toEqual(['Rowing', 'VirtualRow']);
  });

  it('leaves an icon with no Strava equivalent matching nothing', () => {
    expect(byId.mob.stravaSportTypes).toEqual([]);
  });

  it('never overwrites an answer that is already there', () => {
    expect(byId.set.stravaSportTypes).toEqual(['TrailRun']);
  });

  it('seeds each week’s own copies too, since those are what sync matches', () => {
    const weekActivities = result.weekActivities as Record<string, Record<string, unknown>>;
    expect(weekActivities['2026-08-10:run'].stravaSportTypes).toEqual([
      'Run',
      'TrailRun',
      'VirtualRun',
    ]);
  });
});

describe('migrateStore v10 -> v11', () => {
  // Day notes became notes on the workouts. Only a backup taken before the
  // move can still be carrying the old shape, and this is what happens to it.
  const monday = { id: '1', typeId: 'a', day: 'monday', weekStart: '2026-08-24', value: 4 };
  const alsoMonday = { id: '2', typeId: 'a', day: 'monday', weekStart: '2026-08-24', value: 2 };
  const tuesday = { id: '3', typeId: 'a', day: 'tuesday', weekStart: '2026-08-24', value: 1 };

  const migrate = (state: Record<string, unknown>) =>
    migrateStore(state, 10) as { events: MigratedEvent[]; notes?: unknown };

  it("hands a day's note to the workout on that day", () => {
    const result = migrate({
      events: [monday, tuesday],
      notes: { '2026-08-24-monday': 'felt strong' },
    });
    expect(result.events[0].note).toBe('felt strong');
    expect(result.events[1].note).toBeUndefined();
  });

  it('gives it to the first workout when the day has several', () => {
    // One note, two workouts: there is no reading that splits it, and copying
    // it onto both would invent a note nobody wrote.
    const result = migrate({
      events: [monday, alsoMonday],
      notes: { '2026-08-24-monday': 'felt strong' },
    });
    expect(result.events[0].note).toBe('felt strong');
    expect(result.events[1].note).toBeUndefined();
  });

  it('drops a note about a day nothing was scheduled on', () => {
    // A rest-day note has no workout to belong to. Putting it on a neighbouring
    // day would be worse than losing it.
    const result = migrate({
      events: [tuesday],
      notes: { '2026-08-24-monday': 'rest' },
    });
    expect(result.events[0].note).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it('leaves a note the workout already has', () => {
    const result = migrate({
      events: [{ ...monday, note: 'its own' }],
      notes: { '2026-08-24-monday': 'the day\'s' },
    });
    expect(result.events[0].note).toBe('its own');
  });

  it('takes the key away even when there is nothing to move', () => {
    const result = migrate({ events: [monday] });
    expect(result.notes).toBeUndefined();
    expect(result.events[0].note).toBeUndefined();
  });
});
