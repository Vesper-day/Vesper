'use client';

// Web Medications surface (Chat 060; re-homed to /modules/medications by ADD-A). The
// Medications MODULE is OFF by default and gated on
// profile.modulesEnabled.medication.enabled. It is reached from its card on the
// /modules list (app/(app)/modules/page.tsx) and self-gates: it renders the module-off
// state until the module is enabled. CRUD logic is unchanged by the re-home.
//
// CRUD runs against the EXISTING /api/v1/medications route set through the shared web
// fetch helper (@/lib/api) + the react-query provider already mounted in
// app/providers.tsx. Chrome composes the 107/107a primitives (@/components/ui) + the
// @vesper/ui design tokens (named classes only — no hardcoded hexes).
//
// IMPORT SAFETY: this 'use client' file imports NO @vesper/shared barrel (which would
// pull server-only code into the client bundle). Types are declared locally.
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Button,
  Card,
  TextField,
  Toggle,
  SegmentedControl,
  TimePicker,
  DatePicker,
} from '@/components/ui';

type MedicationFrequency = 'daily' | 'twice_daily' | 'weekly' | 'custom';

interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: MedicationFrequency;
  times: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  notes: string | null;
  shiftOutOfQuietHours: boolean;
}

interface ProfileGate {
  profile: { modulesEnabled: { medication: { enabled: boolean } } };
}

const FREQUENCIES: ReadonlyArray<{ label: string; value: MedicationFrequency }> = [
  { label: 'Daily', value: 'daily' },
  { label: 'Twice daily', value: 'twice_daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Custom', value: 'custom' },
];

const FREQUENCY_LABEL: Record<MedicationFrequency, string> = {
  daily: 'Daily',
  twice_daily: 'Twice daily',
  weekly: 'Weekly',
  custom: 'Custom',
};

// Hint shown above the times[] picker; adjusts for the chosen frequency.
const TIMES_HINT: Record<MedicationFrequency, string> = {
  daily: 'One dose time per day.',
  twice_daily: 'Two dose times per day.',
  weekly: 'Dose times, repeating weekly on the start-date weekday.',
  custom: 'Add each dose time you need.',
};

// "HH:MM" only (TimePicker emits exactly this) — trims the DB's "HH:MM:SS" for edit.
const trimSeconds = (t: string): string => t.slice(0, 5);

