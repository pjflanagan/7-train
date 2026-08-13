import { Activity, ScheduledEvent, HelpfulLink } from './types';

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/**
 * Activity colors. Held around the same lightness so no chip reads as louder than
 * its neighbours, and mid-toned enough to stay legible on both themes.
 */
export const PRESET_COLORS = [
  '#E5484D', // red
  '#F76B15', // orange
  '#FFB224', // amber
  '#9BBF2E', // lime
  '#30A46C', // green
  '#12A594', // teal
  '#00A2C7', // cyan
  '#3E63DD', // blue
  '#5B5BD6', // indigo
  '#8E4EC6', // violet
  '#D6409F', // pink
  '#8B8D98'  // slate
];

export const DEFAULT_LINKS: HelpfulLink[] = [
  {
    id: 'link-1',
    title: 'Gym Pool Schedule',
    url: 'https://www.google.com'
  }
];

export const DEFAULT_ACTIVITIES: Activity[] = [
  {
    id: 'type-run',
    name: 'Run',
    icon: 'run',
    metric: 'distance',
    unit: 'miles',
    target: 12,
    color: '#E5484D', // red
    workoutTypes: ['Long', 'Tempo']
  },
  {
    id: 'type-bike',
    name: 'Bike',
    icon: 'bike',
    metric: 'distance',
    unit: 'miles',
    target: 20,
    color: '#F76B15', // orange
    workoutTypes: []
  },
  {
    id: 'type-swim',
    name: 'Swim',
    icon: 'swim',
    metric: 'duration',
    unit: 'mins',
    target: 60,
    color: '#00A2C7', // cyan
    workoutTypes: []
  },
  {
    id: 'type-lift',
    name: 'Lift',
    icon: 'gym',
    metric: 'times',
    unit: 'times',
    target: 5,
    color: '#8E4EC6', // violet
    workoutTypes: ['Chest', 'Arms', 'Back', 'Shoulders', 'Core']
  },
  {
    id: 'type-yoga',
    name: 'Yoga',
    icon: 'yoga',
    metric: 'duration',
    unit: 'mins',
    target: null,
    optional: true,
    color: '#30A46C', // green
    workoutTypes: []
  }
];

/**
 * Seed events for a fresh install, anchored to whichever week is current.
 * Takes the week key as an argument so this module stays free of date logic
 * (lib/dates imports DAYS from here).
 */
export function getDefaultEvents(weekStart: string): ScheduledEvent[] {
  return [
    {
      id: 'event-1',
      typeId: 'type-run',
      day: 'monday',
      weekStart,
      value: 4,
      workoutType: 'Tempo'
    },
    {
      id: 'event-2',
      typeId: 'type-lift',
      day: 'tuesday',
      weekStart,
      value: 1,
      workoutType: 'Chest'
    },
    {
      id: 'event-3',
      typeId: 'type-bike',
      day: 'wednesday',
      weekStart,
      value: 12,
      workoutType: null
    },
    {
      id: 'event-4',
      typeId: 'type-swim',
      day: 'thursday',
      weekStart,
      value: 30,
      workoutType: null
    },
    {
      id: 'event-5',
      typeId: 'type-yoga',
      day: 'friday',
      weekStart,
      value: 45,
      workoutType: null
    },
    {
      id: 'event-6',
      typeId: 'type-run',
      day: 'saturday',
      weekStart,
      value: 8,
      workoutType: 'Long run'
    }
  ];
}
