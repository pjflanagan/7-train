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

import { z } from 'zod';
import { Activity, ActivitySchema, ActivitySnapshot, ActivitySnapshotSchema } from './types';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/** The calendar we create and own. `calendar.app.created` reaches nothing else. */
export const WORKOUTS_CALENDAR_SUMMARY = 'Workouts';

/**
 * Private extended properties, our own metadata on each event. The `item` in
 * the first key is the pre-v3 word for an event; the key itself is written into
 * every event already in Google, so it stays as it is.
 */
const PROP_EVENT_ID = 'workoutItemId';
const PROP_TYPE_ID = 'workoutTypeId';
const PROP_SUB_TYPE = 'workoutSubType';
const PROP_VALUE = 'workoutValue';
/** The event's own copy of its activity, as JSON. */
const PROP_ACTIVITY = 'workoutActivity';
/** Set when that copy has stopped tracking the week's activity. */
const PROP_ACTIVITY_FROZEN = 'workoutActivityFrozen';
/**
 * The week the event belongs to. Only the browser knows the user's zone, and
 * only the user's settings say which day a week starts on, so the week an event
 * was filed under travels with it rather than being re-derived by whoever reads
 * it next.
 */
const PROP_WEEK_START = 'workoutWeekStart';
/**
 * What kind of record an event is. Absent on workouts, which is what everything
 * written before this existed looks like, so absence means "a workout".
 */
const PROP_RECORD = 'workoutRecord';
const RECORD_TARGETS = 'targets';
/** `workoutTargets0`, `workoutTargets1`, … holding one JSON string between them. */
const PROP_TARGETS_PREFIX = 'workoutTargets';
const PROP_TARGETS_COUNT = 'workoutTargetsCount';

/**
 * Google caps a private property value at 1024 bytes. A snapshot is normally a
 * few hundred, but `workoutTypes` is user-typed and unbounded, so it is the
 * part that gets dropped if the whole thing will not fit. Losing the sub-kinds
 * costs an event nothing it needs to render.
 */
const MAX_PROPERTY_BYTES = 1024;

/**
 * Room to spare inside the 1024-character cap, which truncates silently rather
 * than failing — a chunk that quietly loses its tail would corrupt the JSON it
 * is part of, and the loss would only show up as missing targets much later.
 */
const CHUNK_CHARS = 900;

/**
 * Google allows 300 properties and 32kB per event. A week's targets are a few
 * hundred bytes; anything approaching this is a bug, not a big week.
 */
const MAX_CHUNKS = 30;

/** Splits a JSON string across numbered properties, or null if it will not fit. */
function toChunks(json: string): Record<string, string> | null {
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += CHUNK_CHARS) {
    chunks.push(json.slice(i, i + CHUNK_CHARS));
  }
  if (chunks.length > MAX_CHUNKS) return null;

  const props: Record<string, string> = { [PROP_TARGETS_COUNT]: String(chunks.length) };
  chunks.forEach((chunk, index) => {
    props[`${PROP_TARGETS_PREFIX}${index}`] = chunk;
  });
  return props;
}

/** Reassembles what `toChunks` wrote, or undefined if any part is missing. */
function fromChunks(props: Record<string, string>): string | undefined {
  const count = Number(props[PROP_TARGETS_COUNT]);
  if (!Number.isInteger(count) || count < 1) return undefined;

  let json = '';
  for (let index = 0; index < count; index += 1) {
    const chunk = props[`${PROP_TARGETS_PREFIX}${index}`];
    // A missing chunk means the event was edited or truncated. Half a JSON
    // string is worse than none, so the whole record is treated as unreadable.
    if (chunk === undefined) return undefined;
    json += chunk;
  }
  return json;
}

function serializeSnapshot(snapshot: ActivitySnapshot | undefined): string {
  if (!snapshot) return '';
  const full = JSON.stringify(snapshot);
  if (new TextEncoder().encode(full).length <= MAX_PROPERTY_BYTES) return full;

  const trimmed = JSON.stringify({ ...snapshot, workoutTypes: [] });
  return new TextEncoder().encode(trimmed).length <= MAX_PROPERTY_BYTES ? trimmed : '';
}

/**
 * The snapshot a Google event carries, or undefined when it has none or the
 * value is unreadable. A malformed property is treated as absent rather than
 * fatal: the event still exists, and the reader can fall back to the week.
 */
