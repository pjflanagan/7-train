'use client';

import React, { createContext, useContext } from 'react';
import { SessionContext, SessionProvider, signIn, useSession } from 'next-auth/react';
import {
  GOOGLE_INTEGRATIONS,
  GoogleIntegration,
  isIntegrationConnected,
  scopeRequestFor,
} from '@/lib/google';

/**
 * The planner works fully signed out, so a deployment without Google
 * credentials should not advertise a sign in that can only fail. The layout
 * reads the credentials server side and hands the answer down.
 */
const GoogleAuthConfiguredContext = createContext(false);

/** What `useSession` sees when there is no auth backend to ask. */
const SIGNED_OUT_SESSION = {
  data: null,
  status: 'unauthenticated',
  update: async () => null,
} as const;

export function AuthProvider({
  isGoogleAuthConfigured,
  children,
}: {
  isGoogleAuthConfigured: boolean;
  children: React.ReactNode;
}) {
  return (
    <GoogleAuthConfiguredContext.Provider value={isGoogleAuthConfigured}>
      {isGoogleAuthConfigured ? (
        <SessionProvider>{children}</SessionProvider>
      ) : (
        // Without credentials `/api/auth/session` can only answer with a 500,
        // so skip the provider and hand the hooks a settled signed-out value.
        <SessionContext.Provider value={SIGNED_OUT_SESSION}>{children}</SessionContext.Provider>
      )}
    </GoogleAuthConfiguredContext.Provider>
  );
}

export function useIsGoogleAuthConfigured() {
  return useContext(GoogleAuthConfiguredContext);
}

export interface GoogleAccount {
  name: string | null;
  email: string | null;
  image: string | null;
  isSignedIn: boolean;
  /** True until the session request settles — render a placeholder, not a signed-out state. */
  isLoading: boolean;
  /** Google scopes granted so far. */
  scopes: string[];
  /** The refresh token stopped working; Google access needs a fresh sign in. */
  needsReauth: boolean;
}

export function useGoogleAccount(): GoogleAccount {
  const { data: session, status } = useSession();

  return {
    name: session?.user?.name ?? null,
    email: session?.user?.email ?? null,
    image: session?.user?.image ?? null,
    isSignedIn: status === 'authenticated',
    isLoading: status === 'loading',
    scopes: session?.googleScopes ?? [],
    needsReauth: session?.error === 'refresh_failed',
  };
}

export function useIsIntegrationConnected(integration: GoogleIntegration): boolean {
  const { scopes } = useGoogleAccount();
  return isIntegrationConnected(scopes, integration);
}

/**
 * Signing in, with the calendar asked for at the same time.
 *
 * Calendar sync is the reason to have an account here at all — a signed in user
 * whose plan still only lives in this browser has got none of what they signed
 * in for. So the one consent screen covers both, and the only thing left to
 * answer afterwards is which calendar (`CalendarSetupModal`).
 *
 * Sheets stays incremental: it is an export someone asks for, not the point of
 * the account.
 */
export function signInWithGoogle(grantedScopes: string[] = []) {
  return connectGoogleIntegration(GOOGLE_INTEGRATIONS.calendar, grantedScopes);
}

/**
 * Sends the user back through Google's consent screen asking for one more
 * integration's scopes. Incremental by design: nobody is asked for a scope
 * until they have said they want what it is for.
 */
export function connectGoogleIntegration(
  integration: GoogleIntegration,
  grantedScopes: string[] = []
) {
  return signIn('google', undefined, {
    scope: scopeRequestFor(integration, grantedScopes),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
}
