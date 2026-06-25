// Client-safe entry for the Supabase Realtime client + self-mutation filter
// (Chat 037 spine; split out in Chat 081).
//
// Mobile (`apps/mobile/hooks/usePlanRealtime.ts`) and web import the realtime
// surface from '@vesper/shared/realtime' rather than the package barrel
// ('@vesper/shared'), because the barrel statically re-exports server-only
// modules (subscriptionState, api/auth) that pull @vesper/db -> postgres ->
// Node fs/net/tls/crypto into the client bundle. This subpath touches ONLY
// ./client and ./selfMutationFilter, which import nothing platform-specific
// (the Supabase client is injected; no react-native, no node built-ins).
// Mirrors the 038 ./queries pattern and the 032-W ./onboarding pattern.

export { createRealtimeClient } from './client';
export type {
  RealtimeClient,
  RealtimeConnectionState,
  RealtimeStateContext,
  BlocksRealtimeRow,
} from './client';
export {
  createSelfMutationFilter,
  selfMutationFilter,
  SELF_MUTATION_WINDOW_MS,
} from './selfMutationFilter';
export type { SelfMutationFilter } from './selfMutationFilter';
