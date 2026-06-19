// Request Zod + response-shape types for the AI Command endpoint (§9).
//
// Co-located. The §9 request body is { input, planDate } (camelCase). `input` is
// the raw natural-language utterance; `planDate` is the YYYY-MM-DD the edit
// targets. The endpoint is STATELESS — it parses the utterance into a structured
// PlanEditCommand and returns it; the client then calls the appropriate block
// PATCH / plan generate route to apply the edit.
import { z } from 'zod';
import type { PlanEditCommand } from '@vesper/ai';

export const AiCommandRequestSchema = z
  .object({
    input: z.string().trim().min(1),
    // Strict calendar-date shape per the chat-024 param-validation convention.
    planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export type AiCommandRequest = z.infer<typeof AiCommandRequestSchema>;

// §9 success body. Top-level, no envelope (response.ts convention). `command` is
// the structured PlanEditCommand emitted by the parser; `confirmationLine` is the
// butler-tone acknowledgement (or, for command.type === 'unknown', the fixed
// clarification request).
export interface AiCommandResponse {
  command: PlanEditCommand;
  confirmationLine: string;
}
