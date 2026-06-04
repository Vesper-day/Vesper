import { ApiError, ErrorCode } from '../errors';

/** Fallback when MIN_APP_VERSION is unset. */
export const DEFAULT_MIN_APP_VERSION = '1.0.0';

/** Minimum supported native client version (`x.y.z`). */
export function getMinAppVersion(): string {
  return process.env.MIN_APP_VERSION ?? DEFAULT_MIN_APP_VERSION;
}

/** Parse "x.y.z" into a numeric tuple; missing/NaN parts become 0. */
function parse(version: string): [number, number, number] {
  const parts = version.split('.');
  const num = (i: number): number => {
    const n = Number.parseInt(parts[i] ?? '0', 10);
    return Number.isNaN(n) ? 0 : n;
  };
  return [num(0), num(1), num(2)];
}

/** Returns negative if a < b, 0 if equal, positive if a > b. */
function compare(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * Enforce the minimum native client version.
 *
 * Web clients are exempt and send no `X-App-Version` header → no-op. Native
 * clients send the header; if strictly below {@link getMinAppVersion}, throw
 * UPGRADE_REQUIRED (426). semver compare is inline — only `x.y.z` is needed, so
 * no semver dependency.
 */
export function checkAppVersion(request: Request): void {
  const header = request.headers.get('X-App-Version');
  if (header === null) return;

  if (compare(parse(header), parse(getMinAppVersion())) < 0) {
    throw new ApiError(
      ErrorCode.UPGRADE_REQUIRED,
      'Client version below minimum supported',
      426,
    );
  }
}
