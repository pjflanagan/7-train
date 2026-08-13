import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GOOGLE_INTEGRATIONS } from '@/lib/google';
import { getGoogleAccessToken } from '@/lib/googleServer';
import {
  ensureHistorySpreadsheet,
  GoogleSheetsError,
  writeHistoryRows,
} from '@/lib/googleSheets';

/**
 * Writes the workout history to a spreadsheet in the user's Drive — the same
 * rows as the CSV export, kept in one file that later exports overwrite.
 */

const ExportSchema = z.object({
  spreadsheetId: z.string().nullable().optional(),
  title: z.string().min(1).max(120),
  /** Header row first, then one row per entry. */
  rows: z.array(z.array(z.string())).min(1),
});

export async function POST(request: Request) {
  const accessToken = await getGoogleAccessToken(request, GOOGLE_INTEGRATIONS.sheets.scopes);
  if (!accessToken) {
    return NextResponse.json({ error: 'Sheets is not connected' }, { status: 403 });
  }

  const parsed = ExportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Malformed export request' }, { status: 400 });
  }

  try {
    const sheet = await ensureHistorySpreadsheet(
      accessToken,
      parsed.data.spreadsheetId,
      parsed.data.title
    );
    await writeHistoryRows(accessToken, sheet.spreadsheetId, parsed.data.rows);

    return NextResponse.json({
      spreadsheetId: sheet.spreadsheetId,
      url:
        sheet.spreadsheetUrl ??
        `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit`,
    });
  } catch (error) {
    if (error instanceof GoogleSheetsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Sheets export failed', error);
    return NextResponse.json({ error: 'Sheets export failed' }, { status: 500 });
  }
}
