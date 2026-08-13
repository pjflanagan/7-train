/**
 * The `Workouts` calendar and the events in it.
 *
 * Server only — every function here takes an access token obtained through
 * `getGoogleAccessToken`. The calendar is the source of truth for events: an
 * item edited in Google Calendar comes back to us on the next pull, which is
 * why the event carries the item's identity in its private properties.
 *
 * Activities stay local. An event only names the activity it belongs to, so a schedule
 * pulled back in can reattach itself to whatever activities this device holds.
 */

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/** The calendar we create and own. `calendar.app.created` reaches nothing else. */
export const WORKOUTS_CALENDAR_SUMMARY = 'Workouts';

/** Private extended properties, our own metadata on each event. */
const PROP_ITEM_ID = 'workoutItemId';
const PROP_TYPE_ID = 'workoutTypeId';
const PROP_SUB_TYPE = 'workoutSubType';
const PROP_VALUE = 'workoutValue';

export class GoogleApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

async function callGoogle<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? `Google returned ${response.status}`;
    throw new GoogleApiError(message, response.status);
  }
  return body as T;
}

interface CalendarListEntry {
  id: string;
  summary?: string;
  deleted?: boolean;
}

/**
 * The id of our `Workouts` calendar, creating it the first time. A caller that
 * already knows the id passes it in, and we only check that it still exists.
 */
export async function ensureWorkoutsCalendar(
  accessToken: string,
  knownCalendarId?: string | null
): Promise<string> {
  if (knownCalendarId) {
    try {
      const existing = await callGoogle<CalendarListEntry>(
        accessToken,
        `/calendars/${encodeURIComponent(knownCalendarId)}`
      );
      if (existing?.id) return existing.id;
    } catch (error) {
      // Deleted in Google, or belonging to another account — fall through and
      // make a fresh one rather than failing the whole sync.
      if (!(error instanceof GoogleApiError) || error.status < 400 || error.status >= 500) {
        throw error;
      }
    }
  }

  const list = await callGoogle<{ items?: CalendarListEntry[] }>(
    accessToken,
    '/users/me/calendarList?minAccessRole=owner&showDeleted=false'
  );
  const found = list.items?.find(
    (entry) => !entry.deleted && entry.summary === WORKOUTS_CALENDAR_SUMMARY
  );
  if (found) return found.id;

  const created = await callGoogle<CalendarListEntry>(accessToken, '/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: WORKOUTS_CALENDAR_SUMMARY,
      description: 'Workouts planned in 7 Train.',
    }),
  });
  return created.id;
}

export interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  status?: string;
  /** ISO stamp of Google's last write to the event. */
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
}

/** Everything a route needs to write one item out as an event. */
export interface EventDraft {
  itemId: string;
  typeId: string;
  /** Activity name, so the event reads well inside Google Calendar. */
  title: string;
  subType?: string | null;
  value: number;
  /** Local wall-clock start, `YYYY-MM-DDTHH:mm:ss`, paired with `timeZone`. */
  start: string;
  end: string;
  timeZone: string;
  description?: string;
}

function eventBody(draft: EventDraft) {
  return {
    summary: draft.subType ? `${draft.title}: ${draft.subType}` : draft.title,
    description: draft.description,
    start: { dateTime: draft.start, timeZone: draft.timeZone },
    end: { dateTime: draft.end, timeZone: draft.timeZone },
    extendedProperties: {
      private: {
        [PROP_ITEM_ID]: draft.itemId,
        [PROP_TYPE_ID]: draft.typeId,
        [PROP_SUB_TYPE]: draft.subType ?? '',
        [PROP_VALUE]: String(draft.value),
      },
    },
  };
}

export async function createEvent(
  accessToken: string,
  calendarId: string,
  draft: EventDraft
): Promise<GoogleEvent> {
  return callGoogle<GoogleEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(eventBody(draft)) }
  );
}

export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  draft: EventDraft
): Promise<GoogleEvent> {
  return callGoogle<GoogleEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PUT', body: JSON.stringify(eventBody(draft)) }
  );
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  try {
    await callGoogle<void>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' }
    );
  } catch (error) {
    // Already gone from Google is the state we wanted anyway.
    if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) return;
    throw error;
  }
}

/** Every event between two instants, following pagination to the end. */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      maxResults: '2500',
      orderBy: 'startTime',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const page = await callGoogle<{ items?: GoogleEvent[]; nextPageToken?: string }>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    );
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return events.filter((event) => event.status !== 'cancelled');
}

/** The item metadata an event carries, or null when it is not one of ours. */
export function itemPropsFromEvent(event: GoogleEvent): {
  itemId: string;
  typeId: string;
  workoutType: string | null;
  value: number;
} | null {
  const props = event.extendedProperties?.private;
  if (!props?.[PROP_TYPE_ID]) return null;

  return {
    itemId: props[PROP_ITEM_ID] || event.id,
    typeId: props[PROP_TYPE_ID],
    workoutType: props[PROP_SUB_TYPE] || null,
    value: Number(props[PROP_VALUE]) || 0,
  };
}

/**
 * The shape the client turns back into a `ScheduledEvent`.
 *
 * `start` stays an RFC 3339 instant rather than a date and a time: only the
 * browser knows the user's zone, so it is the browser that decides which local
 * day a 7am workout falls on.
 */
export interface PulledEvent {
  eventId: string;
  itemId: string;
  typeId: string;
  workoutType: string | null;
  value: number;
  start: string;
  end: string;
  /** Google's own last-modified stamp for the event, ISO. */
  updated?: string;
}
