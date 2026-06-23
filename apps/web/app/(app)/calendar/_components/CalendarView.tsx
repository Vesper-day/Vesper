'use client';

// Interactive built-in calendar (Chat 052-W). react-big-calendar driving
// month/week/day views over instances read from /api/v1/calendar-events (recurring
// rows already expanded server-side). All chrome is composed from @vesper/ui
// design tokens via Tailwind utility classes + the token-mapped rbc-theme.css
// overlay — no invented design-system primitives.
import { useMemo, useState } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
  type SlotInfo,
} from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { EventFormDialog, type EventDraft } from './EventFormDialog';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './rbc-theme.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
});

// Mirrors operations.ts CalendarEventInstance (the GET response item).
interface CalendarEventInstance {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  rrule: string | null;
  recurring: boolean;
}

interface RbcEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  rrule: string | null;
  recurring: boolean;
}

// Fetch a window padded a week past the visible month so week/day navigation near
// month edges still has data.
function windowForDate(date: Date): { start: string; end: string } {
  return {
    start: addDays(startOfMonth(date), -7).toISOString(),
    end: addDays(endOfMonth(date), 7).toISOString(),
  };
}

export function CalendarView(): React.JSX.Element {
  const [date, setDate] = useState<Date>(() => new Date());
  const [view, setView] = useState<View>(Views.MONTH);
  const [draft, setDraft] = useState<EventDraft | null>(null);

  const queryClient = useQueryClient();
  const window = useMemo(() => windowForDate(date), [date]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['calendar-events', window.start, window.end],
    queryFn: () =>
      api.get<{ events: CalendarEventInstance[] }>(
        `/calendar-events?start=${encodeURIComponent(window.start)}&end=${encodeURIComponent(
          window.end,
        )}`,
      ),
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] }).then(() => undefined);

  const saveMutation = useMutation({
    mutationFn: (d: EventDraft) => {
      const body = {
        title: d.title,
        startTime: d.startTime,
        endTime: d.endTime,
        rrule: d.rrule,
      };
      return d.id
        ? api.patch<{ event: unknown }>(`/calendar-events/${d.id}`, body)
        : api.post<{ event: unknown }>('/calendar-events', body);
    },
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<unknown>(`/calendar-events/${id}`),
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });

  const events: RbcEvent[] = useMemo(
    () =>
      (data?.events ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.startTime),
        end: new Date(e.endTime),
        rrule: e.rrule,
        recurring: e.recurring,
      })),
    [data],
  );

  function handleSelectSlot(slot: SlotInfo): void {
    setDraft({
      id: null,
      title: '',
      startTime: new Date(slot.start).toISOString(),
      endTime: new Date(slot.end).toISOString(),
      rrule: null,
    });
  }

  function handleSelectEvent(event: RbcEvent): void {
    setDraft({
      id: event.id,
      title: event.title,
      startTime: event.start.toISOString(),
      endTime: event.end.toISOString(),
      rrule: event.rrule,
    });
  }

  return (
    <div className="rounded-lg border border-line-subtle bg-surface p-4">
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={() =>
            setDraft({ id: null, title: '', startTime: '', endTime: '', rrule: null })
          }
          className="rounded-md bg-bronze px-3 py-1.5 text-sm font-medium text-espresso hover:opacity-90"
        >
          New event
        </button>
      </div>

      {isError ? (
        <p className="py-8 text-center text-sm text-oxblood">Could not load your calendar.</p>
      ) : (
        <div className={isLoading ? 'opacity-60' : undefined}>
          <Calendar
            localizer={localizer}
            events={events}
            date={date}
            view={view}
            onNavigate={setDate}
            onView={setView}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 640 }}
          />
        </div>
      )}

      {draft && (
        <EventFormDialog
          draft={draft}
          saving={saveMutation.isPending}
          deleting={deleteMutation.isPending}
          onSave={(d) => saveMutation.mutate(d)}
          onDelete={(id) => deleteMutation.mutate(id)}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}
