'use client';

import React, { useRef, useState } from 'react';
import { usePlannerStore } from '@/lib/store';
import { useCsvExport } from '@/hooks/useCsvExport';
import { useBackup } from '@/hooks/useBackup';
import { Modal } from '@/components/elements/Modal/Modal';
import { ConfirmDialog } from '@/components/elements/ConfirmDialog/ConfirmDialog';
import { Button } from '@/components/elements/Button/Button';
import { Select } from '@/components/elements/Select/Select';
import { Tabs, TabConfig } from '@/components/elements/Tabs/Tabs';
import { useWeather, useWeatherStore } from '@/hooks/useWeather';
import { useDefaultStartMinutes, useUse24HourClock, useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { WEEK_START_OPTIONS, WeekStartsOn } from '@/lib/dates';
import { startTimeOptions } from '@/lib/schedule';
import styles from './SettingsModal.module.scss';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConfirmAction = 'reset' | 'clear' | 'import' | null;

const TABS: TabConfig[] = [
  { id: 'general', label: 'General' },
  { id: 'data', label: 'Data' },
  { id: 'danger', label: 'Danger zone' }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [importStatus, setImportStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const pendingFile = useRef<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { exportData } = useCsvExport();
  const { exportBackup, importBackup } = useBackup();
  const { data: weatherData } = useWeather();
  const fetchWeather = useWeatherStore((s) => s.fetchWeather);

  const resetAll = usePlannerStore((state) => state.resetAll);
  const clearAll = usePlannerStore((state) => state.clearAll);

  const tempUnit = usePlannerStore((state) => state.tempUnit ?? 'F');
  const setTempUnit = usePlannerStore((state) => state.setTempUnit);
  const weekStartsOn = useWeekStartsOn();
  const setWeekStartsOn = usePlannerStore((state) => state.setWeekStartsOn);
  const defaultStartMinutes = useDefaultStartMinutes();
  const setDefaultStartMinutes = usePlannerStore((state) => state.setDefaultStartMinutes);
  const use24HourClock = useUse24HourClock();
  const setUse24HourClock = usePlannerStore((state) => state.setUse24HourClock);
  const startTimes = startTimeOptions(use24HourClock);

  const handleTempUnitChange = (unit: 'C' | 'F') => {
    setTempUnit(unit);
    // The forecast is fetched in the stored unit, so re-fetch on change.
    fetchWeather();
  };

  const handleFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    // Reset the input so choosing the same file again still fires a change.
    event.target.value = '';
    if (!file) return;
    pendingFile.current = file;
    setImportStatus(null);
    setConfirmAction('import');
  };

  const runImport = async (file: File) => {
    const error = await importBackup(file);
    setImportStatus(
      error
        ? { message: error, isError: true }
        : { message: 'Backup imported.', isError: false }
    );
  };

  const handleConfirm = () => {
    switch (confirmAction) {
      case 'reset':
        resetAll();
        break;
      case 'clear':
        clearAll();
        break;
      case 'import': {
        const file = pendingFile.current;
        pendingFile.current = null;
        if (file) void runImport(file);
        break;
      }
    }
    setConfirmAction(null);
  };

  const getConfirmDetails = () => {
    switch (confirmAction) {
      case 'reset':
        return { title: 'Factory reset', message: 'Are you sure you want to completely reset the app? This will erase all activities, events, history, and links.', isDestructive: true };
      case 'clear':
        return { title: 'Clear all data', message: 'Are you sure you want to erase everything? Every activity, event, note, target, link, and history entry will be gone, with nothing put back in their place. This cannot be undone.', isDestructive: true };
      case 'import':
        return { title: 'Import backup', message: 'Importing replaces everything currently in the app with the contents of the backup file. This cannot be undone.', isDestructive: true };
      default:
        return { title: '', message: '', isDestructive: false };
    }
  };

  const confirmDetails = getConfirmDetails();

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Settings" maxWidth="500px">
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className={styles.container}>

          {activeTab === 'general' && (
            <div className={styles.section}>
              <div className={styles.row}>
                <span className={styles.text}>Week starts on</span>
                <Select
                  className={styles.control}
                  value={String(weekStartsOn)}
                  onChange={(e) => setWeekStartsOn(Number(e.target.value) as WeekStartsOn)}
                >
                  {WEEK_START_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>
              {/* Only the first workout of a day takes this; later ones still
                  stack after the one before them. */}
              <div className={styles.row}>
                <span className={styles.text}>Default workout time</span>
                <Select
                  className={styles.control}
                  value={String(defaultStartMinutes)}
                  onChange={(e) => setDefaultStartMinutes(Number(e.target.value))}
                >
                  {startTimes.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>
              <div className={styles.row}>
                <span className={styles.text}>Clock</span>
                <Select
                  className={styles.control}
                  value={use24HourClock ? '24' : '12'}
                  onChange={(e) => setUse24HourClock(e.target.value === '24')}
                >
                  <option value="12">12-hour (5:30 PM)</option>
                  <option value="24">24-hour (17:30)</option>
                </Select>
              </div>
              <div className={styles.row}>
                <span className={styles.text}>Temperature unit</span>
                <Select
                  className={styles.control}
                  value={tempUnit}
                  onChange={(e) => handleTempUnitChange(e.target.value as 'C' | 'F')}
                >
                  <option value="F">Fahrenheit (°F)</option>
                  <option value="C">Celsius (°C)</option>
                </Select>
              </div>
              <div className={styles.row}>
                <span className={styles.text}>Weather location</span>
                <span className={styles.value}>
                  {weatherData ? weatherData.location.city : 'Location TBD'}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className={styles.section}>
              <div className={styles.row}>
                <span className={styles.text}>Export history to CSV format</span>
                <Button onClick={exportData} variant="secondary">Export CSV</Button>
              </div>
              <div className={styles.row}>
                <span className={styles.text}>Save a full backup, including activities and settings</span>
                <Button onClick={exportBackup} variant="secondary">Export backup</Button>
              </div>
              <div className={styles.row}>
                <span className={styles.text}>Restore everything from a backup file</span>
                <Button onClick={() => fileInput.current?.click()} variant="secondary">Import backup</Button>
              </div>
              {importStatus && (
                <span className={`${styles.status} ${importStatus.isError ? styles.error : ''}`}>
                  {importStatus.message}
                </span>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className={styles.hiddenInput}
                onChange={handleFileChosen}
              />
            </div>
          )}

          {activeTab === 'danger' && (
            <div className={styles.section}>
              <div className={styles.row}>
                <span className={styles.text}>Factory reset to default data</span>
                <Button onClick={() => setConfirmAction('reset')} variant="danger">Reset app</Button>
              </div>
              <div className={styles.row}>
                <span className={styles.text}>Erase everything, with nothing put back</span>
                <Button onClick={() => setConfirmAction('clear')} variant="danger">Clear all data</Button>
              </div>
            </div>
          )}

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
