import { describe, it, expect } from 'vitest';
import { calculateProgress, getOverallProgress } from '@/lib/progress';
import { Activity, ScheduledEvent } from '@/lib/types';

describe('progress math', () => {
  it('calculates correct progress for single type', () => {
    const types: Activity[] = [
      { id: '1', name: 'Run', icon: 'run', metric: 'distance', unit: 'mi', target: 10, color: 'red' }
    ];
    const events: ScheduledEvent[] = [
      { id: 'i1', typeId: '1', day: 'monday', value: 4, weekStart: '2023-10-09' },
      { id: 'i2', typeId: '1', day: 'wednesday', value: 6, weekStart: '2023-10-09' },
    ];
    const result = calculateProgress(types, events);
    expect(result['1'].current).toBe(10);
    expect(result['1'].percent).toBe(100);
    expect(result['1'].isDone).toBe(true);
  });

  it('handles optional types', () => {
    const types: Activity[] = [
      { id: '1', name: 'Walk', icon: 'walk', metric: 'distance', unit: 'mi', target: null, color: 'red', optional: true }
    ];
    const events: ScheduledEvent[] = [
      { id: 'i1', typeId: '1', day: 'monday', value: 3, weekStart: '2023-10-09' },
    ];
    const result = calculateProgress(types, events);
    expect(result['1'].current).toBe(3);
    expect(result['1'].percent).toBe(0);
    expect(result['1'].isDone).toBe(true);

    const overall = getOverallProgress(result);
    expect(overall.total).toBe(1);
  });

  it('overall progress fallback when no required activities', () => {
    const types: Activity[] = [
      { id: '1', name: 'Walk', icon: 'walk', metric: 'distance', unit: 'mi', target: null, color: 'red', optional: true }
    ];
    const events: ScheduledEvent[] = [
      { id: 'i1', typeId: '1', day: 'monday', value: 3, weekStart: '2023-10-09' },
    ];
    const result = calculateProgress(types, events);
    const overall = getOverallProgress(result);
    expect(overall.total).toBe(1);
    expect(overall.completed).toBe(1);
    expect(overall.percent).toBe(0);
  });
});
