'use client';

import React from 'react';
import clsx from 'clsx';
import { ACTIVITY_ICONS } from '@/lib/icons';
import styles from './IconPicker.module.scss';

export interface IconPickerProps {
  value?: string;
  onChange: (iconKey: string) => void;
  className?: string;
}

export const IconPicker: React.FC<IconPickerProps> = ({ 
  value, 
  onChange,
  className 
}) => {
  return (
    <div className={clsx(styles.grid, className)}>
      {Object.entries(ACTIVITY_ICONS).map(([key, config]) => {
        const Icon = config.Icon;
        return (
          <button
            key={key}
            type="button"
            className={clsx(styles.iconButton, value === key && styles.selected)}
            onClick={() => onChange(key)}
            title={config.label}
            aria-label={`Select icon ${config.label}`}
          >
            <Icon size={24} />
          </button>
        );
      })}
    </div>
  );
};