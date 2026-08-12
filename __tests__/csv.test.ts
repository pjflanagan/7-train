import { describe, it, expect } from 'vitest';
import { exportCsv } from '../lib/csv';
import { HistoryEntry, WorkoutType } from '../lib/types';

describe('csv export', () => {
  it('exports basic history', () => {
    const history: HistoryEntry[] = [
      { id: '1', date: '2023-10-18', day: 'wednesday', typeId: 'a', value: 4, notes: 'good run' }
    ];
    const types: WorkoutType[] = [
      { id: 'a', name: 'Run', icon: 'run', metric: 'distance', unit: 'mi', target: 10, color: 'red' }
    ];

    const result = exportCsv(history, types);
    expect(result).toContain('2023-10-18,Wednesday,Run,,4,mi,good run');
  });

  it('escapes quotes and commas', () => {
    const history: HistoryEntry[] = [
      { id: '1', date: '2023-10-18', day: 'wednesday', typeId: 'a', value: 4, notes: 'a "good" run, really' }
    ];
    const types: WorkoutType[] = [
      { id: 'a', name: 'Run', icon: 'run', metric: 'distance', unit: 'mi', target: 10, color: 'red' }
    ];

    const result = exportCsv(history, types);
    expect(result).toContain('"a ""good"" run, really"');
  });
});
