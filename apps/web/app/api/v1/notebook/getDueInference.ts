// Notebook read core logic (chat 108), extracted from route.ts.
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config, so this pure helper lives in a sibling module. route.ts imports it.
//
// Returns the SINGLE current inference for the authenticated user: the
// most-recent pending row (LAYER_4 Butler's Notebook — no list, no history).
// Uses the partial index idx_notebook_inferences_user_pending. The read is
// scoped through withUser (UserScopedQuery contract) against the service-role
// client, which bypasses RLS — the explicit user_id filter is the per-user
// boundary.
import {
  withUser,
  notebookInferences,
  and,
  eq,
  desc,
  type Database,
  type UserScopedQuery,
} from '@vesper/db';
import type { DueInferenceResponse } from './schemas';
import { mapInference } from './mapInference';

const readDueInference: UserScopedQuery<[], DueInferenceResponse> =
  (userId) => async (db) => {
    const rows = await db
      .select()
      .from(notebookInferences)
      .where(
        and(
          eq(notebookInferences.userId, userId),
          eq(notebookInferences.state, 'pending'),
        ),
      )
      .orderBy(desc(notebookInferences.createdAt))
      .limit(1);

    const row = rows[0];
    return { inference: row ? mapInference(row) : null };
  };

export async function getDueInference(
  db: Database,
  userId: string,
): Promise<DueInferenceResponse> {
  return withUser(db, userId, readDueInference);
}
