// Request source + response-shape types for the Notebook API group (chat 108).
//
// Co-located per the chat-024 contract, shared by the read / confirm / correct
// routes. The Zod validators live in @vesper/shared (schemas/notebook.ts); this
// module re-exports them and adds the route-level response envelope.
import type { NotebookInference } from '@vesper/shared';

export {
  NotebookInferenceSchema,
  ConfirmInferenceRequestSchema,
  CorrectInferenceRequestSchema,
} from '@vesper/shared';
export type {
  NotebookInference,
  ConfirmInferenceRequest,
  CorrectInferenceRequest,
} from '@vesper/shared';

// GET /api/v1/notebook success body — the single current inference, or null
// when none is due. No list, no history (LAYER_4 Butler's Notebook).
export interface DueInferenceResponse {
  inference: NotebookInference | null;
}

// POST confirm/correct success body — the inference after the state transition.
export interface InferenceMutationResponse {
  inference: NotebookInference;
}
