'use client';
import React from 'react';
import styles from './AppHeader.module.scss';
import { Button } from '../../elements/Button/Button';
import { IconButton } from '../../elements/IconButton/IconButton';
import { MdFitnessCenter, MdSettings, MdLink } from 'react-icons/md';

export const AppHeader: React.FC = () => {
  return (
    <header className={styles.header}>
      <div className={styles.brandSection}>
        <div className={styles.brandLogoBadge}>
          <MdFitnessCenter size={18} />
        </div>
        <div className={styles.brandTitles}>
          <h1>Workout Planner</h1>
        </div>
        <button className={styles.btnMyWeek}>
          <MdFitnessCenter size={16} /> My Week
        </button>
      </div>
      
      <div className={styles.headerActions}>
        <IconButton aria-label="Links">
          <MdLink size={20} />
        </IconButton>
        <IconButton aria-label="Settings">
          <MdSettings size={20} />
        </IconButton>
        <Button variant="primary">Add goal</Button>
      </div>
    </header>
  );
};
