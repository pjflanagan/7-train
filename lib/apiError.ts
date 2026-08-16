import { NextResponse } from 'next/server';

/**
 * The reply when a route handler's call to a third party fails.
 *
 * Five routes had grown the same ladder — check for the API's own error class,
 * pass its message and status through, otherwise log and answer 500 — with the
 * fallback wording drifting apart between them.
 *
 * These strings stay here rather than in `lib/copy.ts`. They are diagnostics
 * read by the code that handles the response, not text anyone is meant to see
 * in place of a button label, and separating them from the branch that raises
 * them makes both harder to follow.
 */

/** An error carrying its own HTTP status, as the Google and Strava wrappers do. */
interface StatusError {
  message: string;
  status: number;
}

function hasStatus(error: unknown): error is StatusError {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

/**
 * `context` is logged, never sent — it says which of our routes failed, which
 * is our business. `fallback` is what the browser is told when the failure is
 * not one the upstream API explained.
 */
export function apiError(error: unknown, context: string, fallback: string) {
  if (hasStatus(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(context, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** 403 for a scope the user has not granted. The client offers a connect. */
export function notConnected(what: string) {
  return NextResponse.json({ error: `${what} is not connected` }, { status: 403 });
}

/** 400 for a request we could not read. */
export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
