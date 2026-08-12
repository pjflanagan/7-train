import React from 'react';
import { getWeatherDetails } from '../../../lib/weather';
import styles from './WeatherPill.module.scss';

interface WeatherPillProps {
  code: number;
  tempMax: number;
  unit: string;
}

export const WeatherPill: React.FC<WeatherPillProps> = ({ code, tempMax, unit }) => {
  const { icon: Icon, desc, color } = getWeatherDetails(code);

  return (
    <div className={styles.pill} title={desc}>
      <Icon className={styles.icon} style={{ color }} />
      <span className={styles.temp}>{tempMax}{unit}</span>
    </div>
  );
};
