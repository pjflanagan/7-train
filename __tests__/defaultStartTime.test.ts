import { beforeEach, describe, expect, it } from 'vitest';
import { usePlannerStore } from '@/lib/store';
import { getWeekStartKey } from '@/lib/dates';
import { startMinutesOf } from '@/lib/schedule';

const weekStart = getWeekStartKey(new Date(), 1);

const add = (day: 'monday' | 'tuesday') => {
  const before = usePlannerStore.getState().events.map(i => i.id);
  usePlannerStore.getState().addEvent({
    typeId: usePlannerStore.getState().activities[0].id,
    day,
    weekStart,
    value: 3,
  });
  return usePlannerStore.getState().events.find(i => !before.includes(i.id))!;
};

describe('default workout time', () => {
  beforeEach(() => {
    usePlannerStore.getState().resetAll();
    usePlannerStore.setState({ events: [] });
  });

  it('starts a new workout at the time the setting names', () => {
    usePlannerStore.getState().setDefaultStartMinutes(18 * 60);
    expect(startMinutesOf(add('monday'))).toBe(18 * 60);
  });

  it('snaps a setting off the quarter hour', () => {
    usePlannerStore.getState().setDefaultStartMinutes(6 * 60 + 8);
    expect(usePlannerStore.getState().defaultStartMinutes).toBe(6 * 60 + 15);
  });

  it('still stacks a second workout after the first', () => {
    usePlannerStore.getState().setDefaultStartMinutes(6 * 60);
    const first = add('monday');
    const second = add('monday');
    expect(startMinutesOf(first)).toBe(6 * 60);
    expect(startMinutesOf(second)).toBeGreaterThan(startMinutesOf(first));
  });
});
