/**
 * Open-redirect defense for the `next` query param on auth callbacks.
 *
 * `resolveSafeRedirect` returns a SAFE same-origin path to redirect to, or the
 * '/dashboard' fallback for anything hostile. Both the OAuth callback
 * (app/auth/callback/route.ts) and the magic-link confirm
 * (app/auth/confirm/route.ts) route the untrusted `next` param through here.
 *
 * Why not a plain "starts with /" prefix check: it misses protocol-relative
 * (//evil.com), backslash-folded paths (browsers fold "\" to "/" so a leading
 * slash + backslash becomes protocol-relative), percent-encoded slashes
 * (%2F%2Fevil.com), and U+2028/U+2029 line separators.
 *
 * The PRIMARY gate is parsed-origin equality via the WHATWG URL parser. Two
 * additions are required because origin-equality ALONE is insufficient for two
 * of the mandated vectors:
 *   - %2F%2Fevil.com stays same-origin until decoded — so we decode once first.
 *   - a U+2028 inside an otherwise same-origin path also stays same-origin — so
 *     control chars, U+2028/U+2029, and backslashes are denied outright (none
 *     are valid in a legitimate same-origin app path).
 */
const FALLBACK = '/dashboard';

// Code points that must never appear in a legitimate same-origin app path:
const CP_C0_MAX = 0x1f; // C0 control chars: U+0000..U+001F
const CP_LINE_SEP = 0x2028; // unicode line separator
const CP_PARA_SEP = 0x2029; // unicode paragraph separator
const CP_BACKSLASH = 0x5c; // "\" — browsers fold to "/"

function hasForbiddenChar(value: string): boolean {
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (
      cp <= CP_C0_MAX ||
      cp === CP_LINE_SEP ||
      cp === CP_PARA_SEP ||
      cp === CP_BACKSLASH
    ) {
      return true;
    }
  }
  return false;
}

export function resolveSafeRedirect(
  next: string | null,
  requestUrl: string,
): string {
  if (next === null || next === '') return FALLBACK;

  // Decode once: query params can arrive percent-encoded, and double-encoding
  // (%2F%2F -> //) is a classic open-redirect bypass.
  let candidate: string;
  try {
    candidate = decodeURIComponent(next);
  } catch {
    return FALLBACK; // malformed percent-encoding
  }

  if (hasForbiddenChar(candidate)) return FALLBACK;

  let base: URL;
  let resolved: URL;
  try {
    base = new URL(requestUrl);
    resolved = new URL(candidate, base);
  } catch {
    return FALLBACK;
  }

  // PRIMARY GATE: reject unless the resolved origin EXACTLY equals the request's.
  if (resolved.origin !== base.origin) return FALLBACK;

  // Return only the relative portion so we never emit an absolute URL.
  return resolved.pathname + resolved.search + resolved.hash;
}
