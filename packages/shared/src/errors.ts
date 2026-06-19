/**
 * Single source of truth for API error codes.
 *
 * Future chats add new codes here FIRST, then map an HTTP status in
 * {@link DEFAULT_HTTP_STATUS}. `ErrorCode` is a const object (not a TS enum) so
 * its values are plain string literals usable across the framework-light
 * @vesper/shared package without enum runtime/typing quirks.
 */
export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UPGRADE_REQUIRED: 'UPGRADE_REQUIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  READ_ONLY_MODE: 'READ_ONLY_MODE',
  OPTIMISTIC_LOCK_FAILURE: 'OPTIMISTIC_LOCK_FAILURE',
  INTEGRATION_ERROR: 'INTEGRATION_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Default HTTP status for each error code (per TECHNICAL_SPEC §9). */
export const DEFAULT_HTTP_STATUS: Record<ErrorCodeValue, number> = {
  UNAUTHORIZED: 401,
  INVALID_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PLAN_NOT_FOUND: 404,
  CONFLICT: 409,
  UPGRADE_REQUIRED: 426,
  RATE_LIMITED: 429,
  READ_ONLY_MODE: 403,
  OPTIMISTIC_LOCK_FAILURE: 409,
  INTEGRATION_ERROR: 502,
  NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,
};

/**
 * Typed API error. Throw from route handlers; {@link createRoute} converts it to
 * the §9 error response shape `{ error: { code, message } }` with `httpStatus`.
 */
export class ApiError extends Error {
  public readonly code: ErrorCodeValue;
  public readonly httpStatus: number;

  constructor(code: ErrorCodeValue, message: string, httpStatus?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus ?? DEFAULT_HTTP_STATUS[code];
  }
}
