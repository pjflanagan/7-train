import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isDatabaseConfigured } from '@/lib/db/client';
import { getOrCreateUser, readUserState, writeActivities, writeSettings } from '@/lib/db/users';
import { readSessionIdentity } from '@/lib/sessionServer';
import { UserSettingsSchema } from '@/lib/userSettings';
import { ActivitySchema } from '@/lib/types';

/**
 * A user's settings and activities.
 *
 * `GET` is the whole of what a browser needs on load; `PUT` writes back
 * whichever half changed. Events are not here and never will be — Google
 * Calendar is the store for those.
 *
 * Both answer 501 when there is no database configured, which is a supported
 * deployment: the app is local-first, and without `DATABASE_URL` it behaves
 * exactly as it did before any of this existed.
 */

/** Not an error the user should see — the client falls back to local storage. */
const NOT_CONFIGURED = NextResponse.json(
  { error: 'No database is configured', code: 'no-database' },
  { status: 501 }
);

const PushSchema = z.object({
  /** Omitted when only the activities changed. */
  settings: UserSettingsSchema.optional(),
  /** The whole list, in the user's own order. Omitted when only settings changed. */
  activities: z.array(ActivitySchema).optional(),
});

export async function GET(request: Request) {
  if (!isDatabaseConfigured) return NOT_CONFIGURED;

  const identity = await readSessionIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const { id, isNew } = await getOrCreateUser(identity);
    return NextResponse.json(await readUserState(id, isNew));
  } catch (error) {
    console.error('Reading user settings failed', error);
    return NextResponse.json({ error: 'Could not read your settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isDatabaseConfigured) return NOT_CONFIGURED;

  const identity = await readSessionIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const parsed = PushSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Malformed settings' }, { status: 400 });
  }

  try {
    const { id } = await getOrCreateUser(identity);
    // Activities first: if the two writes straddle a failure, an extra
    // activity is a far kinder state to be in than settings that point at a
    // calendar full of workouts for activities that never arrived.
    if (parsed.data.activities) await writeActivities(id, parsed.data.activities);

    const revision = parsed.data.settings
      ? await writeSettings(id, parsed.data.settings)
      : undefined;

    return NextResponse.json({ revision });
  } catch (error) {
    console.error('Writing user settings failed', error);
    return NextResponse.json({ error: 'Could not save your settings' }, { status: 500 });
  }
}
