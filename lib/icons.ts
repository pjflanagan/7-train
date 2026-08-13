import { FaPersonSwimming, FaPersonBiking, FaPersonRunning, FaDumbbell, FaMountain, FaPersonSkiing, FaPersonWalking, FaPersonSkating, FaPersonSkiingNordic, FaPersonSnowboarding, FaPersonHiking, FaStairs, FaMedal, FaHeartPulse } from 'react-icons/fa6';
import type { IconType } from 'react-icons';
import { FaBasketballBall } from 'react-icons/fa';
import { RiBoxingFill } from 'react-icons/ri';
import { MdOutlineRollerSkating, MdRowing, MdSkateboarding, MdSportsGymnastics, MdSportsTennis, MdSurfing } from 'react-icons/md';
import { PiSoccerBallFill } from 'react-icons/pi';
import { LuBicepsFlexed } from 'react-icons/lu';
import { TbJumpRope, TbOlympics } from 'react-icons/tb';
import { GrYoga } from 'react-icons/gr';
import { GiCarabiner } from 'react-icons/gi';

/**
 * Keys are persisted on activities, so they are the stable part — the `Icon` behind
 * a key can be reskinned, but a key must never be renamed or dropped without a
 * migration. `legacy` maps the original Material ligature for imported data.
 */
export const ACTIVITY_ICONS = {
  run: { label: 'Run', Icon: FaPersonRunning, legacy: 'directions_run' },
  bike: { label: 'Bike', Icon: FaPersonBiking, legacy: 'directions_bike' },
  swim: { label: 'Swim', Icon: FaPersonSwimming, legacy: 'pool' },
  gym: { label: 'Gym', Icon: FaDumbbell, legacy: 'fitness_center' },
  tennis: { label: 'Tennis', Icon: MdSportsTennis, legacy: 'sports_tennis' },
  yoga: { label: 'Yoga', Icon: GrYoga, legacy: 'self_improvement' },
  stairs: { label: 'Stairs', Icon: FaStairs, legacy: null },
  walk: { label: 'Walk', Icon: FaPersonWalking, legacy: 'directions_walk' },
  hike: { label: 'Hike', Icon: FaPersonHiking, legacy: null },
  climb: { label: 'Climb', Icon: GiCarabiner, legacy: null },
  bicep: { label: 'Muscle', Icon: LuBicepsFlexed, legacy: null },
  iceSkating: { label: 'Ice Skating', Icon: FaPersonSkating, legacy: null },
  skate: { label: 'Skate', Icon: MdOutlineRollerSkating, legacy: 'roller_skating' },
  skateboard: { label: 'Skateboard', Icon: MdSkateboarding, legacy: null },
  snowboard: { label: 'Snowboard', Icon: FaPersonSnowboarding, legacy: null, },
  ski: { label: 'Ski', Icon: FaPersonSkiing, legacy: null },
  crossCountrySki: { label: 'Cross Country Ski', Icon: FaPersonSkiingNordic, legacy: null },
  surf: { label: 'Surf', Icon: MdSurfing, legacy: null },
  row: { label: 'Row', Icon: MdRowing, legacy: 'rowing' },
  soccer: { label: 'Soccer', Icon: PiSoccerBallFill, legacy: null },
  basketball: { label: 'Basketball', Icon: FaBasketballBall, legacy: null },
  gymnastics: { label: 'Gymnastics', Icon: TbOlympics, legacy: 'sports_gymnastics' },
  combat: { label: 'Boxing', Icon: RiBoxingFill, legacy: 'sports_kabaddi' },
  karate: { label: 'Karate', Icon: MdSportsGymnastics, legacy: null },
  jumpRope: { label: 'Jump rope', Icon: TbJumpRope, legacy: null },
  other: { label: 'Other', Icon: FaMedal, legacy: 'help_outline' },
  mtb: { label: 'Mountain', Icon: FaMountain, legacy: null },
  heart: { label: 'Heart', Icon: FaHeartPulse, legacy: null }
} as const;

export type IconKey = keyof typeof ACTIVITY_ICONS;

export function getIconByKey(key: string | undefined | null): IconType {
  if (key && key in ACTIVITY_ICONS) {
    return ACTIVITY_ICONS[key as IconKey].Icon;
  }
  return ACTIVITY_ICONS.other.Icon;
}
