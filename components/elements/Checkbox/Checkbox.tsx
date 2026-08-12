'use client';
import React from 'react';
import clsx from 'clsx';
import styles from './Checkbox.module.scss';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

export const Checkbox: React.FC<CheckboxProps> = ({ 
  label, 
  className, 
  id,
  ...props 
}) => {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  
  return (
    <div className={clsx(styles.wrapper, className)}>
      <input 
        type="checkbox"
        id={inputId} 
        className={styles.checkbox} 
        {...props} 
      />
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
    </div>
  );
};