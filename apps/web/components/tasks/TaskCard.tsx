'use client';

// Single task row (Chat 054-W). Renders title, estimate, deadline, priority and
// status, with a complete/uncomplete toggle, an edit affordance and a delete
// affordance. All chrome is composed from @vesper/ui design tokens via Tailwind
// utilities (052-W precedent) — no invented design-system primitives.
//
// completed_at is SERVER-managed: completing sends only status:'completed' and
// uncompleting sends only status:'pending'. This row NEVER sends completedAt.
import { format } from 'date-fns';

export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/** Mirrors the §9 serialized task (operations.ts TaskResponse) — camelCase, NO
 * createdAt/updatedAt. deadline & completedAt are ISO-8601 strings or null. */
export interface Task {
  id: string;
  title: string;
  estimatedMinutes: number;
  deadline: string | null;
  priority: Priority;
  status: TaskStatus;
  completedAt: string | null;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
};

// Priority chip tone — bronze for high, muted for the rest (token-only).
const PRIORITY_CLASS: Record<Priority, string> = {
  high: 'border-bronze text-bronze',
  medium: 'border-line-subtle text-cream-muted',
  low: 'border-line-subtle text-cream-faint',
};

function deadlineLabel(iso: string): string {
  return format(new Date(iso), 'MMM d, h:mm a');
}

interface Props {
  task: Task;
  toggling: boolean;
  deleting: boolean;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskCard({
  task,
  toggling,
  deleting,
  onToggleComplete,
  onEdit,
  onDelete,
}: Props): React.JSX.Element {
  const done = task.status === 'completed';

  return (
    <div className="flex items-start gap-3 rounded-md border border-line-subtle bg-surface px-3 py-3">
      <input
        type="checkbox"
        checked={done}
        disabled={toggling}
        onChange={() => onToggleComplete(task)}
        aria-label={done ? 'Mark task as pending' : 'Mark task as completed'}
        className="mt-1 h-4 w-4 shrink-0 accent-bronze"
      />

      <div className="min-w-0 flex-1">
        <p
          className={
            'truncate text-sm font-medium ' +
            (done ? 'text-cream-faint line-through' : 'text-cream')
          }
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cream-muted">
          <span>{task.estimatedMinutes} min</span>
          {task.deadline && <span>Due {deadlineLabel(task.deadline)}</span>}
          <span
            className={
              'rounded-full border px-2 py-0.5 ' + PRIORITY_CLASS[task.priority]
            }
          >
            {PRIORITY_LABEL[task.priority]}
          </span>
          {task.status === 'in_progress' && (
            <span className="rounded-full border border-line-strong px-2 py-0.5 text-cream">
              {STATUS_LABEL.in_progress}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="rounded-md px-2 py-1 text-xs text-cream-muted hover:text-cream"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(task)}
          disabled={deleting}
          className="rounded-md border border-oxblood px-2 py-1 text-xs text-oxblood hover:bg-oxblood/10 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
