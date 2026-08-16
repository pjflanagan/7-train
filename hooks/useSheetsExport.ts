'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { COPY } from '@/lib/copy';
import { usePlannerStore } from '@/lib/store';
import { entriesFromSchedule, historyRows } from '@/lib/csv';
import { WeekStartsOn } from '@/lib/dates';

/** The one spreadsheet we keep rewriting, named so it is findable in Drive. */
const SPREADSHEET_TITLE = '7 Train workout history';

/**
 * Pushes the same rows as the CSV export into a Google spreadsheet. The sheet
 * id is remembered locally, so exporting again overwrites that file instead of
 * scattering copies through the user's Drive.
 */
export function useSheetsExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToSheets = useCallback(async () => {
    setIsExporting(true);
    const store = usePlannerStore.getState();

    const scheduled = entriesFromSchedule(
      store.events,
      store.notes,
      (store.weekStartsOn ?? 1) as WeekStartsOn,
      store.weekActivities
    );
    const rows = historyRows(
      [...store.history, ...scheduled].sort((a, b) => a.date.localeCompare(b.date)),
      store.activities
    );

    try {
      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: store.googleSheetId,
          title: SPREADSHEET_TITLE,
          rows,
        }),
      });
      if (!response.ok) throw new Error((await response.json())?.error ?? 'Export failed');

      const { spreadsheetId, url } = (await response.json()) as {
        spreadsheetId: string;
        url: string;
      };
      usePlannerStore.getState().setGoogleSheetId(spreadsheetId);

      toast.success(COPY.sheets.exported, {
        action: { label: 'Open', onClick: () => window.open(url, '_blank') },
      });
      return url;
    } catch (error) {
      console.error('Sheets export failed', error);
      toast.error(COPY.sheets.failed);
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToSheets, isExporting };
}
