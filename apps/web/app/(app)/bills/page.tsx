'use client';

// Web Bills surface (Chat 061 — the Finance module). The Finance MODULE is OFF by
// default and gated on profile.modulesEnabled.finance.enabled (the SINGULAR key
// `finance`, NOT `bills`) — it is NOT a core tab, and the web app shell
// (app/(app)/layout.tsx) has no persistent nav, so there is no always-on entry to
// add: this page simply renders the module-off state until the module is enabled.
//
// CRUD runs against the /api/v1/bills route set through the shared web fetch helper
// (@/lib/api) + the react-query provider already mounted in app/providers.tsx.
// Chrome composes the 107/107a primitives (@/components/ui) + the @vesper/ui design
// tokens (named classes only — no hardcoded hexes).
//
// IMPORT SAFETY: this 'use client' file imports NO @vesper/shared barrel (which
// would pull server-only code into the client bundle). Types are declared locally.
//
// POSTHOG POSTURE (Chat 061): NO posthog.capture is wired on this surface — no
// analytics event on the amount / name inputs or on save. Autocapture stays OFF at
// V1 (session recording is off), so no data-ph-no-capture attribute is needed yet;
// it becomes required at V1.5 if recording is ever enabled on financial fields.
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, TextField, Select } from '@/components/ui';

type BillFrequency = 'monthly' | 'quarterly' | 'annually' | 'one_time';

interface Bill {
  id: string;
  name: string;
  amount: number | null;
  dueDayOfMonth: number | null;
  frequency: BillFrequency;
  category: string | null;
}

interface ProfileGate {
  profile: { modulesEnabled: { finance: { enabled: boolean } } };
}

const FREQUENCIES: ReadonlyArray<{ label: string; value: BillFrequency }> = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annually', value: 'annually' },
  { label: 'One-time', value: 'one_time' },
];

const FREQUENCY_LABEL: Record<BillFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
  one_time: 'One-time',
};

const formatAmount = (a: number | null): string | null =>
  a == null ? null : `$${a.toFixed(2)}`;

