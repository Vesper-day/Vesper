import type React from 'react';

/**
 * Authenticated app route-group layout — structural shell for /plan, /tasks,
 * /week, /settings.
 *
 * Auth enforcement lives in middleware.ts (the @supabase/ssr cookie gate), NOT
 * here — do not duplicate redirect logic in this layout. By the time this
 * renders, the request has already passed the middleware auth branch.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="min-h-screen bg-espresso text-cream">{children}</div>;
}
