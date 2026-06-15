// Chat 023 scaffold — workout template selection.
//
// Model: claude-haiku-4-5 (TECHNICAL_SPEC.md §5 — "template selection from a
// pre-filtered candidate set (input is user goal, energy, and equipment; output is
// a template UUID)"). Structured output via generateObject; NOT voice-gated.
//
// The candidate set is PASSED IN (the Layer-3 subset built upstream); this function
// issues no DB query. The model picks one candidate UUID. If it returns nothing
// usable (null, or an id outside the candidate set), we fall back deterministically.
//
// FALLBACK NOTE: the build plan calls for "lowest-rest-required" candidate. The real
// workout_templates schema (packages/db/src/schema/templates.ts) has no rest column;
// the typed proxy for "least recovery demanded" is the lowest intensity_score, so the
// fallback selects the lowest-intensity candidate.

import { z } from 'zod';
import type { WorkoutTemplate } from './context/templateSubset';
import { generateObject } from './generateObject';
import { MODELS } from './client';
import { TEMPLATE_SELECTION_PROMPT } from './prompts/template-selection';

export type WorkoutSelectionInput = {
  /** User fitness preferences (modules_enabled.fitness): goal, equipment, level. */
  fitnessPrefs: {
    goal?: string;
    equipment?: string[];
    level?: string;
  };
  /** Morning energy score 1–10, or null if not yet captured. */
  energyScore: number | null;
  /** Pre-filtered candidate templates (Layer-3 subset). Must be non-empty. */
  candidates: WorkoutTemplate[];
};

const SelectionResultSchema = z.object({
  templateId: z.string().uuid().nullable(),
});

/** Lowest-intensity candidate — the gentlest, least-recovery option. */
function fallbackCandidate(candidates: WorkoutTemplate[]): WorkoutTemplate {
  return candidates.reduce((best, c) =>
    c.intensityScore < best.intensityScore ? c : best,
  );
}

/**
 * Select a workout template UUID from the passed-in candidate set. Returns a
 * deterministic fallback (lowest intensity) when the model returns no usable id.
 *
 * @throws when the candidate set is empty (caller contract violation).
 */
export async function selectWorkoutTemplate(
  input: WorkoutSelectionInput,
): Promise<string> {
  const { fitnessPrefs, energyScore, candidates } = input;
  if (candidates.length === 0) {
    throw new Error('selectWorkoutTemplate: candidate set is empty');
  }

  const fallback = fallbackCandidate(candidates);

  const promptLines = [
    `Goal: ${fitnessPrefs.goal ?? 'unspecified'}`,
    `Level: ${fitnessPrefs.level ?? 'unspecified'}`,
    `Equipment: ${(fitnessPrefs.equipment ?? []).join(', ') || 'none'}`,
    `Energy score (1-10): ${energyScore ?? 'unknown'}`,
    'Candidates:',
    ...candidates.map(
      (c) =>
        `- ${c.id} | ${c.name} | ${c.durationMinutes}min | level ${c.level} | intensity ${c.intensityScore}`,
    ),
    'Return the template_id of the single best match, or null if none fit.',
  ];

  const { object } = await generateObject({
    schema: SelectionResultSchema,
    model: MODELS.HAIKU,
    callType: 'template-selection',
    system: TEMPLATE_SELECTION_PROMPT,
    prompt: promptLines.join('\n'),
  });

  const chosen = object.templateId;
  if (chosen !== null && candidates.some((c) => c.id === chosen)) {
    return chosen;
  }
  return fallback.id;
}
