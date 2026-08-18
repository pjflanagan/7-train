import { describe, it, expect } from 'vitest';
import {
  getWeekStartKey,
  addWeeks,
  weeksBetween,
  orderedDays,
  dateForDay,
  weekLabel,
  formatDateLocal,
  slotForDate,
} from '@/lib/dates';

// 2023-10-18 is a Wednesday.
const wednesday = new Date('2023-10-18T12:00:00');

describe('getWeekStartKey', () => {
  it('snaps back to Monday by default', () => {
    expect(getWeekStartKey(wednesday, 1)).toBe('2023-10-16');
  });

  it('snaps back to Sunday when weeks start on Sunday', () => {
    expect(getWeekStartKey(wednesday, 0)).toBe('2023-10-15');
  });

  it('snaps back to Saturday when weeks start on Saturday', () => {
    expect(getWeekStartKey(wednesday, 6)).toBe('2023-10-14');
  });

  it('treats a day that is itself the week start as its own week', () => {
    expect(getWeekStartKey(new Date('2023-10-16T00:00:00'), 1)).toBe('2023-10-16');
  });
});

describe('addWeeks / weeksBetween', () => {
  it('shifts forwards and backwards', () => {
    expect(addWeeks('2023-10-16', 1)).toBe('2023-10-23');
    expect(addWeeks('2023-10-16', -2)).toBe('2023-10-02');
  });

  it('crosses a DST boundary without drifting', () => {
    // US DST ended 2023-11-05.
    expect(addWeeks('2023-10-30', 2)).toBe('2023-11-13');
  });

  it('measures signed distance in weeks', () => {
    expect(weeksBetween('2023-10-16', '2023-10-30')).toBe(2);
    expect(weeksBetween('2023-10-30', '2023-10-16')).toBe(-2);
  });
});

describe('orderedDays', () => {
  it('is Monday-first by default', () => {
    expect(orderedDays(1)[0]).toBe('monday');
    expect(orderedDays(1)[6]).toBe('sunday');
  });

  it('rotates to the configured start day', () => {
    expect(orderedDays(0)[0]).toBe('sunday');
    expect(orderedDays(6)[0]).toBe('saturday');
    expect(orderedDays(6)[6]).toBe('friday');
  });

  it('always contains all seven days', () => {
    expect(new Set(orderedDays(3)).size).toBe(7);
  });
});

describe('dateForDay', () => {
  it('maps a day onto its date within the week', () => {
    expect(formatDateLocal(dateForDay('2023-10-16', 'monday', 1))).toBe('2023-10-16');
    expect(formatDateLocal(dateForDay('2023-10-16', 'sunday', 1))).toBe('2023-10-22');
  });

  it('honours a Sunday-first week', () => {
    expect(formatDateLocal(dateForDay('2023-10-15', 'sunday', 0))).toBe('2023-10-15');
    expect(formatDateLocal(dateForDay('2023-10-15', 'saturday', 0))).toBe('2023-10-21');
  });
});

describe('weekLabel', () => {
  const current = '2023-10-16';

  it('names the weeks around the current one', () => {
    expect(weekLabel(current, current)).toBe('This week');
    expect(weekLabel('2023-10-23', current)).toBe('Next week');
    expect(weekLabel('2023-10-09', current)).toBe('Last week');
  });

  it('falls back to a dated label further out', () => {
    expect(weekLabel('2023-10-30', current)).toContain('Week of');
    expect(weekLabel('2023-10-02', current)).toContain('Week of');
  });
});

describe('slotForDate', () => {
  // Moving a workout on a phone is a date, and the plan stores a (day, week)
  // pair: getting the week wrong drops the workout into a week nobody is
  // looking at, so the pair is worked out in one place.
  it('names the day and the week a date belongs to', () => {
    expect(slotForDate('2023-10-18', 1)).toEqual({
      day: 'wednesday',
      weekStart: '2023-10-16',
    });
  });

  it('puts the same date in a different week when weeks start elsewhere', () => {
    // A Sunday is the last day of a Monday-first week and the first day of a
    // Sunday-first one — same day name, different week.
    expect(slotForDate('2023-10-22', 1)).toEqual({
      day: 'sunday',
      weekStart: '2023-10-16',
    });
    expect(slotForDate('2023-10-22', 0)).toEqual({
      day: 'sunday',
      weekStart: '2023-10-22',
    });
  });

  it('reads a date key as local midnight rather than UTC', () => {
    // Parsed as UTC, a date west of Greenwich lands on the day before.
    expect(slotForDate('2023-10-16', 1).weekStart).toBe('2023-10-16');
  });
});
