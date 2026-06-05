import type React from 'react';

/**
 * Marketing route-group layout — public, no auth gate.
 * Structural wrapper only; the landing surface lives in (marketing)/page.tsx.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="min-h-screen bg-espresso text-cream">{children}</div>;
}
