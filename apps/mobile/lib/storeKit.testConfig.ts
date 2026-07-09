// StoreKit Configuration File reference (Chat 085) — asset for the DEFERRED Mac
// path only. This is NOT imported by any production code path and has NO runtime
// effect in Expo Go.
//
// Xcode's local StoreKit testing reads a `.storekit` JSON file so a purchase flow
// can be exercised on a Mac WITHOUT App Store Connect. This module captures the
// values that file must mirror so the two never drift: the product id, the
// auto-renewing type, the subscription group, and the LOCAL simulation price.
//
// PRICE NOTE: the 19.99 below is the LOCAL Xcode simulation price ONLY. Production
// pricing is set in App Store Connect (Tier 8) and fetched from StoreKit at
// runtime via `displayPrice` — application code (storeKit.ts / the upgrade UI)
// never reads this value. It lives here purely so a deferred `Vesper.storekit`
// file authored on the Mac stays consistent with SUBSCRIPTION_PRODUCT_ID.
//
// DEFERRED: authoring/importing the actual `.storekit` file, running it, and any
// on-device/simulator purchase are Mac/EAS/Cutover-gated and out of scope here.
import { SUBSCRIPTION_PRODUCT_ID, SUBSCRIPTION_GROUP } from './storeKit.config';

/** Shape of one auto-renewing subscription entry in a local `.storekit` file. */
export interface StoreKitTestSubscription {
  readonly productId: string;
  readonly type: 'auto-renewable-subscription';
  readonly subscriptionGroup: string;
  /** Local Xcode simulation price (USD). NOT the production price. */
  readonly localSimulationPriceUsd: number;
  /** Empty at V1 — no introductory/promotional offer configured. */
  readonly introductoryOffer: null;
}

/**
 * The single subscription the deferred `Vesper.storekit` local test file should
 * declare. Consumed by nothing at runtime; it is a reference asset for the Mac
 * path.
 */
export const STOREKIT_LOCAL_TEST_SUBSCRIPTION: StoreKitTestSubscription = {
  productId: SUBSCRIPTION_PRODUCT_ID,
  type: 'auto-renewable-subscription',
  subscriptionGroup: SUBSCRIPTION_GROUP,
  localSimulationPriceUsd: 19.99,
  introductoryOffer: null,
};
