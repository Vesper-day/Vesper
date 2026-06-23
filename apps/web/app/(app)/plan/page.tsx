import type React from 'react';
import Link from 'next/link';

export default function PlanPage(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-cream">Daily plan</h1>
        {/* Entry link to the task pool — the tasks surface is reached from the
            plan view (Chat 054-W). Link only; no nav-shell work here. */}
        <Link
          href="/tasks"
          className="rounded-md border border-line-subtle px-3 py-1.5 text-sm text-cream-muted hover:text-cream"
        >
          Tasks
        </Link>
      </div>
    </main>
  );
}
