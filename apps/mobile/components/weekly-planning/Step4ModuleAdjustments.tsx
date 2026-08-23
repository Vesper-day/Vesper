// Step 4 — Module Adjustments (Chat 058, mobile twin of the web Step4). PRD §3.3:
// one-off modifications for the coming week (pause a module on travel days, flag a
// recovery day with no workout, note a fixed plan) applied as TRANSIENT constraints on
// generation only. NOTHING here writes modules_enabled or any persistent preference:
// the pure buildWeekConstraints helper reduces the selections to the transient payload.
//
// Copy comes from the client-safe @vesper/shared/copy subpath (the OverCommitPrompt
// precedent); zero @vesper/db, zero @vesper/ai.
import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import {
  WEEK_ADJUST_HEADING,
  WEEK_ADJUST_INTRO,
  WEEK_ADJUST_PAUSE_MODULE_LABEL,
  WEEK_ADJUST_RECOVERY_LABEL,
  WEEK_ADJUST_FIXED_NOTE_LABEL,
  WEEK_ADJUST_CONTINUE_LABEL,
} from '@vesper/shared/copy';
import {
  buildWeekConstraints,
  type ModuleType,
  type WeekConstraints,
  type FixedNote,
} from '../../lib/weekConstraints';

const PAUSABLE_MODULES: Array<{ type: ModuleType; label: string }> = [
  { type: 'fitness', label: 'Fitness' },
  { type: 'nutrition', label: 'Nutrition' },
  { type: 'errands', label: 'Errands' },
  { type: 'medication', label: 'Medication' },
  { type: 'finance', label: 'Finance' },
];

/** Shift a YYYY-MM-DD by n days (UTC). Leaf helper (no lib import that pulls RN deps). */
function addDaysUtc(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function DayPill({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`rounded-md border px-2 py-1 ${
        on ? 'border-bronze bg-elevated' : 'border-line-subtle'
      }`}
    >
      <Text className={`text-xs ${on ? 'text-cream' : 'text-cream-muted'}`}>{label}</Text>
    </Pressable>
  );
}

export function Step4ModuleAdjustments({
  targetMonday,
  onBuild,
}: {
  targetMonday: string;
  onBuild: (constraints: WeekConstraints) => void;
}): React.JSX.Element {
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDaysUtc(targetMonday, i);
        const short = new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
        return { date, short };
      }),
    [targetMonday],
  );

  const [pausedByModule, setPausedByModule] = useState<Record<string, string[]>>({});
  const [recoveryDates, setRecoveryDates] = useState<string[]>([]);
  const [notes, setNotes] = useState<FixedNote[]>([]);
  const [noteDate, setNoteDate] = useState<string>(targetMonday);
  const [noteText, setNoteText] = useState<string>('');

  const togglePause = (module: ModuleType, date: string): void =>
    setPausedByModule((prev) => ({ ...prev, [module]: toggle(prev[module] ?? [], date) }));

  const addNote = (): void => {
    if (noteText.trim().length === 0) return;
    setNotes((prev) => [...prev, { date: noteDate, note: noteText.trim() }]);
    setNoteText('');
  };

  const submit = (): void => {
    const constraints = buildWeekConstraints({
      pausedModules: PAUSABLE_MODULES.map((m) => ({
        moduleType: m.type,
        dates: pausedByModule[m.type] ?? [],
      })),
      recoveryDates,
      fixedNotes: notes,
    });
    onBuild(constraints);
  };

  return (
    <Card className="p-6">
      <Text className="mb-1 text-lg font-medium text-cream">{WEEK_ADJUST_HEADING}</Text>
      <Text className="mb-5 text-sm text-cream-muted">{WEEK_ADJUST_INTRO}</Text>

      <View className="mb-6">
        <Text className="mb-2 text-sm font-medium text-cream">{WEEK_ADJUST_PAUSE_MODULE_LABEL}</Text>
        <View className="gap-3">
          {PAUSABLE_MODULES.map((m) => (
            <View key={m.type}>
              <Text className="mb-1 text-xs text-cream-muted">{m.label}</Text>
              <View className="flex-row flex-wrap gap-1">
                {days.map((d) => (
                  <DayPill
                    key={d.date}
                    label={d.short}
                    on={(pausedByModule[m.type] ?? []).includes(d.date)}
                    onPress={() => togglePause(m.type, d.date)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="mb-6">
        <Text className="mb-2 text-sm font-medium text-cream">{WEEK_ADJUST_RECOVERY_LABEL}</Text>
        <View className="flex-row flex-wrap gap-1">
          {days.map((d) => (
            <DayPill
              key={d.date}
              label={d.short}
              on={recoveryDates.includes(d.date)}
              onPress={() => setRecoveryDates((prev) => toggle(prev, d.date))}
            />
          ))}
        </View>
      </View>

      <View className="mb-6">
        <Text className="mb-2 text-sm font-medium text-cream">{WEEK_ADJUST_FIXED_NOTE_LABEL}</Text>
        <View className="mb-2 flex-row flex-wrap gap-1">
          {days.map((d) => (
            <DayPill
              key={d.date}
              label={d.short}
              on={noteDate === d.date}
              onPress={() => setNoteDate(d.date)}
            />
          ))}
        </View>
        <View className="flex-row items-center gap-2">
          <TextField
            value={noteText}
            onChangeText={setNoteText}
            placeholder="e.g. Dinner out"
            className="flex-1"
          />
          <Button title="Add" variant="ghost" onPress={addNote} />
        </View>
        {notes.length > 0 && (
          <View className="mt-2 gap-1">
            {notes.map((n, i) => (
              <Text key={`${n.date}-${i}`} className="text-xs text-cream-muted">
                {n.date}: {n.note}
              </Text>
            ))}
          </View>
        )}
      </View>

      <Button title={WEEK_ADJUST_CONTINUE_LABEL} variant="primary" onPress={submit} />
    </Card>
  );
}
