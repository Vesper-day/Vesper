'use client';

// Task list surface (Chat 054-W; folds in the 054-V "sortable task list" visual).
// Consumes the EXISTING /api/v1/tasks route set (chat 028) through the shared web
// fetch helper (@/lib/api) + the react-query provider already mounted in
// app/providers.tsx — no new data layer. Chrome is composed from @vesper/ui design
// tokens (052-W precedent); the 107/107a primitives are not built yet.
//
// SORT (054-V) — path (b): the GET sort is FIXED server-side (priority DESC, then
// deadline ASC NULLS LAST) and exposes NO sort param. The "sortable" visual is
// satisfied here by PURELY CLIENT-SIDE toggles over the already-fetched list — no
// route change, no ?sort param. The default ("Priority") reproduces the server order.
//
// in_progress — the GET ?status filter only accepts pending|completed (in_progress
// would 400). So this list fetches the FULL set with NO ?status param and filters
// by each task's own `status` CLIENT-SIDE. in_progress is set through the edit
// form's status control (TaskForm) and surfaced as a badge on the card.
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TaskCard, type Priority, type Task, type TaskStatus } from './TaskCard';
import {
  TaskForm,
  type CreateTaskBody,
  type UpdateTaskBody,
} from './TaskForm';

type SortKey = 'priority' | 'deadline';
type StatusFilter = 'all' | TaskStatus;

const PRIORITY_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

const FILTERS: ReadonlyArray<{ label: string; value: StatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

const SORTS: ReadonlyArray<{ label: string; value: SortKey }> = [
  { label: 'Priority', value: 'priority' },
  { label: 'Deadline', value: 'deadline' },
];

// deadline ASC NULLS LAST: a missing deadline sorts after any dated one.
function deadlineCmp(a: Task, b: Task): number {
  if (a.deadline === b.deadline) return 0;
  if (a.deadline === null) return 1;
  if (b.deadline === null) return -1;
  return a.deadline.localeCompare(b.deadline);
}

function priorityCmp(a: Task, b: Task): number {
  return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
}

// DELETE returns 204 with an EMPTY body; the shared api.delete helper calls
// res.json() and would throw on the empty body, so delete goes through a direct
// fetch here. (We do not edit the shared helper — calendar relies on it.)
async function deleteTaskRequest(id: string): Promise<void> {
  const res = await fetch(`/api/v1/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

export function TaskList(): React.JSX.Element {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('priority');
  // null => modal closed. `{ task: null }` => create. `{ task }` => edit.
  const [editing, setEditing] = useState<{ task: Task | null } | null>(null);

  const queryClient = useQueryClient();

  // No ?status param: fetch the full set so in_progress is visible (see header).
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get<{ tasks: Task[] }>('/tasks'),
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['tasks'] }).then(() => undefined);

  const createMutation = useMutation({
    mutationFn: (body: CreateTaskBody) => api.post<Task>('/tasks', body),
    onSuccess: async () => {
      await invalidate();
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<UpdateTaskBody> }) =>
      api.patch<Task>(`/tasks/${id}`, body),
    onSuccess: async () => {
      await invalidate();
      setEditing(null);
    },
  });

  const toggleMutation = useMutation({
    // Complete = status->completed; uncomplete = status->pending. completedAt is
    // server-managed off this transition — never sent from here.
    mutationFn: (task: Task) =>
      api.patch<Task>(`/tasks/${task.id}`, {
        status: task.status === 'completed' ? 'pending' : 'completed',
      }),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (task: Task) => deleteTaskRequest(task.id),
    onSuccess: () => invalidate(),
  });

  const visible = useMemo(() => {
    const all = data?.tasks ?? [];
    const filtered =
      filter === 'all' ? all : all.filter((t) => t.status === filter);
    const sorted = [...filtered].sort((a, b) =>
      sort === 'priority'
        ? priorityCmp(a, b) || deadlineCmp(a, b)
        : deadlineCmp(a, b) || priorityCmp(a, b),
    );
    return sorted;
  }, [data, filter, sort]);

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="rounded-lg border border-line-subtle bg-surface p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={
                'rounded-md border px-3 py-1.5 text-sm ' +
                (filter === f.value
                  ? 'border-bronze bg-bronze text-espresso'
                  : 'border-line-subtle text-cream-muted hover:text-cream')
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-cream-muted">Sort</span>
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSort(s.value)}
              className={
                'rounded-md border px-2.5 py-1 text-xs ' +
                (sort === s.value
                  ? 'border-line-strong text-cream'
                  : 'border-line-subtle text-cream-muted hover:text-cream')
              }
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              createMutation.reset();
              setEditing({ task: null });
            }}
            className="ml-1 rounded-md bg-bronze px-3 py-1.5 text-sm font-medium text-espresso hover:opacity-90"
          >
            New task
          </button>
        </div>
      </div>

      {isError ? (
        <p className="py-10 text-center text-sm text-oxblood">
          Could not load your tasks.
        </p>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm text-cream-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-cream">
            {filter === 'all' ? 'No tasks yet.' : 'Nothing here.'}
          </p>
          <p className="mt-1 text-sm text-cream-muted">
            {filter === 'all'
              ? 'Add a task to start building your pool.'
              : 'No tasks match this filter.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              toggling={
                toggleMutation.isPending &&
                toggleMutation.variables?.id === task.id
              }
              deleting={
                deleteMutation.isPending &&
                deleteMutation.variables?.id === task.id
              }
              onToggleComplete={(t) => toggleMutation.mutate(t)}
              onEdit={(t) => {
                updateMutation.reset();
                setEditing({ task: t });
              }}
              onDelete={(t) => deleteMutation.mutate(t)}
            />
          ))}
        </div>
      )}

      {editing && (
        <TaskForm
          task={editing.task}
          saving={saving}
          onCreate={(body) => createMutation.mutate(body)}
          onUpdate={(id, body) => updateMutation.mutate({ id, body })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
