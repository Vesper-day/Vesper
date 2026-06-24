export * from './schemas';
export * from './constants';
export * from './utils';

// API foundation (Chat 008)
export { ErrorCode, ApiError, DEFAULT_HTTP_STATUS } from './errors';
export type { ErrorCodeValue } from './errors';
export { successResponse, errorResponse } from './api/response';
export { validateSession } from './api/auth';
export type { AuthenticatedUser } from './api/auth';
export { checkAppVersion, getMinAppVersion } from './api/minAppVersion';
export { createRoute } from './api/route';
export type { AuthenticatedHandler } from './api/route';
export {
  withRateLimit,
  captureRateLimitTripped,
  RateLimitError,
} from './api/rateLimit';
export type { LimiterName } from './api/rateLimit';

// Realtime client + self-mutation filter (Chat 037)
export { createRealtimeClient } from './realtime/client';
export type {
  RealtimeClient,
  RealtimeConnectionState,
  RealtimeStateContext,
  BlocksRealtimeRow,
} from './realtime/client';
export {
  createSelfMutationFilter,
  selfMutationFilter,
  SELF_MUTATION_WINDOW_MS,
} from './realtime/selfMutationFilter';
export type { SelfMutationFilter } from './realtime/selfMutationFilter';

// Offline mutation queue + conflict toast (Chat 038)
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
} from './queries/mutationQueue';
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
} from './queries/mutationQueue';
export {
  createConflictToast,
  CONFLICT_TOAST_COALESCE_WINDOW_MS,
  CONFLICT_TOAST_SINGLE,
  CONFLICT_TOAST_MULTI,
} from './queries/conflictToast';
export type { ConflictToast, ConflictToastOptions } from './queries/conflictToast';

// Subscription state machine (Chat 081) — canonical §8 transitions.
export {
  transitionToActive,
  transitionToPastDue,
  transitionToReadOnly,
  transitionToArchived,
  transitionToDeletionScheduled,
  requestDeletion,
  IllegalSubscriptionTransitionError,
  PERSISTED_SUBSCRIPTION_STATUS,
  CANCELLATION_REASONS,
  REFERRAL_CODE_LENGTH,
  REFERRAL_MINT_MAX_ATTEMPTS,
} from './subscriptionState';
export type {
  SubscriptionState,
  PersistedSubscriptionStatus,
  CancellationReason,
  StripeCanceler,
  DeletionSideEffectOptions,
} from './subscriptionState';
