// Request Zod + response-shape types for POST /api/v1/weekly-priorities/suggest
// (Chat 057 — DECISION B). The route is a thin STATELESS wrapper over the landed
// @vesper/ai suggestWeeklyPriorities (Sonnet) — the ai/command precedent: the caller
// assembles the model input (outstanding tasks + prior-week completion) and the route
// validates it, calls the model, and returns { suggestions }. No DB touch here.
//
// The request shape mirrors @vesper/ai's WeeklyPrioritiesInput exactly so the route
// passes the parsed body straight through.
import { z } from 'zod';

const OutstandingTaskSchema = z
  .object({
    title: z.string().trim().min(1),
    priority: z.string().trim().min(1),
    estimatedMinutes: z.number().int().positive().optional(),
  })
  .strict();

const PriorWeekCompletionSchema = z
  .object({
    completed: z.number().int().min(0),
    total: z.number().int().min(0),
    priorPriorities: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

export const SuggestRequestSchema = z
  .object({
    // Outstanding tasks default to empty — the model prompt tolerates "none".
    outstandingTasks: z.array(OutstandingTaskSchema).default([]),
    priorWeekCompletion: PriorWeekCompletionSchema,
  })
  .strict();

export type SuggestRequest = z.infer<typeof SuggestRequestSchema>;

export interface SuggestResponse {
  /** 3–5 suggested priority strings (length enforced inside suggestWeeklyPriorities). */
  suggestions: string[];
}
