/**
 * Strava: what the athlete actually did, matched against what they planned.
 *
 * Everything here is pure and runs on either side — the token plumbing lives in
 * `lib/stravaServer.ts`, and the loop that drives it in `hooks/useStravaSync`.
 *
 * The shape of the integration is deliberately one-way. Strava is a record of
 * the past, so it only ever writes into the plan: a recording either lands on a
 * workout that was scheduled for it — replacing the planned number with the real
 * one — or becomes a new event on the day it happened, because something you did
 * and never planned still belongs on the week.
 */

import { Activity, ScheduledEvent } from './types';
import { sportsForActivity } from './stravaSports';
import { resolveEventActivity } from './activitySnapshot';
import {
  DayName,
  WeekStartsOn,
  dayNameForDate,
  getWeekStartKey,
  parseDateLocal,
} from './dates';
import { clampDuration, clampStartMinutes } from './schedule';

/** Read-only access to the athlete's own activities, and nothing else. */
export const STRAVA_SCOPES = ['read', 'activity:read'];

export const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
export const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
export const STRAVA_API = 'https://www.strava.com/api/v3';

/** The page a recording lives on, which is what the event links out to. */
export function stravaActivityUrl(activityId: number | string): string {
  return `https://www.strava.com/activities/${activityId}`;
}

/**
 * How much of the calendar a pull covers. Strava rate limits hard — 100 reads
 * per fifteen minutes — and a plan is only ever corrected just after the fact,
 * so this week and last week is the whole useful window.
 */
export const STRAVA_WEEKS_BACK = 1;

/**
 * One recording, as Strava's `athlete/activities` list returns it. Only the
 * fields we act on; the payload carries far more.
 */
export interface StravaActivity {
  id: number;
  name: string;
  /** The finer-grained kind ("TrailRun"), present on everything modern. */
  sport_type?: string;
  /** The older, coarser kind ("Run"). Still returned, and the fallback. */
  type?: string;
  /** Metres. */
  distance: number;
  /** Seconds actually moving — what a pace is measured over. */
  moving_time: number;
  /** Seconds from start to finish, stops included. */
  elapsed_time: number;
  /**
   * The athlete's own wall clock at the start, as `YYYY-MM-DDTHH:mm:ssZ`. The
   * `Z` is a lie Strava tells: the time is already local to wherever the
   * workout happened, so it must never be read as UTC.
   */
  start_date_local: string;
}

/** Strava's own word for what this was, preferring the finer-grained field. */
export function sportOf(stravaActivity: StravaActivity): string {
  return stravaActivity.sport_type ?? stravaActivity.type ?? '';
}

/** True when the activity has been told it answers to this Strava sport. */
export function activityAcceptsSport(activity: Activity, sport: string): boolean {
  return sportsForActivity(activity).includes(sport);
}

/**
 * Which activity a recording should be filed under when nothing was planned
 * for it — the first that accepts the sport, in the user's own order.
 *
 * This is only ever the fallback. A recording that *was* planned for is matched
 * against the planned workout itself, so two activities both accepting `Run`
 * are told apart by which one is on the calendar that morning, not by this.
 */
export function resolveActivityForSport(
  stravaActivity: StravaActivity,
  activities: Activity[]
): Activity | undefined {
  const sport = sportOf(stravaActivity);
  return activities.find((activity) => activityAcceptsSport(activity, sport));
}

const METRES_PER_MILE = 1609.344;
const METRES_PER_YARD = 0.9144;

/** Metres per one of the activity's own units, defaulting to miles. */
function metresPerUnit(unit: string): number {
  const normalized = unit.trim().toLowerCase();
  if (/^(k|kilomet)/.test(normalized)) return 1000;
  if (/^(y|yd)/.test(normalized)) return METRES_PER_YARD;
  if (/^(m(et(er|re)s?)?)$/.test(normalized)) return 1;
  return METRES_PER_MILE;
}

/** Distances read as "6.2", not "6.21371"; yards and metres as whole numbers. */
function roundDistance(value: number, metresPerOne: number): number {
  return metresPerOne >= 1000 || metresPerOne >= METRES_PER_MILE
    ? Math.round(value * 100) / 100
    : Math.round(value);
}

/**
 * What the recording is worth in the activity's own terms — the number that
 * replaces the planned one.
 *
 * An `instance` activity counts sessions, so a recording of it is worth exactly
 * one however far it went.
 */
export function valueFromStrava(
  stravaActivity: StravaActivity,
  activity: Pick<Activity, 'metric' | 'unit'>
): number {
  if (activity.metric === 'duration') {
    return Math.max(1, Math.round(stravaActivity.moving_time / 60));
  }
  if (activity.metric === 'instance') return 1;

  const perUnit = metresPerUnit(activity.unit);
  return roundDistance(stravaActivity.distance / perUnit, perUnit);
}

/**
 * Where the recording sits on the plan's grid.
 *
 * `start_date_local` is parsed by hand rather than through `new Date`, because
 * the trailing `Z` would drag a 7am workout into the browser's zone — a run in
 * New York would land on the previous evening for anyone reading in London.
 */
export function placeStravaActivity(
  stravaActivity: StravaActivity,
  weekStartsOn: WeekStartsOn
): { dateKey: string; day: DayName; weekStart: string; startMinutes: number } | null {
  const match = stravaActivity.start_date_local?.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/
  );
  if (!match) return null;

  const [, dateKey, hours, minutes] = match;
  const date = parseDateLocal(dateKey);
  if (Number.isNaN(date.getTime())) return null;

  return {
    dateKey,
    day: dayNameForDate(date),
    weekStart: getWeekStartKey(date, weekStartsOn),
    startMinutes: clampStartMinutes(Number(hours) * 60 + Number(minutes)),
  };
}

