import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlannerState, WorkoutType, CalendarItem, HelpfulLink } from './types';
import { DEFAULT_WORKOUT_TYPES, DEFAULT_CALENDAR_ITEMS, DEFAULT_LINKS, DAYS } from './constants';
import { importLegacy, migrateStore } from './migrate';
import { computeRollover } from './weekRollover';
import { arrayMove } from '@dnd-kit/sortable';

type PlannerStore = PlannerState & {
  addGoal: (goal: WorkoutType) => void;
  updateGoal: (id: string, goal: Partial<WorkoutType>) => void;
  deleteGoal: (id: string) => void;
  reorderGoals: (oldIndex: number, newIndex: number) => void;
  setGoalTarget: (id: string, target: number) => void;
  
  addItem: (item: Omit<CalendarItem, 'id'>) => void;
  updateItemValue: (id: string, value: number) => void;
  setItemSubType: (id: string, subType: string | null) => void;
  removeItem: (id: string) => void;
  moveItem: (id: string, targetDay: typeof DAYS[number], targetWeek: 1 | 2, newIndex?: number) => void;
  reorderDay: (day: typeof DAYS[number], week: 1 | 2, oldIndex: number, newIndex: number) => void;
  
  setNote: (day: typeof DAYS[number], week: 1 | 2, note: string) => void;
  copyWeek: (fromWeek: 1 | 2, toWeek: 1 | 2) => void;
  clearWeek: (week: 1 | 2) => void;
  
  addLink: (link: HelpfulLink) => void;
  removeLink: (id: string) => void;
  
  applyRollover: (today: Date) => void;
  setTempUnit: (unit: 'C' | 'F') => void;
  resetAll: () => void;
};

const initialState: PlannerState = {
  goals: DEFAULT_WORKOUT_TYPES,
  items: DEFAULT_CALENDAR_ITEMS,
  notes: {},
  links: DEFAULT_LINKS,
  history: [],
  lastViewedMonday: null,
  tempUnit: 'F',
};

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set) => ({
      ...initialState,
      
      addGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
      updateGoal: (id, updates) => set((state) => ({
        goals: state.goals.map(g => g.id === id ? { ...g, ...updates } : g)
      })),
      deleteGoal: (id) => set((state) => ({
        goals: state.goals.filter(g => g.id !== id),
        items: state.items.filter(i => i.typeId !== id)
      })),
      reorderGoals: (oldIndex, newIndex) => set((state) => ({
        goals: arrayMove(state.goals, oldIndex, newIndex)
      })),
      setGoalTarget: (id, target) => set((state) => ({
        goals: state.goals.map(g => g.id === id ? { ...g, target } : g)
      })),
      
      addItem: (item) => set((state) => {
        const id = 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5);
        return { items: [...state.items, { ...item, id }] };
      }),
      updateItemValue: (id, value) => set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, value } : i)
      })),
      setItemSubType: (id, subType) => set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, workoutType: subType } : i)
      })),
      removeItem: (id) => set((state) => ({
        items: state.items.filter(i => i.id !== id)
      })),
      moveItem: (id, targetDay, targetWeek, newIndex) => set((state) => {
        const item = state.items.find(i => i.id === id);
        if (!item) return state;
        
        let newItems = state.items.filter(i => i.id !== id);
        const updatedItem: CalendarItem = { ...item, day: targetDay, week: targetWeek };
        
        if (newIndex !== undefined) {
          const targetDayItems = newItems.filter(i => i.day === targetDay && i.week === targetWeek);
          targetDayItems.splice(newIndex, 0, updatedItem);
          newItems = [
            ...newItems.filter(i => !(i.day === targetDay && i.week === targetWeek)),
            ...targetDayItems
          ];
        } else {
          newItems.push(updatedItem);
        }
        
        return { items: newItems };
      }),
      reorderDay: (day, week, oldIndex, newIndex) => set((state) => {
        const dayItems = state.items.filter(i => i.day === day && i.week === week);
        const otherItems = state.items.filter(i => !(i.day === day && i.week === week));
        const reordered = arrayMove(dayItems, oldIndex, newIndex);
        return { items: [...otherItems, ...reordered] };
      }),
      
      setNote: (day, week, note) => set((state) => {
        const key = `${day}-${week}`;
        if (!note) {
          const newNotes = { ...state.notes };
          delete newNotes[key];
          return { notes: newNotes };
        }
        return { notes: { ...state.notes, [key]: note } };
      }),
      copyWeek: (fromWeek, toWeek) => set((state) => {
        const fromItems = state.items.filter(i => i.week === fromWeek);
        const retainedItems = state.items.filter(i => i.week !== toWeek);
        
        const copiedItems = fromItems.map(i => ({
          ...i,
          id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          week: toWeek
        }));
        
        const newNotes = { ...state.notes };
        DAYS.forEach(day => {
          const fromKey = `${day}-${fromWeek}`;
          const toKey = `${day}-${toWeek}`;
          if (state.notes[fromKey]) {
            newNotes[toKey] = state.notes[fromKey];
          } else {
            delete newNotes[toKey];
          }
        });
        
        return { items: [...retainedItems, ...copiedItems], notes: newNotes };
      }),
      clearWeek: (week) => set((state) => {
        const newNotes = { ...state.notes };
        DAYS.forEach(day => { delete newNotes[`${day}-${week}`]; });
        return {
          items: state.items.filter(i => i.week !== week),
          notes: newNotes
        };
      }),
      
      addLink: (link) => set((state) => ({ links: [...state.links, link] })),
      removeLink: (id) => set((state) => ({ links: state.links.filter(l => l.id !== id) })),
      
      applyRollover: (today) => set((state) => computeRollover(state, today)),
      setTempUnit: (tempUnit) => set({ tempUnit }),
      resetAll: () => set(initialState)
    }),
    {
      name: 'workout-week',
      version: 1,
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
