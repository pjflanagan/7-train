import { describe, it, expect } from 'vitest';
import { migrateStore } from '@/lib/migrate';
import { getWeekStartKey, addWeeks } from '@/lib/dates';

const thisWeek = getWeekStartKey(new Date(), 1);
const nextWeek = addWeeks(thisWeek, 1);

type MigratedItem = { id: string; weekStart?: string; week?: number };
type Migrated = { items: MigratedItem[]; notes: Record<string, string>; weekStartsOn: number };

describe('migrateStore v1 -> v2', () => {
  const v1 = {
    items: [
      { id: '1', typeId: 'a', day: 'monday', week: 1, value: 1 },
      { id: '2', typeId: 'b', day: 'tuesday', week: 2, value: 2 },
      { id: '3', typeId: 'c', day: 'friday', value: 3 }, // no week -> week 1
    ],
    notes: { 'monday-1': 'first', 'tuesday-2': 'second' },
  };

  it('anchors week 1 to the current week and week 2 to the next', () => {
    const result = migrateStore(v1, 1) as Migrated;
    const byId = Object.fromEntries(result.items.map(i => [i.id, i]));

    expect(byId['1'].weekStart).toBe(thisWeek);
    expect(byId['2'].weekStart).toBe(nextWeek);
    expect(byId['3'].weekStart).toBe(thisWeek);
  });

  it('drops the obsolete relative slot', () => {
    const result = migrateStore(v1, 1) as Migrated;
    result.items.forEach(item => expect(item.week).toBeUndefined());
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

  it('leaves already-migrated state alone', () => {
    const v2 = { items: [{ id: '1', weekStart: '2020-01-06' }], notes: {} };
    expect(migrateStore(v2, 2)).toBe(v2);
  });
});
