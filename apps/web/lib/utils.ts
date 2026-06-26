/**
 * cn — class-name joiner used by the @vesper/ui primitives (components.json
 * `utils` alias points here). Dependency-free on purpose: it concatenates
 * truthy class fragments with a single space, so callers can pass conditional
 * classes (`cn('base', isOpen && 'open')`) without pulling clsx/tailwind-merge
 * into the bundle. Later token-driven utilities never collide because the
 * primitives keep a single semantic class per concern.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(' ');
}
