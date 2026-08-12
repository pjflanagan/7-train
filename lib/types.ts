import { z } from 'zod';
import { ACTIVITY_ICONS, IconKey } from './icons';

export const HelpfulLinkSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string()
});
export type HelpfulLink = z.infer<typeof HelpfulLinkSchema>;

export const WorkoutTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.custom<IconKey>((val) => typeof val === 'string' && val in ACTIVITY_ICONS),
  metric: z.enum(['distance', 'duration', 'times']),
  unit: z.string(),
  target: z.number().nullable(),
  color: z.string(),
  optional: z.boolean().optional(),
  workoutTypes: z.array(z.string()).optional(),
  links: z.array(HelpfulLinkSchema).optional()
});
export type WorkoutType = z.infer<typeof WorkoutTypeSchema>;

export const CalendarItemSchema = z.object({
  id: z.string(),
  typeId: z.string(),
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  week: z.union([z.literal(1), z.literal(2)]).optional().default(1),
  value: z.number(),
  workoutType: z.string().nullable().optional()
});
export type CalendarItem = z.infer<typeof CalendarItemSchema>;

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
  goals: z.array(WorkoutTypeSchema),
  items: z.array(CalendarItemSchema),
  notes: z.record(z.string(), z.string()), // `${day}-${week}` -> text
  links: z.array(HelpfulLinkSchema),
  history: z.array(HistoryEntrySchema),
  lastViewedMonday: z.string().nullable()
});
export type PlannerState = z.infer<typeof PlannerStateSchema>;
