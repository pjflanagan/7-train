'use client';
import React from 'react';
import clsx from 'clsx';
import styles from './SegmentedControl.module.scss';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  name,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={clsx(styles.control, className)} role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          name={name}
          className={clsx(styles.segment, value === option.value && styles.active)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
