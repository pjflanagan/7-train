'use client';
import React from 'react';
import clsx from 'clsx';
import styles from './NumberInput.module.scss';

export interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({ 
  label, 
  error,
  className, 
  id,
  ...props 
}) => {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  
  return (
    <div className={clsx(styles.wrapper, className)}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <input 
        type="number"
        id={inputId} 
        className={clsx(styles.input, error && styles.hasError)} 
        {...props} 
      />
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
};