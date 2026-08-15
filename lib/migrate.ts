import { PlannerState, ActivitySchema, ScheduledEventSchema, HelpfulLinkSchema, HistoryEntrySchema, Activity, ScheduledEvent } from './types';
import { DEFAULT_ACTIVITIES, getDefaultEvents, DEFAULT_LINKS } from './constants';
import { getWeekStartKey, addWeeks } from './dates';
import { ACTIVITY_ICONS, IconKey } from './icons';
import { DEFAULT_SPORTS_BY_ICON } from './stravaSports';

function mapLegacyIcon(iconStr: string): IconKey {
  const mapping = Object.entries(ACTIVITY_ICONS).find(([, val]) => val.legacy === iconStr);
  return mapping ? (mapping[0] as IconKey) : 'other';
}

function normalizeActivity(raw: unknown): Activity {
  const activity = { ...(raw as Record<string, unknown>) } as Partial<Activity> & Record<string, unknown>;
  if (typeof activity.icon === 'string') {
    // If it is a legacy Material Icon ligature, remap it
    if (!Object.keys(ACTIVITY_ICONS).includes(activity.icon)) {
      activity.icon = mapLegacyIcon(activity.icon);
    }
  }
  if (!activity.workoutTypes) activity.workoutTypes = [];
  if (!activity.links) activity.links = [];
  // Legacy imports predate the `instance` rename, so their raw metric is still `times`.
  if ((activity.metric as string) === 'times') {
    activity.metric = 'instance';
    activity.unit = 'sessions';
  }
  if (activity.metric === 'duration') activity.unit = 'mins';
  return ActivitySchema.parse(activity);
}

function normalizeEvent(raw: unknown, weekStarts: [string, string]): ScheduledEvent {
  const event = { ...(raw as Record<string, unknown>) } as Record<string, unknown>;
  // Legacy events carried a relative slot (week 1 or 2); anchor it to a real date.
  if (typeof event.weekStart !== 'string') {
    event.weekStart = event.week === 2 ? weekStarts[1] : weekStarts[0];
  }
  delete event.week;
  return ScheduledEventSchema.parse(event);
}

/** Rekey notes from the legacy `${day}-${week}` form to `${weekStart}-${day}`. */
function migrateNotes(
  notes: Record<string, string>,
  weekStarts: [string, string]
): Record<string, string> {
  const migrated: Record<string, string> = {};
  Object.entries(notes).forEach(([key, value]) => {
    const match = /^([a-z]+)-([12])$/.exec(key);
    if (match) {
      const [, day, week] = match;
      migrated[`${weekStarts[week === '2' ? 1 : 0]}-${day}`] = value;
    } else {
      migrated[key] = value;
    }
  });
  return migrated;
}

export function importLegacy(): Partial<PlannerState> | null {
  if (typeof window === 'undefined') return null;

  const raw = {
    types:   localStorage.getItem('workout_week_types'),
    events:   localStorage.getItem('workout_week_calendar'),
    notes:   localStorage.getItem('workout_week_notes'),
    links:   localStorage.getItem('workout_week_links'),
    history: localStorage.getItem('workout_week_history'),
    monday:  localStorage.getItem('workout_week_last_viewed_monday'),
  };

  if (Object.values(raw).every(v => v == null)) return null;

  // Legacy data is relative to whichever week it was last edited in; anchor
  // week 1 to the week the import happens in.
  const currentWeekStart = getWeekStartKey(new Date(), 1);
  const weekStarts: [string, string] = [currentWeekStart, addWeeks(currentWeekStart, 1)];

  let activities = DEFAULT_ACTIVITIES;
  if (raw.types) {
    try {
      const parsed = JSON.parse(raw.types);
      activities = parsed.map(normalizeActivity);
    } catch (e) {
      console.error('Failed to parse legacy types', e);
    }
  }

  let events = getDefaultEvents(currentWeekStart);
  if (raw.events) {
    try {
      const parsed = JSON.parse(raw.events);
      events = parsed.map((i: unknown) => normalizeEvent(i, weekStarts));
    } catch (e) {
      console.error('Failed to parse legacy events', e);
    }
  }

  // enforce value=1 for instance metric
  events = events.map(event => {
    const activity = activities.find(g => g.id === event.typeId);
    if (activity && activity.metric === 'instance') {
      return { ...event, value: 1 };
    }
    return event;
  });

  let notes: Record<string, string> = {};
  if (raw.notes) {
    try { notes = migrateNotes(JSON.parse(raw.notes), weekStarts); } catch {}
  }

  let links = DEFAULT_LINKS;
  if (raw.links) {
    try { 
      const parsed = JSON.parse(raw.links);
      links = parsed.map((l: unknown) => HelpfulLinkSchema.parse(l));
    } catch {}
  }

  let history = [];
  if (raw.history) {
    try {
      const parsed = JSON.parse(raw.history);
      history = parsed.map((h: unknown) => HistoryEntrySchema.parse(h));
    } catch {}
  }

  const newState: Partial<PlannerState> = {
    activities,
    events,
    notes,
    links,
    history,
    lastViewedMonday: raw.monday || null
  };

  // cleanup
  localStorage.removeItem('workout_week_types');
  localStorage.removeItem('workout_week_calendar');
  localStorage.removeItem('workout_week_notes');
  localStorage.removeItem('workout_week_links');
  localStorage.removeItem('workout_week_history');
  localStorage.removeItem('workout_week_last_viewed_monday');

  return newState;
}

