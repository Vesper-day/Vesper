// Pinned Apple Root CA certificates for StoreKit 2 JWS verification (§8).
//
// These are the trust anchors the apple-verify route validates the JWS x5c chain
// against. This is CERTIFICATE PINNING, not a JWKS/network lookup: the StoreKit
// transaction JWS carries its full leaf→intermediate→root chain in the x5c header,
// and we refuse to trust that traveling root — we require the chain to terminate in
// one of the roots pinned HERE (§8: "pinned in code").
//
// The pin set deliberately holds BOTH the current Apple root AND a slot for the
// announced-next root, so an Apple PKI rotation needs no emergency deploy
// (docs/RUNBOOKS/APPLE_ROOT_CA_ROTATION.md). The DER bytes below are real,
// downloaded from Apple and shipped as a build-time constant — see each entry.

export interface PinnedAppleRoot {
  /** Human-readable name (for logs / the rotation runbook). */
  name: string;
  /** SHA-256 fingerprint (lowercase hex) of the DER — for auditability. */
  sha256: string;
  /** Standard-base64 DER of the certificate. Empty string = slot unpopulated. */
  der: string;
}

// Apple Root CA - G3 (CURRENT).
// Source: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
// SHA-256 below matches Apple's published Root CA - G3 fingerprint. EC P-384 root.
const APPLE_ROOT_CA_G3: PinnedAppleRoot = {
  name: 'Apple Root CA - G3',
  sha256: '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179',
  der:
    'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9v' +
    'dCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UE' +
    'CgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2' +
    'WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmlj' +
    'YXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqG' +
    'SM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxE' +
    'tX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNC' +
    'MEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0P' +
    'AQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3m' +
    'eoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkL' +
    'F1vLUagM6BgD56KyKA==',
};

// Apple Root CA - UPCOMING (announced-next root). Populate the `der` + `sha256`
// from Apple's published next root ahead of a PKI rotation so verification never
// needs an emergency deploy. Empty `der` is filtered out by the accessor until then.
const APPLE_ROOT_CA_UPCOMING: PinnedAppleRoot = {
  name: 'Apple Root CA - upcoming (unpopulated)',
  sha256: '',
  der: '',
};

/** Current + upcoming Apple roots. The accessor ignores entries with an empty `der`. */
export const APPLE_ROOT_CA_PINS: readonly PinnedAppleRoot[] = [
  APPLE_ROOT_CA_G3,
  APPLE_ROOT_CA_UPCOMING,
];
