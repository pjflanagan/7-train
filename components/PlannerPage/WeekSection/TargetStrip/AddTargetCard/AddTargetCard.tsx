'use client';

import { useState } from 'react';
import { MdAdd } from 'react-icons/md';
import { ActivityFormModal } from '@/components/PlannerPage/ActivityFormModal/ActivityFormModal';
import styles from './AddTargetCard.module.scss';

/**
 * The empty slot at the end of a week's rail. It reads as a card waiting to be
 * filled rather than a button, because that is what it becomes — and on a week
 * with nothing in it yet, it is the whole rail.
 */
export function AddTargetCard({ weekStart }: { weekStart: string }) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.card}
        aria-label="Add target"
        title="Add target"
        onClick={() => setIsFormOpen(true)}
      >
        <MdAdd className={styles.icon} />
      </button>
      <ActivityFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        weekStart={weekStart}
      />
    </>
  );
}
