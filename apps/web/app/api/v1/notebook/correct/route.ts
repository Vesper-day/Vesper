// POST /api/v1/notebook/correct — correct an inference ("Not quite.").
//
// Body { inferenceId, correctedText }. Sets state='corrected',
// corrected_text=correctedText, resolved_at=now() on the user's own inference
// and returns it. 404 NOT_FOUND when the id does not belong to the caller.
// Built on the chat-008 createRoute template; the state transition + withUser
// scoping live in ./correctInference.
import { createRoute, ApiError, ErrorCode } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { correctInference } from './correctInference';
import { CorrectInferenceRequestSchema } from '../schemas';
import type { InferenceMutationResponse } from '../schemas';

export const POST = createRoute<InferenceMutationResponse>(
  async ({ request, user }) => {
    const raw: unknown = await request.json().catch(() => null);
    const parsed = CorrectInferenceRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { inferenceId: uuid, correctedText: string }.',
      );
    }

    const inference = await correctInference(
      createDrizzleClient(),
      user.id,
      parsed.data.inferenceId,
      parsed.data.correctedText,
    );
    if (!inference) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Inference not found.');
    }

    return { inference };
  },
);
