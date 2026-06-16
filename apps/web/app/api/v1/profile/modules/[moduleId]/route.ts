// PATCH /api/v1/profile/modules/[moduleId] (§9).
//
// Toggles a single module's `enabled` flag.
//  - [moduleId] is validated against the REAL ModulesEnabledSchema keys; an
//    unknown key → 400. No user_profiles row → 404 (defensive).
//
// Core logic lives in the sibling ./toggleModule module (a route.ts may export
// only HTTP-method handlers + segment config, so the pure toggleModule function
// cannot be exported here). The integration tests drive toggleModule directly
// against the chat-002 local-Supabase test DB.
import { createRoute, ApiError, ErrorCode } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import {
  ModuleIdSchema,
  ModuleToggleRequestSchema,
  type ModuleToggleResponse,
} from '../../schemas';
import { toggleModule } from './toggleModule';

export const PATCH = createRoute<ModuleToggleResponse>(
  async ({ request, user, params }) => {
    const moduleIdParsed = ModuleIdSchema.safeParse(params.moduleId);
    if (!moduleIdParsed.success) {
      throw new ApiError(ErrorCode.INVALID_REQUEST, 'Unknown module id.');
    }
    const raw: unknown = await request.json().catch(() => null);
    const bodyParsed = ModuleToggleRequestSchema.safeParse(raw);
    if (!bodyParsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { enabled: boolean }.',
      );
    }
    return toggleModule(
      createDrizzleClient(),
      user.id,
      moduleIdParsed.data,
      bodyParsed.data.enabled,
    );
  },
);
