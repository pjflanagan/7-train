import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';
import { usePlannerDnd, PlannerDndData } from '@/hooks/usePlannerDnd';
import { usePlannerStore } from '@/lib/store';
import { addWeeks, getWeekStartKey } from '@/lib/dates';

const thisWeek = getWeekStartKey(new Date(), 1);
const nextWeek = addWeeks(thisWeek, 1);

const events = () => usePlannerStore.getState().events;
const moved = () => events().find(i => i.typeId === 'moving')!;

/** The shape dnd-kit hands the drop handler, cut down to what it reads. */
const drop = (active: PlannerDndData, over: PlannerDndData) =>
  ({
    active: { id: active.eventId ?? 'active', data: { current: active } },
    over: { id: over.eventId ?? 'over', data: { current: over } },
  }) as unknown as DragEndEvent;

const dragged = (): PlannerDndData => ({
  kind: 'event',
  eventId: moved().id,
  day: moved().day,
  weekStart: moved().weekStart,
});

describe('dragging a workout into another week', () => {
  beforeEach(() => {
    usePlannerStore.getState().resetAll();
    const activity = usePlannerStore.getState().activities[0];
    usePlannerStore.setState({
      activities: [{ ...activity, id: 'moving' }, { ...activity, id: 'sitting' }],
      events: [],
    });
    // The workout being dragged, and one already sitting in next week's Friday
    // for it to be dropped onto.
    usePlannerStore.getState().addEvent({
      typeId: 'moving',
      day: 'wednesday',
      weekStart: thisWeek,
      value: 3,
    });
    usePlannerStore.getState().addEvent({
      typeId: 'sitting',
      day: 'friday',
      weekStart: nextWeek,
      value: 3,
    });
  });

  it('lands on the day it was dropped on in the other week', () => {
    const { result } = renderHook(() => usePlannerDnd());

    result.current.handleDragEnd(
      drop(dragged(), { kind: 'column', day: 'friday', weekStart: nextWeek })
    );

    expect(moved().day).toBe('friday');
    expect(moved().weekStart).toBe(nextWeek);
  });

  it('lands beside a workout already in the other week', () => {
    const { result } = renderHook(() => usePlannerDnd());
    const sitting = events().find(i => i.typeId === 'sitting')!;

    result.current.handleDragEnd(
      drop(dragged(), {
        kind: 'event',
        eventId: sitting.id,
        day: 'friday',
        weekStart: nextWeek,
      })
    );

    expect(moved().day).toBe('friday');
    expect(moved().weekStart).toBe(nextWeek);
    expect(events()).toHaveLength(2);
  });

  // Each drop is its own render: the handler reads the schedule it was rendered
  // with, so the second drag has to see what the first one did.
  it('goes back the way it came', () => {
    const { result } = renderHook(() => usePlannerDnd());

    act(() => {
      result.current.handleDragEnd(
        drop(dragged(), { kind: 'column', day: 'monday', weekStart: nextWeek })
      );
    });
    act(() => {
      result.current.handleDragEnd(
        drop(dragged(), { kind: 'column', day: 'wednesday', weekStart: thisWeek })
      );
    });

    expect(moved().day).toBe('wednesday');
    expect(moved().weekStart).toBe(thisWeek);
  });
});
