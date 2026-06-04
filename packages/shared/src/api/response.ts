import type { ErrorCodeValue } from '../errors';

/**
 * Success response. Per TECHNICAL_SPEC §9 success bodies are top-level (e.g.
 * `{ plan: ... }`, `{ tasks: [...] }`) with NO envelope — `data` is serialized
 * directly as the JSON body. Uses the Web-standard global `Response` so route
 * handlers stay framework-light (Next.js consumes Web `Response` natively).
 */
export function successResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Error response. Body is EXACTLY `{ error: { code, message } }` per §9.
 */
export function errorResponse(
  code: ErrorCodeValue,
  message: string,
  status: number,
): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
