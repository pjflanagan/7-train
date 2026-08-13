import { PlannerState, ActivitySchema, ScheduledEventSchema, HelpfulLinkSchema, HistoryEntrySchema, Activity, ScheduledEvent } from './types';
import { DEFAULT_ACTIVITIES, getDefaultEvents, DEFAULT_LINKS } from './constants';
import { getWeekStartKey, addWeeks } from './dates';
import { ACTIVITY_ICONS, IconKey } from './icons';

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
    activity.unit = 'times';
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

export function migrateStore(persistedState: unknown, version: number): unknown {
  if (!persistedState || typeof persistedState !== 'object') return persistedState;

  let state = persistedState as Record<string, unknown>;
  if (version < 2) state = migrateV1toV2(state);
  if (version < 3) state = migrateV2toV3(state);
  if (version < 4) state = migrateV3toV4(state);
  if (version < 5) state = migrateV4toV5(state);
  if (version < 6) state = migrateV5toV6(state);
  return state;
}
