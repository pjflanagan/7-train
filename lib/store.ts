import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlannerState, WorkoutType, CalendarItem, HelpfulLink } from './types';
import { DEFAULT_WORKOUT_TYPES, getDefaultCalendarItems, DEFAULT_LINKS, DAYS } from './constants';
import { importLegacy, migrateStore } from './migrate';
import { getWeekStartKey, WeekStartsOn } from './dates';
import { weeklyTargetKey } from './progress';
import {
  byStartTime,
  clampDuration,
  clampStartMinutes,
  DEFAULT_START_MINUTES,
  durationMinutesOf,
  SLOT_MINUTES,
  startMinutesOf
} from './schedule';
import { arrayMove } from '@dnd-kit/sortable';

type DayName = typeof DAYS[number];

export const noteKey = (weekStart: string, day: DayName) => `${weekStart}-${day}`;

type PlannerStore = PlannerState & {
  addGoal: (goal: WorkoutType) => void;
  updateGoal: (id: string, goal: Partial<WorkoutType>) => void;
  deleteGoal: (id: string) => void;
  reorderGoals: (oldIndex: number, newIndex: number) => void;
  /** Bends a goal's target for one week only; the baseline `target` is untouched. */
  setGoalTarget: (id: string, target: number, weekStart: string) => void;

  addItem: (item: Omit<CalendarItem, 'id'>) => void;
  updateItemValue: (id: string, value: number) => void;
  setItemSubType: (id: string, subType: string | null) => void;
  removeItem: (id: string) => void;
  moveItem: (id: string, targetDay: DayName, targetWeekStart: string, newIndex?: number) => void;
  reorderDay: (day: DayName, weekStart: string, oldIndex: number, newIndex: number) => void;
  /** Move an item through the day. Minutes from local midnight, snapped to 15. */
  setItemTime: (id: string, startMinutes: number) => void;
  /** Nudge a time by whole slots, the keyboard equivalent of dragging it. */
  nudgeItemTime: (id: string, slots: number) => void;
  /** Set how long an item runs. Minutes, snapped to 15. */
  setItemDuration: (id: string, durationMinutes: number) => void;
  /** Stretch or shrink a duration by whole slots, for the keyboard. */
  nudgeItemDuration: (id: string, slots: number) => void;

  setGoogleCalendarId: (calendarId: string | null) => void;
  setGoogleSheetId: (sheetId: string | null) => void;
  /** Record which Google event now mirrors each item, keyed by item id. */
  setGoogleEventIds: (eventIds: Record<string, string>) => void;
  /**
   * Swap the whole schedule for what Google Calendar holds. Goals, notes and
   * settings stay put: the calendar owns events only.
   */
  replaceCalendarItems: (items: CalendarItem[]) => void;

  setNote: (day: DayName, weekStart: string, note: string) => void;
  /**
   * Pull another week into this one. The schedule (workouts and day notes) and
   * the goal targets are copied independently, so a week can inherit one
   * without the other. Whichever part is copied overwrites what was there.
   */
  copyWeek: (
    fromWeekStart: string,
    toWeekStart: string,
    parts?: { schedule?: boolean; goals?: boolean }
  ) => void;
  clearWeek: (weekStart: string) => void;

  addLink: (link: HelpfulLink) => void;
  removeLink: (id: string) => void;

  setTempUnit: (unit: 'C' | 'F') => void;
  setWeekStartsOn: (weekStartsOn: WeekStartsOn) => void;
  /** Where a new workout lands on an otherwise empty day. */
  setDefaultStartMinutes: (startMinutes: number) => void;
  /** Replace every persisted field at once, used by backup import. */
  replaceAll: (state: PlannerState) => void;
  resetAll: () => void;
};

