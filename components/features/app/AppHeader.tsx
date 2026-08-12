'use client';
import React, { useState } from 'react';
import clsx from 'clsx';
import styles from './AppHeader.module.scss';
import { useScheduleFocus } from '@/hooks/useScheduleFocus';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import { SevenLogo } from '@/components/elements/SevenLogo/SevenLogo';
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
  const { isScheduleFocused } = useScheduleFocus();

  return (
    <>
      <header className={clsx(styles.header, isScheduleFocused && styles.collapsed)}>
        <div className={styles.headerBar}>
          <div className={styles.brandSection}>
            <SevenLogo size={32} className={styles.brandLogoBadge} title="7 train" />
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
