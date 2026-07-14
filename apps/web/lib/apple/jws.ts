// Apple JWS verification — moved to the shared @vesper/apple package (Chat 087) so the
// security-critical x5c-chain verify has ONE implementation that both this app and the
// apple-assn worker import (no drift-prone hand-duplicate). This file is a thin
// re-export shim; @/lib/apple/jws imports (operations.ts, route.test.ts) are unchanged.
export * from '@vesper/apple';
