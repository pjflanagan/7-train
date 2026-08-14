import { beforeEach, describe, expect, it } from 'vitest';
import { usePlannerStore } from '@/lib/store';
import { resolveEventActivity, buildActivitySnapshot } from '@/lib/activitySnapshot';
import { activitiesForWeek, weekActivityKey } from '@/lib/progress';
import { getWeekStartKey } from '@/lib/dates';
import { Activity } from '@/lib/types';

const weekStart = getWeekStartKey(new Date(), 1);

const swim: Activity = {
  id: 'swim',
  name: 'Swimming',
  icon: 'swim',
  metric: 'distance',
  unit: 'yards',
  target: 3000,
  color: '#0ea5e9',
  workoutTypes: ['Drills'],
};

/** How a component reads an event: through its week's activities, whatever they are. */
const resolve = (id: string) => {
  const state = usePlannerStore.getState();
  const event = state.events.find(e => e.id === id)!;
  return resolveEventActivity(event, activitiesForWeek(event.weekStart, state.weekActivities));
};

describe('an event describes itself', () => {
  beforeEach(() => {
    usePlannerStore.getState().clearAll();
  });

  it('renders in a week that has no targets at all', () => {
    usePlannerStore.setState({
      activities: [],
      weekActivities: {},
      events: [
        {
          id: 'pulled',
          typeId: swim.id,
          day: 'monday',
          weekStart,
          value: 1500,
          activitySnapshot: buildActivitySnapshot(swim),
        },
      ],
    });

    const activity = resolve('pulled');
    expect(activity?.name).toBe('Swimming');
    expect(activity?.unit).toBe('yards');
    expect(activity?.workoutTypes).toEqual(['Drills']);
  });

  it('takes its copy of the activity when it is added', () => {
    usePlannerStore.setState({
      activities: [swim],
      weekActivities: { [weekActivityKey(weekStart, swim.id)]: swim },
      events: [],
    });
    usePlannerStore.getState().addEvent({
      typeId: swim.id,
      day: 'monday',
      weekStart,
      value: 1500,
    });

    const event = usePlannerStore.getState().events[0];
    expect(event.activitySnapshot?.name).toBe('Swimming');
    expect(event.activityFrozen).toBeFalsy();
  });

  it('follows a rename of its week\'s activity', () => {
    usePlannerStore.setState({
      activities: [swim],
      weekActivities: { [weekActivityKey(weekStart, swim.id)]: swim },
      events: [],
    });
    usePlannerStore.getState().addEvent({
      typeId: swim.id,
      day: 'monday',
      weekStart,
      value: 1500,
    });
    usePlannerStore.getState().updateWeekActivity(weekStart, swim.id, { name: 'Pool' });

    const event = usePlannerStore.getState().events[0];
    expect(event.activitySnapshot?.name).toBe('Pool');

    // And still reads as "Pool" once the week stops aiming at it.
    usePlannerStore.getState().removeWeekActivity(weekStart, swim.id);
    expect(resolve(event.id)?.name).toBe('Pool');
  });

  it('freezes what it was measured in when the week re-measures it', () => {
    usePlannerStore.setState({
      activities: [swim],
      weekActivities: { [weekActivityKey(weekStart, swim.id)]: swim },
      events: [],
    });
    usePlannerStore.getState().addEvent({
      typeId: swim.id,
      day: 'monday',
      weekStart,
      value: 1500,
    });
    usePlannerStore.getState().updateWeekActivity(weekStart, swim.id, {
      metric: 'duration',
      unit: 'mins',
    });

    const event = usePlannerStore.getState().events[0];
    expect(event.activityFrozen).toBe(true);
    // 1500 was entered as yards and stays yards, whatever the week now measures.
    expect(resolve(event.id)?.unit).toBe('yards');

    // A later rename does not reach a frozen event.
    usePlannerStore.getState().updateWeekActivity(weekStart, swim.id, { name: 'Pool' });
    expect(resolve(event.id)?.name).toBe('Swimming');
  });
});
