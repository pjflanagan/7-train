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
    expect(result.events).toEqual(v2.items);
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
    expect(result.events).toEqual(v3.events);
    expect(result.notes).toEqual(v3.notes);
  });
});
