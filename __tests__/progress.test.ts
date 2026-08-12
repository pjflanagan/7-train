import { describe, it, expect } from 'vitest';
import { calculateProgress, getOverallProgress } from '../lib/progress';
import { WorkoutType, CalendarItem } from '../lib/types';

describe('progress math', () => {
  it('calculates correct progress for single type', () => {
    const types: WorkoutType[] = [
      { id: '1', name: 'Run', icon: 'run', metric: 'distance', unit: 'mi', target: 10, color: 'red' }
    ];
    const items: CalendarItem[] = [
      { id: 'i1', typeId: '1', day: 'monday', value: 4, week: 1 },
      { id: 'i2', typeId: '1', day: 'wednesday', value: 6, week: 1 },
    ];
    const result = calculateProgress(types, items);
    expect(result['1'].current).toBe(10);
    expect(result['1'].percent).toBe(100);
    expect(result['1'].isDone).toBe(true);
  });

  it('handles optional types', () => {
    const types: WorkoutType[] = [
      { id: '1', name: 'Walk', icon: 'walk', metric: 'distance', unit: 'mi', target: null, color: 'red', optional: true }
    ];
    const items: CalendarItem[] = [
      { id: 'i1', typeId: '1', day: 'monday', value: 3, week: 1 },
    ];
    const result = calculateProgress(types, items);
    expect(result['1'].current).toBe(3);
    expect(result['1'].percent).toBe(0);
    expect(result['1'].isDone).toBe(true);

    const overall = getOverallProgress(result);
    expect(overall.total).toBe(1);
  });

  it('overall progress fallback when no required goals', () => {
    const types: WorkoutType[] = [
      { id: '1', name: 'Walk', icon: 'walk', metric: 'distance', unit: 'mi', target: null, color: 'red', optional: true }
    ];
    const items: CalendarItem[] = [
      { id: 'i1', typeId: '1', day: 'monday', value: 3, week: 1 },
    ];
    const result = calculateProgress(types, items);
    const overall = getOverallProgress(result);
    expect(overall.total).toBe(1);
    expect(overall.completed).toBe(1);
    expect(overall.percent).toBe(0);
  });
});
