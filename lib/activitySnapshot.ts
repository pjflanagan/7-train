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
    typicalDurationMinutes: snapshot.typicalDurationMinutes ?? null,
    // The activity's current sub-kinds are still worth offering on an event
    // whose measurement was frozen — only the meaning of `value` is fixed.
    workoutTypes: live?.workoutTypes ?? [],
  };
}

/**
 * How an event should be read. An event snapshots its activity the moment that
 * activity stops describing it — deleted, or re-measured (swimming in miles
 * becoming swimming in minutes) — and from then on the snapshot wins. A logged
 * "30" stays the 30 miles it was rather than silently becoming 30 minutes.
 */
export function resolveEventActivity(
  event: Pick<ScheduledEvent, 'typeId' | 'activitySnapshot'>,
  activities: Activity[]
): Activity | undefined {
  const live = activities.find((a) => a.id === event.typeId);
  if (event.activitySnapshot) {
    return activityFromSnapshot(event.typeId, event.activitySnapshot, live);
  }
  return live;
}

/** What an event holds onto once the activity stops describing it. */
export function buildActivitySnapshot(activity: Activity): ActivitySnapshot {
  return {
    name: activity.name,
    icon: activity.icon,
    metric: activity.metric,
    unit: activity.unit,
    color: activity.color,
    paceMinutes: activity.paceMinutes ?? null,
    typicalDurationMinutes: activity.typicalDurationMinutes ?? null,
  };
}
