// StoreKit 2 product configuration (Chat 085 — iOS in-app purchase client).
//
// Static product identifiers only. There is deliberately NO price constant here:
// the price is set in App Store Connect (Tier 8, $19.99 USD at V1) and fetched
// from StoreKit at runtime via `displayPrice` — application code NEVER hardcodes
// it (TECHNICAL_SPEC §9 / this chat's contract).
//
// Auto-renewing subscription group: "Vesper" (display name "Vesper Standard").
// One product in the group: com.vesper.standard.monthly.

/** The single auto-renewing subscription product id (App Store Connect). */
export const SUBSCRIPTION_PRODUCT_ID = 'com.vesper.standard.monthly';

/** SKU list handed to StoreKit's product fetch. One product at V1. */
export const SUBSCRIPTION_PRODUCT_IDS: readonly string[] = [SUBSCRIPTION_PRODUCT_ID];

/**
 * Subscription group name (App Store Connect). Not sent to any API — recorded
 * here so the group binding is single-sourced with the product id.
 */
export const SUBSCRIPTION_GROUP = 'Vesper';
