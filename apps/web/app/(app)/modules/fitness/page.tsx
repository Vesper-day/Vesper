'use client';

// Web Fitness surface (Chat ADD-C) — the second GENERATIVE module page, shipped at
// method-B functional-breadth scaffold depth (PRD §6.2): a workout-schedule list (the
// 047/048 corpus filtered to the user's fitness prefs), a tailored-generation surface
// that REUSES the chat-049 selection/adaptation path, and a lift-logging surface backed
// by the lift_log_entries table. DEEP fitness (bronze->platinum strength-rank;
// world-standard percentile mapping) is DEFERRED — the page names it and reserves a
// layout slot, and ships none of it.
//
// The Fitness MODULE is OFF by default and gated on profile.modulesEnabled.fitness.enabled.
// Reached from its card on the /modules list; self-gates so a deep link while the module
// is off shows the module-off state.
//
// IMPORT SAFETY: this 'use client' file imports NO @vesper/shared barrel (which would
// pull server-only code into the client bundle) — only the client-safe @vesper/shared/fitness
// subpath and the pure @/lib/fitness helpers. Chrome composes the 107/107a primitives
// (@/components/ui) + named @vesper/ui tokens. Labels are FIXED plain strings (ADD-C
// authors no new voice copy). No visual polish here (a later Fable pass styles this page).
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, TextField } from '@/components/ui';
import { liftLogEntryLabel, workoutScheduleItemLabel } from '@/lib/fitness';
import type {
  LiftLogListResponse,
  LiftLogEntry,
  WorkoutScheduleResponse,
  TailoredWorkoutResponse,
} from '@vesper/shared/fitness';

interface ProfileGate {
  profile: { modulesEnabled: { fitness: { enabled: boolean } } };
}

