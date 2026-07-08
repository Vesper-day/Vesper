// Mobile Bills surface (Chat 061 — the Finance module). Finance is a MODULE, OFF by
// default and gated on modulesEnabled.finance.enabled (the SINGULAR key `finance`,
// NOT `bills`) — it is NOT a top-level tab. It mounts as a sub-screen of the Settings
// stack (settings/_layout.tsx) and is reached from the gated link in settings/index.tsx;
// this screen ALSO self-gates so a deep link while the module is off shows the
// module-off state.
//
// CRUD runs through the thin lib/bills client (the /api/v1/bills route set via the
// shared mobile API client + session) — no second transport. Chrome composes the
// mobile 107a primitives (components/ui) + named @vesper/ui tokens (no hardcoded hexes
// beyond the placeholder-color map taken verbatim from tokens.ts, the tasks/medications
// precedent for raw-color props). amount + due day are text-entry per the 107a mobile
// picker mechanism.
//
// POSTHOG POSTURE (Chat 061): NO analytics capture is wired on this surface — no
// posthog.capture on the amount / name inputs or on save. Autocapture is OFF at V1.
import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TextField, SegmentedControl } from '../../../components/ui';
import {
  listBills,
  createBill,
  updateBill,
  deleteBill,
  type Bill,
  type BillFrequency,
} from '../../../lib/bills';
import { apiClient } from '../../../lib/api/client';

// Bronze for the ActivityIndicator raw-color prop (verbatim from @vesper/ui tokens.ts).
const C = { bronze: '#B8884A' } as const;

interface ProfileGate {
  profile: { modulesEnabled: { finance: { enabled: boolean } } };
}

const FREQUENCIES: ReadonlyArray<{ label: string; value: BillFrequency }> = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annually', value: 'annually' },
  { label: 'Once', value: 'one_time' },
];

const FREQUENCY_LABEL: Record<BillFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
  one_time: 'One-time',
};

const formatAmount = (a: number | null): string | null =>
  a == null ? null : `$${a.toFixed(2)}`;

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

