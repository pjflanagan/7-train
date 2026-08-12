import { create } from 'zustand';
import { useEffect, useRef } from 'react';

export interface WeatherDay {
  date: string; // YYYY-MM-DD
  code: number;
  tempMax: number;
}

export interface WeatherData {
  location: { city: string; lat: number; lon: number };
  unit: string;
  days: WeatherDay[];
}

interface WeatherStore {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
  fetchWeather: (lat?: number, lon?: number) => Promise<void>;
}

export const useWeatherStore = create<WeatherStore>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetchWeather: async (lat, lon) => {
    set({ loading: true, error: null });
    try {
      const url = lat && lon ? `/api/weather?lat=${lat}&lon=${lon}` : '/api/weather';
      const res = await fetch(url);
      
      if (!res.ok) {
        if (res.status === 400 && !lat && !lon && 'geolocation' in navigator) {
          // Attempt geolocation fallback
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const urlGeo = `/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`;
              const resGeo = await fetch(urlGeo);
              if (resGeo.ok) {
                const jsonGeo = await resGeo.json();
                set({ data: jsonGeo, loading: false });
              } else {
                set({ error: 'Failed to load weather with location', loading: false });
              }
            },
            () => {
              set({ error: 'Location access denied', loading: false });
            }
          );
          return;
        }
        throw new Error('Failed to load weather');
      }

      const json = await res.json();
      set({ data: json, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Error fetching weather', loading: false });
    }
  }
}));

export function useInitWeather() {
  const fetchWeather = useWeatherStore(s => s.fetchWeather);
  const fetched = useRef(false);

  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true;
      fetchWeather();
    }
  }, [fetchWeather]);
}

export function useWeather() {
  const store = useWeatherStore();
  return store;
}
