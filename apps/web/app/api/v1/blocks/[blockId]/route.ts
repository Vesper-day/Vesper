// PATCH /api/v1/blocks/[blockId] (§9) — single-block mutation under plan-level
// optimistic concurrency.
//
// Core logic lives in the sibling ../operations module (a route.ts may export
// only HTTP-method handlers + segment config). createRoute supplies the
// authenticated user, awaits params, and maps ApiError -> the §9 error shape.
// Every PATCH (success OR idempotent replay) returns 200.
import { createRoute } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { patchBlock, type BlockResponse } from '../operations';

export const PATCH = createRoute<BlockResponse>(async ({ user, request, params }) => {
  const body: unknown = await request.json().catch(() => null);
  return patchBlock(createDrizzleClient(), user.id, params.blockId, body);
});
