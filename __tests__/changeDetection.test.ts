import { describe, it, expect, beforeEach } from 'vitest';
import { usePlannerStore } from '@/lib/store';
import { isSameUpdate, isSameValue } from '@/lib/changes';
import { getWeekStartKey } from '@/lib/dates';
import { weekActivityKey } from '@/lib/progress';
import { buildActivitySnapshot } from '@/lib/activitySnapshot';
import { durationMinutesOf } from '@/lib/schedule';
import { Activity, ScheduledEvent } from '@/lib/types';

const weekStart = getWeekStartKey(new Date(), 1);

const activity: Activity = {
  id: 'run',
  name: 'Running',
  icon: 'run',
  metric: 'distance',
  unit: 'miles',
  target: 20,
  color: '#f00',
  workoutTypes: ['Long run', 'Easy run'],
};

const event: ScheduledEvent = {
  id: 'monday-run',
  typeId: activity.id,
  day: 'monday',
  weekStart,
  value: 5,
  startMinutes: 7 * 60,
  durationMinutes: 45,
  activitySnapshot: buildActivitySnapshot(activity),
};

const state = () => usePlannerStore.getState();

describe('isSameValue', () => {
  it('does not care what order the keys were written in', () => {
    expect(isSameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('reads null, undefined and an absent key as one absence', () => {
    expect(isSameValue({ target: null }, { target: undefined })).toBe(true);
    expect(isSameValue({ target: null }, {})).toBe(true);
  });

  it('holds arrays to their order', () => {
    expect(isSameValue(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(isSameValue(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('compares nested values', () => {
    expect(isSameValue({ links: [{ id: '1', url: 'x' }] }, { links: [{ id: '1', url: 'x' }] })).toBe(true);
    expect(isSameValue({ links: [{ id: '1', url: 'x' }] }, { links: [{ id: '1', url: 'y' }] })).toBe(false);
  });

  it('does not read 0, "" or false as absent', () => {
    expect(isSameValue(0, null)).toBe(false);
    expect(isSameValue('', undefined)).toBe(false);
    expect(isSameValue(false, null)).toBe(false);
  });

  it('only looks at the fields an update carries', () => {
    expect(isSameUpdate(activity, { name: 'Running' })).toBe(true);
    expect(isSameUpdate(activity, { name: 'Cycling' })).toBe(false);
  });
});

/**
 * Everything downstream of the store treats a new object as an edit — React,
 * `persist`, and both sync loops. So an action that changes nothing has to
 * leave the state it holds exactly where it is, reference and all.
 */
describe('a save that saves nothing', () => {
  beforeEach(() => {
    usePlannerStore.getState().clearAll();
    usePlannerStore.setState({
      activities: [activity],
      events: [event],
      weekActivities: { [weekActivityKey(weekStart, activity.id)]: { ...activity } },
      notes: { [`${weekStart}-monday`]: 'easy week' },
    });
  });

  it('leaves the activity alone when the form was not edited', () => {
    const before = state().activities;
    state().updateActivity(activity.id, { ...activity });
    expect(state().activities).toBe(before);
  });

  it('changes the activity when a field really moved', () => {
    state().updateActivity(activity.id, { ...activity, name: 'Jogging' });
    expect(state().activities[0].name).toBe('Jogging');
  });

  it("leaves the week's activity — and its events — alone when nothing was edited", () => {
    const activities = state().weekActivities;
    const events = state().events;
    state().updateWeekActivity(weekStart, activity.id, { ...activity });
    expect(state().weekActivities).toBe(activities);
    expect(state().events).toBe(events);
  });

  it('leaves the week alone when the target committed is the target it has', () => {
    const before = state().weekActivities;
    state().setActivityTarget(activity.id, 20, weekStart);
    expect(state().weekActivities).toBe(before);
    state().setActivityTarget(activity.id, 25, weekStart);
    expect(state().weekActivities).not.toBe(before);
  });

  it('does not restamp a workout committed at the value it already had', () => {
    const before = state().events;
    state().updateEventValue(event.id, 5);
    expect(state().events).toBe(before);
    state().updateEventValue(event.id, 6);
    expect(state().events[0].updatedAt).toBeTruthy();
  });

  it('reads an empty workout type and no workout type as the same answer', () => {
    const before = state().events;
    state().setEventSubType(event.id, '');
    expect(state().events).toBe(before);
    state().setEventSubType(event.id, 'Long run');
    expect(state().events[0].workoutType).toBe('Long run');
  });

  it('does not move a workout dropped back where it started', () => {
    const before = state().events;
    state().moveEvent(event.id, 'monday', weekStart);
    expect(state().events).toBe(before);
    state().moveEvent(event.id, 'tuesday', weekStart);
    expect(state().events[0].day).toBe('tuesday');
  });

  it('does not re-length a workout committed at the length it is drawn at', () => {
    const before = state().events;
    state().setEventDuration(event.id, 45);
    expect(state().events).toBe(before);
    state().setEventDuration(event.id, 60);
    expect(state().events[0].durationMinutes).toBe(60);
  });

  it('takes the estimate as the length an event without one already shows', () => {
    usePlannerStore.setState({ events: [{ ...event, durationMinutes: undefined }] });
    const before = state().events;
    // The length field shows the estimate when the event has no length of its
    // own, so committing that number back is agreeing with the estimate rather
    // than pinning a length down.
    state().setEventDuration(event.id, durationMinutesOf(before[0], activity));
    expect(state().events).toBe(before);
    state().setEventDuration(event.id, 90);
    expect(state().events[0].durationMinutes).toBe(90);
  });

  it('leaves the note alone when the box was blurred unchanged', () => {
    const before = state().notes;
    state().setNote('monday', weekStart, 'easy week');
    expect(state().notes).toBe(before);
    state().setNote('monday', weekStart, 'hard week');
    expect(state().notes).not.toBe(before);
  });

  it('leaves an empty note empty', () => {
    const before = state().notes;
    state().setNote('tuesday', weekStart, '');
    expect(state().notes).toBe(before);
  });

  it('keeps the schedule a pull agreed with, both halves of it', () => {
    const events = state().events;
    const weekActivities = state().weekActivities;
    const same = {
      events: [{ ...event, activitySnapshot: { ...event.activitySnapshot! } }],
      weekActivities: { [weekActivityKey(weekStart, activity.id)]: { ...activity } },
    };

    state().applyRemoteSchedule(same);
    expect(state().events).toBe(events);
    expect(state().weekActivities).toBe(weekActivities);

    // And the half that did move is the only half that moves.
    state().applyRemoteSchedule({ ...same, events: [{ ...event, value: 8 }] });
    expect(state().events).not.toBe(events);
    expect(state().weekActivities).toBe(weekActivities);
  });

  it('only writes back a Google event id it did not already have', () => {
    state().setGoogleEventIds({ [event.id]: 'google-1' });
    const known = state().events;
    expect(known[0].googleEventId).toBe('google-1');
    state().setGoogleEventIds({ [event.id]: 'google-1' });
    expect(state().events).toBe(known);
  });

  it('leaves a setting set to the value it already holds', () => {
    state().setTempUnit('F');
    state().setWeekStartsOn(1);
    state().setGoogleCalendarName(null);
    const before = state().events;
    state().setTempUnit('C');
    expect(state().tempUnit).toBe('C');
    expect(state().events).toBe(before);
  });

  it('takes nothing from a pull that hands back what this browser already had', () => {
    const settings = {
      googleCalendarId: null,
      googleAdoptedAt: null,
      googleSheetId: null,
      weekStartsOn: 1 as const,
      tempUnit: 'F' as const,
      use24HourClock: false,
      defaultStartMinutes: state().defaultStartMinutes,
    };
    const before = state().activities;
    state().applyRemoteUser({ settings, activities: [{ ...activity }] });
    expect(state().activities).toBe(before);

    state().applyRemoteUser({ settings, activities: [{ ...activity, name: 'Jogging' }] });
    expect(state().activities[0].name).toBe('Jogging');
  });
});
