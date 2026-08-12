'use client';

import React from 'react';
import clsx from 'clsx';
import { PRESET_COLORS } from '../../../lib/constants';
import styles from './ColorPicker.module.scss';

export interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  className?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ 
  value, 
  onChange,
  className 
}) => {
  return (
    <div className={clsx(styles.grid, className)}>
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={clsx(styles.colorButton, value === color && styles.selected)}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          aria-label={`Select color ${color}`}
        />
      ))}
    </div>
  );
};