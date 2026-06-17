// GET /api/v1/notebook — the due/pending Butler's Notebook inference.
//
// Returns { inference } where inference is the single current pending entry for
// the authenticated user, or null when none is due. No list, no history
// (LAYER_4 Butler's Notebook). Built on the chat-008 createRoute template;
// read logic + withUser scoping live in ./getDueInference (a route.ts file may
// export only HTTP handlers + segment config).
import { createRoute } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { getDueInference } from './getDueInference';
import type { DueInferenceResponse } from './schemas';

export const GET = createRoute<DueInferenceResponse>(async ({ user }) => {
  return getDueInference(createDrizzleClient(), user.id);
});
