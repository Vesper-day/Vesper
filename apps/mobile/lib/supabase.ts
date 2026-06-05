import { createClient } from '@supabase/supabase-js';
import { secureStorageAdapter } from './auth/secureStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Session persistence is delegated to the expo-secure-store adapter
// (TECHNICAL_SPEC §4 — mobile session storage maps to the iOS Keychain).
// detectSessionInUrl is false: React Native has no URL bar to parse; inbound
// OAuth / magic-link redirects are handled explicitly by the auth flows in
// lib/auth (google-oauth, magic-link) via expo-web-browser / expo-linking.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
