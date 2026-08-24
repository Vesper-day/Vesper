// Mobile Fitness surface (Chat ADD-C) — the second GENERATIVE module screen, shipped at
// method-B functional-breadth scaffold depth (PRD §6.2): a workout-schedule list (the
// 047/048 corpus filtered to the user's fitness prefs), a tailored-generation surface
// that REUSES the chat-049 selection/adaptation path, and a lift-logging surface backed
// by the lift_log_entries table. DEEP fitness (bronze->platinum strength-rank;
// world-standard percentile mapping) is DEFERRED — this screen names it and reserves a
// slot, and ships none of it.
//
// The Fitness MODULE is OFF by default and gated on modulesEnabled.fitness.enabled — it
// is NOT a top-level tab. It mounts in the Modules stack ((tabs)/modules/_layout.tsx) at
// /modules/fitness and is reached from its card on the Modules list; this screen ALSO
// self-gates so a deep link while the module is off shows the module-off state.
//
// Data reaches mobile only through /api/v1 (the shared apiClient). The wire TYPES + label
// helpers come from the pure ../../../lib/fitness module (no @vesper/shared barrel). Chrome
// composes the mobile 107a primitives + named @vesper/ui tokens. Labels are FIXED plain
// strings (ADD-C authors no new voice copy). No visual polish (a later Fable pass styles
// this screen).
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TextField } from '../../../components/ui';
import { apiClient } from '../../../lib/api/client';
import {
  liftLogEntryLabel,
  workoutScheduleItemLabel,
  type LiftLogEntry,
  type WorkoutScheduleItem,
} from '../../../lib/fitness';

// Bronze for the ActivityIndicator raw-color prop (verbatim from @vesper/ui tokens.ts).
const C = { bronze: '#B8884A' } as const;

interface ProfileGate {
  profile: { modulesEnabled: { fitness: { enabled: boolean } } };
}

const LIFT_LOG_KEY = ['fitness', 'lift-log'] as const;

export default function FitnessScreen(): React.JSX.Element {
  const { data: gate, isLoading: gateLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<ProfileGate>('/profile'),
  });
  const enabled = gate?.profile.modulesEnabled.fitness.enabled ?? false;

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
        <Text className="mb-2 text-2xl text-cream">Fitness</Text>
        <Text className="text-sm text-cream-muted">
          Turn Fitness on in Settings to plan workouts and log your lifts.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-espresso">
      <ScrollView contentContainerClassName="px-6 pb-10 pt-16">
        <Text className="mb-1 text-2xl text-cream">Fitness</Text>
        <Text className="mb-6 text-sm text-cream-muted">
          Your workout schedule, a tailored pick, and your lift log.
        </Text>

        <WorkoutScheduleSection />
        <TailoredSection />
        <LiftLogSection />

        {/* Reserved slot for the DEFERRED deep-engine surfaces: the bronze->platinum
            strength-rank and world-standard percentile mapping (PRD §6.2). Named here,
            shipped as none. */}
        <View className="mt-2 rounded-xl border border-line-subtle bg-surface p-4">
          <Text className="mb-1 text-sm font-medium text-cream">
            Strength rank and percentile
          </Text>
          <Text className="text-xs text-cream-faint">
            Rank and world-standard percentile are coming in a later release. This space is
            held for them.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// --- Workout-schedule surface ------------------------------------------------

