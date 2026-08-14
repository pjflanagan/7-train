import { Activity, ActivitySnapshot, ScheduledEvent } from './types';

/** Rebuilds an activity-shaped record from what an event held onto, for when
 * the live activity no longer describes it. */
function activityFromSnapshot(
  typeId: string,
  snapshot: ActivitySnapshot,
  live: Activity | undefined
): Activity {
  return {
    id: typeId,
    name: snapshot.name,
    icon: snapshot.icon,
    metric: snapshot.metric,
    unit: snapshot.unit,
    target: null,
    color: snapshot.color,
    paceMinutes: snapshot.paceMinutes ?? null,
    paceDistance: snapshot.paceDistance ?? null,
    typicalDurationMinutes: snapshot.typicalDurationMinutes ?? null,
    // The activity's current sub-kinds are still worth offering on an event
    // whose measurement was frozen — only the meaning of `value` is fixed.
    workoutTypes: live?.workoutTypes ?? snapshot.workoutTypes ?? [],
  };
}

/**
 * How an event should be read.
 *
 * Every event carries its own snapshot of its activity, so this answers even
 * when `activities` is empty — a week with no targets still draws its events.
 * While the week's activity still describes the event the two agree (the store
 * re-stamps the snapshot on every edit), and the live copy is preferred so an
 * edit is never a frame behind. Once the event is frozen — the week dropped the
 * activity, or re-measured it — the snapshot wins outright.
 */
export function resolveEventActivity(
  event: Pick<ScheduledEvent, 'typeId' | 'activitySnapshot' | 'activityFrozen'>,
  activities: Activity[]
): Activity | undefined {
  const live = activities.find((a) => a.id === event.typeId);
  if (event.activitySnapshot && (event.activityFrozen || !live)) {
    return activityFromSnapshot(event.typeId, event.activitySnapshot, live);
  }
  return live;
}

/** What an event holds onto so it can render on its own. */
export function buildActivitySnapshot(activity: Activity): ActivitySnapshot {
  return {
    name: activity.name,
    icon: activity.icon,
    metric: activity.metric,
    unit: activity.unit,
    color: activity.color,
    paceMinutes: activity.paceMinutes ?? null,
    paceDistance: activity.paceDistance ?? null,
    typicalDurationMinutes: activity.typicalDurationMinutes ?? null,
    workoutTypes: activity.workoutTypes ?? [],
  };
}
