import type React from 'react';
import { CalendarView } from './_components/CalendarView';

/**
 * Built-in calendar surface (Chat 052-W). Server-component shell — the page
 * chrome is composed entirely from @vesper/ui design tokens (espresso/surface/
 * cream/bronze/line-subtle), no bespoke off-system styling. The interactive
 * calendar (react-big-calendar + event CRUD against /api/v1/calendar-events)
 * lives in the CalendarView client component.
 *
 * Mounts under the (app) route group as a sibling of plan/tasks/week, inheriting
 * the espresso/cream app shell from (app)/layout.tsx.
 */
export default function CalendarPage(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-cream">Calendar</h1>
        <p className="text-sm text-cream-muted">
          Your fixed commitments. Click a slot to add an event.
        </p>
      </header>
      <CalendarView />
    </main>
  );
}
