'use client';

import React, { useState } from 'react';
import { usePlannerStore } from '@/lib/store';
import { useCsvExport } from '@/hooks/useCsvExport';
import { Modal } from '@/components/elements/Modal/Modal';
import { ConfirmDialog } from '@/components/elements/ConfirmDialog/ConfirmDialog';
import { Button } from '@/components/elements/Button/Button';
import { Select } from '@/components/elements/Select/Select';
import { useWeather, useWeatherStore } from '@/hooks/useWeather';
import { useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { WEEK_START_OPTIONS, WeekStartsOn } from '@/lib/dates';
import styles from './SettingsModal.module.scss';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConfirmAction = 'reset' | null;

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const { exportData } = useCsvExport();
  const { data: weatherData } = useWeather();
  const fetchWeather = useWeatherStore((s) => s.fetchWeather);

  const resetAll = usePlannerStore((state) => state.resetAll);

  const tempUnit = usePlannerStore((state) => state.tempUnit ?? 'F');
  const setTempUnit = usePlannerStore((state) => state.setTempUnit);
  const weekStartsOn = useWeekStartsOn();
  const setWeekStartsOn = usePlannerStore((state) => state.setWeekStartsOn);

  const handleTempUnitChange = (unit: 'C' | 'F') => {
    setTempUnit(unit);
    // The forecast is fetched in the stored unit, so re-fetch on change.
    fetchWeather();
  };

  const handleConfirm = () => {
    switch (confirmAction) {
      case 'reset':
        resetAll();
        break;
    }
    setConfirmAction(null);
  };

  const getConfirmDetails = () => {
    switch (confirmAction) {
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
              <span className={styles.text}>Week starts on</span>
              <Select
                value={String(weekStartsOn)}
                onChange={(e) => setWeekStartsOn(Number(e.target.value) as WeekStartsOn)}
              >
                {WEEK_START_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
            <div className={styles.row}>
              <span className={styles.text}>Temperature unit</span>
              <Select
                value={tempUnit}
                onChange={(e) => handleTempUnitChange(e.target.value as 'C' | 'F')}
              >
                <option value="F">Fahrenheit (°F)</option>
                <option value="C">Celsius (°C)</option>
              </Select>
            </div>
            <div className={styles.row}>
              <span className={styles.text}>Weather Location</span>
              <span className={styles.text} style={{ color: 'var(--text-muted)' }}>
                {weatherData ? weatherData.location.city : 'Location TBD'}
              </span>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Data &amp; History</h3>
            <div className={styles.row}>
              <span className={styles.text}>Export history to CSV format</span>
              <Button onClick={exportData} variant="secondary">Export CSV</Button>
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
