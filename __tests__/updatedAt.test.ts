import { beforeEach, describe, expect, it } from 'vitest';
import { usePlannerStore } from '@/lib/store';
import { getWeekStartKey } from '@/lib/dates';

const weekStart = getWeekStartKey(new Date(), 1);

const only = () => usePlannerStore.getState().items[0];

/** An edit made strictly after the item was created, however fast the test runs. */
const backdate = () => {
  usePlannerStore.setState({
    items: usePlannerStore.getState().items.map(i => ({ ...i, updatedAt: '2020-01-01T00:00:00.000Z' })),
  });
};

describe('item updatedAt', () => {
  beforeEach(() => {
    usePlannerStore.getState().resetAll();
    usePlannerStore.setState({ items: [] });
    usePlannerStore.getState().addItem({
      typeId: usePlannerStore.getState().goals[0].id,
      day: 'monday',
      weekStart,
      value: 3,
    });
  });

  it('stamps a new workout', () => {
    expect(Date.parse(only().updatedAt!)).not.toBeNaN();
  });

  it('restamps when the value changes', () => {
    backdate();
    usePlannerStore.getState().updateItemValue(only().id, 5);
    expect(only().updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('restamps when the time or length changes', () => {
    backdate();
    usePlannerStore.getState().setItemTime(only().id, 9 * 60);
    const afterTime = only().updatedAt!;
    expect(afterTime).not.toBe('2020-01-01T00:00:00.000Z');

    usePlannerStore.setState({ items: [{ ...only(), updatedAt: '2020-01-01T00:00:00.000Z' }] });
    usePlannerStore.getState().setItemDuration(only().id, 90);
    expect(only().updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('restamps when it moves to another day', () => {
    backdate();
    usePlannerStore.getState().moveItem(only().id, 'friday', weekStart);
    expect(only().updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('leaves it alone when only the Google event id is learned', () => {
    backdate();
    usePlannerStore.getState().setGoogleEventIds({ [only().id]: 'evt-1' });
    expect(only().googleEventId).toBe('evt-1');
    expect(only().updatedAt).toBe('2020-01-01T00:00:00.000Z');
  });
});
