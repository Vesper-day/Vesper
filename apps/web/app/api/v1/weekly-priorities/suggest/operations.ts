// Suggest core logic (POST /api/v1/weekly-priorities/suggest, Chat 057 — DECISION B),
// extracted from route.ts.
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config; the pure runSuggest function is an invalid Route export, so it lives here.
// route.ts imports it; the unit/integration test drives runSuggest directly with
// suggestWeeklyPriorities mocked at the @vesper/ai boundary (no Anthropic key needed),
// exactly as ai/command drives runAiCommand with the parser mocked.
//
// STATELESS: no DB access. The Haiku/Sonnet call (packages/ai/suggestWeeklyPriorities)
// is the single source of the suggestions + their 3–5 length invariant; we do NOT
// re-author it here. Mobile reaches it ONLY through this HTTP seam — it never imports
// @vesper/ai (DECISION B).
import { suggestWeeklyPriorities } from '@vesper/ai';
import { ApiError, ErrorCode } from '@vesper/shared';
import { SuggestRequestSchema, type SuggestResponse } from './schemas';

export async function runSuggest(rawBody: unknown): Promise<SuggestResponse> {
  const parsed = SuggestRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ??
        'Request body must be { outstandingTasks?, priorWeekCompletion: { completed, total } }.',
    );
  }

  // Rebuild the model input omitting undefined optionals — the repo runs
  // exactOptionalPropertyTypes, so { estimatedMinutes: undefined } / { priorPriorities:
  // undefined } are NOT assignable to WeeklyPrioritiesInput's `?: number` / `?: string[]`.
  const { outstandingTasks, priorWeekCompletion } = parsed.data;
  const suggestions = await suggestWeeklyPriorities({
    outstandingTasks: outstandingTasks.map((t) =>
      t.estimatedMinutes === undefined
        ? { title: t.title, priority: t.priority }
        : { title: t.title, priority: t.priority, estimatedMinutes: t.estimatedMinutes },
    ),
    priorWeekCompletion:
      priorWeekCompletion.priorPriorities === undefined
        ? { completed: priorWeekCompletion.completed, total: priorWeekCompletion.total }
        : {
            completed: priorWeekCompletion.completed,
            total: priorWeekCompletion.total,
            priorPriorities: priorWeekCompletion.priorPriorities,
          },
  });
  return { suggestions };
}
