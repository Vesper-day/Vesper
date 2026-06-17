// Notebook confirm core logic (chat 108), extracted from route.ts.
//
// Sets state='confirmed', resolved_at=now() on the user's own inference. The
// WHERE pins id AND user_id (own-row at the query layer — defense-in-depth on
// top of RLS; the service-role client bypasses RLS). updated_at is maintained
// by the set_updated_at trigger. Returns the updated row, or null when the id
// does not belong to the user (→ 404 at the route).
import {
  withUser,
  notebookInferences,
  and,
  eq,
  sql,
  type Database,
  type UserScopedQuery,
} from '@vesper/db';
import type { NotebookInference } from '@vesper/shared';
import { mapInference } from '../mapInference';

const confirm: UserScopedQuery<[string], NotebookInference | null> =
  (userId, inferenceId) => async (db) => {
    const rows = await db
      .update(notebookInferences)
      .set({ state: 'confirmed', resolvedAt: sql`now()` })
      .where(
        and(
          eq(notebookInferences.id, inferenceId),
          eq(notebookInferences.userId, userId),
        ),
      )
      .returning();

    const row = rows[0];
    return row ? mapInference(row) : null;
  };

export async function confirmInference(
  db: Database,
  userId: string,
  inferenceId: string,
): Promise<NotebookInference | null> {
  return withUser(db, userId, confirm, inferenceId);
}
