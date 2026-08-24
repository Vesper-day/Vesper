// Mobile Medications surface (Chat 060; re-homed under the Modules tab by ADD-A).
// Medications is a MODULE, OFF by default and gated on modulesEnabled.medication.enabled
// — it is NOT a top-level tab. It mounts as a page in the Modules stack
// ((tabs)/modules/_layout.tsx) at /modules/medications and is reached from its card on
// the Modules list ((tabs)/modules/index.tsx); this screen ALSO self-gates so a deep
// link while the module is off shows the module-off state. CRUD/scheduler logic is
// unchanged by the re-home.
//
// CRUD runs through the thin lib/medications client (the EXISTING /api/v1/medications
// route set via the shared mobile API client + session) — no second transport. Chrome
// composes the mobile 107a primitives (components/ui) + named @vesper/ui tokens (no
// hardcoded hexes beyond the placeholder-color map taken verbatim from tokens.ts, the
// tasks-screen precedent for raw-color props). The times[] picker is text-entry
// (TimePicker → "HH:mm") until a future on-device wheel pass.
import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TextField,
  Toggle,
  SegmentedControl,
  TimePicker,
  DatePicker,
} from '../../../components/ui';
import {
  listMedications,
  createMedication,
  updateMedication,
  deleteMedication,
  type Medication,
  type MedicationFrequency,
} from '../../../lib/medications';
import { apiClient } from '../../../lib/api/client';

// Bronze for the ActivityIndicator raw-color prop (verbatim from @vesper/ui tokens.ts).
const C = { bronze: '#B8884A' } as const;

interface ProfileGate {
  profile: { modulesEnabled: { medication: { enabled: boolean } } };
}

const FREQUENCIES: ReadonlyArray<{ label: string; value: MedicationFrequency }> = [
  { label: 'Daily', value: 'daily' },
  { label: 'Twice', value: 'twice_daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Custom', value: 'custom' },
];

const FREQUENCY_LABEL: Record<MedicationFrequency, string> = {
  daily: 'Daily',
  twice_daily: 'Twice daily',
  weekly: 'Weekly',
  custom: 'Custom',
};

const trimSeconds = (t: string): string => t.slice(0, 5);

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

