'use client';

// Create / edit modal for a task (Chat 054-W). Composed from @vesper/ui tokens
// (surface/elevated/cream/bronze/oxblood/line-*) — a lightweight fixed-overlay
// dialog mirroring the 052-W EventFormDialog; the shadcn Dialog primitive
// (107/107a) is not built yet.
//
// Payload rules (mirror operations.ts schemas exactly):
//   - CREATE (POST): title, estimatedMinutes, priority always sent; deadline is
//     OMITTED when blank (PostTaskSchema's deadline is optional, NOT nullable —
//     never send null on create).
//   - EDIT (PATCH): title, estimatedMinutes, priority, status sent; deadline sent
//     as the ISO string OR null to clear it (PatchTaskSchema deadline is nullable).
//   - completedAt is NEVER sent — the server manages it off the status transition.
import { useState } from 'react';
import type { Priority, Task, TaskStatus } from './TaskCard';

export interface CreateTaskBody {
  title: string;
  estimatedMinutes: number;
  priority: Priority;
  deadline?: string; // ISO 8601 — omitted when blank
}

export interface UpdateTaskBody {
  title: string;
  estimatedMinutes: number;
  priority: Priority;
  status: TaskStatus;
  deadline: string | null; // ISO 8601, or null to clear
}

const PRIORITIES: ReadonlyArray<{ label: string; value: Priority }> = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

const STATUSES: ReadonlyArray<{ label: string; value: TaskStatus }> = [
  { label: 'Pending', value: 'pending' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

// <input type="datetime-local"> works in LOCAL time with no zone suffix; convert
// to/from the ISO instants the API expects (mirrors EventFormDialog).
function isoToLocalInput(iso: string | null): string {
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

// --- Pure validation + payload builder (unit-tested directly) ----------------
//
// Extracted from the component so the guards and the create-vs-edit wire shapes
// can be asserted without a DOM render harness (@testing-library is not a dep).
export interface SubmissionInput {
  isEdit: boolean;
  title: string;
  minutes: string; // raw value from the number input
  deadlineLocal: string; // raw datetime-local value ('' => no deadline)
  priority: Priority;
  status: TaskStatus;
}

export type SubmissionResult =
  | { ok: false; error: string }
  | { ok: true; mode: 'create'; body: CreateTaskBody }
  | { ok: true; mode: 'update'; body: UpdateTaskBody };

export function buildSubmission(input: SubmissionInput): SubmissionResult {
  const trimmed = input.title.trim();
  if (!trimmed) {
    return { ok: false, error: 'Please give the task a title.' };
  }

  // estimatedMinutes guard — mirrors the DB CHECK / route (integer, strictly > 0).
  // Rejects blank, non-numeric, non-integer and non-positive BEFORE the API call.
  const parsedMinutes = Number(input.minutes);
  if (
    input.minutes.trim() === '' ||
    !Number.isFinite(parsedMinutes) ||
    !Number.isInteger(parsedMinutes) ||
    parsedMinutes <= 0
  ) {
    return {
      ok: false,
      error: 'Estimated minutes must be a whole number greater than zero.',
    };
  }

  const deadlineIso = localInputToIso(input.deadlineLocal);

  if (input.isEdit) {
    return {
      ok: true,
      mode: 'update',
      body: {
        title: trimmed,
        estimatedMinutes: parsedMinutes,
        priority: input.priority,
        status: input.status,
        // null clears the deadline (PatchTaskSchema deadline is nullable).
        deadline: deadlineIso === '' ? null : deadlineIso,
      },
    };
  }

  // CREATE: deadline OMITTED when blank — PostTaskSchema's deadline is optional,
  // NOT nullable, so null must never be sent on create.
  const body: CreateTaskBody = {
    title: trimmed,
    estimatedMinutes: parsedMinutes,
    priority: input.priority,
  };
  if (deadlineIso !== '') body.deadline = deadlineIso;
  return { ok: true, mode: 'create', body };
}

interface Props {
  task: Task | null; // null => create
  saving: boolean;
  onCreate: (body: CreateTaskBody) => void;
  onUpdate: (id: string, body: UpdateTaskBody) => void;
  onClose: () => void;
}

export function TaskForm({
  task,
  saving,
  onCreate,
  onUpdate,
  onClose,
}: Props): React.JSX.Element {
  const isEdit = task !== null;
  const [title, setTitle] = useState(task?.title ?? '');
  // estimatedMinutes is held as the raw string so the guard can reject blanks /
  // non-integers / non-positives before any parse-coerced submit.
  const [minutes, setMinutes] = useState(
    task ? String(task.estimatedMinutes) : '',
  );
  const [deadline, setDeadline] = useState(isoToLocalInput(task?.deadline ?? null));
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending');
  const [error, setError] = useState<string | null>(null);

  const fieldClass =
    'w-full rounded-md border border-line-subtle bg-elevated px-3 py-2 text-sm text-cream ' +
    'placeholder:text-cream-faint focus:border-line-strong focus:outline-none';

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);

    const result = buildSubmission({
      isEdit,
      title,
      minutes,
      deadlineLocal: deadline,
      priority,
      status,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.mode === 'update' && task) {
      onUpdate(task.id, result.body);
    } else if (result.mode === 'create') {
      onCreate(result.body);
    }
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
          {isEdit ? 'Edit task' : 'New task'}
        </h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-cream-muted">Title</span>
          <input
            className={fieldClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Draft the proposal"
            autoFocus
          />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-cream-muted">Estimated minutes</span>
            <input
              type="number"
              min={1}
              step={1}
              className={fieldClass}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="e.g. 30"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-cream-muted">Priority</span>
            <select
              className={fieldClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-cream-muted">Deadline (optional)</span>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              className={fieldClass}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            {deadline !== '' && (
              <button
                type="button"
                onClick={() => setDeadline('')}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-cream-muted hover:text-cream"
              >
                Clear
              </button>
            )}
          </div>
        </label>

        {isEdit && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-cream-muted">Status</span>
            <select
              className={fieldClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <p className="mb-3 text-sm text-oxblood">{error}</p>}

        <div className="flex items-center justify-end gap-2">
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
      </form>
    </div>
  );
}
