import { beforeEach, describe, expect, it } from 'vitest';
import { usePlannerStore } from '@/lib/store';
import { getWeekStartKey } from '@/lib/dates';

const weekStart = getWeekStartKey(new Date(), 1);

const only = () => usePlannerStore.getState().events[0];

/** An edit made strictly after the event was created, however fast the test runs. */
const backdate = () => {
  usePlannerStore.setState({
    events: usePlannerStore.getState().events.map(i => ({ ...i, updatedAt: '2020-01-01T00:00:00.000Z' })),
  });
};

describe('event updatedAt', () => {
  beforeEach(() => {
    usePlannerStore.getState().resetAll();
    usePlannerStore.setState({ events: [] });
    usePlannerStore.getState().addEvent({
      typeId: usePlannerStore.getState().activities[0].id,
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
    usePlannerStore.getState().updateEventValue(only().id, 5);
    expect(only().updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('restamps when the time or length changes', () => {
    backdate();
    usePlannerStore.getState().setEventTime(only().id, 9 * 60);
    const afterTime = only().updatedAt!;
    expect(afterTime).not.toBe('2020-01-01T00:00:00.000Z');

    usePlannerStore.setState({ events: [{ ...only(), updatedAt: '2020-01-01T00:00:00.000Z' }] });
    usePlannerStore.getState().setEventDuration(only().id, 90);
    expect(only().updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('restamps when it moves to another day', () => {
    backdate();
    usePlannerStore.getState().moveEvent(only().id, 'friday', weekStart);
    expect(only().updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('leaves it alone when only the Google event id is learned', () => {
    backdate();
    usePlannerStore.getState().setGoogleEventIds({ [only().id]: 'evt-1' });
    expect(only().googleEventId).toBe('evt-1');
    expect(only().updatedAt).toBe('2020-01-01T00:00:00.000Z');
  });
});
