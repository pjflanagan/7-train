import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGoogleAccessToken } from '@/lib/googleServer';
import { GOOGLE_INTEGRATIONS } from '@/lib/google';
import {
  createEvent,
  deleteEvent,
  ensureWorkoutsCalendar,
  EventDraft,
  GoogleApiError,
  itemPropsFromEvent,
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
  itemId: z.string(),
  typeId: z.string(),
  title: z.string(),
  subType: z.string().nullable().optional(),
  value: z.number(),
  start: z.string(),
  end: z.string(),
  timeZone: z.string(),
  description: z.string().optional(),
});

const PushSchema = z.object({
  calendarId: z.string().nullable().optional(),
  /** Items to create — no event exists for these yet. */
  create: z.array(DraftSchema).default([]),
  /** Items whose event already exists, keyed by the event id to overwrite. */
  update: z.array(DraftSchema.extend({ eventId: z.string() })).default([]),
  /** Events for items that are gone locally. */
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
      const props = itemPropsFromEvent(event);
      // Anything not written by us — or an all-day event someone hand-made —
      // is left alone rather than dragged into the planner.
      if (!props || !event.start?.dateTime || !event.end?.dateTime) continue;
      events.push({
        ...props,
        eventId: event.id,
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

  try {
    const calendarId = await ensureWorkoutsCalendar(accessToken, knownCalendarId);

    // Item id -> event id, so the client can staple the new events to its items.
    const eventIds: Record<string, string> = {};

    for (const draft of create) {
      const event = await createEvent(accessToken, calendarId, draft as EventDraft);
      eventIds[draft.itemId] = event.id;
    }

    for (const { eventId, ...draft } of update) {
      try {
        await updateEvent(accessToken, calendarId, eventId, draft as EventDraft);
        eventIds[draft.itemId] = eventId;
      } catch (error) {
        // The event was deleted in Google while we still had its id; the item
        // is still on the plan, so put it back rather than losing it.
        if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) {
          const recreated = await createEvent(accessToken, calendarId, draft as EventDraft);
          eventIds[draft.itemId] = recreated.id;
        } else {
          throw error;
        }
      }
    }

    for (const eventId of remove) {
      await deleteEvent(accessToken, calendarId, eventId);
    }

    return NextResponse.json({ calendarId, eventIds });
  } catch (error) {
    return errorResponse(error);
  }
}
