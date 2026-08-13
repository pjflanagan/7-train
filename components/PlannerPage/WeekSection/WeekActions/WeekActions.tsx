'use client';

import { useMemo, useState } from 'react';
import { usePlannerStore } from '@/lib/store';
import { LuCalendarArrowDown, LuCalendarX } from 'react-icons/lu';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import { ConfirmDialog } from '@/components/elements/ConfirmDialog/ConfirmDialog';
import { CopyWeekModal, type CopySource } from './CopyWeekModal/CopyWeekModal';
import { useIsWeekEmpty, useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { addWeeks, getWeekStartKey } from '@/lib/dates';
import styles from './WeekActions.module.scss';

/** Pulls another week's schedule or activities into this one, or empties it. All overwrite. */
export function WeekActions({ weekStart }: { weekStart: string }) {
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const copyWeek = usePlannerStore((state) => state.copyWeek);
  const clearWeek = usePlannerStore((state) => state.clearWeek);
  const weekStartsOn = useWeekStartsOn();
  const isEmpty = useIsWeekEmpty(weekStart);

  const currentWeek = getWeekStartKey(new Date(), weekStartsOn);
  const previousWeek = addWeeks(weekStart, -1);

  // Past weeks are a record, not a plan — nothing gets copied into them. Beyond
  // that, hide a source that is this week itself, or that duplicates the other
  // option: next week's "previous" is the current week.
  const isPast = weekStart < currentWeek;
  // Stable identity: the modal resets its form whenever this list changes.
  const sources = useMemo<CopySource[]>(() => {
    const options: CopySource[] = [];
    if (!isPast && weekStart !== currentWeek) options.push('current');
    if (!isPast && previousWeek !== currentWeek && previousWeek !== weekStart) {
      options.push('previous');
    }
    if (!isPast) options.push('default');
    return options;
  }, [isPast, weekStart, currentWeek, previousWeek]);

  const handleCopy = (
    source: CopySource,
    parts: { schedule: boolean; notes: boolean; activities: boolean }
  ) => {
    const fromWeekStart =
      source === 'current' ? currentWeek : source === 'previous' ? previousWeek : null;
    copyWeek(fromWeekStart, weekStart, parts);
  };

  return (
    <>
      <div className={styles.actions}>
        {sources.length > 0 && (
          <IconButton
            size="sm"
            aria-label="Copy week"
            title="Copy week"
            onClick={() => setIsCopyOpen(true)}
          >
            <LuCalendarArrowDown />
          </IconButton>
        )}
        {!isEmpty && (
          <IconButton
            variant="danger"
            size="sm"
            aria-label="Clear week"
            title="Clear week"
            onClick={() => setIsClearOpen(true)}
          >
            <LuCalendarX />
          </IconButton>
        )}
      </div>

      <CopyWeekModal
        isOpen={isCopyOpen}
        onClose={() => setIsCopyOpen(false)}
        sources={sources}
        onCopy={handleCopy}
      />

      <ConfirmDialog
        isOpen={isClearOpen}
        title="Clear week"
        message="This will remove all events and notes from this week. Are you sure?"
        confirmLabel="Confirm"
        isDestructive
        onConfirm={() => {
          clearWeek(weekStart);
          setIsClearOpen(false);
        }}
        onCancel={() => setIsClearOpen(false)}
      />
    </>
  );
}
