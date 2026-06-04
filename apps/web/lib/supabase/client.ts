import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client for the web app (@supabase/ssr).
 *
 * Used by client components (the sign-in page, Apple/Google OAuth initiation).
 * Reads the public NEXT_PUBLIC_* env vars — never hardcoded. Cookie storage is
 * shared with the server factory (lib/supabase/server.ts) so a session started
 * in the browser is readable server-side.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
