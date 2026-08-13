import { beforeEach, describe, expect, it } from 'vitest';
import { usePlannerStore } from '@/lib/store';
import { getWeekStartKey } from '@/lib/dates';
import { startMinutesOf } from '@/lib/schedule';
import { CalendarItem, WorkoutType } from '@/lib/types';

const weekStart = getWeekStartKey(new Date(), 1);

/** A 30 minute goal, so every duration in here is exact and easy to read. */
const goal: WorkoutType = {
  id: 'half-hour',
  name: 'Half hour',
  icon: 'run',
  metric: 'duration',
  unit: 'mins',
  target: null,
  color: '#000000',
};

const item = (id: string, startMinutes: number): CalendarItem => ({
  id,
  typeId: goal.id,
  day: 'monday',
  weekStart,
  value: 30,
  startMinutes,
});

const startOf = (id: string) =>
  startMinutesOf(usePlannerStore.getState().items.find(i => i.id === id)!);

describe('dropping a workout after another', () => {
  beforeEach(() => {
    usePlannerStore.getState().resetAll();
    usePlannerStore.setState({
      goals: [goal],
      // 7:00 and 9:00, a two hour gap so a swap is obvious.
      items: [item('first', 7 * 60), item('second', 9 * 60)],
    });
  });

  it('starts it when the workout above it ends, leaving that one alone', () => {
    usePlannerStore.getState().reorderDay('monday', weekStart, 0, 1);

    expect(startOf('second')).toBe(9 * 60);
    expect(startOf('first')).toBe(9 * 60 + 30);
  });

  it('does not trade times with the workout it passed', () => {
    usePlannerStore.getState().reorderDay('monday', weekStart, 0, 1);
    expect(startOf('first')).not.toBe(9 * 60);
  });

  it('leaves a workout dragged to the top of the day at its own earlier time', () => {
    usePlannerStore.getState().reorderDay('monday', weekStart, 1, 0);

    expect(startOf('first')).toBe(7 * 60);
    // 9:00 is later than the 7:00 now under it, so it comes back to 7:00.
    expect(startOf('second')).toBe(7 * 60);
  });

  it('applies the same rule when the workout comes from another day', () => {
    usePlannerStore.setState({
      items: [
        item('first', 7 * 60),
        item('second', 9 * 60),
        { ...item('visitor', 6 * 60), day: 'tuesday' },
      ],
    });

    usePlannerStore.getState().moveItem('visitor', 'monday', weekStart, 1);

    expect(startOf('visitor')).toBe(7 * 60 + 30);
    expect(startOf('first')).toBe(7 * 60);
    expect(startOf('second')).toBe(9 * 60);
  });
});
