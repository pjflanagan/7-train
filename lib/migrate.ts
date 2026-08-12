import { PlannerState, WorkoutTypeSchema, CalendarItemSchema, HelpfulLinkSchema, HistoryEntrySchema, WorkoutType, CalendarItem } from './types';
import { DEFAULT_WORKOUT_TYPES, DEFAULT_CALENDAR_ITEMS, DEFAULT_LINKS } from './constants';
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

function normalizeItem(raw: unknown): CalendarItem {
  const item = { ...(raw as Record<string, unknown>) } as Partial<CalendarItem> & Record<string, unknown>;
  if (!item.week) item.week = 1;
  const parsed = CalendarItemSchema.parse(item);
  return parsed;
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

  let goals = DEFAULT_WORKOUT_TYPES;
  if (raw.types) {
    try {
      const parsed = JSON.parse(raw.types);
      goals = parsed.map(normalizeGoal);
    } catch (e) {
      console.error('Failed to parse legacy types', e);
    }
  }

  let items = DEFAULT_CALENDAR_ITEMS;
  if (raw.items) {
    try {
      const parsed = JSON.parse(raw.items);
      items = parsed.map(normalizeItem);
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

  let notes = {};
  if (raw.notes) {
    try { notes = JSON.parse(raw.notes); } catch {}
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

export function migrateStore(persistedState: unknown): unknown {
  // If version 0 -> 1 needed, do it here. Currently we start at version 1.
  return persistedState;
}
