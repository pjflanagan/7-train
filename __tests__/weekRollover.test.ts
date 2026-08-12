import { describe, it, expect } from 'vitest';
import { computeRollover } from '../lib/weekRollover';
import { PlannerState } from '../lib/types';
import { formatDateLocal, getMonday } from '../lib/dates';

describe('weekRollover', () => {
  it('does nothing if no weeks passed', () => {
    const today = new Date('2023-10-18T12:00:00'); // Wed
    const mondayStr = formatDateLocal(getMonday(today)); // '2023-10-16'

    const state: PlannerState = {
      goals: [], items: [], notes: {}, links: [], history: [],
      lastViewedMonday: mondayStr
    };

    const result = computeRollover(state, today);
    expect(result).toEqual(state);
  });

  it('shifts week 2 to week 1 if 1 week passed', () => {
    const lastViewedStr = '2023-10-09';
    const today = new Date('2023-10-18T12:00:00'); // Wed, next week
    const mondayStr = formatDateLocal(getMonday(today)); // '2023-10-16'

    const state: PlannerState = {
      goals: [],
      items: [
        { id: '1', typeId: 'a', day: 'monday', value: 1, week: 1 },
        { id: '2', typeId: 'b', day: 'tuesday', value: 2, week: 2 }
      ],
      notes: {
        'monday-1': 'note 1',
        'tuesday-2': 'note 2'
      },
      links: [],
      history: [],
      lastViewedMonday: lastViewedStr
    };

    const result = computeRollover(state, today);

    expect(result.lastViewedMonday).toBe(mondayStr);
    expect(result.items.length).toBe(1);
    expect(result.items[0].week).toBe(1);
    expect(result.items[0].id).toBe('2');
    
    expect(result.notes['tuesday-1']).toBe('note 2');
    expect(result.notes['monday-1']).toBeUndefined();
    
    expect(result.history.length).toBe(1);
  });

  it('clears everything if >= 2 weeks passed', () => {
    const lastViewedStr = '2023-10-02';
    const today = new Date('2023-10-18T12:00:00'); // Wed, 2 weeks later
    const mondayStr = formatDateLocal(getMonday(today)); // '2023-10-16'

    const state: PlannerState = {
      goals: [],
      items: [
        { id: '1', typeId: 'a', day: 'monday', value: 1, week: 1 },
        { id: '2', typeId: 'b', day: 'tuesday', value: 2, week: 2 }
      ],
      notes: {},
      links: [],
      history: [],
      lastViewedMonday: lastViewedStr
    };

    const result = computeRollover(state, today);

    expect(result.items.length).toBe(0);
    expect(result.notes).toEqual({});
    expect(result.history.length).toBe(2);
  });
});
