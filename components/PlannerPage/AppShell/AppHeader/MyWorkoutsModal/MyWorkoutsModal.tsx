import React, { useState } from 'react';
import { Modal } from '@/components/elements/Modal/Modal';
import { Button } from '@/components/elements/Button/Button';
import { SortableGoalList } from './SortableGoalList/SortableGoalList';
import { GoalFormModal } from './GoalFormModal/GoalFormModal';
import { usePlannerStore } from '@/lib/store';
import { MdAdd } from 'react-icons/md';
import styles from './MyWorkoutsModal.module.scss';
import { useGoals } from '@/hooks/usePlannerSelectors';

export interface MyWorkoutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyWorkoutsModal: React.FC<MyWorkoutsModalProps> = ({ isOpen, onClose }) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const goals = useGoals();
  const reorderGoals = usePlannerStore((s) => s.reorderGoals);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="My workouts"
        maxWidth="600px"
        footer={
          <Button variant="primary" onClick={() => setIsAddOpen(true)}>
            <MdAdd /> Add workout
          </Button>
        }
      >
        <div className={styles.container}>
          <div className={styles.list}>
            {goals.length === 0 ? (
              <p className={styles.empty}>No workouts yet. Add one to start planning.</p>
            ) : (
              <SortableGoalList goals={goals} onReorder={reorderGoals} />
            )}
          </div>
        </div>
      </Modal>

      <GoalFormModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </>
  );
};
