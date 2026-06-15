// Chat 023 scaffold — weekly priority suggestions for the Sunday planning session.
//
// Model: claude-sonnet-4-6. TECHNICAL_SPEC.md §5 places "weekly review reasoning
// during the Sunday planning session" under claude-sonnet-4-6. This resolves the
// build-plan/§5 conflict in favor of §5 (Sonnet), per the Chat 023 directive.
// Structured output via generateObject; NOT voice-gated (suggestions are validated
// by Zod, not rendered as butler prose here).
//
// Returns { suggestions } with 3–5 entries, enforced in the Zod schema.

import { z } from 'zod';
import { generateObject } from './generateObject';
import { MODELS } from './client';
import { WEEKLY_REVIEW_PROMPT } from './prompts/weekly-review';

export type OutstandingTask = {
  title: string;
  priority: string;
  estimatedMinutes?: number;
};

export type WeeklyPrioritiesInput = {
  /** Tasks still pending at week start. */
  outstandingTasks: OutstandingTask[];
  /** Prior-week completion snapshot. */
  priorWeekCompletion: {
    completed: number;
    total: number;
    /** The 3–5 priorities the user set last week, if any. */
    priorPriorities?: string[];
  };
};

// 3 ≤ length ≤ 5 enforced here so a non-conforming model response fails validation.
const WeeklyPrioritiesResultSchema = z.object({
  suggestions: z.array(z.string().min(1)).min(3).max(5),
});

/**
 * Suggest 3–5 priorities for the coming week from outstanding tasks and last week's
 * completion. Returns the validated suggestions array.
 */
export async function suggestWeeklyPriorities(
  input: WeeklyPrioritiesInput,
): Promise<string[]> {
  const { outstandingTasks, priorWeekCompletion } = input;

  const taskLines = outstandingTasks.map(
    (task) =>
      `- ${task.title} (priority ${task.priority}${
        task.estimatedMinutes !== undefined ? `, ~${task.estimatedMinutes}min` : ''
      })`,
  );

  const promptLines = [
    `Prior week: ${priorWeekCompletion.completed}/${priorWeekCompletion.total} priorities completed.`,
    ...(priorWeekCompletion.priorPriorities && priorWeekCompletion.priorPriorities.length > 0
      ? ['Prior priorities:', ...priorWeekCompletion.priorPriorities.map((p) => `- ${p}`)]
      : []),
    'Outstanding tasks:',
    ...(taskLines.length > 0 ? taskLines : ['- none']),
    'Suggest three to five priorities for the coming week.',
  ];

  const { object } = await generateObject({
    schema: WeeklyPrioritiesResultSchema,
    model: MODELS.SONNET,
    callType: 'weekly-review',
    system: WEEKLY_REVIEW_PROMPT,
    prompt: promptLines.join('\n'),
  });

  return object.suggestions;
}
