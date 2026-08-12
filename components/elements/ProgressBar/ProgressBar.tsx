import React from 'react';
import clsx from 'clsx';
import styles from './ProgressBar.module.scss';

export interface ProgressBarProps {
  percent: number;
  color?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  percent, 
  color = 'var(--accent-primary)', 
  className 
}) => {
  const clamped = Math.min(100, Math.max(0, percent));
  
  return (
    <div className={clsx(styles.container, className)}>
      <div 
        className={styles.fill} 
        style={{ width: `${clamped}%`, backgroundColor: color }} 
      />
    </div>
  );
};