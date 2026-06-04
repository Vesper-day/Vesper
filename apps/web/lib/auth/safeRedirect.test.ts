// @vitest-environment node
// Pure logic — no DOM needed; node env avoids requiring jsdom.
import { describe, it, expect } from 'vitest';
import { resolveSafeRedirect } from './safeRedirect';

const REQUEST_URL = 'https://app.vesper.day/auth/callback?code=abc';
const FALLBACK = '/dashboard';

// U+2028 (line separator) built without a \u escape so the source stays clean.
const U2028 = String.fromCodePoint(0x2028);

describe('resolveSafeRedirect', () => {
  it('passes a valid relative path through', () => {
    expect(resolveSafeRedirect('/plans/today', REQUEST_URL)).toBe('/plans/today');
  });

  it('preserves query and hash on a same-origin relative path', () => {
    expect(resolveSafeRedirect('/plans?day=mon#top', REQUEST_URL)).toBe(
      '/plans?day=mon#top',
    );
  });

  it('falls back when next is null', () => {
    expect(resolveSafeRedirect(null, REQUEST_URL)).toBe(FALLBACK);
  });

  it('falls back when next is empty', () => {
    expect(resolveSafeRedirect('', REQUEST_URL)).toBe(FALLBACK);
  });

  it('rejects protocol-relative //evil.com', () => {
    expect(resolveSafeRedirect('//evil.com', REQUEST_URL)).toBe(FALLBACK);
  });

  it('rejects backslash-folded /\\evil.com', () => {
    expect(resolveSafeRedirect('/\\evil.com', REQUEST_URL)).toBe(FALLBACK);
  });

  it('rejects absolute https://evil.com', () => {
    expect(resolveSafeRedirect('https://evil.com', REQUEST_URL)).toBe(FALLBACK);
  });

  it('rejects percent-encoded %2F%2Fevil.com', () => {
    expect(resolveSafeRedirect('%2F%2Fevil.com', REQUEST_URL)).toBe(FALLBACK);
  });

  it('rejects a U+2028 line-separator variant', () => {
    expect(resolveSafeRedirect(`/foo${U2028}//evil.com`, REQUEST_URL)).toBe(
      FALLBACK,
    );
  });

  it('falls back on malformed percent-encoding', () => {
    expect(resolveSafeRedirect('%E0%A4%A', REQUEST_URL)).toBe(FALLBACK);
  });
});
