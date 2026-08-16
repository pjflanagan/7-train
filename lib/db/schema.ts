/**
 * The settings store.
 *
 * What is deliberately **not** here: events. Google Calendar is the durable
 * store for the schedule — an event carries its own week and its own copy of
 * its activity, so it needs nothing from a database to render. See
 * `_todo/google-calendar-as-storage.md` for that division of labour, and
 * `_todo/database.md` for the phases this is the first of.
 *
 * What is here is everything a calendar event has nowhere to put: who the user
 * is, which accounts are theirs, what their preferences are, and the activities
 * a week is built from.
 *
 * The sharpest reason this exists is one string. `googleCalendarId` is the only
 * way back to a user's `Workouts` calendar — there is no lookup, because
 * searching calendars needs a scope the app refuses to ask for — so every
 * browser that did not have it made a *second* calendar. Held against the
 * user's Google `sub` instead of against a browser, a new device resumes the
 * same calendar.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Activity } from '@/lib/types';

/**
 * A person, and their settings.
 *
 * Settings are columns rather than a blob because they are queried and
 * defaulted individually, and there are few enough that a migration per new
 * one is honest work. Activities go the other way — see below.
 */
export const users = pgTable(
  'users',
  {
    /** Ours, not Google's. Client code never sees it. */
    id: text('id').primaryKey(),
    /**
     * Google's subject claim: stable for the life of the account, and the only
     * identifier that survives a user changing their email address.
     */
    googleSub: text('google_sub').notNull(),
    email: text('email'),
    name: text('name'),

    /** The `Workouts` calendar this user's plan lives in. The reason for all this. */
    googleCalendarId: text('google_calendar_id'),
    /** Set once the whole plan has been handed over to Google Calendar. */
    googleAdoptedAt: timestamp('google_adopted_at', { withTimezone: true }),
    /** The spreadsheet history is exported to, so repeat exports overwrite it. */
    googleSheetId: text('google_sheet_id'),

    /** 0 = Sunday … 6 = Saturday. */
    weekStartsOn: integer('week_starts_on').notNull().default(1),
    tempUnit: text('temp_unit').notNull().default('F'),
    use24HourClock: boolean('use_24_hour_clock').notNull().default(false),
    defaultStartMinutes: integer('default_start_minutes').notNull().default(7 * 60),

    /**
     * Server-incremented, monotonic. What makes an incremental pull possible
     * later, and what a write checks to notice it was based on a stale read.
     */
    revision: integer('revision').notNull().default(1),
    /** Last edit to the settings themselves, not to bookkeeping. */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_google_sub_idx').on(table.googleSub)]
);

/**
 * Accounts at other services that are this user's.
 *
 * Its own table rather than columns on `users` because the set grows — Google,
 * Strava, Garmin next — and because "is this Strava athlete already somebody's"
 * is a question worth being able to ask.
 *
 * Note what is **not** stored: tokens. Strava's still live in an encrypted
 * cookie (`lib/stravaServer.ts`), which keeps refresh tokens out of the
 * database entirely. Moving them here is what would let a pull run on a
 * schedule with no browser open, and is a deliberately separate decision — see
 * the open questions in `_todo/database.md`.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** `google`, `strava`, later `garmin`. */
    provider: text('provider').notNull(),
    /** That service's own id for the account — a Google `sub`, a Strava athlete id. */
    externalId: text('external_id').notNull(),
    /** Whatever the service calls them, for showing "connected as …". */
    displayName: text('display_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('accounts_provider_external_idx').on(table.provider, table.externalId),
    index('accounts_user_idx').on(table.userId),
  ]
);

/**
 * "My activities" — the template a week is built from.
 *
 * The activity itself is a `jsonb` blob validated by `ActivitySchema` on the
 * way in and out, rather than a column per field. `lib/types.ts` is the wire
 * contract and it moves: `stravaSportTypes` was added to it this week, and
 * paces, workout types and links before that. A column per field would mean a
 * database migration every time the shape changed, for data only ever read and
 * written whole.
 *
 * What is *not* in the blob is what the database needs to sort and reconcile
 * by — order, revision, tombstone.
 */
export const activities = pgTable(
  'activities',
  {
    /** Client-generated, so an activity made offline keeps its identity. */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /**
     * Reserved for training two things at once — a half marathon and a tri,
     * each with their own activities and their own calendar. Nullable and
     * unused for now: adding the column costs nothing today and retrofitting
     * one onto a populated table costs a great deal.
     */
    planId: text('plan_id'),
    /** An `Activity`, exactly as `ActivitySchema` describes it. */
    data: jsonb('data').$type<Activity>().notNull(),
    /** The user's own ordering, which is meaningful — the rail is drawn in it. */
    sortOrder: integer('sort_order').notNull().default(0),

    revision: integer('revision').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * A tombstone. A deleted activity is kept as a row so the delete reaches a
     * device that has not heard about it — otherwise that device pushes the
     * activity straight back up.
     */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('activities_user_idx').on(table.userId)]
);

export type UserRow = typeof users.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
