# Chat 027 — Block APIs with Optimistic Concurrency + In-Progress Transition

Resolution record (EO 35, ⚠️ risk). Scope: `PATCH /api/v1/blocks/:blockId`,
`POST /api/v1/blocks`, the shared `effectiveStatus.ts` utility, and the
`plans/operations.ts` refactor that consumes it.

## Files authored

| File | Purpose |
|------|---------|
| `apps/web/lib/blocks/effectiveStatus.ts` | Shared effective-status formula (extracted) |
| `apps/web/lib/blocks/effectiveStatus.test.ts` | Offline unit test (no DB) |
| `apps/web/app/api/v1/plans/operations.ts` | Refactored: inline copy deleted, imports the shared util |
| `apps/web/app/api/v1/blocks/operations.ts` | Pure DB-layer logic: `patchBlock`, `createUserBlock`, Zod schemas |
| `apps/web/app/api/v1/blocks/[blockId]/route.ts` | PATCH handler (`createRoute`) |
| `apps/web/app/api/v1/blocks/route.ts` | POST handler (custom — needs 201/200) |
| `apps/web/app/api/v1/blocks/blocks.integration.test.ts` | Integration tests (gated on `VESPER_DB_TESTS`) |

No migration (no schema change). No `@vesper/shared` change
(`OPTIMISTIC_LOCK_FAILURE` / `PLAN_NOT_FOUND` already exist with 409 / 404).

## (a) OCC design — plan-level vs block-level timestamp

The conflict token is `daily_plans.updated_at`, **not** a block-level timestamp.
Migration `20260601000004` installs `trg_blocks_touch_daily_plan`, an
`AFTER INSERT/UPDATE/DELETE` trigger that bumps the parent `daily_plans.updated_at`
on **any** block change. One plan timestamp therefore guards the entire plan: two
devices editing *different* blocks of the same plan still conflict, which is the
intended "plan was modified elsewhere, refresh" semantics.

Mechanics on every mutation:
1. `SELECT updated_at ... FROM daily_plans WHERE id = <plan> AND user_id = <auth> FOR UPDATE`
   — row-locks the plan for the duration of the transaction.
2. Compare the client's `planUpdatedAt` to the locked row.
3. Mismatch → rollback → `409 OPTIMISTIC_LOCK_FAILURE`. Match → mutate in the same tx.

**Comparison is at millisecond resolution** (`Date.getTime()`), deliberately not an
exact SQL `::timestamptz` equality. The token the client holds is a `toISOString()`
value (millisecond precision), while Postgres `now()` is microsecond precision; an
exact equality would spuriously fail. `postgres-js` returns `timestamptz` as a
millisecond-resolution JS `Date`, so both the stored value and the client token
truncate identically and compare equal. Collisions within the same millisecond are
acceptable for OCC (vanishingly rare; worst case mirrors the pre-existing
same-instant race the design already tolerates).

The mutation response returns a fresh `planUpdatedAt` (re-read after the
trigger fired) so the client immediately holds the next OCC token without a
round-trip. This is a deliberate addition beyond the prompt's response contract.

## (b) Idempotency ordering (corrected)

The `clientMutationId` replay lookup (`findByClientMutationId`) runs **outside the
transaction and before the OCC check**. If a block already carries
`(user_id, client_mutation_id)`, it is returned immediately (HTTP 200 for PATCH;
`created: false` → 200 for POST). Only on a miss do we open the transaction, lock
the plan, and run OCC.

Rationale: a network retry can arrive *after* the original mutation already
advanced `plan.updated_at`. If idempotency were evaluated after OCC, that retry —
carrying the now-stale token — would receive a false `409` instead of the correct
idempotent `200`. Server-side uniqueness is still backstopped by
`uq_blocks_user_id_client_mutation_id`.

## (c) completion_log raw-SQL pattern (no ORM stub)

`packages/db/src/schema/analytics.ts` is STALE (declares `event_name`/`occurred_at`;
the applied migration `20260601000010` has `event_type completion_event_enum`,
`value jsonb`, `logged_at`, `block_id`). Per the open flag, `analytics.ts` is
untouched (durable fix = chat-006). All `completion_log` writes use raw
parameterized `sql` against the real columns:

```sql
INSERT INTO completion_log (user_id, block_id, event_type, value)
VALUES ($user::uuid, $block::uuid, $event::completion_event_enum, $value::jsonb)
```

Written inside the same transaction as the block UPDATE, only for terminal status
transitions: `completed → block_completed`, `skipped → block_skipped`,
`rescheduled → block_rescheduled` (a `scheduled` PATCH logs nothing). `value`
denormalizes `{ block_type, title, start_time, end_time, plan_date }` from the
post-update row so the log survives later block deletion (`block_id` is
`ON DELETE SET NULL`).

## (d) effectiveStatus extraction + operations.ts refactor

Chat 026 inlined `computeEffectiveStatus` inside `plans/operations.ts` because the
shared module did not yet exist. This chat created
`apps/web/lib/blocks/effectiveStatus.ts` (signature
`(status, startTime: Date|null, endTime: Date|null, now=new Date()) => string`)
and refactored `plans/operations.ts` to delete the inline copy and
`import { computeEffectiveStatus } from '@/lib/blocks/effectiveStatus'`. The
serializer call site is unchanged except for an `as EffectiveBlockStatus` cast
(the shared util returns the wider `string`). The block-mutation serializer uses
the same util, so both API groups share one formula.

## (d) Deviations from the prompt

1. **"Service-role Supabase client" → `createDrizzleClient()`.** `apps/web/lib/supabase/server.ts`
   is the `@supabase/ssr` **cookie** client (web session path), not an
   RLS-bypassing DB client — wrong tool for API writes. The codebase's
   RLS-bypassing DB path is Drizzle over `SUPABASE_DB_URL`, scoped by explicit
   `user_id` filters (chat 025/026 precedent, and what the integration tests can
   drive directly). All queries carry `WHERE user_id = <auth>` so the service-role
   connection never leaks cross-user rows.
2. **POST uses a custom handler, not `createRoute`.** `createRoute` hardcodes a 200
   success status; POST needs 201 on create / 200 on idempotent replay. The custom
   handler reuses the same auth + version-gate + `ApiError → errorResponse`
   boilerplate as `plans/generate`.
3. **Response adds `planUpdatedAt`** (fresh OCC token) — see (a).
4. **`PLAN_NOT_FOUND` returned with HTTP 400** (not its 404 default) on POST, per the
   prompt's explicit contract, via `new ApiError(ErrorCode.PLAN_NOT_FOUND, msg, 400)`.

## End-of-session commands (hand back to operator — not run here)

Per the prompt, these were NOT executed in-session.

```bash
# A — type-check (repo root; expect exit 0; ignore pre-existing layout.tsx bigint skew)
pnpm type-check

# B — effectiveStatus unit test (offline, no DB). Vitest takes a file-path arg
#     (NOT Jest's --testPathPattern).
pnpm --filter @vesper/web test apps/web/lib/blocks/effectiveStatus.test.ts

# C — integration tests (needs local Supabase running; Upstash NOT required —
#     this test file imports no rate-limiting). Gated on VESPER_DB_TESTS.
VESPER_DB_TESTS=1 pnpm --filter @vesper/web test apps/web/app/api/v1/blocks/blocks.integration.test.ts
```

Note: the integration file is gated on `VESPER_DB_TESTS` (keeps default
`pnpm test` / CI green with no DB). The hand-off command sets it explicitly.
