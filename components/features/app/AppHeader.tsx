'use client';
import React, { useState } from 'react';
import styles from './AppHeader.module.scss';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import {
  MdFitnessCenter,
  MdSettings,
  MdLink,
} from 'react-icons/md';
import { MyWorkoutsModal } from '@/components/features/goals/MyWorkoutsModal';
import { LinksModal } from '@/components/features/links/LinksModal';
import { SettingsModal } from '@/components/features/settings/SettingsModal';

export const AppHeader: React.FC = () => {
  const [isMyWeekOpen, setIsMyWeekOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerBar}>
          <div className={styles.brandSection}>
            <div className={styles.brandLogoBadge}>7</div>
            <div className={styles.brandTitles}>
              <h1>
                <span className={styles.wordTrain}>Train</span>
              </h1>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.btnMyWeek}
              onClick={() => setIsMyWeekOpen(true)}
            >
              <MdFitnessCenter size={16} /> My Workouts
            </button>
            <IconButton aria-label="Links" onClick={() => setIsLinksOpen(true)}>
              <MdLink size={20} />
            </IconButton>
            <IconButton
              aria-label="Settings"
              onClick={() => setIsSettingsOpen(true)}
            >
              <MdSettings size={20} />
            </IconButton>
          </div>
        </div>
      </header>

      <MyWorkoutsModal
        isOpen={isMyWeekOpen}
        onClose={() => setIsMyWeekOpen(false)}
      />
      <LinksModal isOpen={isLinksOpen} onClose={() => setIsLinksOpen(false)} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};
