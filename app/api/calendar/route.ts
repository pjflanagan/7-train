import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGoogleAccessToken } from '@/lib/googleServer';
import { GOOGLE_INTEGRATIONS } from '@/lib/google';
import { ActivitySchema, ActivitySnapshotSchema } from '@/lib/types';
import {
  createEvent,
  createTargetsEvent,
  deleteEvent,
  getCalendar,
  EventDraft,
  GoogleApiError,
  eventPropsFromEvent,
  isTargetsEvent,
  listEvents,
  PulledEvent,
  PulledTargets,
  targetsFromEvent,
  TargetsDraft,
  updateEvent,
  updateTargetsEvent,
} from '@/lib/googleCalendar';

/**
 * The `Workouts` calendar, read and written on the user's behalf.
 *
 * `GET` pulls a window of events so the app can adopt whatever Google holds —
 * including a workout someone dragged to another day inside Google Calendar.
 * `POST` pushes a batch of local changes back.
 *
 * Both **require** a calendar id, and neither will make one. Creating a
 * calendar is a decision the user makes once, through
 * `POST /api/calendar/create`; a sync that quietly created one whenever the id
 * was missing is how a new browser ended up with its own duplicate calendar
 * full of seeded sample data.
 */

/** The id names no calendar we can reach, so the app must ask the user again. */
const NO_CALENDAR = { error: 'That calendar is not there any more', code: 'no-calendar' };

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
  /** Set once a Strava recording has been matched to this workout. */
  stravaActivityId: z.number().nullable().optional(),
});

const TargetsSchema = z.object({
  weekStart: z.string(),
  endDate: z.string(),
  activities: z.array(ActivitySchema),
  /** Present when this week's targets already have an event to overwrite. */
  googleEventId: z.string().optional(),
});

const PushSchema = z.object({
  calendarId: z.string().nullable().optional(),
  /** Events with nothing in Google yet. */
  create: z.array(DraftSchema).default([]),
  /** Events that already have a Google event, named by `googleEventId`. */
  update: z.array(DraftSchema.extend({ googleEventId: z.string() })).default([]),
  /** Google event ids whose event is gone locally. */
  remove: z.array(z.string()).default([]),
  /** Weeks whose targets need writing, created or overwritten as they say. */
  targets: z.array(TargetsSchema).default([]),
  /** Google event ids of targets records for weeks that aim at nothing now. */
  removeTargets: z.array(z.string()).default([]),
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
  const calendarId = searchParams.get('calendarId');
  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }
  if (!calendarId) {
    return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
  }

  try {
    // The existence check already hands back the calendar itself, so its name
    // is free — no second round trip to tell the user what their calendar is
    // called, and a rename in Google Calendar reaches us on the next pull.
    const calendar = await getCalendar(accessToken, calendarId);
    if (!calendar) {
      return NextResponse.json(NO_CALENDAR, { status: 404 });
    }
    const raw = await listEvents(accessToken, calendarId, timeMin, timeMax);

    const events: PulledEvent[] = [];
    const targets: PulledTargets[] = [];

    for (const event of raw) {
      // A week's targets are an all-day record, not a workout, so they are read
      // first and never fall through into the schedule.
      if (isTargetsEvent(event)) {
        const record = targetsFromEvent(event);
        if (record) targets.push({ ...record, googleEventId: event.id });
        continue;
      }

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

    return NextResponse.json({
      calendarId,
      calendarName: calendar.summary ?? null,
      events,
      targets,
    });
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
  const {
    calendarId: knownCalendarId,
    create,
    update,
    remove,
    targets,
    removeTargets,
  } = parsed.data;

  if (!knownCalendarId) {
    return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
  }

  try {
    const calendarId = knownCalendarId;
    if (!(await getCalendar(accessToken, calendarId))) {
      return NextResponse.json(NO_CALENDAR, { status: 404 });
    }

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

    // Week start -> the event holding that week's targets.
    const targetEventIds: Record<string, string> = {};

    for (const { googleEventId, ...draft } of targets) {
      let written = null;
      if (googleEventId) {
        try {
          written = await updateTargetsEvent(
            accessToken,
            calendarId,
            googleEventId,
            draft as TargetsDraft
          );
        } catch (error) {
          // Deleted in Google — inside the app, or by someone tidying their
          // calendar. The week still aims at something, so it is written again.
          if (!(error instanceof GoogleApiError) || (error.status !== 404 && error.status !== 410)) {
            throw error;
          }
        }
      }
      written ??= await createTargetsEvent(accessToken, calendarId, draft as TargetsDraft);
      // `null` means the week's targets would not fit in one event, which no
      // real week does. Skip it rather than failing the whole sync.
      if (written) targetEventIds[draft.weekStart] = written.id;
    }

    for (const googleEventId of removeTargets) {
      await deleteEvent(accessToken, calendarId, googleEventId);
    }

    return NextResponse.json({ calendarId, eventIds, targetEventIds });
  } catch (error) {
    return errorResponse(error);
  }
}
