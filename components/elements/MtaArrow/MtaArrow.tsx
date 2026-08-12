import React from 'react';
import { MdArrowForward } from 'react-icons/md';
import styles from './MtaArrow.module.scss';

export interface MtaArrowProps {
  direction: 'left' | 'right';
  size?: number;
  className?: string;
}

/**
 * The station directional arrow: a white arrow on a black disc, the same mark
 * that points riders down the platform.
 */
export const MtaArrow: React.FC<MtaArrowProps> = ({ direction, size = 24, className }) => (
  <span
    className={className ? `${styles.disc} ${className}` : styles.disc}
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <MdArrowForward
      size={size * 0.68}
      style={direction === 'left' ? { transform: 'rotate(180deg)' } : undefined}
    />
  </span>
);
