import { z } from 'zod';
import { ACTIVITY_ICONS, IconKey } from './icons';

export const HelpfulLinkSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string()
});
export type HelpfulLink = z.infer<typeof HelpfulLinkSchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.custom<IconKey>((val) => typeof val === 'string' && val in ACTIVITY_ICONS),
  metric: z.enum(['distance', 'duration', 'instance']),
  unit: z.string(),
  target: z.number().nullable(),
  color: z.string(),
  optional: z.boolean().optional(),
  /**
   * Typical pace, on a distance workout: `paceMinutes` minutes per
   * `paceDistance` of `unit`. What a scheduled event's length is estimated
   * from, in place of the rough per-icon table.
   *
   * Stored as the pair the user typed rather than collapsed to a per-one-unit
   * ratio, because the denominator is part of how a pace is read: swimming is
   * 2:00 per 100 yards, never 0:01 per yard.
   */
  paceMinutes: z.number().positive().nullable().optional(),
  /** Defaults to 1, which is what every pace stored before this meant. */
  paceDistance: z.number().positive().nullable().optional(),
  /**
   * Typical session length in minutes, on an `instance` workout — there is no value
   * to derive one from, so this is the whole estimate.
   */
  typicalDurationMinutes: z.number().int().positive().nullable().optional(),
  workoutTypes: z.array(z.string()).optional(),
  links: z.array(HelpfulLinkSchema).optional()
});
export type Activity = z.infer<typeof ActivitySchema>;

/**
 * An event's own copy of the activity it is — enough to draw the card with no
 * help from "My activities" or from the week's targets. Every event carries one,
 * so a schedule loaded on a device that has never seen these activities (or into
 * a week nobody has set targets for) still renders.
 *
 * It tracks the week's activity while that activity still describes the event,
 * and freezes when it stops — see `activityFrozen`.
 */
export const ActivitySnapshotSchema = z.object({
  name: z.string(),
  icon: z.custom<IconKey>((val) => typeof val === 'string' && val in ACTIVITY_ICONS),
  metric: z.enum(['distance', 'duration', 'instance']),
  unit: z.string(),
  color: z.string(),
  paceMinutes: z.number().positive().nullable().optional(),
  paceDistance: z.number().positive().nullable().optional(),
  typicalDurationMinutes: z.number().int().positive().nullable().optional(),
  /** The sub-kinds to offer on this event when the activity itself is gone. */
  workoutTypes: z.array(z.string()).optional(),
});
export type ActivitySnapshot = z.infer<typeof ActivitySnapshotSchema>;

export const ScheduledEventSchema = z.object({
  id: z.string(),
  typeId: z.string(),
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  /** YYYY-MM-DD of the day the containing week starts on. */
  weekStart: z.string(),
  value: z.number(),
  workoutType: z.string().nullable().optional(),
  /**
   * Start of the workout, in minutes from local midnight, snapped to 15.
   * Absent on events created before times existed; treat as the default slot.
   */
  startMinutes: z.number().int().min(0).max(1439).optional(),
  /**
   * How long the workout runs, in minutes, snapped to 15. Absent until someone
   * sets it, and then it wins over the estimate read off the activity.
   */
  durationMinutes: z.number().int().min(15).max(1440).optional(),
  /** The Google Calendar event this event is mirrored to, once it has one. */
  googleEventId: z.string().nullable().optional(),
  /**
   * ISO timestamp of the last edit to the workout itself — when it happens,
   * how long it runs, what it is. Absent on events last touched before this was
   * recorded, which for merging purposes makes them older than anything stamped.
   *
   * Bookkeeping that doesn't change the plan (learning an event's Google event
   * id, say) deliberately leaves it alone, so syncing never makes a side look
   * newer than the other just by running.
   */
  updatedAt: z.string().optional(),
  /**
   * The event's own copy of its activity. Written whenever an event is created
   * or edited, so an event describes itself without the week's targets.
   *
   * Optional only for events written before this existed; the migration
   * backfills them, and nothing creates one without it.
   */
  activitySnapshot: ActivitySnapshotSchema.optional(),
  /**
   * Set once the week's activity stops describing this event — the week removed
   * it, or re-measured it (swimming in miles becoming swimming in minutes).
   * From then on the snapshot is the truth and stops tracking, so a logged "30"
   * stays the 30 miles it was entered as.
   */
  activityFrozen: z.boolean().optional()
});
export type ScheduledEvent = z.infer<typeof ScheduledEventSchema>;

export const HistoryEntrySchema = z.object({
  id: z.string(),
  date: z.string(), // YYYY-MM-DD
  day: z.string(),
  typeId: z.string().nullable(),
  workoutType: z.string().nullable().optional(),
  value: z.number().nullable(),
  notes: z.string().nullable().optional(),
  /** Carried over from the source event when its activity has been deleted. */
  activitySnapshot: ActivitySnapshotSchema.optional()
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const PlannerStateSchema = z.object({
  activities: z.array(ActivitySchema),
  events: z.array(ScheduledEventSchema),
  notes: z.record(z.string(), z.string()), // `${weekStart}-${day}` -> text
  /**
   * What each week is aiming at, keyed `${weekStart}:${activityId}`. A week
   * holds its own copy of every activity it plans, taken from `activities` when
   * the week was filled — so `activities` is the template a week can be built
   * from ("My activities"), and a week can then be edited without the template
   * or any other week moving. A week holds nothing until it is filled.
   */
  weekActivities: z.record(z.string(), ActivitySchema).optional().default({}),
  links: z.array(HelpfulLinkSchema),
  history: z.array(HistoryEntrySchema),
  lastViewedMonday: z.string().nullable(),
  tempUnit: z.enum(['C', 'F']).optional().default('F'),
  /** Whether times are shown as "17:30" instead of "5:30 PM". */
  use24HourClock: z.boolean().optional().default(false),
  /**
   * When a newly added workout lands on an empty day, in minutes from local
   * midnight. Workouts added to a day that already has some still stack after
   * the last one.
   */
  defaultStartMinutes: z.number().int().min(0).max(1439).optional().default(7 * 60),
  /** 0 = Sunday ... 6 = Saturday. */
  weekStartsOn: z.number().int().min(0).max(6).optional().default(1),
  /** The `Workouts` calendar we created in Google, once we have made one. */
  googleCalendarId: z.string().nullable().optional().default(null),
  /** The spreadsheet history is exported to, so repeat exports overwrite it. */
  googleSheetId: z.string().nullable().optional().default(null)
});
export type PlannerState = z.infer<typeof PlannerStateSchema>;
