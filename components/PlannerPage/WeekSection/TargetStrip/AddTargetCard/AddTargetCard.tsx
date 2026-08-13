'use client';

import { useState } from 'react';
import { MdAdd } from 'react-icons/md';
import { ActivityFormModal } from '@/components/PlannerPage/ActivityFormModal/ActivityFormModal';
import styles from './AddTargetCard.module.scss';

interface AddTargetCardProps {
  weekStart: string;
  /**
   * On a week with no targets yet a bare "+" has no context, so the slot says
   * what it does. Beside a rail of chips it stays wordless.
   */
  showLabel?: boolean;
}

/**
 * The empty slot at the end of a week's rail. It reads as a card waiting to be
 * filled rather than a button, because that is what it becomes.
 */
export function AddTargetCard({ weekStart, showLabel = false }: AddTargetCardProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const label = showLabel ? 'Add new target' : 'Add target';

  return (
    <>
      <button
        type="button"
        className={styles.card}
        aria-label={label}
        title={label}
        onClick={() => setIsFormOpen(true)}
      >
        <MdAdd className={styles.icon} />
        {showLabel && <span className={styles.label}>Add new target</span>}
      </button>
      <ActivityFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        weekStart={weekStart}
      />
    </>
  );
}
