import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import {
  GOOGLE_BASE_SCOPES,
  GoogleTokens,
  isAccessTokenExpired,
  refreshGoogleTokens,
} from '@/lib/google';

/** Set when the refresh token stopped working, so the UI can ask for a new sign in. */
export type AuthError = 'refresh_failed';

declare module 'next-auth' {
  interface Session {
    /** Google scopes the user has actually consented to. Never assume, always check. */
    googleScopes: string[];
    error?: AuthError;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** Kept server side only — the access token is never sent to the browser. */
    google?: GoogleTokens;
    /**
     * Google's `sub`, taken from the account rather than from `token.sub`.
     *
     * This is the key every row in the database hangs off, and it must be
     * Google's own id for the account. `token.sub` is **not** that: with the
     * JWT strategy and no adapter, Auth.js mints a fresh UUID for it on every
     * sign in. Keying on it made a new `users` row per login — five rows for
     * one person before this was caught — and, worse, meant a returning user
     * was handed an empty settings row that knew nothing of their calendar.
     */
    googleSub?: string;
    error?: AuthError;
  }
}

/**
 * True once the deployment has everything NextAuth needs. Server side only: the
 * app is fully usable signed out, so without credentials we hide sign in rather
 * than offer a button that can only land on an error page.
 */
export const isGoogleAuthConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET
);

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      authorization: {
        params: {
          scope: GOOGLE_BASE_SCOPES.join(' '),
          // Offline access plus a forced consent screen is what makes Google
          // hand back a refresh token instead of an access token alone.
          access_type: 'offline',
          prompt: 'consent',
          // Connecting an integration re-runs sign in with extra scopes; this
          // keeps the grants the user already gave us.
          include_granted_scopes: 'true',
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account }) {
      // Fresh sign in, or a re-consent that added integration scopes.
      if (account) {
        // `providerAccountId` is Google's `sub`, and the only stable identifier
        // here — it outlives an email change, and unlike `token.sub` it is the
        // same on every sign in.
        if (account.providerAccountId) token.googleSub = account.providerAccountId;
        token.google = {
          accessToken: account.access_token,
          // Google omits the refresh token when it has already issued one.
          refreshToken: account.refresh_token ?? token.google?.refreshToken,
          expiresAt: account.expires_at,
          scopes: account.scope?.split(' ') ?? [],
        };
        delete token.error;
        return token;
      }

      if (!token.google || !isAccessTokenExpired(token.google)) return token;

      try {
        token.google = await refreshGoogleTokens(token.google);
        delete token.error;
      } catch {
        // Keep the identity half of the session; only Google access is lost.
        token.error = 'refresh_failed';
        token.google = { ...token.google, accessToken: undefined };
      }
      return token;
    },
    async session({ session, token }) {
      session.googleScopes = token.google?.scopes ?? [];
      session.error = token.error;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
