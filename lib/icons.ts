import {
  GiRun,
  GiWeightLiftingUp,
  GiBiceps,
  GiCycling,
  GiMeditation,
  GiWalk,
  GiHiking,
  GiMountainClimbing,
  GiRollerSkate,
  GiSkateboard,
  GiSkier,
  GiSurfBoard,
  GiCanoe,
  GiTennisRacket,
  GiSoccerBall,
  GiBasketballBall,
  GiCartwheel,
  GiBoxingGlove,
  GiJumpingRope,
  GiStairs,
  GiHelp,
} from 'react-icons/gi';
// Game Icons has no swimmer or riding cyclist worth the name, so these two come
// from Font Awesome's person set.
import { FaPersonSwimming, FaPersonBiking } from 'react-icons/fa6';
import type { IconType } from 'react-icons';

/**
 * Keys are persisted on goals, so they are the stable part — the `Icon` behind
 * a key can be reskinned, but a key must never be renamed or dropped without a
 * migration. `legacy` maps the original Material ligature for imported data.
 */
export const ACTIVITY_ICONS = {
  run:        { label: 'Run',         Icon: GiRun,              legacy: 'directions_run' },
  gym:        { label: 'Gym',         Icon: GiWeightLiftingUp,  legacy: 'fitness_center' },
  bicep:      { label: 'Muscle',      Icon: GiBiceps,           legacy: null },
  bike:       { label: 'Bike',        Icon: FaPersonBiking,     legacy: 'directions_bike' },
  mtb:        { label: 'Mountain bike', Icon: GiCycling,        legacy: null },
  swim:       { label: 'Swim',        Icon: FaPersonSwimming,   legacy: 'pool' },
  yoga:       { label: 'Yoga',        Icon: GiMeditation,       legacy: 'self_improvement' },
  walk:       { label: 'Walk',        Icon: GiWalk,             legacy: 'directions_walk' },
  hike:       { label: 'Hike',        Icon: GiHiking,           legacy: null },
  climb:      { label: 'Climb',       Icon: GiMountainClimbing, legacy: null },
  skate:      { label: 'Skate',       Icon: GiRollerSkate,      legacy: 'roller_skating' },
  skateboard: { label: 'Skateboard',  Icon: GiSkateboard,       legacy: null },
  ski:        { label: 'Ski',         Icon: GiSkier,            legacy: null },
  surf:       { label: 'Surf',        Icon: GiSurfBoard,        legacy: null },
  row:        { label: 'Row',         Icon: GiCanoe,            legacy: 'rowing' },
  tennis:     { label: 'Tennis',      Icon: GiTennisRacket,     legacy: 'sports_tennis' },
  soccer:     { label: 'Soccer',      Icon: GiSoccerBall,       legacy: null },
  basketball: { label: 'Basketball',  Icon: GiBasketballBall,   legacy: null },
  gymnastics: { label: 'Gymnastics',  Icon: GiCartwheel,        legacy: 'sports_gymnastics' },
  combat:     { label: 'Combat',      Icon: GiBoxingGlove,      legacy: 'sports_kabaddi' },
  jumpRope:   { label: 'Jump rope',   Icon: GiJumpingRope,      legacy: null },
  stairs:     { label: 'Stairs',      Icon: GiStairs,           legacy: null },
  other:      { label: 'Other',       Icon: GiHelp,             legacy: 'help_outline' },
} as const;

export type IconKey = keyof typeof ACTIVITY_ICONS;

export function getIconByKey(key: string | undefined | null): IconType {
  if (key && key in ACTIVITY_ICONS) {
    return ACTIVITY_ICONS[key as IconKey].Icon;
  }
  return ACTIVITY_ICONS.other.Icon;
}
