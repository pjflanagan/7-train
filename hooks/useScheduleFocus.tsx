'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

/**
 * One-way latch: the first time the schedule is touched (scrolled, clicked, or
 * focused) the chrome around it collapses and stays collapsed for the session.
 * Deliberately never resets — a header that grew back would shove the feed the
 * user is reading.
 */
const ScheduleFocusContext = createContext<{
  isScheduleFocused: boolean;
  focusSchedule: () => void;
}>({ isScheduleFocused: false, focusSchedule: () => {} });

export function ScheduleFocusProvider({ children }: { children: React.ReactNode }) {
  const [isScheduleFocused, setIsScheduleFocused] = useState(false);
  const focusSchedule = useCallback(() => setIsScheduleFocused(true), []);

  return (
    <ScheduleFocusContext.Provider value={{ isScheduleFocused, focusSchedule }}>
      {children}
    </ScheduleFocusContext.Provider>
  );
}

export function useScheduleFocus() {
  return useContext(ScheduleFocusContext);
}

/** Handlers to spread onto the schedule's scroll container. */
export function useScheduleFocusTriggers() {
  const { focusSchedule } = useScheduleFocus();
  // User gestures only — `scroll` also fires for the programmatic jump to the
  // current week on mount, which would collapse the header before any input.
  return {
    onWheel: focusSchedule,
    onTouchMove: focusSchedule,
    onPointerDown: focusSchedule,
    onKeyDown: focusSchedule,
    onFocus: focusSchedule,
  };
}
