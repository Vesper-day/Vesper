// Pinned Apple Root CA certificates — moved to @vesper/apple (Chat 087). Thin
// re-export shim; the single source of truth for the pinned DER now lives in
// @vesper/apple/src/appleRootCerts.ts. The 086a PKI-monitor parity test
// (workers/apple-pki-monitor/index.test.ts) reads APPLE_ROOT_CA_PINS through this
// shim, so the worker's re-pinned copy stays byte-locked to the shared source.
export * from '@vesper/apple';