function parseSnapshot(raw: string | undefined): ActivitySnapshot | undefined {
  if (!raw) return undefined;
  try {
    const parsed = ActivitySnapshotSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

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

interface CalendarResource {
  id: string;
  summary?: string;
}

/**
 * One calendar, or null when it is not there — or not one this app can reach,
 * which under `calendar.app.created` is any calendar it did not make itself.
 *
 * The way back to a calendar whose id we have lost: the user reads the id off
 * Google Calendar and hands it to us, because we are not allowed to search.
 */
export async function getCalendar(
  accessToken: string,
  calendarId: string
): Promise<CalendarResource | null> {
  try {
    return await callGoogle<CalendarResource>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}`
    );
  } catch (error) {
    if (error instanceof GoogleApiError && error.status >= 400 && error.status < 500) {
      return null;
    }
    throw error;
  }
}

/**
 * The id of our `Workouts` calendar, creating it the first time. A caller that
 * already knows the id passes it in, and we only check that it still exists.
 *
 * There is deliberately no "look for a calendar named Workouts" fallback:
 * `calendarList.list` is the only way to search, and it does not accept
 * `calendar.app.created` — reaching it would mean asking for a scope that reads
 * every calendar the user has. So the remembered id is the only thread back to
 * an existing calendar, and losing it (a cleared `localStorage`, a new device)
 * means a second `Workouts` calendar rather than a resumed one. That is the
 * cost of the narrow scope, and the reason the id belongs in a settings store —
 * see `_todo/database.md`.
 */
export async function ensureWorkoutsCalendar(
  accessToken: string,
  knownCalendarId?: string | null
): Promise<string> {
  if (knownCalendarId) {
    try {
      const existing = await callGoogle<CalendarResource>(
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

  const created = await callGoogle<CalendarResource>(accessToken, '/calendars', {
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

/** Everything a route needs to write one scheduled event out to Google. */
export interface EventDraft {
  /** Our own `ScheduledEvent` id, not Google's. */
  eventId: string;
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
  /** The event's own copy of its activity, so a reader needs no local state. */
  activitySnapshot?: ActivitySnapshot;
  /** Whether that copy has stopped tracking the week's activity. */
  activityFrozen?: boolean;
  /** `YYYY-MM-DD` of the week the event is filed under. */
  weekStart: string;
}

/**
 * How far a distance event goes, as it reads in the title — "5 miles".
 *
 * Only distance events say it. A duration event's number is already the length
 * of the block on the calendar, and an instance event is one session, so
 * neither has anything to add that the event does not already show.
 *
 * The unit comes from the event's own copy of its activity, which is what the
 * app writes on every event, so the title says the same words the card does.
 */
function distanceLabel(draft: EventDraft): string | undefined {
  const activity = draft.activitySnapshot;
  if (activity?.metric !== 'distance' || !(draft.value > 0)) return undefined;

  const unit = activity.unit.trim();
  return unit ? `${draft.value} ${unit}` : String(draft.value);
}

function eventSummary(draft: EventDraft): string {
  const named = draft.subType ? `${draft.title}: ${draft.subType}` : draft.title;
  const distance = distanceLabel(draft);
  return distance ? `${named} — ${distance}` : named;
}

function eventBody(draft: EventDraft) {
  return {
    summary: eventSummary(draft),
    description: draft.description,
    start: { dateTime: draft.start, timeZone: draft.timeZone },
    end: { dateTime: draft.end, timeZone: draft.timeZone },
    extendedProperties: {
      private: {
        [PROP_EVENT_ID]: draft.eventId,
        [PROP_TYPE_ID]: draft.typeId,
        [PROP_SUB_TYPE]: draft.subType ?? '',
        [PROP_VALUE]: String(draft.value),
        [PROP_ACTIVITY]: serializeSnapshot(draft.activitySnapshot),
        [PROP_ACTIVITY_FROZEN]: draft.activityFrozen ? '1' : '',
        [PROP_WEEK_START]: draft.weekStart,
      },
    },
  };
}

/** What a route needs to write one week's targets out to Google. */
export interface TargetsDraft {
  /** `YYYY-MM-DD` of the week these targets belong to. */
  weekStart: string;
  /** The day after `weekStart`, so the all-day event covers exactly one day. */
  endDate: string;
  /** The week's own copies of the activities it is aiming at. */
  activities: Activity[];
}

/**
 * A week's targets, as an all-day event on the day the week starts.
 *
 * Targets are week-shaped, so they are stored on a week-shaped thing. It is
 * marked free rather than busy: it is a note about the week, not time spent.
 */
function targetsEventBody(draft: TargetsDraft) {
  const chunks = toChunks(JSON.stringify(draft.activities));
  if (!chunks) return null;

  return {
    summary: 'Weekly targets',
    description: 'What this week aims at in 7 Train. Edited in the app.',
    start: { date: draft.weekStart },
    end: { date: draft.endDate },
    transparency: 'transparent',
    extendedProperties: {
      private: {
        [PROP_RECORD]: RECORD_TARGETS,
        [PROP_WEEK_START]: draft.weekStart,
        ...chunks,
      },
    },
  };
}

export async function createTargetsEvent(
  accessToken: string,
  calendarId: string,
  draft: TargetsDraft
): Promise<GoogleEvent | null> {
  const body = targetsEventBody(draft);
  if (!body) return null;
  return callGoogle<GoogleEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function updateTargetsEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string,
  draft: TargetsDraft
): Promise<GoogleEvent | null> {
  const body = targetsEventBody(draft);
  if (!body) return null;
  return callGoogle<GoogleEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    { method: 'PUT', body: JSON.stringify(body) }
  );
}

/**
 * The targets a Google event carries, or null when it is not a targets record.
 *
 * Anything unreadable — a chunk gone, JSON that no longer parses, an activity
 * that fails its schema — comes back null. A week then simply has no targets
 * stored, which is a state the app already handles.
 */
export function targetsFromEvent(event: GoogleEvent): {
  weekStart: string;
  activities: Activity[];
} | null {
  const props = event.extendedProperties?.private;
  if (props?.[PROP_RECORD] !== RECORD_TARGETS) return null;

  const weekStart = props[PROP_WEEK_START];
  const json = fromChunks(props);
  if (!weekStart || !json) return null;

  try {
    const parsed = z.array(ActivitySchema).safeParse(JSON.parse(json));
    if (!parsed.success) return null;
    return { weekStart, activities: parsed.data };
  } catch {
    return null;
  }
}

/** True when a Google event is one of our records rather than a workout. */
export function isTargetsEvent(event: GoogleEvent): boolean {
  return event.extendedProperties?.private?.[PROP_RECORD] === RECORD_TARGETS;
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
  googleEventId: string,
  draft: EventDraft
): Promise<GoogleEvent> {
  return callGoogle<GoogleEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    { method: 'PUT', body: JSON.stringify(eventBody(draft)) }
  );
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string
): Promise<void> {
  try {
    await callGoogle<void>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
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

/** The event metadata a Google event carries, or null when it is not ours. */
export function eventPropsFromEvent(event: GoogleEvent): {
  eventId: string;
  typeId: string;
  workoutType: string | null;
  value: number;
  activitySnapshot?: ActivitySnapshot;
  activityFrozen?: boolean;
  weekStart?: string;
} | null {
  const props = event.extendedProperties?.private;
  if (!props?.[PROP_TYPE_ID]) return null;

  return {
    eventId: props[PROP_EVENT_ID] || event.id,
    typeId: props[PROP_TYPE_ID],
    workoutType: props[PROP_SUB_TYPE] || null,
    value: Number(props[PROP_VALUE]) || 0,
    activitySnapshot: parseSnapshot(props[PROP_ACTIVITY]),
    activityFrozen: props[PROP_ACTIVITY_FROZEN] === '1',
    weekStart: props[PROP_WEEK_START] || undefined,
  };
}

/**
 * The shape the client turns back into a `ScheduledEvent`.
 *
 * `start` stays an RFC 3339 instant rather than a date and a time: only the
 * browser knows the user's zone, so it is the browser that decides which local
 * day a 7am workout falls on.
 */
/** One week's targets as pulled back from the calendar. */
export interface PulledTargets {
  googleEventId: string;
  weekStart: string;
  activities: Activity[];
}

export interface PulledEvent {
  /** Google's id for the event. */
  googleEventId: string;
  /** Our own `ScheduledEvent` id, as we wrote it into the event. */
  eventId: string;
  typeId: string;
  workoutType: string | null;
  value: number;
  start: string;
  end: string;
  /** Google's own last-modified stamp for the event, ISO. */
  updated?: string;
  /** The event's own copy of its activity, when it was written with one. */
  activitySnapshot?: ActivitySnapshot;
  activityFrozen?: boolean;
  /** The week the event was filed under, when it was written with one. */
  weekStart?: string;
}
