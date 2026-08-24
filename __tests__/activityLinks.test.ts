import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAllActivityLinks } from '@/hooks/usePlannerSelectors';
import { usePlannerStore } from '@/lib/store';
import { weekActivityKey } from '@/lib/progress';
import { Activity } from '@/lib/types';

/**
 * The links list, which is now a reading of what the activities carry rather
 * than a second set of bookmarks kept beside them.
 */

const swim: Activity = {
  id: 'type-swim',
  name: 'Swim',
  icon: 'swim',
  metric: 'distance',
  unit: 'yards',
  target: 4000,
  color: '#00A2C7',
  workoutTypes: [],
  links: [{ id: 'l1', title: 'How to swim', url: 'https://example.com/swim' }],
};

const run: Activity = {
  id: 'type-run',
  name: 'Run',
  icon: 'run',
  metric: 'distance',
  unit: 'miles',
  target: 12,
  color: '#E5484D',
  workoutTypes: [],
  links: [{ id: 'l2', title: 'Track hours', url: 'https://example.com/track' }],
};

const links = () => renderHook(() => useAllActivityLinks()).result.current;

describe('useAllActivityLinks', () => {
  beforeEach(() => {
    usePlannerStore.getState().clearForSignOut();
  });

  it('gathers the links off "My activities", under the activity they are on', () => {
    usePlannerStore.setState({ activities: [swim, run] });

    expect(links()).toEqual([
      { activityId: 'type-swim', name: 'Swim', icon: 'swim', color: '#00A2C7', links: swim.links },
      { activityId: 'type-run', name: 'Run', icon: 'run', color: '#E5484D', links: run.links },
    ]);
  });

  it('leaves out an activity carrying no links', () => {
    usePlannerStore.setState({ activities: [{ ...swim, links: [] }, run] });
    expect(links().map((entry) => entry.activityId)).toEqual(['type-run']);
  });

  it("keeps a week's links for an activity the template has dropped", () => {
    // A link on last month's activity is still a link the user put there, and
    // the week that aims at it is still in the plan.
    usePlannerStore.setState({
      activities: [run],
      weekActivities: { [weekActivityKey('2026-08-24', swim.id)]: swim },
    });
    expect(links().map((entry) => entry.activityId)).toEqual(['type-run', 'type-swim']);
  });

  it('says a link once, however many weeks are aiming at it', () => {
    // Every week holds its own copy of the activity, so the same link arrives
    // once per week.
    usePlannerStore.setState({
      activities: [swim],
      weekActivities: {
        [weekActivityKey('2026-08-17', swim.id)]: swim,
        [weekActivityKey('2026-08-24', swim.id)]: swim,
      },
    });
    expect(links()).toHaveLength(1);
    expect(links()[0].links).toHaveLength(1);
  });

  it("takes a week's extra link as well as the template's", () => {
    const weekSwim: Activity = {
      ...swim,
      links: [...(swim.links ?? []), { id: 'l3', title: 'Pool hours', url: 'https://example.com/pool' }],
    };
    usePlannerStore.setState({
      activities: [swim],
      weekActivities: { [weekActivityKey('2026-08-24', swim.id)]: weekSwim },
    });
    expect(links()[0].links.map((link) => link.url)).toEqual([
      'https://example.com/swim',
      'https://example.com/pool',
    ]);
  });

  it('is empty when nothing carries a link', () => {
    usePlannerStore.setState({ activities: [{ ...run, links: undefined }] });
    expect(links()).toEqual([]);
  });
});
