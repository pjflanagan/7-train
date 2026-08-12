'use client';
import React from 'react';
import clsx from 'clsx';
import styles from './Select.module.scss';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select: React.FC<SelectProps> = ({ 
  label, 
  className, 
  id,
  ...props 
}) => {
  const generatedId = React.useId();
  const selectId = id || generatedId;
  
  return (
    <div className={clsx(styles.wrapper, className)}>
      {label && <label htmlFor={selectId} className={styles.label}>{label}</label>}
      <select id={selectId} className={styles.select} {...props} />
    </div>
  );
};