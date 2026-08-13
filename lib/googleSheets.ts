/**
 * The workout history spreadsheet — the hosted twin of the CSV export.
 *
 * Server only. `drive.file` is per-file consent, so we can create a sheet and
 * keep rewriting that one file, and can see nothing else in the user's Drive.
 */

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

/** The tab every export writes to, so repeat exports overwrite rather than pile up. */
export const HISTORY_SHEET_TITLE = 'History';

export class GoogleSheetsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'GoogleSheetsError';
  }
}

async function callSheets<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${SHEETS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new GoogleSheetsError(
      body?.error?.message ?? `Google returned ${response.status}`,
      response.status
    );
  }
  return body as T;
}

interface Spreadsheet {
  spreadsheetId: string;
  spreadsheetUrl?: string;
}

/**
 * The spreadsheet to write into: the one we made last time if it is still
 * there, otherwise a fresh one.
 */
export async function ensureHistorySpreadsheet(
  accessToken: string,
  knownId: string | null | undefined,
  title: string
): Promise<Spreadsheet> {
  if (knownId) {
    try {
      return await callSheets<Spreadsheet>(
        accessToken,
        `/${encodeURIComponent(knownId)}?fields=spreadsheetId,spreadsheetUrl`
      );
    } catch (error) {
      // Deleted, or belonging to a different account than the one signed in.
      if (!(error instanceof GoogleSheetsError) || error.status >= 500) throw error;
    }
  }

  return callSheets<Spreadsheet>(accessToken, '', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: HISTORY_SHEET_TITLE } }],
    }),
  });
}

/** Replace the history tab's contents with `rows`, header row included. */
export async function writeHistoryRows(
  accessToken: string,
  spreadsheetId: string,
  rows: string[][]
): Promise<void> {
  const range = `${HISTORY_SHEET_TITLE}!A1:Z`;

  // Clearing first means a shorter export never leaves last week's rows behind.
  await callSheets(
    accessToken,
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`,
    { method: 'POST', body: '{}' }
  );

  await callSheets(
    accessToken,
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      range
    )}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ range, majorDimension: 'ROWS', values: rows }) }
  );
}
