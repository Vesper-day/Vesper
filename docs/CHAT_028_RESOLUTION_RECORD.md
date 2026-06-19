# Chat 028 — Tasks Backend API — Resolution Record

Scope: `apps/web` only. Next.js App Router handlers + colocated Zod + integration
tests for the Tasks API group. NO iOS, NO React UI, NO AI, NO migration.

Precedent mirrored: the BLOCKS API group
(`apps/web/app/api/v1/blocks/{route.ts,[blockId]/route.ts,operations.ts,blocks.integration.test.ts}`).

## Files authored (all NEW)

- `apps/web/app/api/v1/tasks/route.ts` — GET + POST
- `apps/web/app/api/v1/tasks/[taskId]/route.ts` — PATCH + DELETE
- `apps/web/app/api/v1/tasks/operations.ts` — pure logic + Zod (mirrors blocks; NO separate `schemas.ts`)
- `apps/web/app/api/v1/tasks/tasks.integration.test.ts` — pure (ungated) + integration (gated) suites
- `docs/CHAT_028_RESOLUTION_RECORD.md` — this file

No existing files edited.

## §9 vs §3 reconciliation

No disagreement found between §3 "5. tasks" and §9 "Tasks". Both were read
verbatim from `docs/TECHNICAL_SPEC.md` (§3 lines 416–436, §9 lines 1737–1796).
The serialized object in §9 emits exactly `{ id, title, estimatedMinutes,
deadline, priority, status, completedAt }` — NO `createdAt`/`updatedAt`. The
serializer maps snake_case → camelCase accordingly.

## Step 2 — Drizzle-stub verification gate

**Branch taken: USE THE DRIZZLE MODEL.** The `tasks` table in
`packages/db/src/schema/daily-planning.ts` (lines 113–146) matches §3
column-for-column:

| §3 column | Drizzle stub | Match |
|---|---|---|
| `id uuid PK default gen_random_uuid()` | `uuid().defaultRandom().primaryKey()` | ✓ |
| `user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE` | `.notNull().references(users.id, {onDelete:'cascade'})` | ✓ |
| `title text NOT NULL` | `text().notNull()` | ✓ |
| `estimated_minutes integer NOT NULL CHECK (>0)` | `integer().notNull()` + `check('estimated_minutes_positive', > 0)` | ✓ |
| `deadline timestamptz NULL` | `timestamp({withTimezone:true})` (nullable) | ✓ |
| `priority priority_enum NOT NULL DEFAULT 'medium'` | `priorityEnum().notNull().default('medium')` | ✓ |
| `status task_status_enum NOT NULL DEFAULT 'pending'` | `taskStatusEnum().notNull().default('pending')` | ✓ |
| `completed_at timestamptz NULL` | `timestamp({withTimezone:true})` (nullable) | ✓ |
| `created_at/updated_at timestamptz NOT NULL DEFAULT now()` | `.notNull().defaultNow()` | ✓ |
| `idx_tasks_user_id_status`, partial `idx_tasks_user_id_deadline` | both present | ✓ |

Because the model matches, the operations module uses the **Drizzle query
builder** (not raw SQL). The blocks raw-SQL fallback existed for the
`completion_log` column skew + the raw-`execute` timestamptz-as-string parser
gap; neither applies here. The ORM (non-raw) path runs the Date parser, so
`deadline`/`completedAt` return as JS `Date` and `.toISOString()` is safe.

## Step 5 — wrapper choice (per handler, matching blocks)

`createRoute` (`packages/shared/src/api/route.ts`) hardcodes a 200
`successResponse` and cannot express 201/204.

- **GET** → 200 → `createRoute`.
- **POST** → 201 → custom wrapper (requestId → `checkAppVersion` → `validateSession`
  → handler → `successResponse(data, 201)`), mirroring `blocks/route.ts`.
- **PATCH** → 200 → `createRoute`, mirroring `blocks/[blockId]/route.ts`.
- **DELETE** → 204 empty body → custom wrapper returning `new Response(null,{status:204})`.

`runtime`/`dynamic` segment config: blocks sets NEITHER, so neither is set here.

## Step 6 — flags resolved

**(a) in_progress.** §3 `task_status_enum` includes `in_progress` as a real
stored value; §9's GET `?status` filter lists only `pending|completed`.
RESOLUTION: `PatchTaskSchema.status` accepts the full enum
(`pending|in_progress|completed`); `GetTasksQuerySchema.status` accepts only
`pending|completed` (defer to §9 for the filter). An out-of-set `?status` (incl.
`in_progress`) → 400 INVALID_REQUEST.

**(b) not-found error code.** `packages/shared/src/errors.ts` has NO
`TASK_NOT_FOUND` code (only `PLAN_NOT_FOUND`). RESOLUTION: used the generic
`NOT_FOUND` (404) for absent/not-owned tasks on PATCH and DELETE, and for a
malformed (non-UUID) `taskId`.

**(c) Zod colocation.** Blocks keeps Zod in `operations.ts` (no `schemas.ts`).
Mirrored: all Zod (`PostTaskSchema`, `PatchTaskSchema`, `GetTasksQuerySchema`)
lives in `tasks/operations.ts`. File set written = the 4 task files above.

## Business-rule decisions

- **Priority sort.** Explicit numeric mapping (high=3, medium=2, low=1) via
  `ORDER BY (CASE priority …) DESC, deadline ASC NULLS LAST`. Not enum text/
  physical order. **Decision:** deadline-less tasks sort AFTER dated ones within a
  priority tier (NULLS LAST).
- **estimatedMinutes.** `z.number().int().positive()` — required on POST, optional
  on PATCH; integer, strictly > 0 (mirrors the DB CHECK). ≤0 / non-integer → 400.
- **deadline "soft" check.** **Decision:** "soft" = only ISO-8601 shape is
  enforced; a PAST deadline is ACCEPTED on CREATE (warn-tolerant, never a hard
  400). NOT re-validated on PATCH. PATCH additionally accepts `deadline: null` to
  clear it.
- **completed_at lifecycle (PATCH; not in §9 — chat-028 decision).** Transition
  INTO `completed` → set `completed_at = now()`. Transition OUT of `completed`
  (→ `pending`|`in_progress`) → clear `completed_at = NULL`. Status unchanged /
  non-status patch → leave as-is. Implemented inside a transaction that first reads
  the existing status (user-scoped) to detect the transition direction.
- **updated_at.** Maintained by the `set_updated_at()` trigger; never set in the
  handler (Drizzle stub defines no `$onUpdate`, so the ORM does not touch it).
- **user_id.** Always from the authenticated session, NEVER from the body.

## Tests

- Ungated `describe('Tasks validation (pure)')` — Zod schema assertions, run under
  plain `pnpm test` (no DB).
- Gated `describeDb('Tasks API (integration)')` (VESPER_DB_TESTS) — drives
  `listTasks/createTask/updateTask/deleteTask` against local Supabase (54322):
  GET ordering (mixed priorities incl. a deadline-less row), `?status` filter,
  POST 201 + defaults, estimatedMinutes ≤0 → 400, PATCH partial, PATCH
  completed↔pending completed_at lifecycle, PATCH/DELETE another user's id → 404,
  DELETE then row gone + second delete 404. Seeds via `auth.users` so the
  `on_auth_user_created` trigger creates `public.users` (chat-026 precedent).

## Durable follow-up

None required for the stub (it matches §3). The standing chat-006 `drizzle-kit
pull` remains the durable path for any future schema-stub regeneration.
