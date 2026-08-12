import React, { useState } from 'react';
import { Modal } from '../../elements/Modal/Modal';
import { Button } from '../../elements/Button/Button';
import { SortableGoalList } from './SortableGoalList';
import { GoalFormModal } from './GoalFormModal';
import { usePlannerStore } from '../../../lib/store';
import { MdAdd } from 'react-icons/md';
import styles from './MyWeekModal.module.scss';
import { useGoals } from '../../../hooks/usePlannerStore';

export interface MyWeekModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyWeekModal: React.FC<MyWeekModalProps> = ({ isOpen, onClose }) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const goals = useGoals();
  const reorderGoals = usePlannerStore((s) => s.reorderGoals);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="My Week" maxWidth="600px">
        <div className={styles.container}>
          <div className={styles.header}>
            <Button variant="primary" onClick={() => setIsAddOpen(true)}>
              <MdAdd /> Add Goal
            </Button>
          </div>
          
          <div className={styles.list}>
            <SortableGoalList goals={goals} onReorder={reorderGoals} />
          </div>
        </div>
      </Modal>

      <GoalFormModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </>
  );
};
