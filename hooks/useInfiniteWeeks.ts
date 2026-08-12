import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addWeeks } from '@/lib/dates';

/** Weeks rendered on either side of the current one at first paint. */
const INITIAL_BEFORE = 1;
const INITIAL_AFTER = 1;
/** How many weeks to tack on each time a sentinel comes into view. */
const PAGE_SIZE = 1;

export interface InfiniteWeeksOptions {
  /** Week key (YYYY-MM-DD) for the week containing today. */
  currentWeekStart: string;
}

/**
 * Grows a window of week keys in both directions as the user scrolls.
 *
 * Prepending weeks above the viewport would shove the content down, so the
 * scroll offset is corrected in useLayoutEffect (before paint) by the exact
 * height the new weeks added.
 */
export function useInfiniteWeeks({ currentWeekStart }: InfiniteWeeksOptions) {
  const [before, setBefore] = useState(INITIAL_BEFORE);
  const [after, setAfter] = useState(INITIAL_AFTER);

  const scrollRef = useRef<HTMLElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
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
  const [hasLanded, setHasLanded] = useState(false);

  useLayoutEffect(() => {
    if (didInitialScroll.current) return;
    const target = currentWeekRef.current;
    const scroller = getScroller();
    if (!target || !scroller) return;

    didInitialScroll.current = true;
    scroller.scrollTop = target.offsetTop - scroller.offsetTop;
    setHasLanded(true);
  }, [getScroller]);

  useLayoutEffect(() => {
    if (!pendingPrepend.current) return;
    const scroller = getScroller();
    if (!scroller) return;

    pendingPrepend.current = false;
    const added = scroller.scrollHeight - prevScrollHeight.current;
    scroller.scrollTop = prevScrollTop.current + added;
  }, [weeks, getScroller]);

  useEffect(() => {
    // Don't start observing until the initial scroll has landed, or the top
    // sentinel would be on-screen and immediately page in more weeks.
    if (!hasLanded) return;

    const scroller = getScroller();
    const top = topSentinelRef.current;
    const bottom = bottomSentinelRef.current;
    if (!top || !bottom) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          if (entry.target === top) {
            const el = getScroller();
            if (el) {
              pendingPrepend.current = true;
              prevScrollHeight.current = el.scrollHeight;
              prevScrollTop.current = el.scrollTop;
            }
            setBefore((n) => n + PAGE_SIZE);
          } else if (entry.target === bottom) {
            setAfter((n) => n + PAGE_SIZE);
          }
        });
      },
      { root: scroller ?? null, rootMargin: '200px' }
    );

    observer.observe(top);
    observer.observe(bottom);
    return () => observer.disconnect();
  }, [getScroller, weeks, hasLanded]);

  // Whether the current week is on screen, so the caller can offer a way back.
  const [isCurrentWeekVisible, setIsCurrentWeekVisible] = useState(true);

  useEffect(() => {
    const target = currentWeekRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsCurrentWeekVisible(entry.isIntersecting),
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
    topSentinelRef,
    bottomSentinelRef,
    currentWeekRef,
    isCurrentWeekVisible,
    scrollToCurrentWeek,
  };
}
