// @vesper/apple — Apple StoreKit 2 / App Store Server Notifications V2 JWS
// verification + pinned Apple Root CA trust anchors (§8).
//
// Extracted (Chat 087) from the former apps/web/lib/apple/* so the security-critical
// x5c-chain verify has ONE implementation that both apps/web (POST
// /api/v1/subscription/apple-verify) and the apple-assn worker import — no drift-prone
// hand-duplicate. apps/web/lib/apple/{jws,keyCache,appleRootCerts}.ts are now thin
// `export * from '@vesper/apple'` shims.
export {
  verifyAppleJws,
  verifyAppleTransactionJws,
  AppleJwsVerificationError,
  type AppleTransactionPayload,
  type VerifyAppleJwsOptions,
} from './jws';
export {
  getPinnedAppleRoots,
  __resetPinnedAppleRootsCache,
} from './keyCache';
export { APPLE_ROOT_CA_PINS, type PinnedAppleRoot } from './appleRootCerts';
