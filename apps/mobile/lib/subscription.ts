// Thin mobile client for Apple subscription verification (Chat 085). Wraps the
// POST /api/v1/subscription/apple-verify route through the shared mobile API
// client (lib/api/client) — it does NOT open a second transport or session path
// (mirrors lib/bills.ts / lib/calendarEvents.ts).
//
// The route is a 501 (NOT_IMPLEMENTED) stub until chat 086; apiClient throws an
// ApiError carrying the HTTP status on any non-2xx. This client catches that and
// — for anything other than the auth/update gates (401/426, owned globally by
// api/client) — returns a non-throwing "pending" outcome via classifyVerifyStatus.
// So a 501 is surfaced as "verification pending" and NEVER crashes the caller.
//
// It writes NOTHING to users.subscription_status (the server transitions state in
// chat 086) and imports no @vesper/ai, @vesper/db, or subscriptionState.
import { apiClient, ApiError } from './api/client';
import {
  toVerifyPayload,
  classifyVerifyStatus,
  type VerifiablePurchase,
  type VerifyOutcome,
} from './subscriptionVerify';

const APPLE_VERIFY_PATH = '/subscription/apple-verify';

/**
 * Send the signed JWS to apple-verify and report the outcome. Returns
 * { status: 'verified' } on 200, or { status: 'pending', httpStatus } for the
 * 501 stub (and any other non-200), without throwing. The global auth/update
 * gates (401/426) are re-thrown so api/client's handling still fires.
 */
export async function verifyApplePurchase(
  purchase: VerifiablePurchase,
): Promise<VerifyOutcome> {
  const body = toVerifyPayload(purchase);
  try {
    await apiClient.post<unknown>(APPLE_VERIFY_PATH, body);
    return classifyVerifyStatus(200);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 426) {
        throw err;
      }
      return classifyVerifyStatus(err.status);
    }
    throw err;
  }
}
