import * as Sentry from '@sentry/nextjs';
import { ApiError, ErrorCode } from '../errors';
import { successResponse, errorResponse } from './response';
import { validateSession, type AuthenticatedUser } from './auth';
import { checkAppVersion } from './minAppVersion';

export type AuthenticatedHandler<T> = (args: {
  request: Request;
  user: AuthenticatedUser;
  requestId: string;
  params: Record<string, string | string[]>;
}) => Promise<T>;

const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Wrap an authenticated handler into a Next.js App Router route handler.
 *
 * Flow: generate requestId → version gate (426) → session validation (401) →
 * run handler → unwrapped success response. Every response carries
 * `X-Request-Id`. ApiError maps to its `{ error: { code, message } }` shape;
 * any other throw is captured to Sentry and returned as 500.
 *
 * Sentry calls are safe no-ops while the SDK is uninitialized (SENTRY_* are
 * placeholders until Cutover), so this never blocks on Sentry config.
 */
export function createRoute<T>(handler: AuthenticatedHandler<T>) {
  // Next.js 15 App Router passes `context.params` as a Promise; await it so the
  // handler receives a resolved `params` record per the AuthenticatedHandler contract.
  return async (
    request: Request,
    context: { params: Promise<Record<string, string | string[]>> },
  ): Promise<Response> => {
    const requestId = crypto.randomUUID();
    let user: AuthenticatedUser | undefined;

    try {
      checkAppVersion(request);
      user = await validateSession(request);
      const params = (await context?.params) ?? {};
      const data = await handler({
        request,
        user,
        requestId,
        params,
      });
      const response = successResponse(data);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    } catch (err) {
      if (err instanceof ApiError) {
        const response = errorResponse(err.code, err.message, err.httpStatus);
        response.headers.set(REQUEST_ID_HEADER, requestId);
        return response;
      }

      Sentry.captureException(err, {
        tags: { requestId },
        extra: {
          method: request.method,
          path: new URL(request.url).pathname,
          userId: user?.id,
        },
      });
      const response = errorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Internal server error',
        500,
      );
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }
  };
}
