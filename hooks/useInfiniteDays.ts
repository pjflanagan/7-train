import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addDays } from '@/lib/dates';

/** Days kept above today before the user asks for more. */
export const INITIAL_BEFORE = 3;
/** Days kept below today before the user asks for more. */
export const INITIAL_AFTER = 20;
/** Days added each time "load more" is pressed, in either direction. */
export const DAY_PAGE_SIZE = 14;

/**
 * The mobile counterpart to `useInfiniteWeeks`: a bounded window of date keys
 * centred on today, growing only when the caller asks. Prepending days above
 * the viewport would shove the content down, so the scroll offset is corrected
 * before paint by the exact height the new days added.
 */
export function useInfiniteDays({ todayKey }: { todayKey: string }) {
  const [before, setBefore] = useState(INITIAL_BEFORE);
  const [after, setAfter] = useState(INITIAL_AFTER);

  const scrollRef = useRef<HTMLElement | null>(null);
  const todayRef = useRef<HTMLDivElement | null>(null);

  const pendingPrepend = useRef(false);
  const prevScrollHeight = useRef(0);
  const prevScrollTop = useRef(0);
  const didInitialScroll = useRef(false);

  const days = useMemo(() => {
    const keys: string[] = [];
    for (let offset = -before; offset <= after; offset++) {
      keys.push(addDays(todayKey, offset));
    }
    return keys;
  }, [before, after, todayKey]);

  const getScroller = useCallback(
    () => scrollRef.current ?? (document.scrollingElement as HTMLElement | null),
    []
  );

  // Land the user on today, with the past sitting just above it.
  useLayoutEffect(() => {
    if (didInitialScroll.current) return;
    const target = todayRef.current;
    const scroller = getScroller();
    if (!target || !scroller) return;

    didInitialScroll.current = true;
    scroller.scrollTop = target.offsetTop - scroller.offsetTop;
  }, [getScroller]);

  useLayoutEffect(() => {
    if (!pendingPrepend.current) return;
    const scroller = getScroller();
    if (!scroller) return;

    pendingPrepend.current = false;
    const added = scroller.scrollHeight - prevScrollHeight.current;
    scroller.scrollTop = prevScrollTop.current + added;
  }, [days, getScroller]);

  /** Reveal another page of earlier days, holding the viewport still. */
  const loadEarlier = useCallback(() => {
    const el = getScroller();
    if (el) {
      pendingPrepend.current = true;
      prevScrollHeight.current = el.scrollHeight;
      prevScrollTop.current = el.scrollTop;
    }
    setBefore((n) => n + DAY_PAGE_SIZE);
  }, [getScroller]);

  /** Reveal another page of upcoming days. */
  const loadLater = useCallback(() => setAfter((n) => n + DAY_PAGE_SIZE), []);

  return { days, scrollRef, todayRef, loadEarlier, loadLater };
}
