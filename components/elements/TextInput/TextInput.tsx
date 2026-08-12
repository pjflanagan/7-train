'use client';
import React from 'react';
import clsx from 'clsx';
import styles from './TextInput.module.scss';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const TextInput: React.FC<TextInputProps> = ({ 
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
        id={inputId} 
        className={clsx(styles.input, error && styles.hasError)} 
        {...props} 
      />
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
};