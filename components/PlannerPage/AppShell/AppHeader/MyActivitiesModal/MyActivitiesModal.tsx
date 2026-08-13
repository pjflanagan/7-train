import React, { useState } from 'react';
import { Modal } from '@/components/elements/Modal/Modal';
import { Button } from '@/components/elements/Button/Button';
import { SortableActivityList } from './SortableActivityList/SortableActivityList';
import { ActivityFormModal } from './ActivityFormModal/ActivityFormModal';
import { usePlannerStore } from '@/lib/store';
import { MdAdd } from 'react-icons/md';
import styles from './MyActivitiesModal.module.scss';
import { useActivities } from '@/hooks/usePlannerSelectors';

export interface MyActivitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyActivitiesModal: React.FC<MyActivitiesModalProps> = ({ isOpen, onClose }) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const activities = useActivities();
  const reorderActivities = usePlannerStore((s) => s.reorderActivities);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="My activities"
        maxWidth="600px"
        footer={
          <Button variant="primary" onClick={() => setIsAddOpen(true)}>
            <MdAdd /> Add activity
          </Button>
        }
      >
        <div className={styles.container}>
          <div className={styles.list}>
            {activities.length === 0 ? (
              <p className={styles.empty}>No workouts yet. Add one to start planning.</p>
            ) : (
              <SortableActivityList activities={activities} onReorder={reorderActivities} />
            )}
          </div>
        </div>
      </Modal>

      <ActivityFormModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </>
  );
};
