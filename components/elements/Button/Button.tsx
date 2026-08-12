'use client';
import React from 'react';
import clsx from 'clsx';
import styles from './Button.module.scss';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'secondary', 
  className, 
  ...props 
}) => {
  return (
    <button 
      className={clsx(styles.button, styles[variant], className)} 
      {...props}
    >
      {children}
    </button>
  );
};