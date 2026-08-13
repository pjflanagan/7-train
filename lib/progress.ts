import { Activity, ScheduledEvent } from './types';

export type TargetProgress = {
  type: Activity;
  current: number;
  target: number;
  percent: number;
  isDone: boolean;
};

export type ProgressMap = Record<string, TargetProgress>;

export type OverallProgress = {
  completed: number;
  total: number;
  percent: number;
};

export type WeeklyTargets = Record<string, number>;

export const weeklyTargetKey = (weekStart: string, activityId: string) => `${weekStart}:${activityId}`;

/**
 * The target an activity runs against in one week: its per-week override when the
 * user has bent that week, otherwise the activity's baseline target.
 */
export function getEffectiveTarget(
  activity: Activity,
  weekStart: string,
  weeklyTargets?: WeeklyTargets
): number {
  const override = weeklyTargets?.[weeklyTargetKey(weekStart, activity.id)];
  return Number(override ?? activity.target) || 0;
}

/**
 * Rounds to the target's own magnitude rather than a fixed number of decimals,
 * so 833.3 lands on 800 and 3.33 lands on 3 — precision that matches how
 * exact the number actually looks at a glance.
 */
function roundToMagnitude(value: number): number {
  if (value <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.round(value / magnitude) * magnitude;
}

/**
 * A week with one measurable activity splits it across roughly six workout
 * days against one rest day — a sixth a session. Spread the same six workout
 * days across more measurable activities and each gets a bigger slice: three
 * activities means each shows up roughly every other workout day, so a
 * session is closer to half the week's target. Times-based activities (reps,
 * sessions) don't compete for calendar days the way a distance/duration
 * activity's split target does, so they don't count toward the split.
 */
function sessionShare(activities: Activity[]): number {
  const measurable = activities.filter(a => !a.optional && a.metric !== 'times').length;
  return Math.min(1, Math.max(measurable, 1) / 6);
}

/**
 * Where a freshly dropped event's value starts: this activity's share of the
 * week's effective target — see `sessionShare` — rounded to a number that
 * reads as a plan rather than an exact division. Falls back to a bare 1 when
 * the activity has no target to divide (optional activities, a fresh 0).
 */
export function defaultEventValue(
  activity: Activity,
  weekStart: string,
  weeklyTargets: WeeklyTargets | undefined,
  activities: Activity[]
): number {
  const target = getEffectiveTarget(activity, weekStart, weeklyTargets);
  if (target <= 0) return 1;
  return roundToMagnitude(target * sessionShare(activities)) || 1;
}

export function calculateProgress(
  types: Activity[],
  events: ScheduledEvent[],
  weekStart?: string,
  weeklyTargets?: WeeklyTargets
): ProgressMap {
  const progressMap: ProgressMap = {};

  types.forEach(type => {
    progressMap[type.id] = {
      type: type,
      current: 0,
      target: type.optional
        ? 0
        : (weekStart ? getEffectiveTarget(type, weekStart, weeklyTargets) : Number(type.target) || 0),
      percent: 0,
      isDone: false
    };
  });

  events.forEach(event => {
    const typeProgress = progressMap[event.typeId];
    if (typeProgress) {
      typeProgress.current += Number(event.value) || 0;
    }
  });

  types.forEach(type => {
    const p = progressMap[type.id];
    if (type.optional) {
      p.current = Math.round(p.current * 100) / 100;
      p.percent = 0;
      p.isDone = p.current > 0;
    } else if (p.target > 0) {
      p.current = Math.round(p.current * 100) / 100;
      p.percent = Math.min(100, Math.round((p.current / p.target) * 100));
      p.isDone = p.current >= p.target;
    } else {
      p.percent = 100;
      p.isDone = true;
    }
  });

  return progressMap;
}

export function getOverallProgress(progressMap: ProgressMap): OverallProgress {
  const keys = Object.keys(progressMap);
  if (keys.length === 0) {
    return { completed: 0, total: 0, percent: 0 };
  }

  let completed = 0;
  let sumPercent = 0;
  let requiredCount = 0;

  keys.forEach(key => {
    const p = progressMap[key];
    if (p.type && p.type.optional) {
      return;
    }
    requiredCount++;
    if (p.isDone) {
      completed++;
    }
    sumPercent += p.percent;
  });

  if (requiredCount === 0) {
    let completedFallback = 0;
    let sumPercentFallback = 0;
    keys.forEach(key => {
      const p = progressMap[key];
      if (p.isDone) {
        completedFallback++;
      }
      sumPercentFallback += p.percent;
    });
    const totalFallback = keys.length;
    const percentFallback = totalFallback > 0 ? Math.round(sumPercentFallback / totalFallback) : 0;
    return {
      completed: completedFallback,
      total: totalFallback,
      percent: percentFallback
    };
  }

  const percent = Math.round(sumPercent / requiredCount);

  return {
    completed: completed,
    total: requiredCount,
    percent: percent
  };
}
