import { describe, expect, it } from 'vitest';
import {
  byStartTime,
  clampDuration,
  clampStartMinutes,
  durationMinutesOf,
  estimateDurationMinutes,
  formatDuration,
  isExactDuration,
  startMinutesOf,
} from '@/lib/schedule';
import { CalendarItem, WorkoutType } from '@/lib/types';

const goal = (overrides: Partial<WorkoutType>): WorkoutType => ({
  id: 'goal',
  name: 'Goal',
  icon: 'run',
  metric: 'distance',
  unit: 'miles',
  target: null,
  color: '#000000',
  ...overrides,
});

const item = (overrides: Partial<CalendarItem> = {}): CalendarItem => ({
  id: 'item',
  typeId: 'goal',
  day: 'monday',
  weekStart: '2026-08-10',
  value: 1,
  ...overrides,
});

describe('estimateDurationMinutes', () => {
  it('takes a duration goal at its word', () => {
    const minutes = estimateDurationMinutes(
      item({ value: 45 }),
      goal({ metric: 'duration', unit: 'mins' })
    );
    expect(minutes).toBe(45);
  });

  it('reads a duration goal measured in hours as hours', () => {
    const minutes = estimateDurationMinutes(
      item({ value: 1.5 }),
      goal({ metric: 'duration', unit: 'hours' })
    );
    expect(minutes).toBe(90);
  });

  it('estimates a distance goal from a per-mile pace', () => {
    const minutes = estimateDurationMinutes(
      item({ value: 6 }),
      goal({ metric: 'distance', unit: 'miles', icon: 'run' })
    );
    // 6 miles at ~9 min/mile, snapped to a quarter hour.
    expect(minutes).toBe(60);
  });

  it('converts kilometres before applying the pace', () => {
    const miles = estimateDurationMinutes(
      item({ value: 10 }),
      goal({ metric: 'distance', unit: 'miles', icon: 'bike' })
    );
    const km = estimateDurationMinutes(
      item({ value: 10 }),
      goal({ metric: 'distance', unit: 'km', icon: 'bike' })
    );
    expect(km).toBeLessThan(miles);
  });

  it('prefers the goal\'s own pace over the per-icon table', () => {
    const minutes = estimateDurationMinutes(
      item({ value: 4 }),
      goal({ metric: 'distance', unit: 'miles', icon: 'run', paceMinutes: 12 })
    );
    // 4 × 12 = 48, up to the next quarter hour — not the 9 min/mile default.
    expect(minutes).toBe(60);
  });

  it('reads a set pace as per the goal\'s own unit, without converting', () => {
    const minutes = estimateDurationMinutes(
      item({ value: 10 }),
      goal({ metric: 'distance', unit: 'km', paceMinutes: 6 })
    );
    expect(minutes).toBe(60);
  });

  it('rounds an estimated distance up to the next quarter hour', () => {
    const minutes = estimateDurationMinutes(
      item({ value: 3 }),
      goal({ metric: 'distance', unit: 'miles', paceMinutes: 10 })
    );
    // 30 exactly stays put; 31 would round up rather than down.
    expect(minutes).toBe(30);
    expect(
      estimateDurationMinutes(item({ value: 3.1 }), goal({ metric: 'distance', paceMinutes: 10 }))
    ).toBe(45);
  });

  it('uses the typical session length for a count goal', () => {
    const minutes = estimateDurationMinutes(
      item({ value: 1 }),
      goal({ metric: 'times', unit: 'times', typicalDurationMinutes: 50 })
    );
    expect(minutes).toBe(60);
  });

  it('falls back to a flat session for a count goal', () => {
    expect(estimateDurationMinutes(item({ value: 1 }), goal({ metric: 'times' }))).toBe(45);
  });

  it('never returns less than one slot', () => {
    const minutes = estimateDurationMinutes(
      item({ value: 1 }),
      goal({ metric: 'duration', unit: 'mins' })
    );
    expect(minutes).toBe(15);
  });

  it('marks only duration goals as exact', () => {
    expect(isExactDuration(item(), goal({ metric: 'duration' }))).toBe(true);
    expect(isExactDuration(item(), goal({ metric: 'distance' }))).toBe(false);
  });

  it('treats a hand-set length as exact', () => {
    expect(isExactDuration(item({ durationMinutes: 30 }), goal({ metric: 'distance' }))).toBe(
      true
    );
  });
});

describe('durationMinutesOf', () => {
  it('prefers a hand-set length over the estimate', () => {
    expect(durationMinutesOf(item({ value: 6, durationMinutes: 30 }), goal({}))).toBe(30);
  });

  it('falls back to the estimate when nothing was set', () => {
    expect(durationMinutesOf(item({ value: 6 }), goal({ icon: 'run' }))).toBe(60);
  });

  it('snaps and bounds a dragged length', () => {
    expect(clampDuration(38)).toBe(45);
    expect(clampDuration(0)).toBe(15);
    expect(clampDuration(10 * 60)).toBe(8 * 60);
  });
});

describe('start times', () => {
  it('defaults an item with no time to the morning slot', () => {
    expect(startMinutesOf(item())).toBe(7 * 60);
  });

  it('snaps to quarter hours and stays inside the day', () => {
    expect(clampStartMinutes(7 * 60 + 8)).toBe(7 * 60 + 15);
    expect(clampStartMinutes(7 * 60 + 7)).toBe(7 * 60);
    expect(clampStartMinutes(-30)).toBe(0);
    expect(clampStartMinutes(25 * 60)).toBe(23 * 60 + 45);
  });

  it('orders a day by when things happen, keeping ties stable', () => {
    const evening = item({ id: 'evening', startMinutes: 18 * 60 });
    const morningA = item({ id: 'a', startMinutes: 6 * 60 });
    const morningB = item({ id: 'b', startMinutes: 6 * 60 });

    expect(byStartTime([evening, morningA, morningB]).map(i => i.id)).toEqual([
      'a',
      'b',
      'evening',
    ]);
  });
});

describe('formatDuration', () => {
  it('reads as minutes under an hour and hours above', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h 30m');
  });
});