export default function MedicationsScreen(): React.JSX.Element {
  const { data: gate, isLoading: gateLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<ProfileGate>('/profile'),
  });
  const enabled = gate?.profile.modulesEnabled.medication.enabled ?? false;

  const [draft, setDraft] = useState<Draft | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['medications'],
    queryFn: () => listMedications(),
    enabled,
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['medications'] }).then(() => undefined);

  const saveMutation = useMutation({
    mutationFn: async (d: Draft) => {
      const name = d.name.trim();
      const dose = d.dose.trim();
      if (!name) throw new Error('Please give the medication a name.');
      if (!dose) throw new Error('Please enter a dose.');
      if (!d.startDate) throw new Error('Please choose a start date (YYYY-MM-DD).');
      if (d.endDate && d.endDate < d.startDate) {
        throw new Error('The end date must be on or after the start date.');
      }
      const times = d.times.map((t) => t.trim()).filter((t) => t !== '');
      if (d.id) {
        return updateMedication(d.id, {
          name,
          dose,
          frequency: d.frequency,
          times,
          startDate: d.startDate,
          endDate: d.endDate ? d.endDate : null,
          notes: d.notes.trim() ? d.notes.trim() : null,
          shiftOutOfQuietHours: d.shiftOutOfQuietHours,
        });
      }
      return createMedication({
        name,
        dose,
        frequency: d.frequency,
        times,
        startDate: d.startDate,
        ...(d.endDate ? { endDate: d.endDate } : {}),
        ...(d.notes.trim() ? { notes: d.notes.trim() } : {}),
        shiftOutOfQuietHours: d.shiftOutOfQuietHours,
      });
    },
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMedication(id),
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });

  const saveError = saveMutation.error instanceof Error ? saveMutation.error.message : null;
  const medications = data ?? [];

  if (gateLoading) {
    return (
      <View className="flex-1 bg-espresso px-6 pt-16">
        <ActivityIndicator color={C.bronze} className="my-6" />
      </View>
    );
  }

  if (!enabled) {
    return (
      <View className="flex-1 bg-espresso px-6 pt-16">
        <Text className="mb-2 text-2xl text-cream">Medications</Text>
        <Text className="text-sm text-cream-muted">
          The Medications module is off. Enable it in your profile to track medications
          and dose reminders.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-espresso">
      <ScrollView contentContainerClassName="px-6 pb-10 pt-16">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-2xl text-cream">Medications</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              saveMutation.reset();
              setDraft(emptyDraft());
            }}
            className="rounded-md bg-bronze px-3 py-2"
          >
            <Text className="text-sm font-medium text-espresso">New</Text>
          </Pressable>
        </View>
        <Text className="mb-4 text-sm text-cream-muted">
          Track your medications and dose times.
        </Text>

        {isLoading ? (
          <ActivityIndicator color={C.bronze} className="my-6" />
        ) : isError ? (
          <Text className="py-6 text-center text-sm text-oxblood">
            Could not load your medications.
          </Text>
        ) : medications.length === 0 ? (
          <View className="py-12">
            <Text className="text-center text-sm font-medium text-cream">
              No medications yet.
            </Text>
            <Text className="mt-1 text-center text-sm text-cream-muted">
              Tap “New” to add one.
            </Text>
          </View>
        ) : (
          medications.map((m) => {
            const deleting = deleteMutation.isPending && deleteMutation.variables === m.id;
            return (
              <View
                key={m.id}
                className="mb-2 flex-row items-start gap-3 rounded-md border border-line-subtle bg-surface px-3 py-3"
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    saveMutation.reset();
                    setDraft(draftFromMedication(m));
                  }}
                  className="flex-1"
                >
                  <Text className="text-sm font-medium text-cream">
                    {m.name} <Text className="text-cream-muted">· {m.dose}</Text>
                  </Text>
                  <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                    <Text className="text-xs text-cream-muted">
                      {FREQUENCY_LABEL[m.frequency]}
                    </Text>
                    {m.times.length > 0 && (
                      <Text className="text-xs text-cream-muted">
                        {m.times.map(trimSeconds).join(', ')}
                      </Text>
                    )}
                    {m.shiftOutOfQuietHours && (
                      <Text className="text-xs text-bronze">Shifts quiet hours</Text>
                    )}
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={deleting}
                  onPress={() => deleteMutation.mutate(m.id)}
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
        <MedicationForm
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

interface MedicationFormProps {
  draft: Draft;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onSave: (draft: Draft) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function MedicationForm({
  draft: initial,
  saving,
  deleting,
  error,
  onSave,
  onDelete,
  onClose,
}: MedicationFormProps): React.JSX.Element {
  const [draft, setDraft] = useState<Draft>(initial);
  const isEdit = draft.id !== null;

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]): void =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setTime = (i: number, value: string): void =>
    setDraft((d) => ({ ...d, times: d.times.map((t, idx) => (idx === i ? value : t)) }));
  const addTime = (): void => setDraft((d) => ({ ...d, times: [...d.times, ''] }));
  const removeTime = (i: number): void =>
    setDraft((d) => ({ ...d, times: d.times.filter((_, idx) => idx !== i) }));

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-espresso/80 p-4" onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          className="max-h-[90%] w-full max-w-md rounded-xl border border-line-strong bg-surface p-5"
        >
          <ScrollView>
            <Text className="mb-4 text-lg font-semibold text-cream">
              {isEdit ? 'Edit medication' : 'New medication'}
            </Text>

            <Text className="mb-1 text-xs text-cream-muted">Name</Text>
            <TextField
              value={draft.name}
              onChangeText={(v) => setField('name', v)}
              placeholder="e.g. Metformin"
              className="mb-3"
            />

            <Text className="mb-1 text-xs text-cream-muted">Dose</Text>
            <TextField
              value={draft.dose}
              onChangeText={(v) => setField('dose', v)}
              placeholder="e.g. 500mg"
              className="mb-3"
            />

            <Text className="mb-1 text-xs text-cream-muted">Frequency</Text>
            <View className="mb-3">
              <SegmentedControl
                options={FREQUENCIES}
                value={draft.frequency}
                onChange={(v) => setField('frequency', v as MedicationFrequency)}
              />
            </View>

            <Text className="mb-1 text-xs text-cream-muted">Dose times (HH:mm)</Text>
            <View className="mb-3 gap-2">
              {draft.times.map((t, i) => (
                <View key={i} className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <TimePicker value={t} onChange={(v) => setTime(i, v)} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => removeTime(i)}
                    className="rounded-md border border-line-subtle px-2 py-2"
                  >
                    <Text className="text-xs text-cream-muted">Remove</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={addTime}
                className="self-start rounded-md border border-line-subtle px-2 py-1.5"
              >
                <Text className="text-xs text-cream">Add time</Text>
              </Pressable>
            </View>

            <Text className="mb-1 text-xs text-cream-muted">Start date</Text>
            <View className="mb-3">
              <DatePicker value={draft.startDate} onChange={(v) => setField('startDate', v)} />
            </View>

            <Text className="mb-1 text-xs text-cream-muted">End date (optional)</Text>
            <View className="mb-3">
              <DatePicker value={draft.endDate} onChange={(v) => setField('endDate', v)} />
            </View>

            <Text className="mb-1 text-xs text-cream-muted">Notes (optional)</Text>
            <TextField
              value={draft.notes}
              onChangeText={(v) => setField('notes', v)}
              placeholder="e.g. with food"
              className="mb-3"
            />

            <View className="mb-4 flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-sm text-cream">Shift out of quiet hours</Text>
                <Text className="text-xs text-cream-faint">
                  Off = fire at the exact dose time (recommended).
                </Text>
              </View>
              <Toggle
                checked={draft.shiftOutOfQuietHours}
                onChange={(v) => setField('shiftOutOfQuietHours', v)}
              />
            </View>

            {error && <Text className="mb-3 text-sm text-oxblood">{error}</Text>}

            <View className="flex-row items-center justify-between">
              {isEdit ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={deleting}
                  onPress={() => draft.id && onDelete(draft.id)}
                  className="rounded-md border border-oxblood px-3 py-2"
                >
                  <Text className="text-sm text-oxblood">
                    {deleting ? 'Deleting…' : 'Delete'}
                  </Text>
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
                  onPress={() => onSave(draft)}
                  className="rounded-md bg-bronze px-3 py-2"
                >
                  <Text className="text-sm font-medium text-espresso">
                    {saving ? 'Saving…' : 'Save'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
