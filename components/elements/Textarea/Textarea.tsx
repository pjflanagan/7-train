'use client';
import React from 'react';
import clsx from 'clsx';
import styles from './Textarea.module.scss';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ 
  label, 
  error,
  className, 
  id,
  ...props 
}) => {
  const generatedId = React.useId();
  const textareaId = id || generatedId;
  
  return (
    <div className={clsx(styles.wrapper, className)}>
      {label && <label htmlFor={textareaId} className={styles.label}>{label}</label>}
      <textarea 
        id={textareaId} 
        className={clsx(styles.textarea, error && styles.hasError)} 
        {...props} 
      />
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
};