import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

  const [isTodayVisible, setIsTodayVisible] = useState(true);
  /** Which way to scroll to reach today, so the jump control can point there. */
  const [todayDirection, setTodayDirection] = useState<'up' | 'down'>('up');

  const scrollToToday = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const target = todayRef.current;
      const scroller = getScroller();
      if (!target || !scroller) return;
      scroller.scrollTo({ top: target.offsetTop - scroller.offsetTop, behavior });
    },
    [getScroller]
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

  /**
   * Land on today again once the cards above it have settled.
   *
   * The first pass runs before a day above today knows how tall it is — a
   * weather line arrives, a card grows — and every pixel a card above gains
   * pushes today further down the page. Re-asserting the position after the
   * layout settles is what makes "opens on today" true rather than
   * approximately true.
   */
  useEffect(() => {
    const scroller = getScroller();
    const target = todayRef.current;
    if (!scroller || !target) return;

    let settled = false;
    const observer = new ResizeObserver(() => {
      if (settled) return;
      scroller.scrollTop = target.offsetTop - scroller.offsetTop;
    });
    observer.observe(scroller);
    for (const child of Array.from(scroller.children)) observer.observe(child);

    // Only until the user could plausibly have scrolled themselves; after that,
    // yanking the page back to today would be the app fighting them.
    const stop = setTimeout(() => {
      settled = true;
      observer.disconnect();
    }, 1000);

    const release = () => {
      settled = true;
    };
    // Any deliberate act — a scroll, a tap, "show more past days" — hands the
    // position back to the user.
    scroller.addEventListener('wheel', release, { passive: true });
    scroller.addEventListener('pointerdown', release, { passive: true });
    scroller.addEventListener('keydown', release);

    return () => {
      clearTimeout(stop);
      observer.disconnect();
      scroller.removeEventListener('wheel', release);
      scroller.removeEventListener('pointerdown', release);
      scroller.removeEventListener('keydown', release);
    };
    // Deliberately mount-only: this is about the first paint settling down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whether today is on screen, for the jump control.
  useEffect(() => {
    const target = todayRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTodayVisible(entry.isIntersecting);
        if (!entry.isIntersecting && entry.rootBounds) {
          setTodayDirection(
            entry.boundingClientRect.top < entry.rootBounds.top ? 'up' : 'down'
          );
        }
      },
      { root: getScroller() ?? null }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [getScroller, days]);

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

  return {
    days,
    scrollRef,
    todayRef,
    loadEarlier,
    loadLater,
    isTodayVisible,
    todayDirection,
    scrollToToday,
  };
}
