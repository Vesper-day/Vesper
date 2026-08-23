'use client';

// Step 4 — Module Adjustments (Chat 058, web). PRD §3.3: the user applies one-off
// modifications for the coming week (pause a module on travel days, flag a recovery
// day with no workout, note a fixed plan like a dinner out). These are applied as
// TRANSIENT constraints on generation only; NOTHING here writes modules_enabled or any
// persistent module preference. The selections are reduced to the transient payload by
// the pure buildWeekConstraints helper and handed up via onBuild.
//
// Copy comes from the client-safe @vesper/shared/copy subpath (never the bare barrel).
import { useMemo, useState } from 'react';
import { Button, Card, TextField } from '@/components/ui';
import {
  WEEK_ADJUST_HEADING,
  WEEK_ADJUST_INTRO,
  WEEK_ADJUST_PAUSE_MODULE_LABEL,
  WEEK_ADJUST_RECOVERY_LABEL,
  WEEK_ADJUST_FIXED_NOTE_LABEL,
  WEEK_ADJUST_CONTINUE_LABEL,
} from '@vesper/shared/copy';
import { addDays } from '@/lib/weekly-planning/week';
import {
  buildWeekConstraints,
  type ModuleType,
  type WeekConstraints,
  type FixedNote,
} from '@/lib/weekly-planning/weekConstraints';

// Lifestyle modules a user can pause for the week (work/sleep are always on).
const PAUSABLE_MODULES: Array<{ type: ModuleType; label: string }> = [
  { type: 'fitness', label: 'Fitness' },
  { type: 'nutrition', label: 'Nutrition' },
  { type: 'errands', label: 'Errands' },
  { type: 'medication', label: 'Medication' },
  { type: 'finance', label: 'Finance' },
];

interface WeekDay {
  date: string;
  short: string; // e.g. "Mon 24"
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function Step4ModuleAdjustments({
  targetMonday,
  onBuild,
}: {
  targetMonday: string;
  /** Hands the transient constraints up to the host, which triggers generation. */
  onBuild: (constraints: WeekConstraints) => void;
}): React.JSX.Element {
  const days = useMemo<WeekDay[]>(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(targetMonday, i);
        const short = new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
        return { date, short };
      }),
    [targetMonday],
  );

  // moduleType -> the dates it is paused on.
  const [pausedByModule, setPausedByModule] = useState<Record<string, string[]>>({});
  const [recoveryDates, setRecoveryDates] = useState<string[]>([]);
  const [notes, setNotes] = useState<FixedNote[]>([]);
  const [noteDate, setNoteDate] = useState<string>(targetMonday);
  const [noteText, setNoteText] = useState<string>('');

  const togglePause = (module: ModuleType, date: string): void =>
    setPausedByModule((prev) => ({ ...prev, [module]: toggle(prev[module] ?? [], date) }));

  const toggleRecovery = (date: string): void =>
    setRecoveryDates((prev) => toggle(prev, date));

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
      <h2 className="mb-1 text-lg font-medium text-cream">{WEEK_ADJUST_HEADING}</h2>
      <p className="mb-5 text-sm text-cream-muted">{WEEK_ADJUST_INTRO}</p>

      {/* Pause a module on chosen days */}
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-cream">{WEEK_ADJUST_PAUSE_MODULE_LABEL}</h3>
        <div className="flex flex-col gap-3">
          {PAUSABLE_MODULES.map((m) => (
            <div key={m.type}>
              <p className="mb-1 text-xs text-cream-muted">{m.label}</p>
              <div className="flex flex-wrap gap-1">
                {days.map((d) => {
                  const on = (pausedByModule[m.type] ?? []).includes(d.date);
                  return (
                    <button
                      key={d.date}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePause(m.type, d.date)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        on
                          ? 'border-bronze bg-elevated text-cream'
                          : 'border-line-subtle text-cream-muted'
                      }`}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recovery days (no workout) */}
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-cream">{WEEK_ADJUST_RECOVERY_LABEL}</h3>
        <div className="flex flex-wrap gap-1">
          {days.map((d) => {
            const on = recoveryDates.includes(d.date);
            return (
              <button
                key={d.date}
                type="button"
                aria-pressed={on}
                onClick={() => toggleRecovery(d.date)}
                className={`rounded-md border px-2 py-1 text-xs ${
                  on ? 'border-bronze bg-elevated text-cream' : 'border-line-subtle text-cream-muted'
                }`}
              >
                {d.short}
              </button>
            );
          })}
        </div>
      </section>

      {/* Fixed notes */}
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-cream">{WEEK_ADJUST_FIXED_NOTE_LABEL}</h3>
        <div className="flex items-center gap-2">
          <select
            value={noteDate}
            onChange={(e) => setNoteDate(e.target.value)}
            aria-label="Note date"
            className="rounded-md border border-line-subtle bg-transparent px-2 py-1 text-xs text-cream"
          >
            {days.map((d) => (
              <option key={d.date} value={d.date}>
                {d.short}
              </option>
            ))}
          </select>
          <TextField
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. Dinner out"
            aria-label="Note text"
            className="flex-1"
          />
          <button
            type="button"
            onClick={addNote}
            className="rounded-md border border-line-subtle px-2 py-1 text-xs text-cream"
          >
            Add
          </button>
        </div>
        {notes.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {notes.map((n, i) => (
              <li key={`${n.date}-${i}`} className="text-xs text-cream-muted">
                {n.date}: {n.note}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button variant="primary" onClick={submit}>
        {WEEK_ADJUST_CONTINUE_LABEL}
      </Button>
    </Card>
  );
}
