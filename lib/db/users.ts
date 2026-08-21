/**
 * Reading and writing a user's settings and activities. Server only.
 *
 * Every function here takes an already-authenticated identity — nothing in this
 * file decides who the caller is, and nothing in it accepts a `userId` from the
 * browser. The route resolves the session to a Google `sub` and this turns that
 * into a row.
 */

import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from './client';
import { accounts, activities as activitiesTable, users } from './schema';
import { ActivitySchema, Activity } from '@/lib/types';
import { UserSettings, UserState } from '@/lib/userSettings';

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** The user for a Google identity, made on first sight. */
export async function getOrCreateUser(identity: {
  googleSub: string;
  email?: string | null;
  name?: string | null;
}): Promise<{ id: string; isNew: boolean }> {
  const db = getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.googleSub, identity.googleSub))
    .limit(1);

  if (existing) return { id: existing.id, isNew: false };

  const id = newId('user');
  // Two tabs signing in at once both miss the select above, so the insert has
  // to tolerate losing that race rather than 500ing at one of them.
  const [inserted] = await db
    .insert(users)
    .values({
      id,
      googleSub: identity.googleSub,
      email: identity.email ?? null,
      name: identity.name ?? null,
    })
    .onConflictDoNothing({ target: users.googleSub })
    .returning({ id: users.id });

  if (inserted) {
    await linkAccount(inserted.id, 'google', identity.googleSub, identity.name ?? null);
    return { id: inserted.id, isNew: true };
  }

  const [raced] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.googleSub, identity.googleSub))
    .limit(1);
  if (!raced) throw new Error('User vanished between insert and read');
  return { id: raced.id, isNew: false };
}

/** Record that an account at another service belongs to this user. */
export async function linkAccount(
  userId: string,
  provider: string,
  externalId: string,
  displayName: string | null
): Promise<void> {
  await getDb()
    .insert(accounts)
    .values({ id: newId('account'), userId, provider, externalId, displayName })
    // Already linked. Re-linking is not an error, and the display name is not
    // worth a write of its own.
    .onConflictDoNothing({ target: [accounts.provider, accounts.externalId] });
}

function settingsFromRow(row: typeof users.$inferSelect): UserSettings {
  return {
    googleCalendarId: row.googleCalendarId,
    googleAdoptedAt: row.googleAdoptedAt?.toISOString() ?? null,
    googleSheetId: row.googleSheetId,
    weekStartsOn: row.weekStartsOn,
    tempUnit: row.tempUnit === 'C' ? 'C' : 'F',
    use24HourClock: row.use24HourClock,
    defaultStartMinutes: row.defaultStartMinutes,
  };
}

/**
 * Everything the browser needs on load.
 *
 * `isNew` covers both "no row until a moment ago" and "a row with nothing in
 * it": an account that signed in once and never got as far as syncing is, for
 * the purpose of deciding which side wins, still empty.
 */
export async function readUserState(
  userId: string,
  wasCreated: boolean
): Promise<UserState> {
  const db = getDb();

  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new Error('User not found');

  const rows = await db
    .select()
    .from(activitiesTable)
    .where(and(eq(activitiesTable.userId, userId), isNull(activitiesTable.deletedAt)))
    .orderBy(asc(activitiesTable.sortOrder));

  // A row whose blob no longer parses is skipped rather than failing the whole
  // load: one bad activity should not cost someone their settings.
  const parsed: Activity[] = [];
  for (const activity of rows) {
    const result = ActivitySchema.safeParse(activity.data);
    if (result.success) parsed.push(result.data);
  }

  return {
    settings: settingsFromRow(row),
    activities: parsed,
    revision: row.revision,
    isNew: wasCreated || parsed.length === 0,
  };
}

/**
 * The `Workouts` calendar this user's plan lives in, or null if they have none.
 *
 * Narrow on purpose. `readUserState` answers the same question, but making a
 * calendar is not a settings load — the create route wants one string and
 * should not pay for, or be able to disturb, the rest of the row.
 */
export async function readCalendarId(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ googleCalendarId: users.googleCalendarId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row?.googleCalendarId ?? null;
}

/**
 * Remember a freshly made calendar, immediately.
 *
 * The browser will push this in its own time — `useUserSync` debounces settings
 * by a couple of seconds — and that window is long enough for a second tab to
 * ask for a calendar, be told the row still has none, and make another one. So
 * the route that made it writes it down before answering, and the debounced
 * push that follows is a harmless repeat of the same string.
 *
 * Only ever fills a blank, and reports whichever id ended up in the row. Two
 * tabs that both got past the read and both made a calendar cannot un-make
 * them, but they can still be told to use the same one: the loser returns the
 * winner's id rather than its own, so the plan lives in one calendar and the
 * stray is left empty instead of holding half of it.
 */
export async function writeCalendarId(userId: string, calendarId: string): Promise<string> {
  const [won] = await getDb()
    .update(users)
    .set({
      googleCalendarId: calendarId,
      revision: sql`${users.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), isNull(users.googleCalendarId)))
    .returning({ googleCalendarId: users.googleCalendarId });

  if (won?.googleCalendarId) return won.googleCalendarId;

  // Somebody wrote one between our read and our write. Theirs is the answer.
  return (await readCalendarId(userId)) ?? calendarId;
}

/** Write the settings half. Bumps the revision, and reports the new one. */
export async function writeSettings(
  userId: string,
  settings: UserSettings
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .update(users)
    .set({
      googleCalendarId: settings.googleCalendarId,
      googleAdoptedAt: settings.googleAdoptedAt ? new Date(settings.googleAdoptedAt) : null,
      googleSheetId: settings.googleSheetId,
      weekStartsOn: settings.weekStartsOn,
      tempUnit: settings.tempUnit,
      use24HourClock: settings.use24HourClock,
      defaultStartMinutes: settings.defaultStartMinutes,
      revision: sql`${users.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ revision: users.revision });

  return row?.revision ?? 0;
}

/**
 * Replace the activity list with what the browser is holding.
 *
 * A whole-list write rather than a diff, because that is what the client
 * actually knows: "My activities" is edited as a list, reordered as a list, and
 * is a handful of rows. Anything missing from the list is tombstoned rather
 * than deleted, so the removal reaches a device that has not heard about it.
 */
export async function writeActivities(
  userId: string,
  activities: Activity[]
): Promise<void> {
  const db = getDb();
  const now = new Date();

  for (const [index, activity] of activities.entries()) {
    await db
      .insert(activitiesTable)
      .values({
        id: activity.id,
        userId,
        data: activity,
        sortOrder: index,
        updatedAt: now,
        deletedAt: null,
      })
      .onConflictDoUpdate({
        target: activitiesTable.id,
        set: {
          data: activity,
          sortOrder: index,
          updatedAt: now,
          // An activity that comes back after being deleted is undeleted, which
          // is what re-adding one by the same id means.
          deletedAt: null,
          revision: sql`${activitiesTable.revision} + 1`,
        },
      });
  }

  const keep = new Set(activities.map((activity) => activity.id));
  const existing = await db
    .select({ id: activitiesTable.id })
    .from(activitiesTable)
    .where(and(eq(activitiesTable.userId, userId), isNull(activitiesTable.deletedAt)));

  for (const row of existing) {
    if (keep.has(row.id)) continue;
    await db
      .update(activitiesTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(activitiesTable.id, row.id));
  }
}
