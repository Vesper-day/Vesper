# Chat 029 — NL Command + Weekly Priorities + Batch Reorder APIs — Resolution Record

Scope: `apps/web` App Router server handlers + colocated Zod + integration tests,
plus one additive `@vesper/ai` export. NO migration, NO iOS, NO React UI.

Precedents mirrored: blocks (`blocks/{route.ts,operations.ts}`, chat 027 OCC),
push-tokens (201-vs-200 manual wrapper), profile (base_profile_version bump),
plans/generate (rate-limited manual wrapper + Retry-After), plans/date/[date]
(createRoute + `isValidPlanDate` param validation), tasks (chat 028 test layout).

## Files authored (all NEW)

- `packages/ai/src/confirmation.ts` — butler confirmation constants + `confirmationLineFor`
- `packages/ai/src/index.ts` — **edited**: re-export the two new symbols
- `apps/web/app/api/v1/ai/command/{schemas.ts,operations.ts,route.ts,command.integration.test.ts}`
- `apps/web/app/api/v1/weekly-priorities/{schemas.ts,operations.ts,route.ts,weekly-priorities.integration.test.ts}`
- `apps/web/app/api/v1/plans/date/[date]/reorder/{schemas.ts,operations.ts,route.ts,reorder.integration.test.ts}`
- `docs/CHAT_029_RESOLUTION_RECORD.md` — this file

`packages/ai/src/index.ts` is the only existing file edited.

## Stale-model check (the three tables, verified column-for-column vs §3)

| Table | §3 ref | Drizzle model | Verdict | SQL strategy |
|---|---|---|---|---|
| `weekly_priorities` | §3 #6 | daily-planning.ts:148-172 | **CURRENT** | Drizzle query builder (upsert via `onConflictDoUpdate`) |
| `daily_plans` | §3 | daily-planning.ts:41-74 | **CURRENT** | Drizzle `.select().for('update')` for the reorder OCC |
| `blocks` | §3 | daily-planning.ts:76-111 | **CURRENT** | Drizzle `.update()` for displayOrder writes |

All three match §3 exactly (id/user_id/.../created_at/updated_at + the documented
unique/index/check constraints). Because all three are current, **every operation
this chat authors uses the Drizzle model — no raw parameterized SQL.**

Why this differs from chat 027 (which used raw SQL on `blocks`/`daily_plans`): 027's
raw path existed for (a) the `completion_log` column skew and (b) the raw-`execute`
timestamptz-as-string parser gap (it projected `updated_at` as an epoch-ms bigint).
Neither applies here — reorder never touches `completion_log`, and the ORM
`.select()` path runs the Date parser, so `daily_plans.updated_at` returns a JS
`Date` and `.getTime()` is safe directly. (push_tokens/subscriptions/completion_log
are known-stale elsewhere but are NOT touched in this chat.)

## chat 027 OCC: literal reuse vs extension

**027 implements a PLAN-LEVEL OCC** (`blocks/operations.ts:11-22, 262-281`): it
locks the `daily_plans` row `FOR UPDATE` and compares `daily_plans.updated_at`
against the client's `planUpdatedAt` at millisecond resolution; the parent-touch
trigger `trg_blocks_touch_daily_plan` bumps that one timestamp on any block
insert/update/delete, so it guards the whole plan.

The reorder endpoint **REUSES that plan-level OCC semantics but is an EXTENSION,
not a literal code reuse**: 027 exposes no shared OCC helper, and its functions
(`patchBlock`/`createUserBlock`) are single-block. Reorder applies the same check
**once, at the top of one transaction**, ahead of a BATCH of `displayOrder`
updates. Mechanism difference: 027 projects `updated_at` as epoch-ms bigint (raw
path); reorder reads it as a JS `Date` via the ORM. Semantics are identical —
millisecond-resolution compare, **single 409 + full transaction rollback on
mismatch (never partial success)**. The OCC check throws before any UPDATE runs,
and even if it didn't, the throw rolls the transaction back; the test asserts both
blocks keep their seeded `displayOrder` after a 409.

## Parser command.type union vs §9

`parsePlanEditCommand` (read, NOT re-authored) returns `PlanEditCommand`, a
discriminated union of exactly seven variants: `reschedule_block`,
`complete_block`, `skip_block`, `add_block`, `remove_block`, `regenerate_plan`,
`unknown`. **This matches the §9 target set exactly** (§9 lists the six structured
types plus the `unknown` fallback). No divergence, no coercion needed.

Note: the parser's signature is `parsePlanEditCommand(input, options)` — it does
NOT take `planDate`. The endpoint validates `planDate` per the §9 request contract
but passes only `input` to the parser (the scaffold consumes only the utterance).

## Clarification constant + voice gate

`UNKNOWN_COMMAND_CLARIFICATION` (in `packages/ai/src/confirmation.ts`):

> "I couldn't identify a specific change there. Could you rephrase it?"

Authored once through the two voice-gate skills (caveman + stop-slop) and verified
against the regex layer (`voiceGate.regex.ts`): no em-dash, no `!`, no emoji, no
PRD §5.4 "Never Says" term. It is < 30 whitespace tokens, so at runtime
`voiceGate()` applies the regex layer only (Haiku review is out of scope) and
returns it unchanged with **zero tier-B flags** — i.e. it clears the gate. **No
runtime Haiku/AI call** is made for the clarification; it is a deterministic
constant. The structured-branch acknowledgements (`Rescheduled.`,
`Marked complete.`, `Skipped.`, `Added to your plan.`, `Removed from your plan.`,
`Rebuilding your plan.`) are likewise fixed, no-interpolation, gate-cleared
constants keyed exhaustively on the seven-variant union. Placement mirrors the
existing `APOLOGY_LINE` single-source-of-truth precedent in `@vesper/ai`.

