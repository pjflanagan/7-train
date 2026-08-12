import React from 'react';
import { WorkoutType } from '@/lib/types';
import { Modal } from '@/components/elements/Modal/Modal';
import { Button } from '@/components/elements/Button/Button';
import styles from './GoalLinksPickerModal.module.scss';
import { MdOpenInNew } from 'react-icons/md';

export interface GoalLinksPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: WorkoutType;
}

export const GoalLinksPickerModal: React.FC<GoalLinksPickerModalProps> = ({
  isOpen,
  onClose,
  goal
}) => {
  const links = goal.links || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${goal.name} Links`} maxWidth="400px">
      <div className={styles.list}>
        {links.length === 0 ? (
          <p className={styles.empty}>No links added for this goal.</p>
        ) : (
          links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkItem}
            >
              <span>{link.title || link.url}</span>
              <MdOpenInNew size={16} />
            </a>
          ))
        )}
      </div>
      <div className={styles.actions}>
        <Button onClick={onClose} variant="secondary">Close</Button>
      </div>
    </Modal>
  );
};
