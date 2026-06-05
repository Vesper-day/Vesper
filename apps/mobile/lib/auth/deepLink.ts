// Shared deep-link hardening for the inbound auth redirects.
//
// Both the Google OAuth callback (vesper://auth/callback) and the magic-link
// confirm (vesper://auth/confirm) must reject any inbound URL whose path is not
// EXACTLY the expected one before a session is established — this is the guard
// against a malicious app/link smuggling tokens through an unexpected route.

/**
 * True iff `url`'s scheme+host+path (ignoring query string and fragment) equals
 * `expected` exactly. A single optional trailing slash is tolerated; everything
 * else (extra path segments, different host, different scheme) is rejected.
 *
 * e.g. matchesDeepLinkPath('vesper://auth/callback?code=x', 'vesper://auth/callback') === true
 *      matchesDeepLinkPath('vesper://auth/callbackXY', 'vesper://auth/callback')    === false
 *      matchesDeepLinkPath('vesper://auth/evil',       'vesper://auth/callback')    === false
 */
export function matchesDeepLinkPath(url: string, expected: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  // Strip query (?) and fragment (#) — order-independent.
  const base = url.split('#')[0]!.split('?')[0]!;
  const normalize = (s: string): string => s.replace(/\/+$/, '');
  return normalize(base) === normalize(expected);
}

/**
 * Extract auth params from BOTH the query string and the URL fragment of an
 * inbound redirect. PKCE returns `?code=...`; the implicit flow returns tokens
 * in the `#access_token=...&refresh_token=...` fragment. Returns a flat map.
 */
export function extractAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  const queryPart =
    queryIndex >= 0
      ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
      : '';
  const fragmentPart = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';

  for (const segment of [queryPart, fragmentPart]) {
    if (!segment) continue;
    for (const pair of segment.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const key = eq >= 0 ? pair.slice(0, eq) : pair;
      const value = eq >= 0 ? pair.slice(eq + 1) : '';
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  return params;
}
