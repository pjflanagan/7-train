'use client';

import { MdPlaylistAdd } from 'react-icons/md';
import { LuCalendarArrowDown } from 'react-icons/lu';
import { usePlannerStore } from '@/lib/store';
import { addWeeks } from '@/lib/dates';
import styles from './CopyActivitiesCard.module.scss';

interface CopyActivitiesCardProps {
  weekStart: string;
  /**
   * Where the targets come from: the "my weekly targets" template, or the week
   * before this one. Same action either way — the week gets its own copies.
   */
  from: 'default' | 'previous';
}

/**
 * Only shown on a week aiming at nothing yet: filling it from somewhere that
 * already has targets is how a week usually starts, and typing a single
 * activity in by hand is the exception.
 */
export function CopyActivitiesCard({ weekStart, from }: CopyActivitiesCardProps) {
  const copyWeek = usePlannerStore((state) => state.copyWeek);

  const isDefault = from === 'default';
  const label = isDefault ? 'Add my weekly targets' : "Add last week's targets";
  // A calendar pulled downward: this one slot is specifically about the week
  // before, where the plain copy icon would only say "copy something".
  const Icon = isDefault ? MdPlaylistAdd : LuCalendarArrowDown;

  return (
    <button
      type="button"
      className={`${styles.card} ${isDefault ? styles.isDefault : ''}`}
      title={label}
      onClick={() =>
        copyWeek(isDefault ? null : addWeeks(weekStart, -1), weekStart, {
          schedule: false,
          notes: false,
          activities: true,
        })
      }
    >
      <Icon className={styles.icon} />
      {label}
    </button>
  );
}
