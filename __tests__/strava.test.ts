import { describe, expect, it } from 'vitest';
import {
  StravaActivity,
  activityAcceptsSport,
  placeStravaActivity,
  reconcileStrava,
  resolveActivityForSport,
  sportOf,
  stravaActivityUrl,
  valueFromStrava,
} from '@/lib/strava';
import { DEFAULT_SPORTS_BY_ICON, sportsForActivity } from '@/lib/stravaSports';
import { buildActivitySnapshot } from '@/lib/activitySnapshot';
import { Activity, ScheduledEvent } from '@/lib/types';

const running: Activity = {
  id: 'run',
  name: 'Running',
  icon: 'run',
  metric: 'distance',
  unit: 'miles',
  target: 20,
  color: '#f97316',
  stravaSportTypes: ['Run', 'TrailRun', 'VirtualRun'],
};

const yoga: Activity = {
  ...running,
  id: 'yoga',
  name: 'Yoga',
  icon: 'yoga',
  metric: 'instance',
  unit: 'sessions',
  stravaSportTypes: ['Yoga', 'Pilates'],
};

const lifting: Activity = {
  ...running,
  id: 'lift',
  name: 'Lifting',
  icon: 'gym',
  metric: 'duration',
  unit: 'minutes',
  stravaSportTypes: ['WeightTraining', 'Workout'],
};

function stravaActivity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 1001,
    name: 'Morning run',
    sport_type: 'Run',
    distance: 8046.72, // five miles
    moving_time: 45 * 60,
    elapsed_time: 47 * 60,
    start_date_local: '2026-08-12T07:03:00Z',
    ...overrides,
  };
}

/** Monday-start week containing 2026-08-12, a Wednesday. */
const WEEK = '2026-08-10';

function plannedRun(overrides: Partial<ScheduledEvent> = {}): ScheduledEvent {
  return {
    id: 'event-1',
    typeId: 'run',
    day: 'wednesday',
    weekStart: WEEK,
    value: 4,
    startMinutes: 7 * 60,
    activitySnapshot: buildActivitySnapshot(running),
    ...overrides,
  };
}

function reconcile(stravaActivities: StravaActivity[], events: ScheduledEvent[]) {
  return reconcileStrava({
    stravaActivities,
    events,
    activitiesFor: () => [running, yoga, lifting],
    weekStartsOn: 1,
    buildSnapshot: buildActivitySnapshot,
  });
}

describe('sport mapping', () => {
  it('reads whichever sport field Strava filled in', () => {
    expect(sportOf(stravaActivity({ sport_type: 'TrailRun' }))).toBe('TrailRun');
    expect(sportOf(stravaActivity({ sport_type: undefined, type: 'Swim' }))).toBe('Swim');
  });

  it('matches only the sports the activity was told to accept', () => {
    expect(activityAcceptsSport(running, 'TrailRun')).toBe(true);
    expect(activityAcceptsSport(running, 'Ride')).toBe(false);
  });

  it('does not let a kayak count as a rowing session', () => {
    // Never asked, so it falls back to the icon — and the icon's default no
    // longer sweeps every paddle sport in with it.
    const erg: Activity = {
      ...running,
      id: 'erg',
      name: 'Erg',
      icon: 'row',
      stravaSportTypes: undefined,
    };
    expect(sportsForActivity(erg)).toEqual(['Rowing', 'VirtualRow']);
    expect(activityAcceptsSport(erg, 'Kayaking')).toBe(false);
    expect(activityAcceptsSport(erg, 'Rowing')).toBe(true);
  });

  it('falls back to the icon only while nobody has answered', () => {
    const neverAsked = { ...running, stravaSportTypes: undefined };
    expect(sportsForActivity(neverAsked)).toEqual(DEFAULT_SPORTS_BY_ICON.run);

    // An empty list is an answer, not an absence: this is not a Strava sport.
    expect(sportsForActivity({ ...running, stravaSportTypes: [] })).toEqual([]);
  });

  it('treats an icon with no honest Strava sport as not synced', () => {
    const mobility: Activity = { ...running, id: 'mob', icon: 'heart' };
    expect(sportsForActivity({ ...mobility, stravaSportTypes: undefined })).toEqual([]);
  });

  it('picks an activity for an unplanned recording, in the user’s own order', () => {
    const found = resolveActivityForSport(stravaActivity({ sport_type: 'TrailRun' }), [
      yoga,
      running,
    ]);
    expect(found?.id).toBe('run');
  });
});

describe('values', () => {
  it('converts metres into the activity’s own unit', () => {
    expect(valueFromStrava(stravaActivity(), running)).toBe(5);
    expect(valueFromStrava(stravaActivity(), { ...running, unit: 'km' })).toBe(8.05);
    expect(valueFromStrava(stravaActivity(), { ...running, unit: 'yards' })).toBe(8800);
  });

  it('measures a duration activity in moving minutes', () => {
    expect(valueFromStrava(stravaActivity(), lifting)).toBe(45);
  });

  it('counts an instance activity as one session however far it went', () => {
    expect(valueFromStrava(stravaActivity(), yoga)).toBe(1);
  });
});

