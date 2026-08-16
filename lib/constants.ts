/**
 * The words and values the whole app is built on.
 *
 * Seed data used to live here too, which forced `lib/dates.ts` to import
 * `DAYS` from a module full of activities and events — and forced this module
 * to stay clear of `lib/dates`, because that would have been a cycle. The
 * seeds are in `lib/seed.ts` now and `DAYS` is where it belongs.
 */

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/**
 * Activity colors. Held around the same lightness so no chip reads as louder than
 * its neighbours, and mid-toned enough to stay legible on both themes.
 */
export const PRESET_COLORS = [
  '#E5484D', // red
  '#F76B15', // orange
  '#FFB224', // amber
  '#9BBF2E', // lime
  '#30A46C', // green
  '#12A594', // teal
  '#00A2C7', // cyan
  '#3E63DD', // blue
  '#5B5BD6', // indigo
  '#8E4EC6', // violet
  '#D6409F', // pink
  '#8B8D98'  // slate
];
