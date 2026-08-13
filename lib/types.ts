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
  metric: z.enum(['distance', 'duration', 'times']),
  unit: z.string(),
  target: z.number().nullable(),
  color: z.string(),
  optional: z.boolean().optional(),
  /**
   * Typical pace in minutes per `unit`, on a distance workout. What a scheduled
   * event's length is estimated from, in place of the rough per-icon table.
   */
  paceMinutes: z.number().positive().nullable().optional(),
  /**
   * Typical session length in minutes, on a `times` workout — there is no value
   * to derive one from, so this is the whole estimate.
   */
  typicalDurationMinutes: z.number().int().positive().nullable().optional(),
  workoutTypes: z.array(z.string()).optional(),
  links: z.array(HelpfulLinkSchema).optional()
});
export type Activity = z.infer<typeof ActivitySchema>;

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
  updatedAt: z.string().optional()
});
export type ScheduledEvent = z.infer<typeof ScheduledEventSchema>;

export const HistoryEntrySchema = z.object({
  id: z.string(),
  date: z.string(), // YYYY-MM-DD
  day: z.string(),
  typeId: z.string().nullable(),
  workoutType: z.string().nullable().optional(),
  value: z.number().nullable(),
  notes: z.string().nullable().optional()
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const PlannerStateSchema = z.object({
  activities: z.array(ActivitySchema),
  events: z.array(ScheduledEventSchema),
  notes: z.record(z.string(), z.string()), // `${weekStart}-${day}` -> text
  /**
   * Per-week overrides of an activity's weekly target, keyed `${weekStart}:${activityId}`.
   * An activity's `target` stays the baseline; editing the tally on a week's chip
   * only bends that one week.
   */
  weeklyTargets: z.record(z.string(), z.number()).optional().default({}),
  links: z.array(HelpfulLinkSchema),
  history: z.array(HistoryEntrySchema),
  lastViewedMonday: z.string().nullable(),
  tempUnit: z.enum(['C', 'F']).optional().default('F'),
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
