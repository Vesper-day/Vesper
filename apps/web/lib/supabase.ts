import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazily-constructed browser Supabase client. Construction is deferred out of
// module evaluation so that Next's server prerender at `next build` — which
// evaluates this module's graph the moment a 'use client' page (chat 039's
// /plan) imports it — never calls createClient() with the NEXT_PUBLIC_SUPABASE_*
// vars absent (they are only guaranteed present in the browser bundle and in a
// dev shell with .env.local). CI has no such env, and an eager createClient()
// there throws "supabaseUrl is required" and fails the build. The client is only
// ever needed at runtime in the browser (Realtime subscribe), so a lazy getter
// keeps prerender inert while preserving identical runtime behaviour.
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client === null) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}
