import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { createBrowserSupabase } from '@/lib/supabase/client';

/**
 * Auth slice — derives client-side auth state from the @supabase/ssr cookie
 * session. Does NOT persist a token (Decision 05); the HTTP-only cookie set by
 * @supabase/ssr is the single source of truth. This store is a read-through
 * convenience for client components.
 *
 * MUST NOT import @vesper/db — all DB access is via /api/v1/ routes.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  currentUser: User | null;
  status: AuthStatus;
  setUser: (user: User | null) => void;
  setStatus: (status: AuthStatus) => void;
  /** Hydrate from the browser Supabase client's current session. */
  hydrate: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  status: 'loading',

  setUser: (user) =>
    set({
      currentUser: user,
      status: user ? 'authenticated' : 'unauthenticated',
    }),

  setStatus: (status) => set({ status }),

  hydrate: async () => {
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    set({
      currentUser: user,
      status: user ? 'authenticated' : 'unauthenticated',
    });
  },

  clear: () => set({ currentUser: null, status: 'unauthenticated' }),
}));
