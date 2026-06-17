# Chat 108 — Resolution Record

> Build-track half of the Butler's Notebook: storage + read/confirm/correct API.
> Produces NO UI. The confirm/correct copy and the butler voice gate are chat
> 108a's concern; 108 only stores the inference text and records state
> transitions.

All facts below were verified by reading the real `.ts` / `.sql` files and by
running the migration against the local Supabase stack — not from memory.

---

## 1. Migration suffix allocation (build-time decision)

Allocated suffix: **0021** → `20260601000021_notebook_inferences.sql` (+ `.down.sql`).

Re-verified live against both migration dirs:
- Highest committed in-block suffix is `0020` (`chat111_schema_checkpoint`).
- `0019` is OCCUPIED in `supabase/migrations/` as `start_of_local_day` (the
  `4a`↔`19` divergence: `packages/db/migrations/` numbers it `0004a`,
  `supabase/migrations/` numbers it `0019`). It is NOT free.
- Next genuinely-free Blocks-4–7 integer = **21**. Did not reuse 19 or 20.
- Used the committed `20260601…` date-prefix batch so the new file sorts after
  `0020` in both dirs.

## 2. Dual-write / which dir the CLI reads

`supabase/config.toml` has **no `migration_path` override** under
`[db.migrations]` (only `enabled = true`, `schema_paths = []`). The Supabase CLI
therefore reads the default **`supabase/migrations/`** on this checkout —
`supabase db reset` confirmed it applies from there. ARCHITECTURE_DECISIONS
Decision 02's "config.toml reads `packages/db/migrations/`" is **not** reflected
in the committed config (pre-existing divergence; chat 111 already flagged the
two dirs diverge — see §5).

Action taken (matching the existing mirroring convention, verified byte-identical
against `…0018_calendar_events.sql`):
- Canonical pair written to `packages/db/migrations/` (up + down).
- Up file mirrored verbatim to `supabase/migrations/20260601000021_notebook_inferences.sql`.
- `.down.sql` is NOT mirrored (the mirror is up-only, per existing convention).

## 3. Table `notebook_inferences` (as applied)

Verified via `\d public.notebook_inferences` after `supabase db reset`:

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | not null | `gen_random_uuid()` |
| user_id | uuid | not null | — (FK → `users(id)` ON DELETE CASCADE) |
| inference_text | text | not null | — |
| inference_type | text | not null | — |
| state | `notebook_inference_state_enum` | not null | `'pending'` |
| corrected_text | text | null | — |
| surfaced_at | timestamptz | null | — |
| resolved_at | timestamptz | null | — |
| created_at | timestamptz | not null | `now()` |
| updated_at | timestamptz | not null | `now()` |

- Enum `notebook_inference_state_enum` = `('pending','confirmed','corrected')`,
  created inline in the migration (closed set → pgEnum, per `templates.ts`).
- `inference_type` is **TEXT, not an enum**: no enumerated inference taxonomy
  exists in any project artifact (searched TECHNICAL_SPEC §3, LAYER_4 Butler's
  Notebook, build plan — only the sample copy line exists). If a closed taxonomy
  lands later, migrate to a pgEnum then.
- Indexes: `idx_notebook_inferences_user_created (user_id, created_at DESC)`;
  partial `idx_notebook_inferences_user_pending (user_id) WHERE state='pending'`.
- Trigger: `set_updated_at_notebook_inferences BEFORE UPDATE` → shared
  `set_updated_at()` from migration 13 (function left intact on down).

## 4. RLS posture (matches chat-005 sensitive pattern)

- `relrowsecurity = t`, `relforcerowsecurity = f`. **No FORCE** — confirmed none
  of the chat-005 sensitive tables (`security_audit_log`, `hydration_log`,
  `cancellation_events`) use FORCE either.
- Strict own-row, deny-all default (no permissive policy):
  - `notebook_inferences_select_own` — `FOR SELECT USING (auth.uid() = user_id)`
  - `notebook_inferences_update_own` — `FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id)` (covers confirm + correct).
  - No INSERT/DELETE policy: engine inserts under the service role (RLS-bypass);
    deny-all forbids client INSERT/DELETE (mirrors `cancellation_events`).
- **No table GRANTs** to `anon`/`authenticated` — matches the repo-wide pattern
  (verified `hydration_log` also denies `authenticated`). The app reaches the
  table only via the **service-role** Drizzle client, which bypasses RLS and has
  full privileges. The own-row policies are defense-in-depth for any future
  direct (PostgREST/`authenticated`-JWT) access.

### Own-row cross-user test (captured)

Run in a rolled-back transaction: user A and user B each own one inference; an
in-transaction `GRANT SELECT,UPDATE … TO authenticated` then `SET ROLE
authenticated` with `request.jwt.claim.sub = B`:

| Check | Expected | Result |
|-------|----------|--------|
| Rows B can see (of A+B) | 1 | **1** |
| A's rows visible to B | 0 | **0** |
| Rows affected by B updating A's row | 0 | **0** |
| A's state after B's attempted update | `pending` | **pending** |

Parity note: the same `SET ROLE authenticated; SELECT` denies on the existing
`hydration_log` too — the missing GRANT is a pre-existing repo-wide condition,
not introduced here.

## 5. Migration apply / reverse (local Supabase, Docker up)

