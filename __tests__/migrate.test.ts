import { describe, it, expect, beforeEach } from 'vitest';
import { importLegacy } from '@/lib/migrate';

describe('migrate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null if nothing in localStorage', () => {
    expect(importLegacy()).toBeNull();
  });

  it('imports legacy activities and maps icons', () => {
    localStorage.setItem('workout_week_types', JSON.stringify([
      {
        id: 'type-1',
        name: 'My Activity',
        icon: 'fitness_center', // legacy material icon
        metric: 'times',
        target: 2,
        color: '#ff0000'
      }
    ]));

    const state = importLegacy();
    expect(state).not.toBeNull();
    expect(state?.activities?.[0].icon).toBe('gym'); // mapped properly
    expect(state?.activities?.[0].unit).toBe('times'); // forced by times metric
    
    // verify it cleaned up
    expect(localStorage.getItem('workout_week_types')).toBeNull();
  });

  it('forces calendar events for times activities to value=1', () => {
    localStorage.setItem('workout_week_types', JSON.stringify([
      { id: 'type-1', name: 'My Activity', icon: 'fitness_center', metric: 'times', target: 2, color: '#ff0000', unit: 'times' }
    ]));
    localStorage.setItem('workout_week_calendar', JSON.stringify([
      { id: 'event-1', typeId: 'type-1', day: 'monday', value: 5 }
    ]));

    const state = importLegacy();
    expect(state?.events?.[0].value).toBe(1);
  });
});
