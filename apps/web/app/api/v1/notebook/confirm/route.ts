// POST /api/v1/notebook/confirm — confirm an inference ("That's right.").
//
// Body { inferenceId }. Sets state='confirmed', resolved_at=now() on the user's
// own inference and returns it. 404 NOT_FOUND when the id does not belong to the
// caller. Built on the chat-008 createRoute template; the state transition +
// withUser scoping live in ./confirmInference.
import { createRoute, ApiError, ErrorCode } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { confirmInference } from './confirmInference';
import { ConfirmInferenceRequestSchema } from '../schemas';
import type { InferenceMutationResponse } from '../schemas';

export const POST = createRoute<InferenceMutationResponse>(
  async ({ request, user }) => {
    const raw: unknown = await request.json().catch(() => null);
    const parsed = ConfirmInferenceRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { inferenceId: uuid }.',
      );
    }

    const inference = await confirmInference(
      createDrizzleClient(),
      user.id,
      parsed.data.inferenceId,
    );
    if (!inference) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Inference not found.');
    }

    return { inference };
  },
);