/** How long the event should block out, from what the recording actually took. */
export function durationFromStrava(stravaActivity: StravaActivity): number {
  const seconds = stravaActivity.elapsed_time || stravaActivity.moving_time || 0;
  return clampDuration(seconds / 60);
}

/** A planned workout, corrected to what was actually done. */
export interface StravaEventUpdate {
  eventId: string;
  value: number;
  startMinutes: number;
  durationMinutes: number;
  stravaActivityId: number;
}

/** A recording nothing was planned for, as a new event on the day it happened. */
export type StravaEventCreation = Omit<ScheduledEvent, 'id'>;

export interface StravaReconciliation {
  updates: StravaEventUpdate[];
  creations: StravaEventCreation[];
  /**
   * Sports no activity answers to, so nothing was written for them. Worth
   * saying out loud: the fix is for the user to add the sport to an activity,
   * and silence would leave them wondering where their ride went.
   */
  unmatchedSports: string[];
}

/**
 * The closest candidate by start time — two runs on one day should pair up
 * morning with morning.
 */
function bestCandidate(
  candidates: { event: ScheduledEvent; activity: Activity }[],
  startMinutes: number
): { event: ScheduledEvent; activity: Activity } | undefined {
  let best: { event: ScheduledEvent; activity: Activity } | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.abs((candidate.event.startMinutes ?? 0) - startMinutes);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * What Strava changes about the plan.
 *
 * Nothing here touches the store; it returns the work so the same decision can
 * be tested without a browser, and so a sync that finds nothing to do can say
 * so without writing.
 *
 * The search is over **planned workouts**, not over activities. A recording
 * looks for a workout on the day it happened whose activity accepts its sport,
 * and takes the nearest one in time. That is what tells "Long run" from "Easy
 * run" when both answer to `Run`: the calendar already knows which was which,
 * so nothing has to be inferred from the activity list's order. Choosing an
 * activity by that order happens only when nothing was planned at all and a
 * workout has to be created from scratch.
 *
 * Two rules keep the sync from fighting the user. A recording is applied once —
 * an event already carrying a Strava id is finished, and is neither re-read nor
 * re-timed however often the sync runs. And a recording whose id is already on
 * some event is skipped outright, so moving that workout to another day does
 * not make Strava add it back on the old one.
 */
export function reconcileStrava({
  stravaActivities,
  events,
  activitiesFor,
  weekStartsOn,
  buildSnapshot,
}: {
  stravaActivities: StravaActivity[];
  events: ScheduledEvent[];
  /** The activities a given week can be planned from, richest source first. */
  activitiesFor: (weekStart: string) => Activity[];
  weekStartsOn: WeekStartsOn;
  buildSnapshot: (activity: Activity) => ScheduledEvent['activitySnapshot'];
}): StravaReconciliation {
  const updates: StravaEventUpdate[] = [];
  const creations: StravaEventCreation[] = [];
  const unmatchedSports: string[] = [];

  /** Every recording the plan has already taken in, from any earlier sync. */
  const claimedActivityIds = new Set(
    events.map((event) => event.stravaActivityId).filter((id): id is number => id != null)
  );
  /** Events spoken for during this pass, so two recordings never share one. */
  const claimedEventIds = new Set<string>();

  for (const stravaActivity of stravaActivities) {
    if (claimedActivityIds.has(stravaActivity.id)) continue;

    const placement = placeStravaActivity(stravaActivity, weekStartsOn);
    if (!placement) continue;

    const { day, weekStart, startMinutes } = placement;
    const sport = sportOf(stravaActivity);
    const weekActivities = activitiesFor(weekStart);
    const durationMinutes = durationFromStrava(stravaActivity);

    // What was planned that day, read through each event's own activity, so an
    // event whose activity the week has since dropped is still matchable.
    const candidates = events
      .filter(
        (event) =>
          event.weekStart === weekStart &&
          event.day === day &&
          event.stravaActivityId == null &&
          !claimedEventIds.has(event.id)
      )
      .flatMap((event) => {
        const activity = resolveEventActivity(event, weekActivities);
        return activity && activityAcceptsSport(activity, sport)
          ? [{ event, activity }]
          : [];
      });

    const match = bestCandidate(candidates, startMinutes);

    if (match) {
      claimedEventIds.add(match.event.id);
      claimedActivityIds.add(stravaActivity.id);
      updates.push({
        eventId: match.event.id,
        value: valueFromStrava(stravaActivity, match.activity),
        startMinutes,
        durationMinutes,
        stravaActivityId: stravaActivity.id,
      });
      continue;
    }

    // Nothing was planned for it, so an activity has to be picked to file it
    // under. Only here does the order of the activity list decide anything.
    const activity = resolveActivityForSport(stravaActivity, weekActivities);
    if (!activity) {
      unmatchedSports.push(sport || 'Unknown');
      continue;
    }

    claimedActivityIds.add(stravaActivity.id);
    creations.push({
      typeId: activity.id,
      day,
      weekStart,
      value: valueFromStrava(stravaActivity, activity),
      workoutType: null,
      startMinutes,
      durationMinutes,
      stravaActivityId: stravaActivity.id,
      // A workout nobody planned still has to draw itself, so it takes its copy
      // of the activity here like any other event.
      activitySnapshot: buildSnapshot(activity),
    });
  }

  return { updates, creations, unmatchedSports };
}
