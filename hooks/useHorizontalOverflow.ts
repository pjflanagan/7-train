'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks whether a horizontal scroller has content hidden off either edge, and
 * hands back a paging scroller for the arrow controls.
 */
export function useHorizontalOverflow<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Sub-pixel layout means the right edge never lands exactly on zero.
    const slack = 1;
    setCanScrollLeft(el.scrollLeft > slack);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - slack);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    measure();
    el.addEventListener('scroll', measure, { passive: true });

    // Catches both the viewport resizing and activities being added or removed.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));

    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  const scrollBy = useCallback((direction: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }, []);

  return { ref, canScrollLeft, canScrollRight, scrollBy, measure };
}
