// Chat 023 scaffold — recipe template selection (recipe analogue of
// selectWorkoutTemplate).
//
// Model: claude-haiku-4-5 (TECHNICAL_SPEC.md §5 — template selection from a
// pre-filtered candidate set). Structured output via generateObject; NOT voice-gated.
// The candidate set is PASSED IN; this function issues no DB query.
//
// FALLBACK NOTE: the workout fallback proxies "lowest-rest-required" with lowest
// intensity. Recipes have no rest/intensity column; the analogous "least effort"
// proxy is the lowest total_minutes (matches TECHNICAL_SPEC.md §5 synthesis step 7:
// recipes are ordered by total_minutes ascending to prefer faster options).

import { z } from 'zod';
import type { RecipeTemplate } from './context/templateSubset';
import { generateObject } from './generateObject';
import { MODELS } from './client';
import { TEMPLATE_SELECTION_PROMPT } from './prompts/template-selection';

export type RecipeSelectionInput = {
  /** User nutrition preferences (modules_enabled.nutrition): diet tags + time cap. */
  nutritionPrefs: {
    dietTags?: string[];
    cookingTimeMaxMinutes?: number;
  };
  /** Morning energy score 1–10, or null if not yet captured. */
  energyScore: number | null;
  /** Pre-filtered candidate templates (Layer-3 subset). Must be non-empty. */
  candidates: RecipeTemplate[];
};

const SelectionResultSchema = z.object({
  templateId: z.string().uuid().nullable(),
});

/** Lowest total-minutes candidate — the fastest, least-effort option. */
function fallbackCandidate(candidates: RecipeTemplate[]): RecipeTemplate {
  return candidates.reduce((best, c) =>
    c.totalMinutes < best.totalMinutes ? c : best,
  );
}

/**
 * Select a recipe template UUID from the passed-in candidate set. Returns a
 * deterministic fallback (lowest total_minutes) when the model returns no usable id.
 *
 * @throws when the candidate set is empty (caller contract violation).
 */
export async function selectRecipeTemplate(
  input: RecipeSelectionInput,
): Promise<string> {
  const { nutritionPrefs, energyScore, candidates } = input;
  if (candidates.length === 0) {
    throw new Error('selectRecipeTemplate: candidate set is empty');
  }

  const fallback = fallbackCandidate(candidates);

  const promptLines = [
    `Diet tags: ${(nutritionPrefs.dietTags ?? []).join(', ') || 'none'}`,
    `Cooking time cap (min): ${nutritionPrefs.cookingTimeMaxMinutes ?? 'unspecified'}`,
    `Energy score (1-10): ${energyScore ?? 'unknown'}`,
    'Candidates:',
    ...candidates.map(
      (c) =>
        `- ${c.id} | ${c.name} | ${c.totalMinutes}min total | ${c.difficulty} | ${c.dietTags.join('/') || 'no-tags'}`,
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
