'use client';

// Create / edit / delete modal for a calendar event (Chat 052-W chrome). Composed
// from @vesper/ui tokens (elevated/surface/cream/bronze/oxblood/line-*) — no
// invented design-system primitives. A lightweight fixed-overlay dialog; the app
// has no shadcn Dialog primitive built yet (107/107a not shipped), so the modal
// is assembled from token-mapped Tailwind utilities matching (app)/layout.tsx.
import { useState } from 'react';

export interface EventDraft {
  id: string | null; // null => create
  title: string;
  startTime: string; // ISO 8601 (or '' for a blank new-event form)
  endTime: string; // ISO 8601 (or '')
  rrule: string | null;
}

// A small fixed set of recurrence presets — the V1 surface for "fixed weekly
// events" (§3 #25). Custom RRULE authoring is out of scope for this chat.
const RRULE_PRESETS: ReadonlyArray<{ label: string; value: string | null }> = [
  { label: 'Does not repeat', value: null },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly (Mon & Wed)', value: 'FREQ=WEEKLY;BYDAY=MO,WE' },
  { label: 'Weekly (Mon–Fri)', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
];

// <input type="datetime-local"> works in LOCAL time with no zone suffix. Convert
// to/from the ISO instants the API expects.
function isoToLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string {
  return local ? new Date(local).toISOString() : '';
}

interface Props {
  draft: EventDraft;
  saving: boolean;
  deleting: boolean;
  onSave: (draft: EventDraft) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function EventFormDialog({
  draft,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
}: Props): React.JSX.Element {
  const [title, setTitle] = useState(draft.title);
  const [start, setStart] = useState(isoToLocalInput(draft.startTime));
  const [end, setEnd] = useState(isoToLocalInput(draft.endTime));
  const [rrule, setRrule] = useState<string | null>(draft.rrule);
  const [error, setError] = useState<string | null>(null);

  const isEdit = draft.id !== null;
  const fieldClass =
    'w-full rounded-md border border-line-subtle bg-elevated px-3 py-2 text-sm text-cream ' +
    'placeholder:text-cream-faint focus:border-line-strong focus:outline-none';

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Please give the event a title.');
      return;
    }
    const startIso = localInputToIso(start);
    const endIso = localInputToIso(end);
    if (!startIso || !endIso) {
      setError('Please set a start and end time.');
      return;
    }
    // Mirror the DB CHECK / server validation client-side for instant feedback.
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setError('End time must be after start time.');
      return;
    }
    onSave({ id: draft.id, title: title.trim(), startTime: startIso, endTime: endIso, rrule });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-line-strong bg-surface p-5 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-semibold text-cream">
          {isEdit ? 'Edit event' : 'New event'}
        </h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-cream-muted">Title</span>
          <input
            className={fieldClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Team standup"
            autoFocus
          />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-cream-muted">Starts</span>
            <input
              type="datetime-local"
              className={fieldClass}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-cream-muted">Ends</span>
            <input
              type="datetime-local"
              className={fieldClass}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-cream-muted">Repeats</span>
          <select
            className={fieldClass}
            value={rrule ?? ''}
            onChange={(e) => setRrule(e.target.value === '' ? null : e.target.value)}
          >
            {RRULE_PRESETS.map((p) => (
              <option key={p.label} value={p.value ?? ''}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="mb-3 text-sm text-oxblood">{error}</p>}

        <div className="flex items-center justify-between">
          {isEdit ? (
            <button
              type="button"
              onClick={() => draft.id && onDelete(draft.id)}
              disabled={deleting}
              className="rounded-md border border-oxblood px-3 py-1.5 text-sm text-oxblood hover:bg-oxblood/10 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-cream-muted hover:text-cream"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-bronze px-3 py-1.5 text-sm font-medium text-espresso hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
