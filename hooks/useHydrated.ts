import { useState, useEffect } from 'react';

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    setTimeout(() => {
      if (active) setHydrated(true);
    }, 0);
    return () => {
      active = false;
    };
  }, []);
  return hydrated;
}
