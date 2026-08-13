'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import styles from './InlineNumberInput.module.scss';

export interface InlineNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onLiveChange?: (val: number | null) => void;
  onCommit: (val: number) => void;
}

export const InlineNumberInput: React.FC<InlineNumberInputProps> = ({
  value,
  onLiveChange,
  onCommit,
  className,
  onBlur,
  onKeyDown,
  ...props
}) => {
  const [prevValue, setPrevValue] = useState<number>(value);
  const [localValue, setLocalValue] = useState<string>(value.toString());

  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value.toString());
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);

    if (raw === '') {
      onLiveChange?.(null);
      return;
    }
    const num = Number(raw);
    if (!isNaN(num)) {
      onLiveChange?.(num);
    }
  };

  const handleCommit = () => {
    let num = Number(localValue);
    if (localValue === '' || isNaN(num)) {
      num = value; // revert to original
      setLocalValue(value.toString());
    }
    onCommit(num);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    handleCommit();
    onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalValue(value.toString());
      e.currentTarget.blur();
    }
    onKeyDown?.(e);
  };

  return (
    <input
      type="text"
      className={clsx(styles.input, className)}
      value={localValue}
      // Grows with what's typed, so a wide number like "5000" gets room
      // rather than sitting clipped inside a box sized for two digits.
      size={Math.max(2, localValue.length)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
};