import React from 'react';
import styles from './AppShell.module.scss';
import { AppHeader } from './AppHeader/AppHeader';
import { ScheduleFocusProvider } from '@/hooks/useScheduleFocus';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ScheduleFocusProvider>
      <div className={styles.appContainer}>
        <AppHeader />
        <div className={styles.mainContent}>
          {children}
        </div>
      </div>
    </ScheduleFocusProvider>
  );
};
