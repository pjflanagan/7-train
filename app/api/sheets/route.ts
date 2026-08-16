import { NextResponse } from 'next/server';
import { apiError, badRequest, notConnected } from '@/lib/apiError';
import { z } from 'zod';
import { GOOGLE_INTEGRATIONS } from '@/lib/google';
import { getGoogleAccessToken } from '@/lib/googleServer';
import {
  ensureHistorySpreadsheet,
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
    return notConnected('Sheets');
  }

  const parsed = ExportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return badRequest('Malformed export request');
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
    return apiError(error, 'Sheets export failed', 'Sheets export failed');
  }
}
