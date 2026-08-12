import { useEffect, useState } from 'react';

/** Mirrors `$bp-mobile` in `styles/_breakpoints.scss`. */
const MOBILE_QUERY = '(max-width: 768px)';

/**
 * True on phone-sized viewports. Starts false so server and first client render
 * agree; the real value lands in an effect, behind the same hydration gate the
 * planner already waits on.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isMobile;
}
