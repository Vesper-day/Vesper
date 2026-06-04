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
