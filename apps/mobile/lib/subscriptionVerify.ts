// Pure verify-payload helpers (Chat 085). Extracted so the mapping + response
// classification are unit-testable with NO native mock and NO DOM render — this
// module imports nothing from expo-iap or react-native.
//
// Two pure functions:
//   toVerifyPayload  — purchase result -> the { jwsTransaction } request body.
//   classifyVerifyStatus — apple-verify HTTP status -> a non-throwing outcome.
//
// The apple-verify route is a 501 (NOT_IMPLEMENTED) stub until chat 086, so a
// non-200 (specifically 501) MUST be surfaced as "verification pending" and
// never as a crash. classifyVerifyStatus encodes exactly that: 200 => verified,
// anything else => pending. The transport (lib/subscription.ts) reuses it.

/** The apple-verify request body — the only field the route reads (§9). */
export interface AppleVerifyBody {
  jwsTransaction: string;
}

/**
 * Structural subset of a StoreKit purchase this mapper needs. `purchaseToken`
 * is the OpenIAP unified token; on iOS it carries the signed StoreKit 2 JWS.
 */
export interface VerifiablePurchase {
  purchaseToken?: string | null;
}

/** Verified when the route returns 200; pending for every other status. */
export type VerifyOutcome =
  | { status: 'verified' }
  | { status: 'pending'; httpStatus: number };

/** Raised when a completed purchase carries no JWS token to verify. */
export class MissingJwsError extends Error {
  constructor(message = 'The purchase did not include a verifiable transaction.') {
    super(message);
    this.name = 'MissingJwsError';
  }
}

/**
 * Map a completed purchase to the apple-verify request body. Throws
 * MissingJwsError if the purchase has no token (defensive — a real StoreKit 2
 * transaction always carries one).
 */
export function toVerifyPayload(purchase: VerifiablePurchase): AppleVerifyBody {
  const jws = purchase.purchaseToken;
  if (!jws) {
    throw new MissingJwsError();
  }
  return { jwsTransaction: jws };
}

/**
 * Classify an apple-verify HTTP status without throwing. 200 => verified; any
 * other status (incl. the 501 stub returned until chat 086) => pending.
 */
export function classifyVerifyStatus(httpStatus: number): VerifyOutcome {
  if (httpStatus === 200) {
    return { status: 'verified' };
  }
  return { status: 'pending', httpStatus };
}
