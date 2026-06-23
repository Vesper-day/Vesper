import type React from 'react';
import { TaskList } from '@/components/tasks/TaskList';

/**
 * Task pool surface (Chat 054-W). Server-component shell — the page chrome is
 * composed from @vesper/ui design tokens (espresso/cream), mirroring the 052-W
 * calendar page. The interactive list (filter tabs + client-side sort + CRUD
 * against /api/v1/tasks) lives in the TaskList client component.
 *
 * Mounts under the (app) route group as a sibling of plan/calendar/week,
 * inheriting the espresso/cream app shell from (app)/layout.tsx. Reachable from
 * the plan view via the entry link there.
 */
export default function TasksPage(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-cream">Tasks</h1>
        <p className="text-sm text-cream-muted">
          Your task pool. Capture work here, then schedule it into your day.
        </p>
      </header>
      <TaskList />
    </main>
  );
}
