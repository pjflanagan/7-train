'use client';
import React, { useState } from 'react';
import styles from './AppHeader.module.scss';
import { Button } from '@/components/elements/Button/Button';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import { SevenLogo } from '@/components/elements/SevenLogo/SevenLogo';
import { MdBookmark, MdFitnessCenter } from 'react-icons/md';
import { MyWorkoutsModal } from './MyWorkoutsModal/MyWorkoutsModal';
import { LinksModal } from './LinksModal/LinksModal';
import { ProfileMenu } from './ProfileMenu/ProfileMenu';

export const AppHeader: React.FC = () => {
  const [isMyWeekOpen, setIsMyWeekOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerBar}>
          <div className={styles.brandSection}>
            <SevenLogo size={28} className={styles.brandLogo} title="7 train" />
            <h1>Train</h1>
          </div>

          <div className={styles.headerActions}>
            <IconButton aria-label="Links" onClick={() => setIsLinksOpen(true)}>
              <MdBookmark />
            </IconButton>
            <Button
              variant="primary"
              className={styles.myWorkouts}
              onClick={() => setIsMyWeekOpen(true)}
            >
              <MdFitnessCenter /> My workouts
            </Button>
            <ProfileMenu />
          </div>
        </div>
      </header>

      <MyWorkoutsModal
        isOpen={isMyWeekOpen}
        onClose={() => setIsMyWeekOpen(false)}
      />
      <LinksModal isOpen={isLinksOpen} onClose={() => setIsLinksOpen(false)} />
    </>
  );
};
