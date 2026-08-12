import { WorkoutType, CalendarItem, HelpfulLink } from './types';

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Light Blue
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#64748b'  // Slate
];

export const DEFAULT_LINKS: HelpfulLink[] = [
  {
    id: 'link-1',
    title: 'Gym Pool Schedule',
    url: 'https://www.google.com'
  }
];

export const DEFAULT_WORKOUT_TYPES: WorkoutType[] = [
  {
    id: 'type-run',
    name: 'Run',
    icon: 'run',
    metric: 'distance',
    unit: 'miles',
    target: 10,
    color: '#ff4d4d',
    workoutTypes: ['Long Run', 'Tempo Run', 'Intervals']
  },
  {
    id: 'type-lift',
    name: 'Lift',
    icon: 'gym',
    metric: 'times',
    unit: 'times',
    target: 3,
    color: '#a855f7',
    workoutTypes: ['Chest Day', 'Leg Day', 'Arms']
  },
  {
    id: 'type-bike',
    name: 'Bike',
    icon: 'bike',
    metric: 'distance',
    unit: 'miles',
    target: 25,
    color: '#10b981',
    workoutTypes: ['Road Bike', 'Mountain Bike']
  },
  {
    id: 'type-swim',
    name: 'Swim',
    icon: 'swim',
    metric: 'duration',
    unit: 'mins',
    target: 90,
    color: '#06b6d4',
    workoutTypes: ['Laps', 'Technique']
  },
  {
    id: 'type-yoga',
    name: 'Yoga',
    icon: 'yoga',
    metric: 'duration',
    unit: 'mins',
    target: 60,
    color: '#f59e0b',
    workoutTypes: ['Vinyasa', 'Hatha']
  }
];

export const DEFAULT_CALENDAR_ITEMS: CalendarItem[] = [
  {
    id: 'item-1',
    typeId: 'type-run',
    day: 'monday',
    week: 1,
    value: 3,
    workoutType: 'Long Run'
  },
  {
    id: 'item-2',
    typeId: 'type-lift',
    day: 'tuesday',
    week: 1,
    value: 1,
    workoutType: 'Chest Day'
  },
  {
    id: 'item-3',
    typeId: 'type-bike',
    day: 'wednesday',
    week: 1,
    value: 12,
    workoutType: 'Road Bike'
  },
  {
    id: 'item-4',
    typeId: 'type-yoga',
    day: 'thursday',
    week: 1,
    value: 30,
    workoutType: 'Vinyasa'
  }
];
