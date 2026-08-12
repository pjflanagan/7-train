import React from 'react';
import styles from './AppShell.module.scss';
import { AppHeader } from '../AppHeader/AppHeader';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className={styles.appContainer}>
      <AppHeader />
      <div className={styles.mainContent}>
        {children}
      </div>
    </div>
  );
};
