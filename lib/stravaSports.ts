/**
 * Strava's own sports, as an activity can be told to accept them.
 *
 * This list is ours on purpose. The published npm clients ship `SportType` as a
 * type-only union — nothing to iterate for a picker — and the ones that exist
 * are already behind the API, missing the racquet sports, Pilates and HIIT that
 * Strava added later. So the list lives here, where it can be corrected in one
 * place when Strava adds a sport.
 *
 * `id` is Strava's exact `sport_type` string and is persisted on activities, so
 * it is the stable part: a label can be reworded, an id cannot change without a
 * migration.
 */

import { IconKey } from './icons';

export interface StravaSport {
  /** Strava's `sport_type`, verbatim. */
  id: string;
  /** How we say it. Sentence case, like every other piece of copy. */
  label: string;
  group: StravaSportGroup;
}

export type StravaSportGroup =
  | 'Run'
  | 'Ride'
  | 'Water'
  | 'Winter'
  | 'Gym'
  | 'Racquet'
  | 'Other';

/** Group order, which is the order the picker draws them in. */
export const STRAVA_SPORT_GROUPS: StravaSportGroup[] = [
  'Run',
  'Ride',
  'Water',
  'Winter',
  'Gym',
  'Racquet',
  'Other',
];

export const STRAVA_SPORTS: StravaSport[] = [
  { id: 'Run', label: 'Run', group: 'Run' },
  { id: 'TrailRun', label: 'Trail run', group: 'Run' },
  { id: 'VirtualRun', label: 'Virtual run', group: 'Run' },
  { id: 'Walk', label: 'Walk', group: 'Run' },
  { id: 'Hike', label: 'Hike', group: 'Run' },
  { id: 'Wheelchair', label: 'Wheelchair', group: 'Run' },

  { id: 'Ride', label: 'Ride', group: 'Ride' },
  { id: 'GravelRide', label: 'Gravel ride', group: 'Ride' },
  { id: 'MountainBikeRide', label: 'Mountain bike ride', group: 'Ride' },
  { id: 'EBikeRide', label: 'E-bike ride', group: 'Ride' },
  { id: 'EMountainBikeRide', label: 'E-mountain bike ride', group: 'Ride' },
  { id: 'VirtualRide', label: 'Virtual ride', group: 'Ride' },
  { id: 'Handcycle', label: 'Handcycle', group: 'Ride' },
  { id: 'Velomobile', label: 'Velomobile', group: 'Ride' },

  { id: 'Swim', label: 'Swim', group: 'Water' },
  { id: 'Rowing', label: 'Rowing', group: 'Water' },
  { id: 'VirtualRow', label: 'Virtual row', group: 'Water' },
  { id: 'Kayaking', label: 'Kayaking', group: 'Water' },
  { id: 'Canoeing', label: 'Canoeing', group: 'Water' },
  { id: 'StandUpPaddling', label: 'Stand up paddling', group: 'Water' },
  { id: 'Surfing', label: 'Surfing', group: 'Water' },
  { id: 'Kitesurf', label: 'Kitesurf', group: 'Water' },
  { id: 'Windsurf', label: 'Windsurf', group: 'Water' },
  { id: 'Sail', label: 'Sail', group: 'Water' },

  { id: 'AlpineSki', label: 'Alpine ski', group: 'Winter' },
  { id: 'BackcountrySki', label: 'Backcountry ski', group: 'Winter' },
  { id: 'NordicSki', label: 'Nordic ski', group: 'Winter' },
  { id: 'RollerSki', label: 'Roller ski', group: 'Winter' },
  { id: 'Snowboard', label: 'Snowboard', group: 'Winter' },
  { id: 'Snowshoe', label: 'Snowshoe', group: 'Winter' },
  { id: 'IceSkate', label: 'Ice skate', group: 'Winter' },

  { id: 'WeightTraining', label: 'Weight training', group: 'Gym' },
  { id: 'Workout', label: 'Workout', group: 'Gym' },
  { id: 'Crossfit', label: 'Crossfit', group: 'Gym' },
  {
    id: 'HighIntensityIntervalTraining',
    label: 'High intensity interval training',
    group: 'Gym',
  },
  { id: 'Elliptical', label: 'Elliptical', group: 'Gym' },
  { id: 'StairStepper', label: 'Stair stepper', group: 'Gym' },
  { id: 'Yoga', label: 'Yoga', group: 'Gym' },
  { id: 'Pilates', label: 'Pilates', group: 'Gym' },

  { id: 'Tennis', label: 'Tennis', group: 'Racquet' },
  { id: 'Badminton', label: 'Badminton', group: 'Racquet' },
  { id: 'Squash', label: 'Squash', group: 'Racquet' },
  { id: 'Racquetball', label: 'Racquetball', group: 'Racquet' },
  { id: 'Pickleball', label: 'Pickleball', group: 'Racquet' },
  { id: 'TableTennis', label: 'Table tennis', group: 'Racquet' },

  { id: 'RockClimbing', label: 'Rock climbing', group: 'Other' },
  { id: 'InlineSkate', label: 'Inline skate', group: 'Other' },
  { id: 'Skateboard', label: 'Skateboard', group: 'Other' },
  { id: 'Soccer', label: 'Soccer', group: 'Other' },
  { id: 'Golf', label: 'Golf', group: 'Other' },
];

