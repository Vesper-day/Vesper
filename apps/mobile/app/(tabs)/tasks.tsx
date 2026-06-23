// Task pool surface (Chat 054-W — parity with the web Tasks surface).
//
// Consumes the EXISTING /api/v1/tasks route set through the shared mobile API client
// + session via lib/tasks (no second transport, no re-implemented CRUD). All CRUD —
// list, create, edit, complete/uncomplete, delete — goes through that thin client.
//
// SORT (054-V) — path (b): the GET sort is FIXED server-side (priority DESC, then
// deadline ASC NULLS LAST) with no sort param. The "sortable" visual is satisfied by
// PURELY CLIENT-SIDE toggles over the already-fetched list (default "Priority"
// reproduces the server order) — no route change.
//
// in_progress — the GET ?status filter only accepts pending|completed (in_progress
// would 400). So this screen fetches the FULL set with NO status filter and filters
// by each task's own `status` CLIENT-SIDE; in_progress is set via the edit form's
// status control and shown as a badge.
//
// react-native-calendars-free: no native module here — pure RN + NativeWind, runs in
// Expo Go on SDK 52. completed_at is server-managed (never sent); user_id is
// session-derived (never sent).
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { format as formatDate } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  InvalidEstimateError,
  type Task,
  type Priority,
  type TaskStatus,
} from '../../lib/tasks';

// Token hexes (verbatim from @vesper/ui tokens.ts) for raw-color props.
const C = {
  espresso: '#1E1815',
  cream: '#E8DDC9',
  creamFaint: '#756B57',
  bronze: '#B8884A',
} as const;

const PRIORITY_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

type SortKey = 'priority' | 'deadline';
type StatusFilter = 'all' | TaskStatus;

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

// deadline ASC NULLS LAST.
function deadlineCmp(a: Task, b: Task): number {
  if (a.deadline === b.deadline) return 0;
  if (a.deadline === null) return 1;
  if (b.deadline === null) return -1;
  return a.deadline.localeCompare(b.deadline);
}

function priorityCmp(a: Task, b: Task): number {
  return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
}

const deadlineLabel = (iso: string): string => formatDate(new Date(iso), 'MMM d, HH:mm');

// Local date+time strings -> ISO instant (device-local, matching web). Returns null
// on an unparseable/blank pair.
function toIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Form draft. `id: null` => create. Deadline held as separate date/time fields
// (blank => no deadline). minutes held as a raw string for the guard.
interface Draft {
  id: string | null;
  title: string;
  minutes: string;
  deadlineDate: string;
  deadlineTime: string;
  priority: Priority;
  status: TaskStatus;
}

function emptyDraft(): Draft {
  return {
    id: null,
    title: '',
    minutes: '',
    deadlineDate: '',
    deadlineTime: '',
    priority: 'medium',
    status: 'pending',
  };
}

function draftFromTask(t: Task): Draft {
  const d = t.deadline ? new Date(t.deadline) : null;
  return {
    id: t.id,
    title: t.title,
    minutes: String(t.estimatedMinutes),
    deadlineDate: d ? formatDate(d, 'yyyy-MM-dd') : '',
    deadlineTime: d ? formatDate(d, 'HH:mm') : '',
    priority: t.priority,
    status: t.status,
  };
}

