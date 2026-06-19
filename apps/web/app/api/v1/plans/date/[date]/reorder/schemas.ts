// Request Zod + response-shape types for the batch block-reorder endpoint
// (build-plan Chat 029; NOT in §9 — no §9 shape to mirror).
//
// Co-located. The body carries the full set of (blockId -> displayOrder) updates
// to apply plus the plan-level OCC token (planUpdatedAt) the client last observed.
import { z } from 'zod';

const ISO_DATETIME = { offset: true } as const;

export const ReorderItemSchema = z
  .object({
    id: z.string().uuid(),
    displayOrder: z.number().int(),
  })
  .strict();

export const ReorderRequestSchema = z
  .object({
    blocks: z.array(ReorderItemSchema).min(1),
    planUpdatedAt: z.string().datetime(ISO_DATETIME), // OCC token (plan-level)
  })
  .strict();

export type ReorderRequest = z.infer<typeof ReorderRequestSchema>;

// Success body (top-level, no envelope). Echoes the applied orders and returns the
// fresh plan-level OCC token (daily_plans.updated_at, bumped by the parent-touch
// trigger) for the client's next mutation.
export interface ReorderResponse {
  planUpdatedAt: string; // ISO 8601
  blocks: Array<{ id: string; displayOrder: number }>;
}
