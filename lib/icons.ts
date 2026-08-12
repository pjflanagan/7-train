import {
  MdDirectionsRun,
  MdFitnessCenter,
  MdDirectionsBike,
  MdPool,
  MdSelfImprovement,
  MdDirectionsWalk,
  MdRollerSkating,
  MdRowing,
  MdSportsTennis,
  MdSportsGymnastics,
  MdSportsKabaddi,
  MdHelpOutline,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

export const ACTIVITY_ICONS = {
  run:        { label: 'Run',        Icon: MdDirectionsRun,    legacy: 'directions_run' },
  gym:        { label: 'Gym',        Icon: MdFitnessCenter,    legacy: 'fitness_center' },
  bike:       { label: 'Bike',       Icon: MdDirectionsBike,   legacy: 'directions_bike' },
  swim:       { label: 'Swim',       Icon: MdPool,             legacy: 'pool' },
  yoga:       { label: 'Yoga',       Icon: MdSelfImprovement,  legacy: 'self_improvement' },
  walk:       { label: 'Walk',       Icon: MdDirectionsWalk,   legacy: 'directions_walk' },
  skate:      { label: 'Skate',      Icon: MdRollerSkating,    legacy: 'roller_skating' },
  row:        { label: 'Row',        Icon: MdRowing,           legacy: 'rowing' },
  tennis:     { label: 'Tennis',     Icon: MdSportsTennis,     legacy: 'sports_tennis' },
  gymnastics: { label: 'Gymnastics', Icon: MdSportsGymnastics, legacy: 'sports_gymnastics' },
  combat:     { label: 'Combat',     Icon: MdSportsKabaddi,    legacy: 'sports_kabaddi' },
  other:      { label: 'Other',      Icon: MdHelpOutline,      legacy: 'help_outline' },
} as const;

export type IconKey = keyof typeof ACTIVITY_ICONS;

export function getIconByKey(key: string | undefined | null): IconType {
  if (key && key in ACTIVITY_ICONS) {
    return ACTIVITY_ICONS[key as IconKey].Icon;
  }
  return ACTIVITY_ICONS.other.Icon;
}