// DELETE returns 204 with an EMPTY body; the shared api.delete helper calls
// res.json() and would throw on the empty body, so delete goes through a direct
// fetch here (Medications/TaskList precedent — the shared helper is not edited).
async function deleteBillRequest(id: string): Promise<void> {
  const res = await fetch(`/api/v1/bills/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

interface Draft {
  id: string | null;
  name: string;
  amount: string;
  dueDayOfMonth: string;
  frequency: BillFrequency;
  category: string;
}

function emptyDraft(): Draft {
  return { id: null, name: '', amount: '', dueDayOfMonth: '', frequency: 'monthly', category: '' };
}

function draftFromBill(b: Bill): Draft {
  return {
    id: b.id,
    name: b.name,
    amount: b.amount == null ? '' : String(b.amount),
    dueDayOfMonth: b.dueDayOfMonth == null ? '' : String(b.dueDayOfMonth),
    frequency: b.frequency,
    category: b.category ?? '',
  };
}

export default function BillsPage(): React.JSX.Element {
  const { data: gate, isLoading: gateLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<ProfileGate>('/profile'),
  });

  if (gateLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="py-10 text-center text-sm text-cream-muted">Loading…</p>
      </main>
    );
  }

  const enabled = gate?.profile.modulesEnabled.finance.enabled ?? false;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-cream">Bills</h1>
        <p className="text-sm text-cream-muted">
          Track your recurring bills and due days. Reminders fire on the mobile app.
        </p>
      </header>
      {enabled ? (
        <BillList />
      ) : (
        <Card className="p-6">
          <p className="text-sm font-medium text-cream">The Finance module is off.</p>
          <p className="mt-1 text-sm text-cream-muted">
            Enable the Finance module in your profile settings to start tracking bills
            and due-day reminders.
          </p>
        </Card>
      )}
    </main>
  );
}

function BillList(): React.JSX.Element {
  const [editing, setEditing] = useState<{ bill: Bill | null } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bills'],
    queryFn: () => api.get<{ bills: Bill[] }>('/bills'),
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['bills'] }).then(() => undefined);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Bill>('/bills', body),
    onSuccess: async () => {
      await invalidate();
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch<Bill>(`/bills/${id}`, body),
    onSuccess: async () => {
      await invalidate();
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (b: Bill) => deleteBillRequest(b.id),
    onSuccess: () => invalidate(),
  });

  const bills = useMemo(() => data?.bills ?? [], [data]);
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="rounded-lg border border-line-subtle bg-surface p-4">
      <div className="mb-4 flex items-center justify-end">
        <Button
          onClick={() => {
            createMutation.reset();
            setEditing({ bill: null });
          }}
        >
          New bill
        </Button>
      </div>

      {isError ? (
        <p className="py-10 text-center text-sm text-oxblood">Could not load your bills.</p>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm text-cream-muted">Loading…</p>
      ) : bills.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-cream">No bills yet.</p>
          <p className="mt-1 text-sm text-cream-muted">Add a bill to track its due day.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bills.map((b) => (
            <div
              key={b.id}
              className="flex items-start justify-between gap-3 rounded-md border border-line-subtle px-3 py-3"
            >
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => {
                  updateMutation.reset();
                  setEditing({ bill: b });
                }}
              >
                <p className="text-sm font-medium text-cream">
                  {b.name}
                  {formatAmount(b.amount) && (
                    <span className="text-cream-muted"> · {formatAmount(b.amount)}</span>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cream-muted">
                  <span>{FREQUENCY_LABEL[b.frequency]}</span>
                  {b.dueDayOfMonth != null && <span>Due day {b.dueDayOfMonth}</span>}
                  {b.category && <span className="text-bronze">{b.category}</span>}
                </div>
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending && deleteMutation.variables?.id === b.id}
                onClick={() => deleteMutation.mutate(b)}
                className="rounded-md border border-oxblood px-2 py-1 text-xs text-oxblood"
              >
                {deleteMutation.isPending && deleteMutation.variables?.id === b.id ? '…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BillForm
          bill={editing.bill}
          saving={saving}
          onCreate={(body) => createMutation.mutate(body)}
          onUpdate={(id, body) => updateMutation.mutate({ id, body })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

interface BillFormProps {
  bill: Bill | null;
  saving: boolean;
  onCreate: (body: Record<string, unknown>) => void;
  onUpdate: (id: string, body: Record<string, unknown>) => void;
  onClose: () => void;
}

function BillForm({ bill, saving, onCreate, onUpdate, onClose }: BillFormProps): React.JSX.Element {
  const [draft, setDraft] = useState<Draft>(bill ? draftFromBill(bill) : emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const isEdit = draft.id !== null;

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]): void =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = (): void => {
    const name = draft.name.trim();
    if (!name) return setError('Please give the bill a name.');

    // amount: blank -> null; else a money value >= 0.
    let amount: number | null = null;
    if (draft.amount.trim() !== '') {
      const n = Number(draft.amount);
      if (!Number.isFinite(n) || n < 0) return setError('Amount must be zero or positive.');
      if (Math.round(n * 100) !== n * 100) {
        return setError('Amount may have at most 2 decimal places.');
      }
      amount = n;
    }

    // dueDayOfMonth: blank -> null; else an integer 1..31.
    let dueDayOfMonth: number | null = null;
    if (draft.dueDayOfMonth.trim() !== '') {
      const d = Number(draft.dueDayOfMonth);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        return setError('Due day must be a whole number between 1 and 31.');
      }
      dueDayOfMonth = d;
    }

    const category = draft.category.trim() ? draft.category.trim() : null;
    setError(null);

    if (isEdit) {
      // On edit send every field explicitly (null clears the nullable columns).
      onUpdate(draft.id!, {
        name,
        frequency: draft.frequency,
        amount,
        dueDayOfMonth,
        category,
      });
    } else {
      // On create, omit nullable fields that are blank so the DB stores NULL.
      const body: Record<string, unknown> = { name, frequency: draft.frequency };
      if (amount !== null) body.amount = amount;
      if (dueDayOfMonth !== null) body.dueDayOfMonth = dueDayOfMonth;
      if (category !== null) body.category = category;
      onCreate(body);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/80 p-4">
      <Card className="w-full max-w-md p-5">
        <h2 className="mb-4 text-lg font-semibold text-cream">
          {isEdit ? 'Edit bill' : 'New bill'}
        </h2>

        <label className="mb-1 block text-xs text-cream-muted">Name</label>
        <TextField
          value={draft.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="e.g. Rent"
          className="mb-3"
        />

        <label className="mb-1 block text-xs text-cream-muted">Amount (optional)</label>
        <TextField
          value={draft.amount}
          onChange={(e) => setField('amount', e.target.value)}
          inputMode="decimal"
          placeholder="e.g. 1200.00"
          className="mb-3"
        />

        <label className="mb-1 block text-xs text-cream-muted">Frequency</label>
        <Select
          options={FREQUENCIES}
          value={draft.frequency}
          onChange={(e) => setField('frequency', e.target.value as BillFrequency)}
          aria-label="Frequency"
          className="mb-3"
        />

        <label className="mb-1 block text-xs text-cream-muted">Due day of month (optional)</label>
        <TextField
          value={draft.dueDayOfMonth}
          onChange={(e) => setField('dueDayOfMonth', e.target.value)}
          inputMode="numeric"
          placeholder="1–31"
          className="mb-3"
        />

        <label className="mb-1 block text-xs text-cream-muted">Category (optional)</label>
        <TextField
          value={draft.category}
          onChange={(e) => setField('category', e.target.value)}
          placeholder="e.g. Utilities"
          className="mb-3"
        />

        {error && <p className="mb-3 text-sm text-oxblood">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-cream-muted">
            Cancel
          </button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
