import {
  LuSun,
  LuCloud,
  LuCloudFog,
  LuCloudRain,
  LuCloudDrizzle,
  LuSnowflake,
  LuCloudLightning,
  LuCircleHelp
} from 'react-icons/lu';
import { IconType } from 'react-icons';

export type WeatherDetails = {
  icon: IconType;
  desc: string;
  color: string;
};

export function getWeatherDetails(code: number): WeatherDetails {
  if (code === 0) {
    return { icon: LuSun, desc: 'Sunny', color: '#f59e0b' };
  }
  if (code >= 1 && code <= 3) {
    return { icon: LuCloud, desc: 'Partly Cloudy', color: '#94a3b8' };
  }
  if (code === 45 || code === 48) {
    return { icon: LuCloudFog, desc: 'Foggy', color: '#64748b' };
  }
  if ((code >= 51 && code <= 55) || (code >= 61 && code <= 65)) {
    return { icon: LuCloudRain, desc: 'Raining', color: '#3b82f6' };
  }
  if ((code >= 56 && code <= 57) || (code >= 66 && code <= 67) || (code >= 80 && code <= 82)) {
    return { icon: LuCloudDrizzle, desc: 'Showers', color: '#60a5fa' };
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return { icon: LuSnowflake, desc: 'Snowing', color: '#22d3ee' };
  }
  if (code >= 95 && code <= 99) {
    return { icon: LuCloudLightning, desc: 'Thunderstorms', color: '#eab308' };
  }
  return { icon: LuCircleHelp, desc: 'Unknown', color: '#94a3b8' };
}
