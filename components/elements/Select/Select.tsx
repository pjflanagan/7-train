'use client';
import React from 'react';
import clsx from 'clsx';
import styles from './Select.module.scss';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({ 
  label, 
  error,
  className, 
  id,
  ...props 
}) => {
  const generatedId = React.useId();
  const selectId = id || generatedId;
  
  return (
    <div className={clsx(styles.wrapper, className)}>
      {label && <label htmlFor={selectId} className={styles.label}>{label}</label>}
      <select 
        id={selectId} 
        className={clsx(styles.select, error && styles.hasError)} 
        {...props} 
      />
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
};