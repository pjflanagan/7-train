import React from 'react';
import { Activity } from '@/lib/types';
import { Modal } from '@/components/elements/Modal/Modal';
import { Button } from '@/components/elements/Button/Button';
import styles from './ActivityLinksPickerModal.module.scss';
import { MdOpenInNew } from 'react-icons/md';

export interface ActivityLinksPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity;
}

export const ActivityLinksPickerModal: React.FC<ActivityLinksPickerModalProps> = ({
  isOpen,
  onClose,
  activity
}) => {
  const links = activity.links || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${activity.name} links`}
      maxWidth="400px"
      footer={<Button onClick={onClose} variant="secondary">Close</Button>}
    >
      <div className={styles.list}>
        {links.length === 0 ? (
          <p className={styles.empty}>No links added for this workout.</p>
        ) : (
          links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkEvent}
            >
              <span>{link.title || link.url}</span>
              <MdOpenInNew size={16} />
            </a>
          ))
        )}
      </div>
    </Modal>
  );
};
