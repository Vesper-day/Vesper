// Zustand auth slice (mobile) — TECHNICAL_SPEC §4 (Session Handling, Token Refresh).
//
// Responsibilities:
//   - hydrate the session from secure storage on app start (getSession);
//   - subscribe to supabase.auth.onAuthStateChange and mirror changes into the
//     store (supabase-js persists the session blob through the secure-store
//     adapter automatically; on sign-out we also clear the documented keys);
//   - expose signIn (delegating to the Google / Apple / magic-link flows),
//     signOut, and currentUser;
//   - when getSession() returns null (refresh token expired / revoked) expose
//     `needsSignIn` so the auth gate (Chat 013) can route to the sign-in screen.
//
// HARD CONSTRAINT 1: no security_audit_log write anywhere.
// Type-only imports from @supabase/supabase-js — no value import that could pull
// @vesper/db into the mobile bundle (HARD CONSTRAINT 2).
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearStoredSession } from '../lib/auth/secureStorage';
import { signInWithGoogle } from '../lib/auth/google-oauth';
import { signInWithApple } from '../lib/auth/apple-sign-in';
import { sendMagicLink } from '../lib/auth/magic-link';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type SignInProvider =
  | { provider: 'google' }
  | { provider: 'apple' }
  | { provider: 'magic_link'; email: string };

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** True when there is no valid session and the gate should route to sign-in. */
  needsSignIn: boolean;

  /** Internal: apply a session (from hydrate or onAuthStateChange). */
  setSession: (session: Session | null) => void;
  hydrate: () => Promise<void>;
  signIn: (input: SignInProvider) => Promise<{ ok: boolean; reason?: string }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  user: null,
  needsSignIn: false,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
      // Null session => refresh expired/revoked => route to sign-in.
      needsSignIn: !session,
    }),

  hydrate: async () => {
    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      status: data.session ? 'authenticated' : 'unauthenticated',
      needsSignIn: !data.session,
    });
  },

  signIn: async (input) => {
    if (input.provider === 'google') {
      const r = await signInWithGoogle();
      return r.ok ? { ok: true } : { ok: false, reason: r.reason };
    }
    if (input.provider === 'apple') {
      const r = await signInWithApple();
      return r.ok ? { ok: true } : { ok: false, reason: r.reason };
    }
    const r = await sendMagicLink(input.email);
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await clearStoredSession();
    set({
      session: null,
      user: null,
      status: 'unauthenticated',
      needsSignIn: true,
    });
  },
}));

/** Selector: the currently signed-in user (or null). */
export const currentUser = (state: AuthState): User | null => state.user;

/**
 * Wire onAuthStateChange into the store and hydrate the initial session.
 * Call once from the root layout (Chat 013 wires routing on `needsSignIn`).
 * Returns an unsubscribe fn.
 */
export function initAuthStore(): () => void {
  void useAuthStore.getState().hydrate();

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.getState().setSession(session);
    if (event === 'SIGNED_OUT') {
      // Belt-and-suspenders: ensure the documented keys are gone.
      void clearStoredSession();
    }
  });

  return () => data.subscription.unsubscribe();
}
