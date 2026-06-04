import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for the web app (App Router, @supabase/ssr).
 *
 * Cookie-based session: reads/writes the auth cookies via Next's `cookies()`
 * store so OAuth code exchange and magic-link OTP verification persist a session.
 * This is the WEB cookie path; the stateless Bearer-token path used by mobile API
 * routes lives in @vesper/shared/api/auth.ts. Keys come from the public
 * NEXT_PUBLIC_* env vars — never hardcoded.
 *
 * Separate from the legacy apps/web/lib/supabase.ts singleton (left untouched);
 * new auth code imports this factory.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` was called from a Server Component where cookies are
            // read-only. Safe to ignore when a middleware/route refreshes the
            // session instead. (Standard @supabase/ssr guidance.)
          }
        },
      },
    },
  );
}
