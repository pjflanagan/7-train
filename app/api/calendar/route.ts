import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGoogleAccessToken } from '@/lib/googleServer';
import { GOOGLE_INTEGRATIONS } from '@/lib/google';
import { ActivitySnapshotSchema } from '@/lib/types';
import {
  createEvent,
  deleteEvent,
  ensureWorkoutsCalendar,
  EventDraft,
  GoogleApiError,
  eventPropsFromEvent,
  listEvents,
  PulledEvent,
  updateEvent,
} from '@/lib/googleCalendar';

/**
 * The `Workouts` calendar, read and written on the user's behalf.
 *
 * `GET` pulls a window of events so the app can adopt whatever Google holds —
 * including a workout someone dragged to another day inside Google Calendar.
 * `POST` pushes a batch of local changes back. Both take the calendar id the
 * client remembers and hand back the one actually used, which is how a first
 * sync learns the id of the calendar we just created.
 */

const CALENDAR_SCOPES = GOOGLE_INTEGRATIONS.calendar.scopes;

const DraftSchema = z.object({
  /** Our own `ScheduledEvent` id. Google's id, where there is one, is separate. */
  eventId: z.string(),
  typeId: z.string(),
  title: z.string(),
  subType: z.string().nullable().optional(),
  value: z.number(),
  start: z.string(),
  end: z.string(),
  timeZone: z.string(),
  description: z.string().optional(),
  /** Written into the event so a reader needs nothing local to draw it. */
  activitySnapshot: ActivitySnapshotSchema.optional(),
  activityFrozen: z.boolean().optional(),
  weekStart: z.string(),
});

const PushSchema = z.object({
  calendarId: z.string().nullable().optional(),
  /** Events with nothing in Google yet. */
  create: z.array(DraftSchema).default([]),
  /** Events that already have a Google event, named by `googleEventId`. */
  update: z.array(DraftSchema.extend({ googleEventId: z.string() })).default([]),
  /** Google event ids whose event is gone locally. */
  remove: z.array(z.string()).default([]),
});

function errorResponse(error: unknown) {
  if (error instanceof GoogleApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('Calendar sync failed', error);
  return NextResponse.json({ error: 'Calendar sync failed' }, { status: 500 });
}

export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken(request, CALENDAR_SCOPES);
  if (!accessToken) {
    return NextResponse.json({ error: 'Calendar is not connected' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get('from');
  const timeMax = searchParams.get('to');
  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }

  try {
    const calendarId = await ensureWorkoutsCalendar(
      accessToken,
      searchParams.get('calendarId')
    );
    const raw = await listEvents(accessToken, calendarId, timeMin, timeMax);

    const events: PulledEvent[] = [];
    for (const event of raw) {
      const props = eventPropsFromEvent(event);
      // Anything not written by us — or an all-day event someone hand-made —
      // is left alone rather than dragged into the planner.
      if (!props || !event.start?.dateTime || !event.end?.dateTime) continue;
      events.push({
        ...props,
        googleEventId: event.id,
        start: event.start.dateTime,
        end: event.end.dateTime,
        updated: event.updated,
      });
    }

    return NextResponse.json({ calendarId, events });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const accessToken = await getGoogleAccessToken(request, CALENDAR_SCOPES);
  if (!accessToken) {
    return NextResponse.json({ error: 'Calendar is not connected' }, { status: 403 });
  }

  const parsed = PushSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Malformed sync request' }, { status: 400 });
  }
  const { calendarId: knownCalendarId, create, update, remove } = parsed.data;

  // Deletions alone, against a calendar we have lost the id of, would make a
  // fresh calendar purely to delete events that were never in it. Nothing to
  // write means nothing to create.
  if (!knownCalendarId && create.length === 0 && update.length === 0) {
    return NextResponse.json({ calendarId: null, eventIds: {} });
  }

  try {
    const calendarId = await ensureWorkoutsCalendar(accessToken, knownCalendarId);

    // Our event id -> Google's, so the client can staple the two together.
    const eventIds: Record<string, string> = {};

    for (const draft of create) {
      const event = await createEvent(accessToken, calendarId, draft as EventDraft);
      eventIds[draft.eventId] = event.id;
    }

    for (const { googleEventId, ...draft } of update) {
      try {
        await updateEvent(accessToken, calendarId, googleEventId, draft as EventDraft);
        eventIds[draft.eventId] = googleEventId;
      } catch (error) {
        // The Google event was deleted while we still had its id; the workout
        // is still on the plan, so put it back rather than losing it.
        if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) {
          const recreated = await createEvent(accessToken, calendarId, draft as EventDraft);
          eventIds[draft.eventId] = recreated.id;
        } else {
          throw error;
        }
      }
    }

    for (const googleEventId of remove) {
      await deleteEvent(accessToken, calendarId, googleEventId);
    }

    return NextResponse.json({ calendarId, eventIds });
  } catch (error) {
    return errorResponse(error);
  }
}
