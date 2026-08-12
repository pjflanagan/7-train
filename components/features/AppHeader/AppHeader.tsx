'use client';
import React, { useState } from 'react';
import styles from './AppHeader.module.scss';
import { Button } from '../../elements/Button/Button';
import { IconButton } from '../../elements/IconButton/IconButton';
import { MdFitnessCenter, MdSettings, MdLink } from 'react-icons/md';
import { MyWeekModal } from '../goals/MyWeekModal';
import { GoalFormModal } from '../goals/GoalFormModal';
import { LinksModal } from '../links/LinksModal';
import { SettingsModal } from '../settings/SettingsModal';

export const AppHeader: React.FC = () => {
  const [isMyWeekOpen, setIsMyWeekOpen] = useState(false);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.brandSection}>
          <div className={styles.brandLogoBadge}>
            <MdFitnessCenter size={18} />
          </div>
          <div className={styles.brandTitles}>
            <h1>Workout Planner</h1>
          </div>
          <button className={styles.btnMyWeek} onClick={() => setIsMyWeekOpen(true)}>
            <MdFitnessCenter size={16} /> My Week
          </button>
        </div>
        
        <div className={styles.headerActions}>
          <IconButton aria-label="Links" onClick={() => setIsLinksOpen(true)}>
            <MdLink size={20} />
          </IconButton>
          <IconButton aria-label="Settings" onClick={() => setIsSettingsOpen(true)}>
            <MdSettings size={20} />
          </IconButton>
          <Button variant="primary" onClick={() => setIsGoalFormOpen(true)}>Add goal</Button>
        </div>
      </header>

      <MyWeekModal isOpen={isMyWeekOpen} onClose={() => setIsMyWeekOpen(false)} />
      <GoalFormModal isOpen={isGoalFormOpen} onClose={() => setIsGoalFormOpen(false)} />
      <LinksModal isOpen={isLinksOpen} onClose={() => setIsLinksOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};
