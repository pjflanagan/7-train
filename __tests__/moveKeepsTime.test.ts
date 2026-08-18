import { beforeEach, describe, expect, it } from 'vitest';
import { usePlannerStore } from '@/lib/store';
import { getWeekStartKey } from '@/lib/dates';
import { startMinutesOf } from '@/lib/schedule';
import { ScheduledEvent, Activity } from '@/lib/types';
import { buildActivitySnapshot } from '@/lib/activitySnapshot';

const weekStart = getWeekStartKey(new Date(), 1);

/** A 30 minute activity, so every duration in here is exact and easy to read. */
const activity: Activity = {
  id: 'half-hour',
  name: 'Half hour',
  icon: 'run',
  metric: 'duration',
  unit: 'mins',
  target: null,
  color: '#000000',
};

// Every event carries its own copy of its activity, which is what the day's
// stacking reads its length from — no week target needed.
const event = (id: string, startMinutes: number): ScheduledEvent => ({
  id,
  typeId: activity.id,
  day: 'monday',
  weekStart,
  value: 30,
  startMinutes,
  activitySnapshot: buildActivitySnapshot(activity),
});

const find = (id: string) => usePlannerStore.getState().events.find(i => i.id === id)!;
const startOf = (id: string) => startMinutesOf(find(id));

/**
 * Dropping a workout used to re-time it from whatever it landed beside, which
 * was the last way in the app to set a start time by hand. Start times belong
 * to Google Calendar now, so a move answers one question only: which day.
 */
describe('moving a workout', () => {
  beforeEach(() => {
    usePlannerStore.getState().resetAll();
    usePlannerStore.setState({
      activities: [activity],
      // 7:00 and 9:00, a two hour gap so any re-timing would be obvious.
      events: [event('first', 7 * 60), event('second', 9 * 60)],
    });
  });

  it('keeps the time it already had', () => {
    usePlannerStore.getState().moveEvent('first', 'thursday', weekStart);

    expect(find('first').day).toBe('thursday');
    expect(startOf('first')).toBe(7 * 60);
  });

  it('leaves the day it landed on exactly as it was', () => {
    usePlannerStore.setState({
      events: [
        event('first', 7 * 60),
        event('second', 9 * 60),
        { ...event('visitor', 6 * 60), day: 'tuesday' },
      ],
    });

    usePlannerStore.getState().moveEvent('visitor', 'monday', weekStart);

    // It arrives at 6:00 — before both of them — rather than being stacked
    // after whichever workout it was dropped nearest.
    expect(startOf('visitor')).toBe(6 * 60);
    expect(startOf('first')).toBe(7 * 60);
    expect(startOf('second')).toBe(9 * 60);
  });

  it('carries its time across into another week', () => {
    usePlannerStore.getState().moveEvent('second', 'sunday', '2020-01-06');

    expect(find('second').weekStart).toBe('2020-01-06');
    expect(startOf('second')).toBe(9 * 60);
  });
});
