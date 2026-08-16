import { describe, expect, it } from 'vitest';
import { COPY } from '@/lib/copy';
import { DEFAULT_ACTIVITIES, getDefaultEvents } from '@/lib/seed';
import { getWeekStartKey } from '@/lib/dates';

/**
 * `AGENTS.md` requires sentence case in every user-facing string, and until
 * this test nothing enforced it — the rule held only as long as everyone
 * remembered. Four strings had already drifted.
 */

/**
 * Words allowed a capital mid-sentence: proper nouns and acronyms. Anything
 * else with two capitalised words in a row is title case.
 */
const PROPER_NOUNS = [
  'Google',
  'Calendar',
  'Sheets',
  'Strava',
  'Drive',
  'CSV',
  'URL',
  'Workouts',
  'Run',
  'Recovery',
  'Running',
  'Lifting',
  'Racquet',
  'Long',
];

/** Every string in the tree, with the path that reached it. */
function walk(node: unknown, path: string[] = []): Array<[string, string]> {
  if (typeof node === 'string') return [[path.join('.'), node]];
  if (typeof node === 'function') return [];
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => walk(value, [...path, key]));
  }
  return [];
}

const entries = walk(COPY);

describe('copy', () => {
  it('has strings to check', () => {
    expect(entries.length).toBeGreaterThan(50);
  });

  it.each(entries)('%s is sentence case', (path, text) => {
    // Strip the words that are allowed their capital, then look for what is
    // left: a capitalised word that is not the first word of a sentence.
    let rest = text;
    for (const noun of PROPER_NOUNS) {
      rest = rest.replaceAll(noun, noun.toLowerCase());
    }
    // Anything starting a sentence, or a quoted phrase, may capitalise.
    rest = rest.replace(/(^|[.!?:;]\s+|["“(]\s*)([A-Z])/g, (_, lead) => `${lead}x`);

    const offender = rest.match(/\b[A-Z][a-z]+/);
    expect(offender?.[0], `"${text}" (${path}) looks like title case`).toBeUndefined();
  });

  it('does not end a label with a full stop', () => {
    // Sentences may; buttons, headings and placeholders may not.
    const labels = entries.filter(
      ([path]) => !/message|blurb|description|hint|Failed|reauth|pullFailed/i.test(path)
    );
    for (const [path, text] of labels) {
      expect(text.endsWith('.'), `${path} ends with a full stop`).toBe(false);
    }
  });
});

describe('seed data', () => {
  it("only uses workout types the seeded activity actually has", () => {
    // `getDefaultEvents` used to hand out `workoutType: 'Long run'` while the
    // Run activity offered `['Long', 'Tempo']` — the same list of strings
    // written twice, 110 lines apart, and drifted.
    const events = getDefaultEvents(getWeekStartKey(new Date(), 1));

    for (const event of events) {
      if (!event.workoutType) continue;
      const activity = DEFAULT_ACTIVITIES.find((a) => a.id === event.typeId);
      expect(activity, `no seeded activity ${event.typeId}`).toBeDefined();
      expect(activity!.workoutTypes).toContain(event.workoutType);
    }
  });

  it('seeds an activity for every seeded event', () => {
    const ids = new Set(DEFAULT_ACTIVITIES.map((a) => a.id));
    for (const event of getDefaultEvents(getWeekStartKey(new Date(), 1))) {
      expect(ids.has(event.typeId), `${event.typeId} is not a seeded activity`).toBe(true);
    }
  });
});
