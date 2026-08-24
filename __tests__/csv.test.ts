import { describe, it, expect } from 'vitest';
import { exportCsv, entriesFromSchedule } from '@/lib/csv';
import { HistoryEntry, Activity, ScheduledEvent } from '@/lib/types';

describe('csv export', () => {
  it('exports basic history', () => {
    const history: HistoryEntry[] = [
      { id: '1', date: '2023-10-18', day: 'wednesday', typeId: 'a', value: 4, notes: 'good run' }
    ];
    const types: Activity[] = [
      { id: 'a', name: 'Run', icon: 'run', metric: 'distance', unit: 'mi', target: 10, color: 'red' }
    ];

    const result = exportCsv(history, types);
    expect(result).toContain('2023-10-18,Wednesday,Run,,4,mi,good run');
  });

  it('escapes quotes and commas', () => {
    const history: HistoryEntry[] = [
      { id: '1', date: '2023-10-18', day: 'wednesday', typeId: 'a', value: 4, notes: 'a "good" run, really' }
    ];
    const types: Activity[] = [
      { id: 'a', name: 'Run', icon: 'run', metric: 'distance', unit: 'mi', target: 10, color: 'red' }
    ];

    const result = exportCsv(history, types);
    expect(result).toContain('"a ""good"" run, really"');
  });
});

describe('entriesFromSchedule', () => {
  const events: ScheduledEvent[] = [
    { id: 'i1', typeId: 'a', day: 'monday', weekStart: '2023-10-16', value: 4 },
    { id: 'i2', typeId: 'a', day: 'sunday', weekStart: '2023-10-09', value: 2 },
  ];

  it('dates each event from its week and day', () => {
    const entries = entriesFromSchedule(events, 1);
    const dates = entries.map(e => e.date);

    expect(dates).toContain('2023-10-16'); // Monday of that week
    expect(dates).toContain('2023-10-15'); // Sunday closes the prior week
  });

  it('returns rows in date order across weeks', () => {
    const entries = entriesFromSchedule(events, 1);
    expect(entries.map(e => e.date)).toEqual(['2023-10-15', '2023-10-16']);
  });

  it("carries each workout's own note", () => {
    // A note belongs to the workout now, not to the day, so it lands on that
    // workout's row and on no other.
    const noted: ScheduledEvent[] = [
      { ...events[0], note: 'felt strong' },
      events[1],
    ];
    const entries = entriesFromSchedule(noted, 1);
    expect(entries.find(e => e.date === '2023-10-16')?.notes).toBe('felt strong');
    expect(entries.find(e => e.date === '2023-10-15')?.notes).toBeNull();
  });

  it('has nothing to say about a day with no workouts on it', () => {
    // There used to be a note-only row here, standing for a day note on a rest
    // day. Nothing carries such a note any more, so nothing invents a row.
    expect(entriesFromSchedule([], 1)).toEqual([]);
  });

  it('shifts dates when the week starts on Sunday', () => {
    const sundayWeek: ScheduledEvent[] = [
      { id: 'i1', typeId: 'a', day: 'monday', weekStart: '2023-10-15', value: 1 },
    ];
    const entries = entriesFromSchedule(sundayWeek, 0);
    expect(entries[0].date).toBe('2023-10-16');
  });
});
