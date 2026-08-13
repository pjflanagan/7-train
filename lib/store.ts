import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlannerState, WorkoutType, CalendarItem, HelpfulLink } from './types';
import { DEFAULT_WORKOUT_TYPES, getDefaultCalendarItems, DEFAULT_LINKS, DAYS } from './constants';
import { importLegacy, migrateStore } from './migrate';
import { getWeekStartKey, WeekStartsOn } from './dates';
import { weeklyTargetKey } from './progress';
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

  setNote: (day: DayName, weekStart: string, note: string) => void;
  copyWeek: (fromWeekStart: string, toWeekStart: string) => void;
  clearWeek: (weekStart: string) => void;

  addLink: (link: HelpfulLink) => void;
  removeLink: (id: string) => void;

  setTempUnit: (unit: 'C' | 'F') => void;
  setWeekStartsOn: (weekStartsOn: WeekStartsOn) => void;
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
  };
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

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
        items: [...state.items, { ...item, id: newId('item') }]
      })),
      updateItemValue: (id, value) => set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, value } : i)
      })),
      setItemSubType: (id, subType) => set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, workoutType: subType } : i)
      })),
      removeItem: (id) => set((state) => ({
        items: state.items.filter(i => i.id !== id)
      })),
      moveItem: (id, targetDay, targetWeekStart, newIndex) => set((state) => {
        const item = state.items.find(i => i.id === id);
        if (!item) return state;

        let newItems = state.items.filter(i => i.id !== id);
        const updatedItem: CalendarItem = { ...item, day: targetDay, weekStart: targetWeekStart };

        if (newIndex !== undefined) {
          const inTarget = (i: CalendarItem) =>
            i.day === targetDay && i.weekStart === targetWeekStart;
          const targetDayItems = newItems.filter(inTarget);
          targetDayItems.splice(newIndex, 0, updatedItem);
          newItems = [...newItems.filter(i => !inTarget(i)), ...targetDayItems];
        } else {
          newItems.push(updatedItem);
        }

        return { items: newItems };
      }),
      reorderDay: (day, weekStart, oldIndex, newIndex) => set((state) => {
        const inDay = (i: CalendarItem) => i.day === day && i.weekStart === weekStart;
        const dayItems = state.items.filter(inDay);
        const otherItems = state.items.filter(i => !inDay(i));
        return { items: [...otherItems, ...arrayMove(dayItems, oldIndex, newIndex)] };
      }),

      setNote: (day, weekStart, note) => set((state) => {
        const key = noteKey(weekStart, day);
        if (!note) {
          const newNotes = { ...state.notes };
          delete newNotes[key];
          return { notes: newNotes };
        }
        return { notes: { ...state.notes, [key]: note } };
      }),
      copyWeek: (fromWeekStart, toWeekStart) => set((state) => {
        const fromItems = state.items.filter(i => i.weekStart === fromWeekStart);
        const retainedItems = state.items.filter(i => i.weekStart !== toWeekStart);

        const copiedItems = fromItems.map(i => ({
          ...i,
          id: newId('item'),
          weekStart: toWeekStart
        }));

        const newNotes = { ...state.notes };
        DAYS.forEach(day => {
          const from = state.notes[noteKey(fromWeekStart, day)];
          if (from) {
            newNotes[noteKey(toWeekStart, day)] = from;
          } else {
            delete newNotes[noteKey(toWeekStart, day)];
          }
        });

        // A copied week brings its bent targets with it, so the copy is a
        // faithful duplicate rather than a week snapped back to baseline.
        const weeklyTargets = { ...(state.weeklyTargets || {}) };
        state.goals.forEach(goal => {
          const from = weeklyTargets[weeklyTargetKey(fromWeekStart, goal.id)];
          const toKey = weeklyTargetKey(toWeekStart, goal.id);
          if (from === undefined) delete weeklyTargets[toKey];
          else weeklyTargets[toKey] = from;
        });

        return { items: [...retainedItems, ...copiedItems], notes: newNotes, weeklyTargets };
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