- `supabase db reset` (clean) → all migrations incl. `0021` apply, exit 0.
- Applied `…0021_…down.sql` → table + enum dropped (verified count 0/0).
- Re-applied `…0021_…sql` → table(1)/type(1)/indexes(2)/policies(2)/trigger(1).
  Reverses and re-applies cleanly on a fresh DB.

## 6. Drizzle schema sync

- Added `packages/db/src/schema/notebook.ts` (`notebookInferences` pgTable +
  `notebookInferenceStateEnum`), hand-authored to match the SQL exactly
  (camelCase keys / snake_case columns). Exported from `schema/index.ts`.
- Added `desc` to the `@vesper/db` operator re-export barrel (`src/index.ts`)
  alongside `eq, and, sql` — operators must come from `@vesper/db` to avoid the
  documented cross-`drizzle-orm`-instance Column/SQL type errors.

### ⚠ Pre-existing divergence FLAGGED (not fixed — out of chat-108 scope)

`drizzle-kit pull` could NOT be run to completion: the repo pins
`drizzle-kit ^0.30.0` + `drizzle-orm ^0.38.0`, and this pairing throws
`ERR_PACKAGE_PATH_NOT_EXPORTED: './gel-core'` on pull (the known
version-pairing issue — a working pull needs `drizzle-kit 0.29.1` +
`drizzle-orm 0.38.4`). This is the same reason chat 006's `drizzle-kit pull`
has not landed, so the whole `packages/db/src/schema/` dir remains a hand-stub
that diverges from the committed SQL (templates/waitlist/referral_credits stubs;
the 024 energy + 031 waitlist/referral raw-SQL workarounds). **Not absorbed or
fixed here.** Equivalent evidence that the table is introspectable was captured
directly via `\d public.notebook_inferences` (§3) — i.e. pull will reflect it
once chat 006 corrects the pin.

## 7. API (chat-008 createRoute + chat-007 withUser)

Service-role client; every query threaded through
`withUser(serviceRoleDb, session.userId, query, …)`. No Anthropic, no Resend,
no rate-limiter.

- `GET /api/v1/notebook` → `route.ts` + `getDueInference.ts`: most-recent
  `pending` row for the user (uses the partial index); returns
  `{ inference: NotebookInference | null }`. No list, no history.
- `POST /api/v1/notebook/confirm` → `confirm/route.ts` + `confirmInference.ts`:
  body `{ inferenceId }`; `state='confirmed', resolved_at=now()` WHERE
  `id = inferenceId AND user_id = session.userId`; 404 NOT_FOUND on own-row miss.
- `POST /api/v1/notebook/correct` → `correct/route.ts` + `correctInference.ts`:
  body `{ inferenceId, correctedText }`; `state='corrected',
  corrected_text=…, resolved_at=now()`, same own-row WHERE; 404 on miss.
- `notebook/schemas.ts` re-exports the shared Zod + route response envelopes;
  `mapInference.ts` is the shared row→ISO response mapper.
- `resolved_at` set via `sql\`now()\``; `updated_at` left to the DB trigger.

## 8. Zod (camelCase, in `@vesper/shared`)

`packages/shared/src/schemas/notebook.ts` (exported from `schemas/index.ts`):
- `NotebookInferenceSchema` (response): `id, userId, inferenceText,
  inferenceType, state ('pending'|'confirmed'|'corrected'), correctedText
  nullable, surfacedAt nullable, resolvedAt nullable, createdAt, updatedAt`.
- `ConfirmInferenceRequestSchema`: `{ inferenceId: uuid }`.
- `CorrectInferenceRequestSchema`: `{ inferenceId: uuid, correctedText: string (min 1) }`.

## 9. audit-schema assertion — DEFERRED (chat-111 precedent, NOT fabricated)

Chat 006's `packages/db/scripts/audit-schema.ts` **does not exist** (verified:
`packages/db/scripts/` holds only `check-client.ts` and `setup-test-db.ts`). Per
the chat-111 precedent, **no stub was created**. When chat 006's
`audit-schema.ts` lands, it MUST add these assertions for `notebook_inferences`:

1. Table `public.notebook_inferences` exists.
2. `user_id` FK → `users(id)` with `ON DELETE CASCADE`.
3. `state` column default = `'pending'`; type `notebook_inference_state_enum`
   with values `('pending','confirmed','corrected')`.
4. Both indexes present: `idx_notebook_inferences_user_created` and the partial
   `idx_notebook_inferences_user_pending (… WHERE state='pending')`.
5. RLS enabled (`relrowsecurity = true`) with own-row `SELECT` + `UPDATE`
   policies (`auth.uid() = user_id`) and deny-all default (no INSERT/DELETE
   policy).
6. `set_updated_at` trigger attached (`BEFORE UPDATE`, function `set_updated_at()`).

## 10. End-of-session gate

- `pnpm --filter @vesper/db --filter @vesper/shared type-check` → clean.
- `pnpm build`: the 4 non-web packages build; `@vesper/web` "Compiled
  successfully" then fails ONLY in Next's generated `.next/types/validator.ts`
  for the three untouched `layout.tsx` files (`bigint not assignable to
  ReactNode` — the pre-existing `@types/react` 18-vs-19 skew). **No notebook
  file is implicated.** Pre-existing, not from this chat.
- `pnpm lint` → clean (all 6 packages; web: "No ESLint warnings or errors").
- `.env.example`: no new env var introduced.
- Both new migrations have matching `.down.sql` (the canonical pair; mirror is
  up-only by convention).