function buildInitialState(): PlannerState {
  const weekStart = getWeekStartKey(new Date(), 1);
  return {
    goals: DEFAULT_WORKOUT_TYPES,
    items: getDefaultCalendarItems(weekStart),
    notes: {},
    weeklyTargets: {},
    links: DEFAULT_LINKS,
    history: [],
    lastViewedMonday: null,
    tempUnit: 'F',
    weekStartsOn: 1,
    defaultStartMinutes: DEFAULT_START_MINUTES,
    googleCalendarId: null,
    googleSheetId: null,
  };
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

/**
 * Where a newly dropped workout lands: straight after the last one already on
 * that day, or the default morning slot when the day is empty.
 */
function nextFreeSlot(state: PlannerState, day: DayName, weekStart: string): number {
  const defaultStart = clampStartMinutes(state.defaultStartMinutes ?? DEFAULT_START_MINUTES);
  const dayItems = state.items.filter(i => i.day === day && i.weekStart === weekStart);
  if (dayItems.length === 0) return defaultStart;

  const latestEnd = dayItems.reduce((end, item) => {
    const goal = state.goals.find(g => g.id === item.typeId);
    return Math.max(end, startMinutesOf(item) + durationMinutesOf(item, goal));
  }, defaultStart);

  return clampStartMinutes(latestEnd);
}

/** The moment a workout finishes: its start plus however long it runs. */
function endOf(state: PlannerState, item: CalendarItem): number {
  const goal = state.goals.find(g => g.id === item.typeId);
  return startMinutesOf(item) + durationMinutesOf(item, goal);
}

/**
 * The time a workout takes when it is dropped into a day at `index`.
 *
 * Dropping something after another workout means exactly that: it starts when
 * that one ends. Nothing else on the day moves — the workouts it was dropped
 * between keep the times they were given.
 *
 * `ordered` is the day already in its new order, the dragged workout included.
 */
function startAtIndex(state: PlannerState, ordered: CalendarItem[], index: number): number {
  const previous = ordered[index - 1];
  if (previous) return clampStartMinutes(endOf(state, previous));

  // Dropped at the top of the day: it only has to be no later than what now
  // follows it, so a workout dragged up there keeps its own earlier time.
  const moved = ordered[index];
  const next = ordered[index + 1];
  if (!next) return startMinutesOf(moved);
  return Math.min(startMinutesOf(moved), startMinutesOf(next));
}

/**
 * Mark an item as edited now. Everything that changes what the workout *is*
 * goes through here, so a future merge against an integration can compare
 * timestamps and keep the newer side.
 */
function stamp(item: CalendarItem): CalendarItem {
  return { ...item, updatedAt: new Date().toISOString() };
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set) => ({
      ...buildInitialState(),

      addGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
      updateGoal: (id, updates) => set((state) => ({
        goals: state.goals.map(g => g.id === id ? { ...g, ...updates } : g)
      })),
      deleteGoal: (id) => set((state) => {
        const weeklyTargets = { ...(state.weeklyTargets || {}) };
        Object.keys(weeklyTargets).forEach(key => {
          if (key.endsWith(`:${id}`)) delete weeklyTargets[key];
        });
        return {
          goals: state.goals.filter(g => g.id !== id),
          items: state.items.filter(i => i.typeId !== id),
          weeklyTargets
        };
      }),
      reorderGoals: (oldIndex, newIndex) => set((state) => ({
        goals: arrayMove(state.goals, oldIndex, newIndex)
      })),
      setGoalTarget: (id, target, weekStart) => set((state) => {
        const key = weeklyTargetKey(weekStart, id);
        const goal = state.goals.find(g => g.id === id);
        const weeklyTargets = { ...(state.weeklyTargets || {}) };
        // Back at the baseline there is nothing to remember, so drop the
        // override and let the week follow the goal again.
        if (goal && (Number(goal.target) || 0) === target) {
          delete weeklyTargets[key];
        } else {
          weeklyTargets[key] = target;
        }
        return { weeklyTargets };
      }),

      addItem: (item) => set((state) => ({
        items: [
          ...state.items,
          stamp({
            ...item,
            id: newId('item'),
            startMinutes: item.startMinutes ?? nextFreeSlot(state, item.day, item.weekStart)
          })
        ]
      })),
      updateItemValue: (id, value) => set((state) => ({
        items: state.items.map(i => i.id === id ? stamp({ ...i, value }) : i)
      })),
      setItemSubType: (id, subType) => set((state) => ({
        items: state.items.map(i => i.id === id ? stamp({ ...i, workoutType: subType }) : i)
      })),
      removeItem: (id) => set((state) => ({
        items: state.items.filter(i => i.id !== id)
      })),
      moveItem: (id, targetDay, targetWeekStart, newIndex) => set((state) => {
        const item = state.items.find(i => i.id === id);
        if (!item) return state;

        let newItems = state.items.filter(i => i.id !== id);
        const updatedItem: CalendarItem = stamp({
          ...item,
          day: targetDay,
          weekStart: targetWeekStart
        });

        if (newIndex !== undefined) {
          const inTarget = (i: CalendarItem) =>
            i.day === targetDay && i.weekStart === targetWeekStart;
          const targetDayItems = byStartTime(newItems.filter(inTarget));
          targetDayItems.splice(newIndex, 0, updatedItem);
          // Dropped after a workout, so it starts when that one ends; the rest
          // of the day is left where it was.
          updatedItem.startMinutes = startAtIndex(state, targetDayItems, newIndex);
          newItems = [...newItems.filter(i => !inTarget(i)), ...targetDayItems];
        } else {
          newItems.push(updatedItem);
        }

        return { items: newItems };
      }),
      reorderDay: (day, weekStart, oldIndex, newIndex) => set((state) => {
        const inDay = (i: CalendarItem) => i.day === day && i.weekStart === weekStart;
        const dayItems = byStartTime(state.items.filter(inDay));
        const otherItems = state.items.filter(i => !inDay(i));

        // Only the dragged workout is re-timed: it starts when the one it was
        // dropped after ends. The workouts it moved past keep their times
        // rather than trading slots with it.
        const reordered = arrayMove(dayItems, oldIndex, newIndex);
        reordered[newIndex] = stamp({
          ...reordered[newIndex],
          startMinutes: startAtIndex(state, reordered, newIndex)
        });

        return { items: [...otherItems, ...reordered] };
      }),
      setItemTime: (id, startMinutes) => set((state) => ({
        items: state.items.map(i =>
          i.id === id ? stamp({ ...i, startMinutes: clampStartMinutes(startMinutes) }) : i
        )
      })),
      nudgeItemTime: (id, slots) => set((state) => ({
        items: state.items.map(i =>
          i.id === id
            ? stamp({
                ...i,
                startMinutes: clampStartMinutes(startMinutesOf(i) + slots * SLOT_MINUTES)
              })
            : i
        )
      })),
      setItemDuration: (id, durationMinutes) => set((state) => ({
        items: state.items.map(i =>
          i.id === id ? stamp({ ...i, durationMinutes: clampDuration(durationMinutes) }) : i
        )
      })),
      nudgeItemDuration: (id, slots) => set((state) => ({
        items: state.items.map(i => {
          if (i.id !== id) return i;
          const goal = state.goals.find(g => g.id === i.typeId);
          return stamp({
            ...i,
            durationMinutes: clampDuration(durationMinutesOf(i, goal) + slots * SLOT_MINUTES)
          });
        })
      })),

      setGoogleCalendarId: (googleCalendarId) => set({ googleCalendarId }),
      setGoogleSheetId: (googleSheetId) => set({ googleSheetId }),
      setGoogleEventIds: (eventIds) => set((state) => ({
        items: state.items.map(i =>
          eventIds[i.id] ? { ...i, googleEventId: eventIds[i.id] } : i
        )
      })),
      replaceCalendarItems: (items) => set({ items }),

      setNote: (day, weekStart, note) => set((state) => {
        const key = noteKey(weekStart, day);
        if (!note) {
          const newNotes = { ...state.notes };
          delete newNotes[key];
          return { notes: newNotes };
        }
        return { notes: { ...state.notes, [key]: note } };
      }),
      copyWeek: (fromWeekStart, toWeekStart, parts) => set((state) => {
        const { schedule = true, goals = true } = parts ?? {};

        let items = state.items;
        const newNotes = { ...state.notes };
        if (schedule) {
          const fromItems = state.items.filter(i => i.weekStart === fromWeekStart);
          const retainedItems = state.items.filter(i => i.weekStart !== toWeekStart);

          const copiedItems = fromItems.map(i => ({
            ...i,
            id: newId('item'),
            weekStart: toWeekStart,
            // A copy is a new workout, not the same one twice, so it gets its own
            // calendar event rather than pointing at the original's.
            googleEventId: null
          }));
          items = [...retainedItems, ...copiedItems];

          DAYS.forEach(day => {
            const from = state.notes[noteKey(fromWeekStart, day)];
            if (from) {
              newNotes[noteKey(toWeekStart, day)] = from;
            } else {
              delete newNotes[noteKey(toWeekStart, day)];
            }
          });
        }

        // A copied week brings its bent targets with it, so the copy is a
        // faithful duplicate rather than a week snapped back to baseline.
        const weeklyTargets = { ...(state.weeklyTargets || {}) };
        if (goals) {
          state.goals.forEach(goal => {
            const from = weeklyTargets[weeklyTargetKey(fromWeekStart, goal.id)];
            const toKey = weeklyTargetKey(toWeekStart, goal.id);
            if (from === undefined) delete weeklyTargets[toKey];
            else weeklyTargets[toKey] = from;
          });
        }

        return { items, notes: newNotes, weeklyTargets };
      }),
      clearWeek: (weekStart) => set((state) => {
        const newNotes = { ...state.notes };
        DAYS.forEach(day => { delete newNotes[noteKey(weekStart, day)]; });
        const weeklyTargets = { ...(state.weeklyTargets || {}) };
        Object.keys(weeklyTargets).forEach(key => {
          if (key.startsWith(`${weekStart}:`)) delete weeklyTargets[key];
        });
        return {
          items: state.items.filter(i => i.weekStart !== weekStart),
          notes: newNotes,
          weeklyTargets
        };
      }),

      addLink: (link) => set((state) => ({ links: [...state.links, link] })),
      removeLink: (id) => set((state) => ({ links: state.links.filter(l => l.id !== id) })),

      setTempUnit: (tempUnit) => set({ tempUnit }),
      setWeekStartsOn: (weekStartsOn) => set({ weekStartsOn }),
      setDefaultStartMinutes: (startMinutes) => set({
        defaultStartMinutes: clampStartMinutes(startMinutes)
      }),
      replaceAll: (state) => set(state),
      resetAll: () => set(buildInitialState())
    }),
    {
      name: 'workout-week',
      version: 2,
      migrate: migrateStore,
      onRehydrateStorage: () => () => {
        // Run once on hydrate, this imports legacy if needed
        if (!localStorage.getItem('workout-week')) {
          const legacy = importLegacy();
          if (legacy) {
            usePlannerStore.setState(legacy);
          }
        }
      }
    }
  )
);