// DELETE returns 204 with an empty body; the shared api.delete helper calls res.json()
// and would throw on it, so delete goes through a direct fetch (nutrition precedent).
async function deleteLiftLogRequest(id: string): Promise<void> {
  const res = await fetch(`/api/v1/fitness/lift-log/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

const LIFT_LOG_KEY = ['fitness', 'lift-log'] as const;

export default function FitnessPage(): React.JSX.Element {
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

  const enabled = gate?.profile.modulesEnabled.fitness.enabled ?? false;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-cream">Fitness</h1>
        <p className="text-sm text-cream-muted">
          Your workout schedule, a tailored pick, and your lift log.
        </p>
      </header>

      {enabled ? (
        <div className="flex flex-col gap-6">
          <WorkoutScheduleSection />
          <TailoredSection />
          <LiftLogSection />
          {/* Reserved slot for the DEFERRED deep-engine surfaces: the bronze->platinum
              strength-rank and world-standard percentile mapping (PRD §6.2). Named here,
              shipped as none — this is where they mount later. */}
          <Card className="p-4">
            <h2 className="mb-1 text-sm font-medium text-cream">
              Strength rank and percentile
            </h2>
            <p className="text-xs text-cream-faint">
              Rank and world-standard percentile are coming in a later release. This space
              is held for them.
            </p>
          </Card>
        </div>
      ) : (
        <Card className="p-6">
          <p className="text-sm font-medium text-cream">The Fitness module is off.</p>
          <p className="mt-1 text-sm text-cream-muted">
            Turn Fitness on in Settings to plan workouts and log your lifts.
          </p>
        </Card>
      )}
    </main>
  );
}

// --- Workout-schedule surface ------------------------------------------------

function WorkoutScheduleSection(): React.JSX.Element {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['fitness', 'workouts'],
    queryFn: () => api.get<WorkoutScheduleResponse>('/fitness/workouts'),
  });

  const workouts = data?.workouts ?? [];

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-lg font-semibold text-cream">Workout schedule</h2>

      {isError ? (
        <p className="py-6 text-center text-sm text-oxblood">
          Could not load your workouts.
        </p>
      ) : isLoading ? (
        <p className="py-6 text-center text-sm text-cream-muted">Loading…</p>
      ) : workouts.length === 0 ? (
        <p className="py-6 text-center text-sm text-cream-muted">
          No workouts match your fitness preferences yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {workouts.map((workout) => (
            <div
              key={workout.id}
              className="rounded-md border border-line-subtle px-3 py-2"
            >
              <p className="text-sm text-cream">{workoutScheduleItemLabel(workout)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// --- Tailored-generation surface (reuses chat-049 selection) ------------------

function TailoredSection(): React.JSX.Element {
  const [energy, setEnergy] = useState('');

  const tailoredMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<TailoredWorkoutResponse>('/fitness/tailored', body),
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
    <Card className="p-4">
      <h2 className="mb-1 text-lg font-semibold text-cream">Tailored workout</h2>
      <p className="mb-3 text-xs text-cream-faint">
        Pick one workout tuned to your preferences and today&apos;s energy.
      </p>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <TextField
          value={energy}
          onChange={(e) => setEnergy(e.target.value)}
          placeholder="Energy 1-10 (optional)"
          className="flex-1"
          aria-label="Energy score"
          inputMode="numeric"
        />
        <Button onClick={submit} disabled={tailoredMutation.isPending}>
          {tailoredMutation.isPending ? 'Choosing…' : 'Suggest a workout'}
        </Button>
      </div>

      {tailoredMutation.isError && (
        <p className="text-sm text-oxblood">Could not suggest a workout.</p>
      )}
      {tailoredMutation.data &&
        (picked ? (
          <div className="rounded-md border border-line-subtle p-3">
            <p className="text-sm text-cream">{workoutScheduleItemLabel(picked)}</p>
          </div>
        ) : (
          <p className="text-sm text-cream-muted">
            No workout matches your preferences yet.
          </p>
        ))}
    </Card>
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
    queryFn: () => api.get<LiftLogListResponse>('/fitness/lift-log'),
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: LIFT_LOG_KEY }).then(() => undefined);

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<LiftLogEntry>('/fitness/lift-log', body),
    onSuccess: async () => {
      setReps('');
      setWeight('');
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLiftLogRequest(id),
    onSuccess: () => invalidate(),
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);

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

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-lg font-semibold text-cream">Lift log</h2>

      <div className="mb-2 flex flex-col gap-2 sm:flex-row">
        <TextField
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          placeholder="Exercise"
          className="flex-1"
          aria-label="Exercise name"
        />
        <TextField
          value={setNumber}
          onChange={(e) => setSetNumber(e.target.value)}
          placeholder="Set"
          className="w-20"
          aria-label="Set number"
          inputMode="numeric"
        />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <TextField
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="Reps (optional)"
          className="flex-1"
          aria-label="Reps"
          inputMode="numeric"
        />
        <TextField
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Weight (optional)"
          className="flex-1"
          aria-label="Weight"
          inputMode="decimal"
        />
        <div className="flex gap-1">
          {(['kg', 'lb'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => setWeightUnit(unit)}
              className={`rounded-md border px-3 py-2 text-xs ${
                weightUnit === unit
                  ? 'border-bronze text-bronze'
                  : 'border-line-subtle text-cream-muted'
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
        <Button
          onClick={submit}
          disabled={
            addMutation.isPending ||
            exerciseName.trim() === '' ||
            Number.parseInt(setNumber.trim(), 10) <= 0
          }
        >
          {addMutation.isPending ? 'Saving…' : 'Log set'}
        </Button>
      </div>

      {isError ? (
        <p className="py-6 text-center text-sm text-oxblood">Could not load your lift log.</p>
      ) : isLoading ? (
        <p className="py-6 text-center text-sm text-cream-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-cream-muted">
          No sets logged today.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line-subtle px-3 py-2"
            >
              <p className="text-sm text-cream">{liftLogEntryLabel(entry)}</p>
              <button
                type="button"
                disabled={deleteMutation.isPending && deleteMutation.variables === entry.id}
                onClick={() => deleteMutation.mutate(entry.id)}
                className="rounded-md border border-oxblood px-2 py-1 text-xs text-oxblood"
              >
                {deleteMutation.isPending && deleteMutation.variables === entry.id
                  ? '…'
                  : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