// DELETE returns 204 with an EMPTY body; the shared api.delete helper calls
// res.json() and would throw on the empty body, so delete goes through a direct
// fetch here (TaskList precedent — the shared helper is not edited).
async function deleteMedicationRequest(id: string): Promise<void> {
  const res = await fetch(`/api/v1/medications/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

interface Draft {
  id: string | null;
  name: string;
  dose: string;
  frequency: MedicationFrequency;
  times: string[];
  startDate: string;
  endDate: string;
  notes: string;
  shiftOutOfQuietHours: boolean;
}

function emptyDraft(): Draft {
  return {
    id: null,
    name: '',
    dose: '',
    frequency: 'daily',
    times: ['08:00'],
    startDate: '',
    endDate: '',
    notes: '',
    shiftOutOfQuietHours: false,
  };
}

function draftFromMedication(m: Medication): Draft {
  return {
    id: m.id,
    name: m.name,
    dose: m.dose,
    frequency: m.frequency,
    times: m.times.length > 0 ? m.times.map(trimSeconds) : [''],
    startDate: m.startDate,
    endDate: m.endDate ?? '',
    notes: m.notes ?? '',
    shiftOutOfQuietHours: m.shiftOutOfQuietHours,
  };
}

export default function MedicationsPage(): React.JSX.Element {
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

  const enabled = gate?.profile.modulesEnabled.medication.enabled ?? false;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-cream">Medications</h1>
        <p className="text-sm text-cream-muted">
          Track your medications and dose times. Reminders fire on the mobile app.
        </p>
      </header>
      {enabled ? (
        <MedicationList />
      ) : (
        <Card className="p-6">
          <p className="text-sm font-medium text-cream">The Medications module is off.</p>
          <p className="mt-1 text-sm text-cream-muted">
            Enable the Medications module in your profile settings to start tracking
            medications and dose reminders.
          </p>
        </Card>
      )}
    </main>
  );
}

function MedicationList(): React.JSX.Element {
  const [editing, setEditing] = useState<{ medication: Medication | null } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['medications'],
    queryFn: () => api.get<{ medications: Medication[] }>('/medications'),
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['medications'] }).then(() => undefined);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Medication>('/medications', body),
    onSuccess: async () => {
      await invalidate();
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch<Medication>(`/medications/${id}`, body),
    onSuccess: async () => {
      await invalidate();
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (m: Medication) => deleteMedicationRequest(m.id),
    onSuccess: () => invalidate(),
  });

  const medications = useMemo(() => data?.medications ?? [], [data]);
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="rounded-lg border border-line-subtle bg-surface p-4">
      <div className="mb-4 flex items-center justify-end">
        <Button
          onClick={() => {
            createMutation.reset();
            setEditing({ medication: null });
          }}
        >
          New medication
        </Button>
      </div>

      {isError ? (
        <p className="py-10 text-center text-sm text-oxblood">
          Could not load your medications.
        </p>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm text-cream-muted">Loading…</p>
      ) : medications.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-cream">No medications yet.</p>
          <p className="mt-1 text-sm text-cream-muted">
            Add a medication to track its doses.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {medications.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-3 rounded-md border border-line-subtle px-3 py-3"
            >
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => {
                  updateMutation.reset();
                  setEditing({ medication: m });
                }}
              >
                <p className="text-sm font-medium text-cream">
                  {m.name} <span className="text-cream-muted">· {m.dose}</span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cream-muted">
                  <span>{FREQUENCY_LABEL[m.frequency]}</span>
                  {m.times.length > 0 && <span>{m.times.map(trimSeconds).join(', ')}</span>}
                  {m.shiftOutOfQuietHours && <span className="text-bronze">Shifts quiet hours</span>}
                </div>
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending && deleteMutation.variables?.id === m.id}
                onClick={() => deleteMutation.mutate(m)}
                className="rounded-md border border-oxblood px-2 py-1 text-xs text-oxblood"
              >
                {deleteMutation.isPending && deleteMutation.variables?.id === m.id
                  ? '…'
                  : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MedicationForm
          medication={editing.medication}
          saving={saving}
          onCreate={(body) => createMutation.mutate(body)}
          onUpdate={(id, body) => updateMutation.mutate({ id, body })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

interface MedicationFormProps {
  medication: Medication | null;
  saving: boolean;
  onCreate: (body: Record<string, unknown>) => void;
  onUpdate: (id: string, body: Record<string, unknown>) => void;
  onClose: () => void;
}

function MedicationForm({
  medication,
  saving,
  onCreate,
  onUpdate,
  onClose,
}: MedicationFormProps): React.JSX.Element {
  const [draft, setDraft] = useState<Draft>(
    medication ? draftFromMedication(medication) : emptyDraft(),
  );
  const [error, setError] = useState<string | null>(null);
  const isEdit = draft.id !== null;

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]): void =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setTime = (i: number, value: string): void =>
    setDraft((d) => ({ ...d, times: d.times.map((t, idx) => (idx === i ? value : t)) }));
  const addTime = (): void => setDraft((d) => ({ ...d, times: [...d.times, ''] }));
  const removeTime = (i: number): void =>
    setDraft((d) => ({ ...d, times: d.times.filter((_, idx) => idx !== i) }));

  const submit = (): void => {
    const name = draft.name.trim();
    const dose = draft.dose.trim();
    if (!name) return setError('Please give the medication a name.');
    if (!dose) return setError('Please enter a dose.');
    if (!draft.startDate) return setError('Please choose a start date.');
    if (draft.endDate && draft.endDate < draft.startDate) {
      return setError('The end date must be on or after the start date.');
    }
    const times = draft.times.map((t) => t.trim()).filter((t) => t !== '');
    setError(null);

    const body: Record<string, unknown> = {
      name,
      dose,
      frequency: draft.frequency,
      times,
      startDate: draft.startDate,
      shiftOutOfQuietHours: draft.shiftOutOfQuietHours,
    };
    if (isEdit) {
      // On edit send endDate/notes explicitly (null clears); on create omit when blank.
      body.endDate = draft.endDate ? draft.endDate : null;
      body.notes = draft.notes.trim() ? draft.notes.trim() : null;
      onUpdate(draft.id!, body);
    } else {
      if (draft.endDate) body.endDate = draft.endDate;
      if (draft.notes.trim()) body.notes = draft.notes.trim();
      onCreate(body);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/80 p-4">
      <Card className="w-full max-w-md p-5">
        <h2 className="mb-4 text-lg font-semibold text-cream">
          {isEdit ? 'Edit medication' : 'New medication'}
        </h2>

        <label className="mb-1 block text-xs text-cream-muted">Name</label>
        <TextField
          value={draft.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="e.g. Metformin"
          className="mb-3"
        />

        <label className="mb-1 block text-xs text-cream-muted">Dose</label>
        <TextField
          value={draft.dose}
          onChange={(e) => setField('dose', e.target.value)}
          placeholder="e.g. 500mg"
          className="mb-3"
        />

        <label className="mb-1 block text-xs text-cream-muted">Frequency</label>
        <SegmentedControl
          options={FREQUENCIES}
          value={draft.frequency}
          onChange={(v) => setField('frequency', v as MedicationFrequency)}
          aria-label="Frequency"
          className="mb-3"
        />

        <label className="mb-1 block text-xs text-cream-muted">Dose times</label>
        <p className="mb-2 text-xs text-cream-faint">{TIMES_HINT[draft.frequency]}</p>
        <div className="mb-3 flex flex-col gap-2">
          {draft.times.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <TimePicker
                value={t}
                onChange={(v) => setTime(i, v)}
                aria-label={`Dose time ${i + 1}`}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeTime(i)}
                className="rounded-md border border-line-subtle px-2 py-1 text-xs text-cream-muted"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addTime}
            className="self-start rounded-md border border-line-subtle px-2 py-1 text-xs text-cream"
          >
            Add time
          </button>
        </div>

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-cream-muted">Start date</label>
            <DatePicker
              value={draft.startDate}
              onChange={(v) => setField('startDate', v)}
              aria-label="Start date"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-cream-muted">End date (optional)</label>
            <DatePicker
              value={draft.endDate}
              onChange={(v) => setField('endDate', v)}
              aria-label="End date"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs text-cream-muted">Notes (optional)</label>
        <TextField
          value={draft.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="e.g. with food"
          className="mb-3"
        />

        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-cream">Shift out of quiet hours</p>
            <p className="text-xs text-cream-faint">
              Off = fire at the exact dose time (recommended).
            </p>
          </div>
          <Toggle
            checked={draft.shiftOutOfQuietHours}
            onChange={(v) => setField('shiftOutOfQuietHours', v)}
            aria-label="Shift out of quiet hours"
          />
        </div>

        {error && <p className="mb-3 text-sm text-oxblood">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-cream-muted"
          >
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
