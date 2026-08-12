import { WorkoutType, CalendarItem } from './types';

export type GoalProgress = {
  type: WorkoutType;
  current: number;
  target: number;
  percent: number;
  isDone: boolean;
};

export type ProgressMap = Record<string, GoalProgress>;

export type OverallProgress = {
  completed: number;
  total: number;
  percent: number;
};

export function calculateProgress(types: WorkoutType[], items: CalendarItem[]): ProgressMap {
  const progressMap: ProgressMap = {};

  types.forEach(type => {
    progressMap[type.id] = {
      type: type,
      current: 0,
      target: type.optional ? 0 : (Number(type.target) || 0),
      percent: 0,
      isDone: false
    };
  });

  items.forEach(item => {
    const typeProgress = progressMap[item.typeId];
    if (typeProgress) {
      typeProgress.current += Number(item.value) || 0;
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