function WorkoutScheduleSection(): React.JSX.Element {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['fitness', 'workouts'],
    queryFn: () => apiClient.get<{ workouts: WorkoutScheduleItem[] }>('/fitness/workouts'),
  });

  const workouts = data?.workouts ?? [];

  return (
    <View className="mb-6 rounded-xl border border-line-subtle bg-surface p-4">
      <Text className="mb-3 text-lg font-semibold text-cream">Workout schedule</Text>

      {isLoading ? (
        <ActivityIndicator color={C.bronze} className="my-4" />
      ) : isError ? (
        <Text className="py-4 text-center text-sm text-oxblood">
          Could not load your workouts.
        </Text>
      ) : workouts.length === 0 ? (
        <Text className="py-4 text-center text-sm text-cream-muted">
          No workouts match your fitness preferences yet.
        </Text>
      ) : (
        workouts.map((workout) => (
          <View
            key={workout.id}
            className="mt-2 rounded-md border border-line-subtle px-3 py-2"
          >
            <Text className="text-sm text-cream">{workoutScheduleItemLabel(workout)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

// --- Tailored-generation surface (reuses chat-049 selection) ------------------

function TailoredSection(): React.JSX.Element {
  const [energy, setEnergy] = useState('');

  const tailoredMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<{ workout: WorkoutScheduleItem | null }>('/fitness/tailored', body),
  });

  const submit = (): void => {
    const trimmed = energy.trim();
    const score = trimmed === '' ? null : Number.parseInt(trimmed, 10);
    const body: Record<string, unknown> =
      score !== null && Number.isFinite(score) ? { energyScore: score } : {};
    tailoredMutation.mutate(body);
  };

  const picked = tailoredMutation.data?.workout ?? null;

  return (
    <View className="mb-6 rounded-xl border border-line-subtle bg-surface p-4">
      <Text className="mb-1 text-lg font-semibold text-cream">Tailored workout</Text>
      <Text className="mb-3 text-xs text-cream-faint">
        Pick one workout tuned to your preferences and today&apos;s energy.
      </Text>

      <TextField
        value={energy}
        onChangeText={setEnergy}
        placeholder="Energy 1-10 (optional)"
        className="mb-2"
      />
      <Pressable
        accessibilityRole="button"
        disabled={tailoredMutation.isPending}
        onPress={submit}
        className="mb-3 self-start rounded-md bg-bronze px-3 py-2"
      >
        <Text className="text-sm font-medium text-espresso">
          {tailoredMutation.isPending ? 'Choosing…' : 'Suggest a workout'}
        </Text>
      </Pressable>

      {tailoredMutation.isError && (
        <Text className="text-sm text-oxblood">Could not suggest a workout.</Text>
      )}
      {tailoredMutation.data &&
        (picked ? (
          <View className="rounded-md border border-line-subtle p-3">
            <Text className="text-sm text-cream">{workoutScheduleItemLabel(picked)}</Text>
          </View>
        ) : (
          <Text className="text-sm text-cream-muted">
            No workout matches your preferences yet.
          </Text>
        ))}
    </View>
  );
}

// --- Lift-log surface --------------------------------------------------------

function LiftLogSection(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [exerciseName, setExerciseName] = useState('');
  const [setNumber, setSetNumber] = useState('1');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');

  const { data, isLoading, isError } = useQuery({
    queryKey: LIFT_LOG_KEY,
    queryFn: () => apiClient.get<{ entries: LiftLogEntry[] }>('/fitness/lift-log'),
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: LIFT_LOG_KEY }).then(() => undefined);

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<LiftLogEntry>('/fitness/lift-log', body),
    onSuccess: async () => {
      setReps('');
      setWeight('');
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/fitness/lift-log/${id}`),
    onSuccess: () => invalidate(),
  });

  const entries = data?.entries ?? [];

  const submit = (): void => {
    const name = exerciseName.trim();
    const setNo = Number.parseInt(setNumber.trim(), 10);
    if (!name || !Number.isFinite(setNo) || setNo <= 0) return;
    const body: Record<string, unknown> = { exerciseName: name, setNumber: setNo };
    const repsNo = reps.trim() === '' ? null : Number.parseInt(reps.trim(), 10);
    if (repsNo !== null && Number.isFinite(repsNo)) body.reps = repsNo;
    const weightNo = weight.trim() === '' ? null : Number.parseFloat(weight.trim());
    if (weightNo !== null && Number.isFinite(weightNo)) {
      body.weight = weightNo;
      body.weightUnit = weightUnit;
    }
    addMutation.mutate(body);
  };

  const canSubmit =
    exerciseName.trim() !== '' && Number.parseInt(setNumber.trim(), 10) > 0;

  return (
    <View className="mb-6 rounded-xl border border-line-subtle bg-surface p-4">
      <Text className="mb-3 text-lg font-semibold text-cream">Lift log</Text>

      <TextField
        value={exerciseName}
        onChangeText={setExerciseName}
        placeholder="Exercise"
        className="mb-2"
      />
      <TextField
        value={setNumber}
        onChangeText={setSetNumber}
        placeholder="Set number"
        className="mb-2"
      />
      <TextField
        value={reps}
        onChangeText={setReps}
        placeholder="Reps (optional)"
        className="mb-2"
      />
      <TextField
        value={weight}
        onChangeText={setWeight}
        placeholder="Weight (optional)"
        className="mb-2"
      />
      <View className="mb-2 flex-row gap-1">
        {(['kg', 'lb'] as const).map((unit) => (
          <Pressable
            key={unit}
            accessibilityRole="button"
            onPress={() => setWeightUnit(unit)}
            className={`rounded-md border px-3 py-2 ${
              weightUnit === unit ? 'border-bronze' : 'border-line-subtle'
            }`}
          >
            <Text
              className={`text-xs ${weightUnit === unit ? 'text-bronze' : 'text-cream-muted'}`}
            >
              {unit}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={addMutation.isPending || !canSubmit}
        onPress={submit}
        className="mb-3 self-start rounded-md bg-bronze px-3 py-2"
      >
        <Text className="text-sm font-medium text-espresso">
          {addMutation.isPending ? 'Saving…' : 'Log set'}
        </Text>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator color={C.bronze} className="my-4" />
      ) : isError ? (
        <Text className="py-4 text-center text-sm text-oxblood">
          Could not load your lift log.
        </Text>
      ) : entries.length === 0 ? (
        <Text className="py-4 text-center text-sm text-cream-muted">
          No sets logged today.
        </Text>
      ) : (
        entries.map((entry) => {
          const deleting = deleteMutation.isPending && deleteMutation.variables === entry.id;
          return (
            <View
              key={entry.id}
              className="mt-2 flex-row items-center justify-between gap-3 rounded-md border border-line-subtle px-3 py-2"
            >
              <Text className="flex-1 text-sm text-cream">{liftLogEntryLabel(entry)}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => deleteMutation.mutate(entry.id)}
                className="rounded-md border border-oxblood px-2 py-1"
              >
                <Text className="text-xs text-oxblood">{deleting ? '…' : 'Remove'}</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}