const SPORT_LABELS = new Map(STRAVA_SPORTS.map((sport) => [sport.id, sport.label]));

/** How to say a sport, falling back to Strava's own word for one we don't list. */
export function stravaSportLabel(id: string): string {
  return SPORT_LABELS.get(id) ?? id;
}

/**
 * What an activity accepts when nobody has said, keyed by the icon it draws
 * with. Two jobs, and only two:
 *
 * 1. Seeding an activity made before sports were a field, in the migration.
 * 2. Filling in a sensible starting point when someone picks an icon while
 *    making a new activity.
 *
 * After that the activity's own list is the truth, and the icon goes back to
 * being decoration. An icon missing here — `heart`, `bicep`, `other` — has no
 * honest Strava equivalent, so an activity drawn with one starts with nothing
 * and says so, rather than quietly matching the wrong recordings.
 *
 * A single running activity should catch trail and treadmill runs too, so the
 * defaults are generous. Someone who keeps "Long run" and "Trail run" apart
 * narrows them by hand, which is the whole point of the field existing.
 */
export const DEFAULT_SPORTS_BY_ICON: Partial<Record<IconKey, string[]>> = {
  run: ['Run', 'TrailRun', 'VirtualRun'],
  walk: ['Walk'],
  hike: ['Hike', 'Snowshoe'],
  bike: ['Ride', 'GravelRide', 'VirtualRide', 'EBikeRide'],
  mtb: ['MountainBikeRide', 'EMountainBikeRide'],
  swim: ['Swim'],
  // Deliberately not Kayaking or Canoeing: a paddle down a river is not an erg
  // session, and folding them together is what made the old icon matching
  // log the wrong thing against a rowing target.
  row: ['Rowing', 'VirtualRow'],
  surf: ['Surfing', 'Kitesurf', 'Windsurf'],
  climb: ['RockClimbing'],
  gym: ['WeightTraining', 'Workout', 'Crossfit'],
  stairs: ['StairStepper'],
  yoga: ['Yoga', 'Pilates'],
  ski: ['AlpineSki', 'BackcountrySki'],
  crossCountrySki: ['NordicSki', 'RollerSki'],
  snowboard: ['Snowboard'],
  iceSkating: ['IceSkate'],
  skate: ['InlineSkate'],
  skateboard: ['Skateboard'],
  soccer: ['Soccer'],
  tennis: ['Tennis', 'Badminton', 'Squash', 'Racquetball', 'Pickleball', 'TableTennis'],
};

/**
 * The sports an activity answers to.
 *
 * `undefined` means nobody has been asked yet — an activity from before the
 * field existed, or one pulled back from a calendar written by an older device
 * — so the icon's defaults stand in. An empty array is an answer: this activity
 * is not something Strava records, and nothing should match it.
 */
export function sportsForActivity(activity: {
  icon: IconKey;
  stravaSportTypes?: string[] | null;
}): string[] {
  if (activity.stravaSportTypes) return activity.stravaSportTypes;
  return DEFAULT_SPORTS_BY_ICON[activity.icon] ?? [];
}
