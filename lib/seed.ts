import { Activity, ScheduledEvent, HelpfulLink } from './types';
import { buildActivitySnapshot } from './activitySnapshot';

/**
 * What a fresh install starts with: a week someone can look at and edit,
 * rather than an empty grid with no clue what to do with it.
 *
 * Kept apart from `lib/constants.ts` so that the day names and colour palette —
 * which nearly everything imports — do not drag activities, events and the
 * snapshot builder in behind them.
 */

export const DEFAULT_LINKS: HelpfulLink[] = [
  {
    id: 'link-1',
    title: 'Gym pool schedule',
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
    // 8:30 per mile.
    paceMinutes: 8.5,
    paceDistance: 1,
    color: '#E5484D', // red
    workoutTypes: ['Long', 'Tempo'],
    stravaSportTypes: ['Run', 'TrailRun', 'VirtualRun']
  },
  {
    id: 'type-bike',
    name: 'Bike',
    icon: 'bike',
    metric: 'duration',
    unit: 'mins',
    target: 240,
    color: '#F76B15', // orange
    workoutTypes: [],
    stravaSportTypes: ['Ride', 'GravelRide', 'VirtualRide', 'EBikeRide']
  },
  {
    id: 'type-swim',
    name: 'Swim',
    icon: 'swim',
    metric: 'distance',
    unit: 'yards',
    target: 5000,
    // 2:00 per 100 yards.
    paceMinutes: 2,
    paceDistance: 100,
    color: '#00A2C7', // cyan
    workoutTypes: [],
    stravaSportTypes: ['Swim'],
    links: [
      { id: 'link-swim-howto', title: 'How to Swim', url: 'https://youtu.be/Rr_CnIfr5u8?si=rbdujpGZdmoIR_Ie' }
    ]
  },
  {
    id: 'type-lift',
    name: 'Lift',
    icon: 'gym',
    metric: 'instance',
    unit: 'sessions',
    target: 5,
    color: '#8E4EC6', // violet
    workoutTypes: ['Chest', 'Arms', 'Back', 'Shoulders', 'Core'],
    stravaSportTypes: ['WeightTraining', 'Workout', 'Crossfit']
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
    workoutTypes: [],
    stravaSportTypes: ['Yoga', 'Pilates']
  }
];

/**
 * Seed events for a fresh install, anchored to whichever week is current.
 * Takes the week key as an argument so this module stays free of date logic
 * (lib/dates imports DAYS from here).
 */
export function getDefaultEvents(weekStart: string): ScheduledEvent[] {
  const events: Omit<ScheduledEvent, 'activitySnapshot'>[] = [
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
      value: 60,
      workoutType: null
    },
    {
      id: 'event-4',
      typeId: 'type-swim',
      day: 'thursday',
      weekStart,
      value: 1000,
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
      // Must be one of the Run activity's own `workoutTypes` above — a seed
      // naming a type that does not exist renders a chip nothing can match.
      workoutType: 'Long'
    }
  ];

  return events.map(event => ({
    ...event,
    // Seeds are events like any other: they carry their own copy of the
    // activity so they render without the seeded week's targets.
    activitySnapshot: buildActivitySnapshot(
      DEFAULT_ACTIVITIES.find(a => a.id === event.typeId)!
    )
  }));
}
