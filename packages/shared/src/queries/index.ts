// Client-safe entry for the offline mutation queue + conflict toast (Chat 038).
//
// `'use client'` web/mobile files import the queue helpers from
// '@vesper/shared/queries' rather than the package barrel ('@vesper/shared'),
// because the barrel statically re-exports server-only modules (subscriptionState,
// api/auth) that pull @vesper/db -> postgres -> Node fs/net/tls/crypto into the
// client bundle. This subpath touches ONLY these two modules, which import nothing
// platform-specific.

export {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  MAX_MUTATION_RETRIES,
  OFFLINE_MUTATION_PERSIST_KEY,
  OFFLINE_MUTATION_PERSIST_VERSION,
  BLOCK_MUTATION_KEY_PREFIX,
  planQueryKey,
  blockMutationScope,
  mintClientMutationId,
  ensureClientMutationId,
  prepareMutationSend,
  classifyMutationError,
  shouldRetryMutation,
  mutationRetryDelay,
  buildMutationDefaults,
  buildMutationCacheConfig,
  flushQueue,
  createMutationPersister,
} from './mutationQueue';
export type {
  MutationErrorKind,
  ClientMutationVariables,
  AnalyticsEmitter,
  MutationDroppedInfo,
  MutationCacheConfigOptions,
  FlushQueueOptions,
  AsyncStorageLike,
  MutationPersister,
  MutationPersisterOptions,
} from './mutationQueue';
export {
  createConflictToast,
  CONFLICT_TOAST_COALESCE_WINDOW_MS,
  CONFLICT_TOAST_SINGLE,
  CONFLICT_TOAST_MULTI,
} from './conflictToast';
export type { ConflictToast, ConflictToastOptions } from './conflictToast';