export default function BillsScreen(): React.JSX.Element {
  const { data: gate, isLoading: gateLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<ProfileGate>('/profile'),
  });
  const enabled = gate?.profile.modulesEnabled.finance.enabled ?? false;

  const [draft, setDraft] = useState<Draft | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bills'],
    queryFn: () => listBills(),
    enabled,
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['bills'] }).then(() => undefined);

  const saveMutation = useMutation({
    mutationFn: async (d: Draft) => {
      const name = d.name.trim();
      if (!name) throw new Error('Please give the bill a name.');

      let amount: number | null = null;
      if (d.amount.trim() !== '') {
        const n = Number(d.amount);
        if (!Number.isFinite(n) || n < 0) throw new Error('Amount must be zero or positive.');
        if (Math.round(n * 100) !== n * 100) {
          throw new Error('Amount may have at most 2 decimal places.');
        }
        amount = n;
      }

      let dueDayOfMonth: number | null = null;
      if (d.dueDayOfMonth.trim() !== '') {
        const day = Number(d.dueDayOfMonth);
        if (!Number.isInteger(day) || day < 1 || day > 31) {
          throw new Error('Due day must be a whole number between 1 and 31.');
        }
        dueDayOfMonth = day;
      }

      const category = d.category.trim() ? d.category.trim() : null;

      if (d.id) {
        return updateBill(d.id, { name, frequency: d.frequency, amount, dueDayOfMonth, category });
      }
      return createBill({
        name,
        frequency: d.frequency,
        ...(amount !== null ? { amount } : {}),
        ...(dueDayOfMonth !== null ? { dueDayOfMonth } : {}),
        ...(category !== null ? { category } : {}),
      });
    },
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBill(id),
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });

  const saveError = saveMutation.error instanceof Error ? saveMutation.error.message : null;
  const bills = data ?? [];

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
        <Text className="mb-2 text-2xl text-cream">Bills</Text>
        <Text className="text-sm text-cream-muted">
          The Finance module is off. Enable it in your profile to track bills and
          due-day reminders.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-espresso">
      <ScrollView contentContainerClassName="px-6 pb-10 pt-16">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-2xl text-cream">Bills</Text>
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
          Track your recurring bills and due days.
        </Text>

        {isLoading ? (
          <ActivityIndicator color={C.bronze} className="my-6" />
        ) : isError ? (
          <Text className="py-6 text-center text-sm text-oxblood">
            Could not load your bills.
          </Text>
        ) : bills.length === 0 ? (
          <View className="py-12">
            <Text className="text-center text-sm font-medium text-cream">No bills yet.</Text>
            <Text className="mt-1 text-center text-sm text-cream-muted">
              Tap “New” to add one.
            </Text>
          </View>
        ) : (
          bills.map((b) => {
            const deleting = deleteMutation.isPending && deleteMutation.variables === b.id;
            return (
              <View
                key={b.id}
                className="mb-2 flex-row items-start gap-3 rounded-md border border-line-subtle bg-surface px-3 py-3"
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    saveMutation.reset();
                    setDraft(draftFromBill(b));
                  }}
                  className="flex-1"
                >
                  <Text className="text-sm font-medium text-cream">
                    {b.name}
                    {formatAmount(b.amount) && (
                      <Text className="text-cream-muted"> · {formatAmount(b.amount)}</Text>
                    )}
                  </Text>
                  <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                    <Text className="text-xs text-cream-muted">{FREQUENCY_LABEL[b.frequency]}</Text>
                    {b.dueDayOfMonth != null && (
                      <Text className="text-xs text-cream-muted">Due day {b.dueDayOfMonth}</Text>
                    )}
                    {b.category && <Text className="text-xs text-bronze">{b.category}</Text>}
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={deleting}
                  onPress={() => deleteMutation.mutate(b.id)}
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
        <BillForm
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

interface BillFormProps {
  draft: Draft;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onSave: (draft: Draft) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function BillForm({
  draft: initial,
  saving,
  deleting,
  error,
  onSave,
  onDelete,
  onClose,
}: BillFormProps): React.JSX.Element {
  const [draft, setDraft] = useState<Draft>(initial);
  const isEdit = draft.id !== null;

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]): void =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-espresso/80 p-4" onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          className="max-h-[90%] w-full max-w-md rounded-xl border border-line-strong bg-surface p-5"
        >
          <ScrollView>
            <Text className="mb-4 text-lg font-semibold text-cream">
              {isEdit ? 'Edit bill' : 'New bill'}
            </Text>

            <Text className="mb-1 text-xs text-cream-muted">Name</Text>
            <TextField
              value={draft.name}
              onChangeText={(v) => setField('name', v)}
              placeholder="e.g. Rent"
              className="mb-3"
            />

            <Text className="mb-1 text-xs text-cream-muted">Amount (optional)</Text>
            <TextField
              value={draft.amount}
              onChangeText={(v) => setField('amount', v)}
              keyboardType="decimal-pad"
              placeholder="e.g. 1200.00"
              className="mb-3"
            />

            <Text className="mb-1 text-xs text-cream-muted">Frequency</Text>
            <View className="mb-3">
              <SegmentedControl
                options={FREQUENCIES}
                value={draft.frequency}
                onChange={(v) => setField('frequency', v as BillFrequency)}
              />
            </View>

            <Text className="mb-1 text-xs text-cream-muted">Due day of month (optional)</Text>
            <TextField
              value={draft.dueDayOfMonth}
              onChangeText={(v) => setField('dueDayOfMonth', v)}
              keyboardType="number-pad"
              placeholder="1–31"
              className="mb-3"
            />

            <Text className="mb-1 text-xs text-cream-muted">Category (optional)</Text>
            <TextField
              value={draft.category}
              onChangeText={(v) => setField('category', v)}
              placeholder="e.g. Utilities"
              className="mb-3"
            />

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
