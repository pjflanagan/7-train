'use client';

import React, { useState } from 'react';
import { usePlannerStore } from '../../../lib/store';
import { useCsvExport } from '../../../hooks/useCsvExport';
import { Modal } from '../../elements/Modal/Modal';
import { ConfirmDialog } from '../../elements/ConfirmDialog/ConfirmDialog';
import { Button } from '../../elements/Button/Button';
import { useWeather } from '../../../hooks/useWeather';
import { Select } from '../../elements/Select/Select';
import styles from './SettingsModal.module.scss';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConfirmAction = 'clear1' | 'clear2' | 'copy1to2' | 'reset' | null;

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const { exportData } = useCsvExport();
  const { data: weatherData } = useWeather();

  const clearWeek = usePlannerStore((state) => state.clearWeek);
  const copyWeek = usePlannerStore((state) => state.copyWeek);
  const resetAll = usePlannerStore((state) => state.resetAll);

  const handleConfirm = () => {
    switch (confirmAction) {
      case 'clear1':
        clearWeek(1);
        break;
      case 'clear2':
        clearWeek(2);
        break;
      case 'copy1to2':
        copyWeek(1, 2);
        break;
      case 'reset':
        resetAll();
        break;
    }
    setConfirmAction(null);
  };

  const getConfirmDetails = () => {
    switch (confirmAction) {
      case 'clear1':
        return { title: 'Clear Week 1', message: 'Are you sure you want to clear all workouts and notes from Week 1?', isDestructive: true };
      case 'clear2':
        return { title: 'Clear Week 2', message: 'Are you sure you want to clear all workouts and notes from Week 2?', isDestructive: true };
      case 'copy1to2':
        return { title: 'Copy Week 1 to 2', message: 'This will overwrite Week 2 with the contents of Week 1. Are you sure?', isDestructive: false };
      case 'reset':
        return { title: 'Factory Reset', message: 'Are you sure you want to completely reset the app? This will erase all goals, workouts, history, and links.', isDestructive: true };
      default:
        return { title: '', message: '', isDestructive: false };
    }
  };

  const confirmDetails = getConfirmDetails();

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Settings" maxWidth="500px">
        <div className={styles.container}>
          
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>General</h3>
            <div className={styles.row}>
              <span className={styles.text}>Weather Location</span>
              <span className={styles.text} style={{ color: 'var(--text-muted)' }}>
                {weatherData ? weatherData.location.city : 'Location TBD'}
              </span>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Data & History</h3>
            <div className={styles.row}>
              <span className={styles.text}>Export history to CSV format</span>
              <Button onClick={exportData} variant="secondary">Export CSV</Button>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Week Management</h3>
            <div className={styles.row}>
              <span className={styles.text}>Clear all items from Week 1</span>
              <Button onClick={() => setConfirmAction('clear1')} variant="danger">Clear Week 1</Button>
            </div>
            <div className={styles.row}>
              <span className={styles.text}>Clear all items from Week 2</span>
              <Button onClick={() => setConfirmAction('clear2')} variant="danger">Clear Week 2</Button>
            </div>
            <div className={styles.row}>
              <span className={styles.text}>Copy Week 1 schedule to Week 2</span>
              <Button onClick={() => setConfirmAction('copy1to2')} variant="secondary">Copy 1 → 2</Button>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Danger Zone</h3>
            <div className={styles.row}>
              <span className={styles.text}>Factory reset to default data</span>
              <Button onClick={() => setConfirmAction('reset')} variant="danger">Reset App</Button>
            </div>
          </div>

        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmDetails.title}
        message={confirmDetails.message}
        confirmLabel="Confirm"
        isDestructive={confirmDetails.isDestructive}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
};
