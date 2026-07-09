// StoreKit 2 wrapper (Chat 085 — iOS in-app purchase client, steps 1–4).
//
// Thin, import-safe TypeScript surface over expo-iap (OpenIAP). It exposes just
// what the upgrade UI needs: fetch the one subscription product, present the
// native purchase sheet, hand back the signed JWS transaction, and deep-link to
// the system "Manage subscription" UI.
//
// IMPORT-SAFETY: this module performs NO native call at import time — it only
// binds function references. The native module is inert in Expo Go and every
// device/native path (real product fetch, real purchase sheet, real JWS) is
// Mac/EAS/Cutover-gated and deferred; none of it runs in this chat. Because the
// screens that import this module are never loaded by vitest (no screen tests),
// and this module is otherwise mocked wholesale, vitest never transforms
// expo-iap's native source.
//
// SCOPE: client steps 1–4 only. The signed JWS is POSTed to
// /api/v1/subscription/apple-verify by the thin client (lib/subscription.ts);
// server-side verification + the subscriptions upsert is chat 086. We therefore
// deliberately DO NOT call finishTransaction here — the transaction stays in the
// queue until 086 verifies it, so an un-verified purchase is never dropped.
import {
  fetchProducts,
  requestPurchase,
  deepLinkToSubscriptions,
  type Purchase,
} from 'expo-iap';
import { SUBSCRIPTION_PRODUCT_ID, SUBSCRIPTION_PRODUCT_IDS } from './storeKit.config';

/**
 * The minimal product shape the UI renders. `displayName` and `displayPrice`
 * are whatever StoreKit returns at runtime (localized name + currency-formatted
 * price) — never hardcoded.
 */
export interface StoreProduct {
  id: string;
  displayName: string;
  displayPrice: string;
}

/** Raised when the product is not returned by StoreKit (mis-config, offline, or Expo Go). */
export class ProductUnavailableError extends Error {
  constructor(message = 'The subscription is currently unavailable.') {
    super(message);
    this.name = 'ProductUnavailableError';
  }
}

/** Raised when the purchase flow returns no completed transaction (cancelled/failed). */
export class PurchaseIncompleteError extends Error {
  constructor(message = 'The purchase did not complete.') {
    super(message);
    this.name = 'PurchaseIncompleteError';
  }
}

/**
 * Step 1–2: fetch the single subscription product and return its runtime name +
 * price for display. Throws ProductUnavailableError if StoreKit yields nothing.
 */
export async function fetchStandardProduct(): Promise<StoreProduct> {
  const products = await fetchProducts({ skus: SUBSCRIPTION_PRODUCT_IDS, type: 'subs' });
  for (const p of products ?? []) {
    if (p.id === SUBSCRIPTION_PRODUCT_ID) {
      return {
        id: p.id,
        displayName: p.displayName ?? '',
        displayPrice: p.displayPrice,
      };
    }
  }
  throw new ProductUnavailableError();
}

/**
 * Step 3–4: present the native payment sheet for the subscription and return the
 * completed Purchase (whose `purchaseToken` carries the signed StoreKit 2 JWS on
 * iOS). Throws PurchaseIncompleteError if the flow yields no transaction.
 */
export async function purchaseStandard(): Promise<Purchase> {
  const result = await requestPurchase({
    request: { apple: { sku: SUBSCRIPTION_PRODUCT_ID } },
    type: 'subs',
  });
  const purchase = Array.isArray(result) ? result[0] : result;
  if (!purchase) {
    throw new PurchaseIncompleteError();
  }
  return purchase;
}

/**
 * Open the system subscription-management UI (iOS deep link). Used by the
 * "Manage subscription" settings entry; no-args on iOS.
 */
export async function showManageSubscriptions(): Promise<void> {
  await deepLinkToSubscriptions();
}
