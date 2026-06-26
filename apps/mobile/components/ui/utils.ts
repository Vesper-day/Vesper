/**
 * cn — dependency-free class-name joiner for the mobile primitives, mirroring
 * apps/web/lib/utils.ts so web and mobile compose classes the same way. NativeWind
 * resolves the joined string to RN styles at build time.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(' ');
}