/**
 * v1 -> v2: weeks stopped being relative slots (1 and 2) and became absolute
 * dates, so past weeks can be kept and scrolled back to. Week 1 lands on the
 * current week and week 2 on the next one.
 *
 * Note this reads the field names as they were *written*: v1 and v2 stored the
 * schedule under `items`, which v3 renames.
 */
function migrateV1toV2(state: Record<string, unknown>): Record<string, unknown> {
  const weekStartsOn = 1; // v1 always started weeks on Monday
  const current = getWeekStartKey(new Date(), weekStartsOn);
  const weekStarts: [string, string] = [current, addWeeks(current, 1)];

  const items = Array.isArray(state.items)
    ? state.items.map((item) => {
        const raw = { ...(item as Record<string, unknown>) };
        if (typeof raw.weekStart !== 'string') {
          raw.weekStart = raw.week === 2 ? weekStarts[1] : weekStarts[0];
        }
        delete raw.week;
        return raw;
      })
    : state.items;

  const notes =
    state.notes && typeof state.notes === 'object'
      ? migrateNotes(state.notes as Record<string, string>, weekStarts)
      : state.notes;

  return { ...state, items, notes, weekStartsOn };
}

/**
 * v2 -> v3: the vocabulary settled. What you can do is an *activity*, what you
 * put on the calendar is an *event*, and a *target* is what a week aims at — so
 * `goals` and `items` are stored under their new names. Nothing inside either
 * record changes; only the two keys move.
 */
function migrateV2toV3(state: Record<string, unknown>): Record<string, unknown> {
  const { goals, items, ...rest } = state;
  return {
    ...rest,
    activities: state.activities ?? goals,
    events: state.events ?? items,
  };
}

/**
 * v3 -> v4: `times` was a confusing name to share with `duration` — both read
 * as "how long," when this metric actually means "how many separate
 * sessions." Renamed to `instance`; nothing else about the activity changes.
 */
function migrateV3toV4(state: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(state.activities)) return state;

  const hasLegacyMetric = state.activities.some(
    (raw) => (raw as Record<string, unknown>).metric === 'times'
  );
  if (!hasLegacyMetric) return state;

  const activities = state.activities.map((raw) => {
    const activity = { ...(raw as Record<string, unknown>) };
    if (activity.metric === 'times') activity.metric = 'instance';
    return activity;
  });

  return { ...state, activities };
}

/**
 * v4 -> v5: a week used to fall back to each activity's baseline target when it
 * had no entry of its own, which quietly tied every unbent week to the
 * activity's default — edit the default and history moved. A week now aims at
 * exactly what it holds, and a new week holds nothing until targets are copied
 * into it. Weeks that already existed keep the numbers they were showing, so
 * the fallback they relied on is written down before it goes away.
 */
function migrateV4toV5(state: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(state.activities)) return state;

  const weeklyTargets = { ...((state.weeklyTargets as Record<string, number>) ?? {}) };
  const weekStarts = new Set<string>();
  if (Array.isArray(state.events)) {
    state.events.forEach((raw) => {
      const weekStart = (raw as Record<string, unknown>).weekStart;
      if (typeof weekStart === 'string') weekStarts.add(weekStart);
    });
  }
  Object.keys(weeklyTargets).forEach((key) => weekStarts.add(key.split(':')[0]));
  Object.keys((state.notes as Record<string, string>) ?? {}).forEach((key) =>
    weekStarts.add(key.slice(0, 10))
  );
  // The week in view counts as existing even when nothing has been put in it
  // yet — it was showing baseline targets a moment ago.
  const weekStartsOn = typeof state.weekStartsOn === 'number' ? state.weekStartsOn : 1;
  weekStarts.add(getWeekStartKey(new Date(), weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6));

  state.activities.forEach((raw) => {
    const activity = raw as Record<string, unknown>;
    if (typeof activity.id !== 'string') return;
    weekStarts.forEach((weekStart) => {
      const key = `${weekStart}:${activity.id}`;
      if (weeklyTargets[key] === undefined) weeklyTargets[key] = Number(activity.target) || 0;
    });
  });

  return { ...state, weeklyTargets };
}

