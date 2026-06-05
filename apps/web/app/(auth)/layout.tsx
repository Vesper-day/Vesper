import type React from 'react';

/**
 * Auth route-group layout — public, no auth gate (sign-in must be reachable
 * while signed out). Structural wrapper only.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="min-h-screen bg-espresso text-cream">{children}</div>;
}
