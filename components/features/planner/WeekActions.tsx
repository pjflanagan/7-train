'use client';

import React, { useState } from 'react';
import { usePlannerStore } from '@/lib/store';
import { MdDeleteOutline } from 'react-icons/md';
import { Button } from '@/components/elements/Button/Button';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import { ConfirmDialog } from '@/components/elements/ConfirmDialog/ConfirmDialog';
import { useIsWeekEmpty, useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { addWeeks, getWeekStartKey } from '@/lib/dates';
import styles from './WeekActions.module.scss';

type WeekAction = 'current' | 'previous' | 'clear' | null;

/** Pulls another week's schedule into this one, or empties it. All overwrite. */
export function WeekActions({ weekStart }: { weekStart: string }) {
  const [action, setAction] = useState<WeekAction>(null);
  const copyWeek = usePlannerStore((state) => state.copyWeek);
  const clearWeek = usePlannerStore((state) => state.clearWeek);
  const weekStartsOn = useWeekStartsOn();
  const isEmpty = useIsWeekEmpty(weekStart);

  const currentWeek = getWeekStartKey(new Date(), weekStartsOn);
  const previousWeek = addWeeks(weekStart, -1);

  // Past weeks are a record, not a plan — nothing gets copied into them. Beyond
  // that, hide a copy whose source is this week itself, or that duplicates the
  // other button: next week's "previous" is the current week.
  const isPast = weekStart < currentWeek;
  const canCopyCurrent = !isPast && weekStart !== currentWeek;
  const canCopyPrevious = !isPast && previousWeek !== currentWeek && previousWeek !== weekStart;

  const handleConfirm = () => {
    if (action === 'current') copyWeek(currentWeek, weekStart);
    if (action === 'previous') copyWeek(previousWeek, weekStart);
    if (action === 'clear') clearWeek(weekStart);
    setAction(null);
  };

  const details = {
    current: {
      title: 'Copy current week',
      message: 'This will overwrite this week with the contents of the current week. Are you sure?',
    },
    previous: {
      title: 'Copy previous week',
      message: 'This will overwrite this week with the contents of the previous week. Are you sure?',
    },
    clear: {
      title: 'Clear week',
      message: 'This will remove all workouts and notes from this week. Are you sure?',
    },
  }[action ?? 'current'];

  return (
    <>
      <div className={styles.actions}>
        {canCopyCurrent && (
          <Button
            variant="secondary"
            className={styles.button}
            onClick={() => setAction('current')}
          >
            Copy current week
          </Button>
        )}
        {canCopyPrevious && (
          <Button
            variant="secondary"
            className={styles.button}
            onClick={() => setAction('previous')}
          >
            Copy previous week
          </Button>
        )}
        {!isEmpty && (
          <IconButton
            variant="danger"
            size="sm"
            aria-label="Clear week"
            title="Clear week"
            onClick={() => setAction('clear')}
          >
            <MdDeleteOutline />
          </IconButton>
        )}
      </div>

      <ConfirmDialog
        isOpen={action !== null}
        title={details.title}
        message={details.message}
        confirmLabel="Confirm"
        isDestructive={action === 'clear'}
        onConfirm={handleConfirm}
        onCancel={() => setAction(null)}
      />
    </>
  );
}
