import { WorkoutType, CalendarItem, HelpfulLink } from './types';

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export const PRESET_COLORS = [
  '#EE352E', // Tomato Red (1, 2, 3)
  '#00933C', // Apple Green (4, 5, 6)
  '#B933AD', // Raspberry Purple (7)
  '#0039A6', // Blue (A, C, E)
  '#FF6319', // Orange (B, D, F, M)
  '#6CBE45', // Lime Green (G)
  '#996633', // Terracotta Brown (J, Z)
  '#A7A9AC', // Light Slate Gray (L)
  '#FCCC0A', // Sunflower Yellow (N, Q, R, W)
  '#808183', // Dark Slate Gray (S Shuttles)
  '#00ADD0'  // Turquoise / Teal (T Second Ave)
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
    color: '#EE352E', // MTA Red (1, 2, 3)
    workoutTypes: ['Long Run', 'Tempo Run', 'Intervals']
  },
  {
    id: 'type-lift',
    name: 'Lift',
    icon: 'gym',
    metric: 'times',
    unit: 'times',
    target: 3,
    color: '#B933AD', // MTA Purple (7)
    workoutTypes: ['Chest Day', 'Leg Day', 'Arms']
  },
  {
    id: 'type-bike',
    name: 'Bike',
    icon: 'bike',
    metric: 'distance',
    unit: 'miles',
    target: 25,
    color: '#00933C', // MTA Apple Green (4, 5, 6)
    workoutTypes: ['Road Bike', 'Mountain Bike']
  },
  {
    id: 'type-swim',
    name: 'Swim',
    icon: 'swim',
    metric: 'duration',
    unit: 'mins',
    target: 90,
    color: '#0039A6', // MTA Blue (A, C, E)
    workoutTypes: ['Laps', 'Technique']
  },
  {
    id: 'type-yoga',
    name: 'Yoga',
    icon: 'yoga',
    metric: 'duration',
    unit: 'mins',
    target: 60,
    color: '#FF6319', // MTA Orange (B, D, F, M)
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