/**
 * v5 -> v6: a week held only a number per activity, which meant every week
 * still read its name, icon and units out of the one shared list — rename an
 * activity and every week that ever used it was renamed with it. "My
 * activities" is now the template a week is *built from*: filling a week copies
 * the activities into it, and the week's copies are what it plans against. Each
 * week's numbers become its own copies here.
 */
function migrateV5toV6(state: Record<string, unknown>): Record<string, unknown> {
  const { weeklyTargets, ...rest } = state;
  if (!weeklyTargets || !Array.isArray(state.activities)) return rest;

  const byId = new Map(
    state.activities.map((raw) => {
      const activity = raw as Record<string, unknown>;
      return [activity.id as string, activity];
    })
  );

  const weekActivities: Record<string, unknown> = {};
  Object.entries(weeklyTargets as Record<string, number>).forEach(([key, target]) => {
    const id = key.slice(key.indexOf(':') + 1);
    const template = byId.get(id);
    if (template) weekActivities[key] = { ...template, target };
  });

  return { ...rest, weekActivities };
}

/**
 * v6 -> v7: a pace used to be stored collapsed to minutes per one unit, which
 * threw away the denominator it was typed with — "2:00 / 100 yards" came back
 * as "0:01 / 1 yard", unrecognizable and unusable to edit. The pair is kept
 * now, and everything stored before this was per one unit by definition.
 */
function migrateV6toV7(state: Record<string, unknown>): Record<string, unknown> {
  const withPaceDistance = (raw: unknown): unknown => {
    const record = raw as Record<string, unknown>;
    if (!record || typeof record !== 'object') return raw;
    if (record.paceMinutes == null || record.paceDistance != null) return raw;
    return { ...record, paceDistance: 1 };
  };

  const activities = Array.isArray(state.activities)
    ? state.activities.map(withPaceDistance)
    : state.activities;

  const weekActivities =
    state.weekActivities && typeof state.weekActivities === 'object'
      ? Object.fromEntries(
          Object.entries(state.weekActivities as Record<string, unknown>).map(([key, value]) => [
            key,
            withPaceDistance(value),
          ])
        )
      : state.weekActivities;

  // An event whose activity was deleted carries its own frozen copy of the
  // pace, which has to move with the rest of them.
  const withSnapshot = (raw: unknown): unknown => {
    const record = raw as Record<string, unknown>;
    if (!record?.activitySnapshot) return raw;
    return { ...record, activitySnapshot: withPaceDistance(record.activitySnapshot) };
  };

  const events = Array.isArray(state.events) ? state.events.map(withSnapshot) : state.events;
  const history = Array.isArray(state.history) ? state.history.map(withSnapshot) : state.history;

  return { ...state, activities, weekActivities, events, history };
}

/**
 * v7 -> v8: the metric is `instance` in the code, but the word on screen was
 * "times" — "5 times" says nothing about what was counted. A session is what the
 * user actually plans, so that is the unit now. Only the label changes; an
 * activity someone renamed the unit on themselves is left alone.
 */
function migrateV7toV8(state: Record<string, unknown>): Record<string, unknown> {
  const withSessionUnit = (raw: unknown): unknown => {
    const record = raw as Record<string, unknown>;
    if (!record || typeof record !== 'object') return raw;
    if (record.metric !== 'instance' || record.unit !== 'times') return raw;
    return { ...record, unit: 'sessions' };
  };

  const activities = Array.isArray(state.activities)
    ? state.activities.map(withSessionUnit)
    : state.activities;

  const weekActivities =
    state.weekActivities && typeof state.weekActivities === 'object'
      ? Object.fromEntries(
          Object.entries(state.weekActivities as Record<string, unknown>).map(([key, value]) => [
            key,
            withSessionUnit(value),
          ])
        )
      : state.weekActivities;

  // An event whose activity was deleted carries its own frozen copy of it.
  const withSnapshot = (raw: unknown): unknown => {
    const record = raw as Record<string, unknown>;
    if (!record?.activitySnapshot) return raw;
    return { ...record, activitySnapshot: withSessionUnit(record.activitySnapshot) };
  };

  const events = Array.isArray(state.events) ? state.events.map(withSnapshot) : state.events;
  const history = Array.isArray(state.history) ? state.history.map(withSnapshot) : state.history;

  return { ...state, activities, weekActivities, events, history };
}