export default function TasksScreen(): React.JSX.Element {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('priority');
  const [draft, setDraft] = useState<Draft | null>(null);

  const queryClient = useQueryClient();

  // No status filter: fetch the full set so in_progress is visible.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['tasks'] }).then(() => undefined);

  const tasks = data ?? [];

  const visible = useMemo(() => {
    const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
    return [...filtered].sort((a, b) =>
      sort === 'priority'
        ? priorityCmp(a, b) || deadlineCmp(a, b)
        : deadlineCmp(a, b) || priorityCmp(a, b),
    );
  }, [tasks, filter, sort]);

  const saveMutation = useMutation({
    mutationFn: async (d: Draft) => {
      const title = d.title.trim();
      if (!title) throw new Error('Please give the task a title.');
      const minutes = Number(d.minutes);
      if (d.minutes.trim() === '' || !Number.isInteger(minutes) || minutes <= 0) {
        throw new InvalidEstimateError();
      }
      const iso = toIso(d.deadlineDate, d.deadlineTime);
      if ((d.deadlineDate || d.deadlineTime) && iso === null) {
        throw new Error('Please enter a valid deadline date and time, or clear both.');
      }
      if (d.id) {
        return updateTask(d.id, {
          title,
          estimatedMinutes: minutes,
          priority: d.priority,
          status: d.status,
          deadline: iso, // null clears
        });
      }
      return createTask({
        title,
        estimatedMinutes: minutes,
        priority: d.priority,
        ...(iso !== null ? { deadline: iso } : {}),
      });
    },
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (t: Task) =>
      updateTask(t.id, { status: t.status === 'completed' ? 'pending' : 'completed' }),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });

  const saveError =
    saveMutation.error instanceof InvalidEstimateError
      ? saveMutation.error.message
      : saveMutation.error instanceof Error
        ? saveMutation.error.message
        : null;

  return (
    <View className="flex-1 bg-espresso">
      <ScrollView contentContainerClassName="p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-cream">Tasks</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              saveMutation.reset();
              setDraft(emptyDraft());
            }}
            className="rounded-md bg-bronze px-3 py-2"
          >
            <Text className="text-sm font-medium text-espresso">New task</Text>
          </Pressable>
        </View>
        <Text className="mb-3 text-sm text-cream-muted">
          Your task pool. Capture work here, then schedule it into your day.
        </Text>

        <View className="mb-3 flex-row flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                accessibilityRole="button"
                onPress={() => setFilter(f.value)}
                className={`rounded-md border px-3 py-1.5 ${
                  active ? 'border-bronze bg-bronze' : 'border-line-subtle'
                }`}
              >
                <Text className={`text-xs ${active ? 'text-espresso' : 'text-cream-muted'}`}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mb-4 flex-row items-center gap-2">
          <Text className="text-xs text-cream-muted">Sort</Text>
          {SORTS.map((s) => {
            const active = sort === s.value;
            return (
              <Pressable
                key={s.value}
                accessibilityRole="button"
                onPress={() => setSort(s.value)}
                className={`rounded-md border px-2.5 py-1 ${
                  active ? 'border-line-strong' : 'border-line-subtle'
                }`}
              >
                <Text className={`text-xs ${active ? 'text-cream' : 'text-cream-muted'}`}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <ActivityIndicator color={C.bronze} className="my-6" />
        ) : isError ? (
          <Text className="py-6 text-center text-sm text-oxblood">
            Could not load your tasks.
          </Text>
        ) : visible.length === 0 ? (
          <View className="py-12">
            <Text className="text-center text-sm font-medium text-cream">
              {filter === 'all' ? 'No tasks yet.' : 'Nothing here.'}
            </Text>
            <Text className="mt-1 text-center text-sm text-cream-muted">
              {filter === 'all'
                ? 'Tap “New task” to start building your pool.'
                : 'No tasks match this filter.'}
            </Text>
          </View>
        ) : (
          visible.map((t) => {
            const done = t.status === 'completed';
            const toggling = toggleMutation.isPending && toggleMutation.variables?.id === t.id;
            const deleting = deleteMutation.isPending && deleteMutation.variables === t.id;
            return (
              <View
                key={t.id}
                className="mb-2 flex-row items-start gap-3 rounded-md border border-line-subtle bg-surface px-3 py-3"
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  disabled={toggling}
                  onPress={() => toggleMutation.mutate(t)}
                  className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                    done ? 'border-bronze bg-bronze' : 'border-line-strong'
                  }`}
                >
                  {done && <Text className="text-xs text-espresso">✓</Text>}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    saveMutation.reset();
                    setDraft(draftFromTask(t));
                  }}
                  className="flex-1"
                >
                  <Text
                    className={`text-sm font-medium ${
                      done ? 'text-cream-faint line-through' : 'text-cream'
                    }`}
                  >
                    {t.title}
                  </Text>
                  <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                    <Text className="text-xs text-cream-muted">{t.estimatedMinutes} min</Text>
                    {t.deadline && (
                      <Text className="text-xs text-cream-muted">
                        Due {deadlineLabel(t.deadline)}
                      </Text>
                    )}
                    <Text className="text-xs text-cream-muted">
                      {PRIORITY_LABEL[t.priority]}
                    </Text>
                    {t.status === 'in_progress' && (
                      <Text className="text-xs text-bronze">In progress</Text>
                    )}
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={deleting}
                  onPress={() => deleteMutation.mutate(t.id)}
                  className="rounded-md border border-oxblood px-2 py-1"
                >
                  <Text className="text-xs text-oxblood">{deleting ? '…' : 'Delete'}</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {draft && (
        <TaskForm
          draft={draft}
          saving={saveMutation.isPending}
          deleting={deleteMutation.isPending}
          error={saveError}
          onSave={(d) => saveMutation.mutate(d)}
          onDelete={(id) => deleteMutation.mutate(id)}
          onClose={() => setDraft(null)}
        />
      )}
    </View>
  );
}

interface TaskFormProps {
  draft: Draft;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onSave: (draft: Draft) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function TaskForm({
  draft,
  saving,
  deleting,
  error,
  onSave,
  onDelete,
  onClose,
}: TaskFormProps): React.JSX.Element {
  const [title, setTitle] = useState(draft.title);
  const [minutes, setMinutes] = useState(draft.minutes);
  const [deadlineDate, setDeadlineDate] = useState(draft.deadlineDate);
  const [deadlineTime, setDeadlineTime] = useState(draft.deadlineTime);
  const [priority, setPriority] = useState<Priority>(draft.priority);
  const [status, setStatus] = useState<TaskStatus>(draft.status);

  const isEdit = draft.id !== null;
  const fieldClass =
    'rounded-md border border-line-subtle bg-elevated px-3 py-2 text-sm text-cream';

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-espresso/80 p-4" onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          className="w-full max-w-md rounded-xl border border-line-strong bg-surface p-5"
        >
          <Text className="mb-4 text-lg font-semibold text-cream">
            {isEdit ? 'Edit task' : 'New task'}
          </Text>

          <Text className="mb-1 text-xs text-cream-muted">Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Draft the proposal"
            placeholderTextColor={C.creamFaint}
            className={`${fieldClass} mb-3`}
          />

          <Text className="mb-1 text-xs text-cream-muted">Estimated minutes</Text>
          <TextInput
            value={minutes}
            onChangeText={setMinutes}
            placeholder="e.g. 30"
            placeholderTextColor={C.creamFaint}
            keyboardType="number-pad"
            className={`${fieldClass} mb-3`}
          />

          <View className="mb-3 flex-row items-end gap-3">
            <View className="flex-1">
              <Text className="mb-1 text-xs text-cream-muted">Deadline (optional)</Text>
              <TextInput
                value={deadlineDate}
                onChangeText={setDeadlineDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.creamFaint}
                autoCapitalize="none"
                className={`${fieldClass} mb-2`}
              />
              <TextInput
                value={deadlineTime}
                onChangeText={setDeadlineTime}
                placeholder="HH:MM"
                placeholderTextColor={C.creamFaint}
                className={fieldClass}
              />
            </View>
            {(deadlineDate !== '' || deadlineTime !== '') && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setDeadlineDate('');
                  setDeadlineTime('');
                }}
                className="px-2 py-2"
              >
                <Text className="text-xs text-cream-muted">Clear</Text>
              </Pressable>
            )}
          </View>

          <Text className="mb-1 text-xs text-cream-muted">Priority</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {PRIORITIES.map((p) => {
              const active = p.value === priority;
              return (
                <Pressable
                  key={p.value}
                  accessibilityRole="button"
                  onPress={() => setPriority(p.value)}
                  className={`rounded-md border px-3 py-1.5 ${
                    active ? 'border-bronze bg-bronze' : 'border-line-subtle bg-elevated'
                  }`}
                >
                  <Text className={`text-xs ${active ? 'text-espresso' : 'text-cream'}`}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isEdit && (
            <>
              <Text className="mb-1 text-xs text-cream-muted">Status</Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {STATUSES.map((s) => {
                  const active = s.value === status;
                  return (
                    <Pressable
                      key={s.value}
                      accessibilityRole="button"
                      onPress={() => setStatus(s.value)}
                      className={`rounded-md border px-3 py-1.5 ${
                        active ? 'border-bronze bg-bronze' : 'border-line-subtle bg-elevated'
                      }`}
                    >
                      <Text className={`text-xs ${active ? 'text-espresso' : 'text-cream'}`}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {error && <Text className="mb-3 text-sm text-oxblood">{error}</Text>}

          <View className="flex-row items-center justify-between">
            {isEdit ? (
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => draft.id && onDelete(draft.id)}
                className="rounded-md border border-oxblood px-3 py-2"
              >
                <Text className="text-sm text-oxblood">{deleting ? 'Deleting…' : 'Delete'}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View className="flex-row gap-2">
              <Pressable accessibilityRole="button" onPress={onClose} className="px-3 py-2">
                <Text className="text-sm text-cream-muted">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() =>
                  onSave({
                    ...draft,
                    title,
                    minutes,
                    deadlineDate,
                    deadlineTime,
                    priority,
                    status,
                  })
                }
                className="rounded-md bg-bronze px-3 py-2"
              >
                <Text className="text-sm font-medium text-espresso">
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