describe('placement', () => {
  it('reads the local start as local, not as UTC', () => {
    // The trailing Z is Strava's, and a lie: 07:03 is the athlete's own clock.
    const placed = placeStravaActivity(stravaActivity(), 1);
    expect(placed).toEqual({
      dateKey: '2026-08-12',
      day: 'wednesday',
      weekStart: WEEK,
      startMinutes: 7 * 60,
    });
  });

  it('files the workout under the week the user’s settings say', () => {
    const placed = placeStravaActivity(stravaActivity(), 0);
    expect(placed?.weekStart).toBe('2026-08-09');
  });

  it('skips a recording with no readable start', () => {
    expect(placeStravaActivity(stravaActivity({ start_date_local: '' }), 1)).toBeNull();
  });
});

describe('reconciliation', () => {
  it('replaces the planned number with what was actually run', () => {
    const { updates, creations } = reconcile([stravaActivity()], [plannedRun()]);

    expect(creations).toHaveLength(0);
    expect(updates).toEqual([
      {
        eventId: 'event-1',
        value: 5,
        startMinutes: 7 * 60,
        durationMinutes: 45,
        stravaActivityId: 1001,
      },
    ]);
  });

  it('adds a workout nobody planned to the day it happened', () => {
    const { updates, creations } = reconcile([stravaActivity()], []);

    expect(updates).toHaveLength(0);
    expect(creations).toHaveLength(1);
    expect(creations[0]).toMatchObject({
      typeId: 'run',
      day: 'wednesday',
      weekStart: WEEK,
      value: 5,
      startMinutes: 7 * 60,
      stravaActivityId: 1001,
    });
    // It has to draw itself on a device that has never seen these activities.
    expect(creations[0].activitySnapshot?.name).toBe('Running');
  });

  it('leaves an event alone once it already links to a recording', () => {
    const done = plannedRun({ value: 5, stravaActivityId: 1001 });
    const { updates, creations } = reconcile([stravaActivity()], [done]);

    expect(updates).toHaveLength(0);
    expect(creations).toHaveLength(0);
  });

  it('does not re-add a recording that was dragged to another day', () => {
    // Same recording, now attached to Thursday's event. Wednesday is bare, and
    // must stay bare rather than gaining a second copy of the same run.
    const moved = plannedRun({ day: 'thursday', stravaActivityId: 1001 });
    const { updates, creations } = reconcile([stravaActivity()], [moved]);

    expect(updates).toHaveLength(0);
    expect(creations).toHaveLength(0);
  });

  it('pairs two runs in a day up by start time', () => {
    const morning = plannedRun({ id: 'am', startMinutes: 7 * 60 });
    const evening = plannedRun({ id: 'pm', startMinutes: 18 * 60 });
    const { updates } = reconcile(
      [
        stravaActivity({ id: 1, start_date_local: '2026-08-12T18:10:00Z' }),
        stravaActivity({ id: 2, start_date_local: '2026-08-12T06:55:00Z' }),
      ],
      [morning, evening]
    );

    expect(updates.map((update) => [update.stravaActivityId, update.eventId])).toEqual([
      [1, 'pm'],
      [2, 'am'],
    ]);
  });

  it('never gives one planned workout to two recordings', () => {
    const { updates, creations } = reconcile(
      [stravaActivity({ id: 1 }), stravaActivity({ id: 2 })],
      [plannedRun()]
    );

    expect(updates).toHaveLength(1);
    expect(creations).toHaveLength(1);
  });

  it('tells two activities with the same sport apart by what was planned', () => {
    // Both answer to `Run`, and "Easy run" comes first in the list — so the old
    // icon matching gave every recording to it. The calendar knows better:
    // Wednesday is long run day.
    const easy: Activity = { ...running, id: 'easy', name: 'Easy run' };
    const long: Activity = { ...running, id: 'long', name: 'Long run' };
    const plannedLong = plannedRun({
      id: 'long-1',
      typeId: 'long',
      value: 16,
      activitySnapshot: buildActivitySnapshot(long),
    });

    const { updates, creations } = reconcileStrava({
      stravaActivities: [stravaActivity({ distance: 25749.5 })],
      events: [plannedLong],
      activitiesFor: () => [easy, long],
      weekStartsOn: 1,
      buildSnapshot: buildActivitySnapshot,
    });

    expect(creations).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].eventId).toBe('long-1');
    expect(updates[0].value).toBe(16);
  });

  it('does not match a workout whose activity rejects the sport', () => {
    // A ride recorded on a day with a swim planned is a ride, not a short swim.
    const swim: Activity = {
      ...running,
      id: 'swim',
      name: 'Swim',
      icon: 'swim',
      stravaSportTypes: ['Swim'],
    };
    const plannedSwim = plannedRun({
      id: 'swim-1',
      typeId: 'swim',
      activitySnapshot: buildActivitySnapshot(swim),
    });

    const { updates, creations, unmatchedSports } = reconcileStrava({
      stravaActivities: [stravaActivity({ sport_type: 'Ride' })],
      events: [plannedSwim],
      activitiesFor: () => [swim],
      weekStartsOn: 1,
      buildSnapshot: buildActivitySnapshot,
    });

    expect(updates).toHaveLength(0);
    expect(creations).toHaveLength(0);
    expect(unmatchedSports).toEqual(['Ride']);
  });

  it('reports a sport it cannot name an activity for rather than guessing', () => {
    const { updates, creations, unmatchedSports } = reconcile(
      [stravaActivity({ sport_type: 'Kayaking' })],
      []
    );

    expect(updates).toHaveLength(0);
    expect(creations).toHaveLength(0);
    expect(unmatchedSports).toEqual(['Kayaking']);
  });

  it('links out to the recording', () => {
    expect(stravaActivityUrl(1001)).toBe('https://www.strava.com/activities/1001');
  });
});