## base_profile_version bump on PUT — confirmed

`putWeeklyPriorities` increments `user_profiles.base_profile_version`
(`sql\`base_profile_version + 1\``) **inside the same transaction** as the
priorities upsert (priorities feed plan-gen context; the cache key must
invalidate). Mirrors the profile-PUT (`profile/operations.ts:159`) and
modules-toggle (`toggleModule.ts:60`) precedents. The integration test asserts the
version goes 1 → 2 on create and 2 → 3 on replace.

## Reorder route PATH — discrepancy flagged

Build plan literally says `plans/[date]/reorder`. The established convention nests
date-scoped plan routes under `plans/date/[date]/` (the existing
`plans/date/[date]/route.ts` GET). **Path chosen: `apps/web/app/api/v1/plans/date/[date]/reorder/route.ts`**
— follows the convention (most specific date-segment precedent), reuses
`isValidPlanDate` from `plans/operations.ts`. This endpoint is build-plan-only (NOT
in §9), so no §9 response shape was invented; it returns
`{ planUpdatedAt, blocks: [{id, displayOrder}] }`.

## weekly_priorities casing — API camelCase vs jsonb snake_case

The `priorities` jsonb column is **untyped** in the Drizzle model
(`t.jsonb('priorities')`), so per §3 #6 STORAGE is snake_case: each item is
`{ text, source, completed_at }`. The §9 API boundary is camelCase:
`{ text, source, completedAt }`. `operations.ts` maps at the boundary —
`serializePriorities` (snake → camel on read) and the PUT persist step (writes
`completed_at: null`, since §9 PUT items carry only `{ text, source }`). The test
asserts the round-trip: the raw jsonb holds `completed_at` (not `completedAt`), and
`getWeeklyPriorities` returns `completedAt`.

## Other decisions

- **Rate limiter**: `ai-command` (sliding window, **60 / 1h**, Upstash, per-user)
  was **already registered** in `packages/shared/src/api/rateLimit.ts:42-48` — no
  shared export added, so no `@vesper/shared` rebuild is required. The route wires
  `withRateLimit('ai-command', user.id)` before any parsing/model work and sets
  `Retry-After` on the 429 (plans/generate precedent). weekly-priorities and
  reorder are NOT rate-limited.
- **Wrapper choices** (per the chat 028 createRoute fixed-200 vs manual-wrapper
  finding):
  - `POST /ai/command` → 200 → **manual wrapper** (needed for the 429 `Retry-After`
    header, which createRoute cannot set).
  - `GET /weekly-priorities` → 200 → `createRoute`.
  - `PUT /weekly-priorities` → **201 on insert / 200 on replace** → manual wrapper
    (push-tokens precedent; createRoute hardcodes 200).
  - `POST /plans/date/[date]/reorder` → 200, OCC 409 via ApiError → `createRoute`
    (no 201/204, not rate-limited, so the fixed-200 wrapper fits).
- **GET empty week**: when no `weekly_priorities` row exists for the resolved week,
  GET returns `{ weekPriorities: { id: null, weekStartDate, priorities: [] } }`
  (`id` typed `string | null`). The resolved week defaults to the current
  **UTC Monday** (`mondayOf`) when `?weekStart` is absent.
- **Prompt-version constant**: NO prompt was touched (the parser and
  `NL_COMMAND_PROMPT`/`NL_COMMAND_VERSION` were read-only), so **no version bump**.

## Tests (author now; DB-hitting suites run by the operator)

Each suite splits an ungated pure (Zod) `describe` from a `VESPER_DB_TESTS`-gated
`describe` that seeds via `auth.users` (the `on_auth_user_created` trigger creates
`public.users` + `user_profiles`) and drives the exported operations directly.

- `ai/command/command.integration.test.ts` — parser partial-mocked at the
  `@vesper/ai` boundary (real `confirmationLineFor`/constant kept). NO Anthropic
  key, NO Upstash (limiter lives in route.ts and is lazy). Asserts: structured →
  `{command, confirmationLine}`; unknown → type `'unknown'` + the gated constant;
  invalid body → 400 before the parser is called.
- `weekly-priorities/weekly-priorities.integration.test.ts` — GET empty + populated;
  PUT 3/4/5 → ok, PUT 2/6 → 400; base_profile_version 1→2→3; snake↔camel round-trip;
  exactly-one-row replace.
- `plans/date/[date]/reorder/reorder.integration.test.ts` — correct token commits
  all updates (200) + fresh token; stale token → single 409 + NO rows changed;
  missing plan → 404.

## Operator run commands (Windows / PowerShell)

`@vesper/ai` was built in-session (its `dist` types back the two new exports), so a
plain `pnpm type-check` will resolve them. No Upstash env and no Anthropic key are
needed for the unit suites — the limiter and parser are mocked.

```powershell
pnpm --filter @vesper/ai build      # (already run in-session; re-run if dist is stale)
pnpm type-check
pnpm --filter @vesper/web test -- command.integration weekly-priorities.integration reorder.integration
# DB-hitting suites (local Supabase on 54322 required):
pnpm --filter @vesper/db setup-test-db
$env:VESPER_DB_TESTS=1; pnpm --filter @vesper/web test -- weekly-priorities.integration reorder.integration
```
