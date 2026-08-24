import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SignInModal } from '@/components/PlannerPage/SignInModal/SignInModal';
import { COPY } from '@/lib/copy';

/**
 * The door a signed out browser gets instead of a planner.
 *
 * It exists because the browser caches nothing: a signed out planner would be
 * an empty week that forgets every edit on reload, which looks like it is
 * working right up until it loses something. See `_docs/storage.md`.
 */

const configured = { value: true };

vi.mock('@/hooks/useAuth', () => ({
  useIsGoogleAuthConfigured: () => configured.value,
  signInWithGoogle: vi.fn(),
}));

describe('SignInModal', () => {
  // The modal portals into `document.body`, which outlives a render — without
  // this the second case reads the first one's button.
  afterEach(cleanup);

  it('offers the sign in, and no way past it', async () => {
    configured.value = true;
    render(<SignInModal />);

    // The modal element mounts on a tick of its own, so everything here waits
    // for it rather than reading an empty document.
    expect(await screen.findByText(COPY.signIn.title)).toBeTruthy();
    expect(screen.getByRole('button', { name: COPY.account.signIn })).toBeTruthy();
    // Dismissing it would leave an empty page, so there is nothing to dismiss
    // it with.
    expect(screen.queryByRole('button', { name: COPY.modal.close })).toBeNull();
  });

  it('says so rather than offering a sign in that can only fail', async () => {
    // A deployment with no Google credentials. `/api/auth/session` can only
    // 500, so the button would be a dead end.
    configured.value = false;
    render(<SignInModal />);

    expect(await screen.findByText(COPY.signIn.notConfiguredMessage)).toBeTruthy();
    expect(screen.queryByRole('button', { name: COPY.account.signIn })).toBeNull();
  });
});
