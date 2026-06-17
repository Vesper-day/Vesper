import { z } from 'zod';

// Butler's Notebook (chat 108) — request/response shapes for the read /
// confirm / correct API. camelCase per the real Zod files (user.ts), NOT the
// snake_case in TECHNICAL_SPEC §3.2.

export const NotebookInferenceStateSchema = z.enum([
  'pending',
  'confirmed',
  'corrected',
]);
export type NotebookInferenceState = z.infer<
  typeof NotebookInferenceStateSchema
>;

// GET /api/v1/notebook success body — the single current inference (or null).
export const NotebookInferenceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  inferenceText: z.string(),
  inferenceType: z.string(),
  state: NotebookInferenceStateSchema,
  correctedText: z.string().nullable(),
  surfacedAt: z.string().datetime().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type NotebookInference = z.infer<typeof NotebookInferenceSchema>;

// POST /api/v1/notebook/confirm body.
export const ConfirmInferenceRequestSchema = z.object({
  inferenceId: z.string().uuid(),
});
export type ConfirmInferenceRequest = z.infer<
  typeof ConfirmInferenceRequestSchema
>;

// POST /api/v1/notebook/correct body.
export const CorrectInferenceRequestSchema = z.object({
  inferenceId: z.string().uuid(),
  correctedText: z.string().min(1),
});
export type CorrectInferenceRequest = z.infer<
  typeof CorrectInferenceRequestSchema
>;
