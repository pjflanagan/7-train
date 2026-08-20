/**
 * Whether an edit is really an edit.
 *
 * Everything downstream of the store treats a new object as a change: React
 * re-renders on it, `persist` writes it to `localStorage`, and both sync loops
 * watch for it and start a countdown to a write. So a save that saves nothing —
 * closing the activity form without touching a field, blurring a number input
 * on the number that was already there, a pull that brings back exactly what we
 * sent — is not free. It costs a write, a wire message, and a header that
 * announces syncing when nothing happened.
 *
 * The cheapest place to stop that is the moment before the store changes, which
 * is what these are for.
 */

/** Nothing at all, however it was spelled. */
function isNothing(value: unknown): boolean {
  return value === undefined || value === null;
}

/**
 * Whether two values the store could hold are the same value.
 *
 * Deep, and blind to key order: a form hands back the same activity with its
 * fields in whatever order the schema lists them, which is not a change to the
 * activity. Arrays are compared in order, because their order is meaningful
 * here — workout types and activities are lists the user arranged.
 *
 * `null`, `undefined` and an absent key are all one absence. The schema uses
 * all three for the same thing — an activity saved before `optional` existed,
 * an event with no workout type, a pace nobody set — and calling them different
 * would report an edit every time a form filled in a blank with `null`.
 */
export function isSameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (isNothing(a) || isNothing(b)) return isNothing(a) && isNothing(b);

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => isSameValue(item, b[index]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].every(key => isSameValue(left[key], right[key]));
  }

  return false;
}

/**
 * Whether applying `updates` would leave `current` exactly as it stands.
 *
 * Only the keys the update carries are looked at — a partial update says
 * nothing about the fields it omits, so they cannot differ.
 */
export function isSameUpdate<T extends object>(current: T, updates: Partial<T>): boolean {
  return (Object.keys(updates) as (keyof T)[]).every(key =>
    isSameValue(current[key], updates[key])
  );
}
