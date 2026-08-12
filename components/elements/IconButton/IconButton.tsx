'use client';
import React from 'react';
import clsx from 'clsx';
import styles from './IconButton.module.scss';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton: React.FC<IconButtonProps> = ({ 
  children, 
  variant = 'ghost', 
  size = 'md',
  className, 
  ...props 
}) => {
  return (
    <button 
      className={clsx(styles.iconButton, styles[variant], styles[size], className)} 
      {...props}
    >
      {children}
    </button>
  );
};