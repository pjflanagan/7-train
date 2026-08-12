'use client';
import React from 'react';
import clsx from 'clsx';
import styles from './Tabs.module.scss';

export interface TabConfig {
  id: string;
  label: React.ReactNode;
}

export interface TabsProps {
  tabs: TabConfig[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  return (
    <div className={clsx(styles.tabs, className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={clsx(styles.tab, activeTab === tab.id && styles.active)}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};