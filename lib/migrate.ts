import { PlannerState, WorkoutTypeSchema, CalendarItemSchema, HelpfulLinkSchema, HistoryEntrySchema, WorkoutType, CalendarItem } from './types';
import { DEFAULT_WORKOUT_TYPES, getDefaultCalendarItems, DEFAULT_LINKS } from './constants';
import { getWeekStartKey, addWeeks } from './dates';
import { ACTIVITY_ICONS, IconKey } from './icons';

function mapLegacyIcon(iconStr: string): IconKey {
  const mapping = Object.entries(ACTIVITY_ICONS).find(([, val]) => val.legacy === iconStr);
  return mapping ? (mapping[0] as IconKey) : 'other';
}

function normalizeGoal(raw: unknown): WorkoutType {
  const goal = { ...(raw as Record<string, unknown>) } as Partial<WorkoutType> & Record<string, unknown>;
  if (typeof goal.icon === 'string') {
    // If it is a legacy Material Icon ligature, remap it
    if (!Object.keys(ACTIVITY_ICONS).includes(goal.icon)) {
      goal.icon = mapLegacyIcon(goal.icon);
    }
  }
  if (!goal.workoutTypes) goal.workoutTypes = [];
  if (!goal.links) goal.links = [];
  if (goal.metric === 'times') goal.unit = 'times';
  return WorkoutTypeSchema.parse(goal);
}

function normalizeItem(raw: unknown, weekStarts: [string, string]): CalendarItem {
  const item = { ...(raw as Record<string, unknown>) } as Record<string, unknown>;
  // Legacy items carried a relative slot (week 1 or 2); anchor it to a real date.
  if (typeof item.weekStart !== 'string') {
    item.weekStart = item.week === 2 ? weekStarts[1] : weekStarts[0];
  }
  delete item.week;
  return CalendarItemSchema.parse(item);
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
    items:   localStorage.getItem('workout_week_calendar'),
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

  let goals = DEFAULT_WORKOUT_TYPES;
  if (raw.types) {
    try {
      const parsed = JSON.parse(raw.types);
      goals = parsed.map(normalizeGoal);
    } catch (e) {
      console.error('Failed to parse legacy types', e);
    }
  }

  let items = getDefaultCalendarItems(currentWeekStart);
  if (raw.items) {
    try {
      const parsed = JSON.parse(raw.items);
      items = parsed.map((i: unknown) => normalizeItem(i, weekStarts));
    } catch (e) {
      console.error('Failed to parse legacy items', e);
    }
  }

  // enforce value=1 for times metric
  items = items.map(item => {
    const goal = goals.find(g => g.id === item.typeId);
    if (goal && goal.metric === 'times') {
      return { ...item, value: 1 };
    }
    return item;
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
    goals,
    items,
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
 */
export function migrateStore(persistedState: unknown, version: number): unknown {
  if (version >= 2 || !persistedState || typeof persistedState !== 'object') {
    return persistedState;
  }

  const state = persistedState as Record<string, unknown>;
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
