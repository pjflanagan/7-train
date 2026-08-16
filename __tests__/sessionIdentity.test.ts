import { describe, expect, it } from 'vitest';
import { isUsableGoogleSub } from '@/lib/sessionServer';

/**
 * The database keys every row off this string, so it has to be Google's own id
 * for the account and nothing else.
 *
 * What actually happened: `readSessionIdentity` returned `token.sub`, and with
 * the JWT strategy and no adapter Auth.js mints a fresh UUID for that on every
 * sign in. One person signing in five times became five `users` rows, five
 * `accounts` rows, and — the part that would have hurt — a returning user
 * handed an empty settings row that did not know which calendar was theirs.
 *
 * The unique indexes were never the problem. They did exactly their job on a
 * key that was wrong.
 */
describe('isUsableGoogleSub', () => {
  it('accepts a Google subject claim', () => {
    expect(isUsableGoogleSub('104839571236547890123')).toBe(true);
  });

  it('rejects the per-sign-in UUID that caused the duplicates', () => {
    expect(isUsableGoogleSub('c43a023e-d5ad-4e2f-b5ee-d1934e8c314c')).toBe(false);
    expect(isUsableGoogleSub('29910E4F-8746-401A-BF70-D66604F45DCF')).toBe(false);
  });

  it('rejects nothing at all', () => {
    expect(isUsableGoogleSub('')).toBe(false);
    expect(isUsableGoogleSub(undefined)).toBe(false);
    expect(isUsableGoogleSub(null)).toBe(false);
  });

  it('does not police Google id formats beyond that', () => {
    // Google documents `sub` as a string of up to 255 characters. It is
    // numeric today, and this must not break if that ever stops being true.
    expect(isUsableGoogleSub('abc123')).toBe(true);
  });
});
