import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addWeeks } from '@/lib/dates';

// Tuning knobs for how much of the calendar is reachable at a time.
/** Weeks kept above the current one before the user asks for more. */
export const INITIAL_BEFORE = 1;
/** Weeks kept below the current one before the user asks for more. */
export const INITIAL_AFTER = 6;
/** Weeks added each time "load more" is pressed, in either direction. */
export const PAGE_SIZE = 6;

export interface InfiniteWeeksOptions {
  /** Week key (YYYY-MM-DD) for the week containing today. */
  currentWeekStart: string;
}

/**
 * Holds a bounded window of week keys. The window only grows when the caller
 * presses one of the load-more controls, so scrolling can never run away in
 * either direction.
 *
 * Prepending weeks above the viewport would shove the content down, so the
 * scroll offset is corrected in useLayoutEffect (before paint) by the exact
 * height the new weeks added.
 */
export function useInfiniteWeeks({ currentWeekStart }: InfiniteWeeksOptions) {
  const [before, setBefore] = useState(INITIAL_BEFORE);
  const [after, setAfter] = useState(INITIAL_AFTER);

  const scrollRef = useRef<HTMLElement | null>(null);
  const currentWeekRef = useRef<HTMLDivElement | null>(null);

  // Height bookkeeping so a prepend doesn't visibly jump the viewport.
  const pendingPrepend = useRef(false);
  const prevScrollHeight = useRef(0);
  const prevScrollTop = useRef(0);
  const didInitialScroll = useRef(false);

  const weeks = useMemo(() => {
    const keys: string[] = [];
    for (let offset = -before; offset <= after; offset++) {
      keys.push(addWeeks(currentWeekStart, offset));
    }
    return keys;
  }, [before, after, currentWeekStart]);

  const getScroller = useCallback(
    () => scrollRef.current ?? (document.scrollingElement as HTMLElement | null),
    []
  );

  // Start the user on the current week, with last week sitting just above.
  // Tracked in state (not just a ref) so the observers below reliably attach
  // once the landing scroll is done, rather than depending on effect ordering.

  useLayoutEffect(() => {
    if (didInitialScroll.current) return;
    const target = currentWeekRef.current;
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
  }, [weeks, getScroller]);

  /** Reveal another page of older weeks, holding the viewport still. */
  const loadEarlier = useCallback(() => {
    const el = getScroller();
    if (el) {
      pendingPrepend.current = true;
      prevScrollHeight.current = el.scrollHeight;
      prevScrollTop.current = el.scrollTop;
    }
    setBefore((n) => n + PAGE_SIZE);
  }, [getScroller]);

  /** Reveal another page of upcoming weeks. */
  const loadLater = useCallback(() => setAfter((n) => n + PAGE_SIZE), []);

  // Whether the current week is on screen, so the caller can offer a way back.
  const [isCurrentWeekVisible, setIsCurrentWeekVisible] = useState(true);
  // Which way to scroll to reach it, so the "jump back" control can point there.
  const [currentWeekDirection, setCurrentWeekDirection] = useState<'up' | 'down'>('down');

  useEffect(() => {
    const target = currentWeekRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCurrentWeekVisible(entry.isIntersecting);
        if (!entry.isIntersecting && entry.rootBounds) {
          setCurrentWeekDirection(
            entry.boundingClientRect.top < entry.rootBounds.top ? 'up' : 'down'
          );
        }
      },
      { root: getScroller() ?? null }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [getScroller, weeks]);

  const scrollToCurrentWeek = useCallback(() => {
    const target = currentWeekRef.current;
    const scroller = getScroller();
    if (!target || !scroller) return;
    scroller.scrollTo({
      top: target.offsetTop - scroller.offsetTop,
      behavior: 'smooth',
    });
  }, [getScroller]);

  return {
    weeks,
    scrollRef,
    currentWeekRef,
    loadEarlier,
    loadLater,
    isCurrentWeekVisible,
    currentWeekDirection,
    scrollToCurrentWeek,
  };
}