/**
 * v8 -> v9: an event used to read its name, icon and units out of its week's
 * targets, and only kept a copy of its own once the week stopped aiming at it.
 * That made an event unreadable without the week around it — a plan pulled onto
 * a device with no targets set drew nothing. Every event carries its own copy
 * now, taken from its week, or failing that from "My activities".
 *
 * A copy tracks the week's activity until that activity stops describing the
 * event, which is what `activityFrozen` records from here on. Whether an older
 * event was in that state is read off the copy it already holds: it was frozen
 * exactly when the week stopped aiming at the activity (nothing to compare
 * against now) or re-measured it (the metric or unit disagree). Anything else
 * is a copy that should have been tracking, so it is refreshed rather than
 * frozen at whatever it happened to say.
 */
function migrateV8toV9(state: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(state.events)) return state;

  const weekActivities = (state.weekActivities ?? {}) as Record<string, unknown>;
  const templates = Array.isArray(state.activities)
    ? (state.activities as Record<string, unknown>[])
    : [];

  const snapshotOf = (raw: unknown): unknown => {
    const a = raw as Record<string, unknown>;
    return {
      name: a.name,
      icon: a.icon,
      metric: a.metric,
      unit: a.unit,
      color: a.color,
      paceMinutes: a.paceMinutes ?? null,
      paceDistance: a.paceDistance ?? null,
      typicalDurationMinutes: a.typicalDurationMinutes ?? null,
      workoutTypes: Array.isArray(a.workoutTypes) ? a.workoutTypes : [],
    };
  };

  const events = state.events.map((raw) => {
    const event = raw as Record<string, unknown>;
    const source = (weekActivities[`${event.weekStart}:${event.typeId}`] ??
      templates.find((a) => a.id === event.typeId)) as Record<string, unknown> | undefined;
    const held = event.activitySnapshot as Record<string, unknown> | undefined;

    if (held) {
      const frozen =
        !source || held.metric !== source.metric || held.unit !== source.unit;
      return {
        ...event,
        activitySnapshot: frozen ? held : snapshotOf(source),
        activityFrozen: frozen,
      };
    }

    // Neither the week nor the template knows this activity any more. The event
    // still happened, so it gets a plain placeholder rather than being dropped.
    return {
      ...event,
      activitySnapshot: source
        ? snapshotOf(source)
        : {
            name: 'Workout',
            icon: 'other',
            metric: 'instance',
            unit: 'sessions',
            color: '#94a3b8',
            workoutTypes: [],
          },
      activityFrozen: !source,
    };
  });

  return { ...state, events };
}

/**
 * Which Strava sports an activity answers to, made explicit.
 *
 * Matching used to read the icon and guess, which meant two activities sharing
 * an icon were told apart by their order in the list, and a kayak logged
 * against a rowing target. The activity now says what it accepts, seeded here
 * from the icon it already draws with so nobody has to re-answer for a plan
 * they already had.
 *
 * An icon with no honest Strava equivalent seeds nothing, and the activity
 * shows as not synced rather than matching the wrong recordings quietly.
 */
function migrateV9toV10(state: Record<string, unknown>): Record<string, unknown> {
  const seed = (raw: unknown): unknown => {
    const activity = raw as Record<string, unknown>;
    // Only ever fills a gap. Anything already answered is the user's.
    if (!activity || activity.stravaSportTypes !== undefined) return activity;
    const sports = DEFAULT_SPORTS_BY_ICON[activity.icon as IconKey];
    return { ...activity, stravaSportTypes: sports ? [...sports] : [] };
  };

  const activities = Array.isArray(state.activities)
    ? state.activities.map(seed)
    : state.activities;

  // Every week holds its own copies, and they are what sync actually matches
  // against, so they are seeded too rather than left behind the template.
  const weekActivities =
    state.weekActivities && typeof state.weekActivities === 'object'
      ? Object.fromEntries(
          Object.entries(state.weekActivities as Record<string, unknown>).map(
            ([key, activity]) => [key, seed(activity)]
          )
        )
      : state.weekActivities;

  return { ...state, activities, weekActivities };
}

export function migrateStore(persistedState: unknown, version: number): unknown {
  if (!persistedState || typeof persistedState !== 'object') return persistedState;

  let state = persistedState as Record<string, unknown>;
  if (version < 2) state = migrateV1toV2(state);
  if (version < 3) state = migrateV2toV3(state);
  if (version < 4) state = migrateV3toV4(state);
  if (version < 5) state = migrateV4toV5(state);
  if (version < 6) state = migrateV5toV6(state);
  if (version < 7) state = migrateV6toV7(state);
  if (version < 8) state = migrateV7toV8(state);
  if (version < 9) state = migrateV8toV9(state);
  if (version < 10) state = migrateV9toV10(state);
  return state;
}
