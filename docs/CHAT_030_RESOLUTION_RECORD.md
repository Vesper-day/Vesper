# Chat 030 — Subscription / Account / Push-Token API scaffolds — Resolution Record

Backend-only scaffolds: App Router handlers + colocated Zod + integration tests,
one migration (auth.users UPDATE trigger → internal auth-event), the server-side
`onAuthStateChange` hook, and a minimal subscription state-machine stub. No iOS, no
React UI, no AI/synthesis. The full subscription state machine is OUT OF SCOPE
(chat 081).

## DB model staleness — raw-SQL vs ORM decision (per table)

Verified each model against TECHNICAL_SPEC §3 AND the applied migration,
column-for-column.

| Table | Model file | Status vs migration | Decision |
|---|---|---|---|
| `push_tokens` | `schema/integrations.ts` | **STALE.** Model omits `live_activity_token` and `last_used_at`; carries an extra `updated_at` the table lacks; marks `token` UNIQUE and `platform` text-with-default, but the real table is `platform push_platform_enum NOT NULL` (no default), `device_id text NOT NULL`, and uniqueness is `UNIQUE(user_id, device_id)`. | **RAW SQL.** Upsert + deletes run as raw parameterized SQL against migration `20260601000007` columns. No stub hand-edit (CHAT_111 §5). |
| `subscriptions` | `schema/subscriptions.ts` | **STALE.** Model omits `provider`, `status`, `stripe_price_id`, `apple_product_id`, `canceled_at`, `cancellation_reason`, `cancellation_reason_text`. GET /subscription needs `status` + `provider`. | **RAW SQL** for the SELECTs (subscription read, portal customer lookup, delete provider check). The `users` UPDATEs use the Drizzle model (`users.ts` matches §3 for the two columns touched). |
| `security_audit_log` | `schema/security_audit_log` (migration `20260601000011`) | Matches §3. | **NOT TOUCHED** — out of scope (see below). |

## DROPPED kickoff rule — security_audit_log co-write (defer-to-spec)

The kickoff's "account delete/restore co-writes `security_audit_log`" instruction
was **DROPPED**. §3 (table 19), §4, and §9 do not support it: the table is
trigger-only (scoped to `medications` + `integrations`), the application never
writes it, it has **no `event_type` column**, and it has no INSERT policy. Writing
it from the delete/restore handlers is structurally impossible and contradicts the
spec. The handlers perform only the §4 direct `users` UPDATEs. An integration test
asserts zero `security_audit_log` rows after delete+restore.

## Migration

- **Number chosen: `20260601000023`.** `0021` is the current max present; `0022`
  was deleted and is RETIRED (never reused, per `docs/MIGRATION_NUMBER_ALLOCATION.md`).
  Prefix `20260601` matches the Block-1 convention.
- **Dual-write paths:**
  - canonical: `packages/db/migrations/20260601000023_auth_event_trigger.sql` + `.down.sql`
  - Supabase mirror (up-only): `supabase/migrations/20260601000023_auth_event_trigger.sql`
  - (`supabase/config.toml` `[db.migrations] enabled = true`, `schema_paths = []` →
    it reads `supabase/migrations/`; mirror placed there per the 014–021 precedent.)
- **trigger → HTTP mechanism (NOT spec-specified; chosen + called out):**
  **pg_net** (`net.http_post`, async). Chosen over Supabase "Database Webhooks"
  (those are pg_net wrappers configured out-of-band, not reproducible in a
  migration) and over a synchronous call (keeps the auth write path non-blocking).
  `CREATE EXTENSION IF NOT EXISTS pg_net`.
- **shared-secret storage (NOT spec-specified; chosen + called out):**
  **Supabase Vault** (`vault.decrypted_secrets`). The trigger reads
  `auth_event_secret` and `auth_event_base_url` at fire time. Both are provisioned
  **out of band** (operational step, e.g. `select vault.create_secret(...)`), NOT
  in the migration, so no secret is committed. `CREATE EXTENSION IF NOT EXISTS
  supabase_vault WITH SCHEMA vault`.
- **Fail-open behavior:** the trigger function returns a NO-OP when either Vault
  row is absent, so `supabase db reset --local` and normal auth writes are never
  blocked by missing config. The trigger only acts on a password change
  (`encrypted_password` changed); other `auth.users` UPDATEs are ignored.
- **Scope in this chat:** the trigger fires `eventType = 'password change'`. The
  other event types (`sign-out`, `session expired`, `hard-delete cascade`) are
  driven from the application via `apps/web/lib/auth/onAuthStateChange.ts`, which
  POSTs the same endpoint.

⚠️ **REVIEW FLAGS:** pg_net + supabase_vault must be available at local
`db reset` (both ship with Supabase, but confirm on the target image). The Vault
secret bootstrap is an operational prerequisite, not migration-owned. Trigger on
`auth.users` requires the migration role to own/alter auth.users — precedent:
`handle_new_user` (migration `20260601000002`) already creates an `auth.users`
trigger.

## Internal endpoint + auth

- `POST /api/v1/internal/auth-event` — authenticated by the `x-auth-event-secret`
  header compared (constant-time) against `process.env.AUTH_EVENT_SECRET`. **Fails
  closed:** a missing server secret rejects 401. Action: DELETE all `push_tokens`
  for the `userId` (raw SQL). Request Zod: `{ userId: uuid, eventType: enum }`.
- New env var: **`AUTH_EVENT_SECRET`** (added to `.env.example`). Same value must
  live in Vault as `auth_event_secret`.

## State-machine stub

- Module: `apps/web/lib/subscription/stateMachine.ts`.
- Exports (throwing stubs): **`transitionToActive`** (sourced —
  PHASE_4_BUILD_PLAN L457) and **`transitionToReadOnly`** (referenced by the
  kickoff, **UNVERIFIED** in project files). Both throw `ApiError(NOT_IMPLEMENTED)`.
- ⚠️ The authoritative names / signatures / path are **owned by chat 081** and
  MUST be reconciled there. account/delete + account/restore do NOT call these —
  they perform the direct `users` UPDATEs per §4.

## Error code

- Added **`ErrorCode.NOT_IMPLEMENTED`** to `packages/shared/src/errors.ts`, mapped
  to HTTP **501** in `DEFAULT_HTTP_STATUS`. Error shape per §9:
  `{ error: { code: "NOT_IMPLEMENTED", message } }`.

## apple-verify phasing

- `POST /api/v1/subscription/apple-verify` is a **501 stub** this chat (§9 shows an
  eventual 200; PHASE_4_BUILD_PLAN L1125/L1132 → full StoreKit 2 verify lands
  chat 086). The request Zod `{ jwsTransaction: string }` is colocated now for 086
  to reuse. Manual wrapper (createRoute emits a fixed 200; 501 needs the manual
  path), returns `NOT_IMPLEMENTED`.

## push-tokens upsert

- Conflict target: **`(user_id, device_id)`** (§3 table 13 UNIQUE). Insert-vs-update
  (201 vs 200) detected with the `RETURNING (xmax = 0)` idiom — no second round-trip.

## Tests — Stripe decision

- Stripe Checkout/Portal builders take a `Stripe` client **parameter**, so tests
  **MOCK** Stripe (plain object with the called methods). **No `STRIPE_SECRET_KEY`
  needed**; the suite runs fully offline. DB-backed logic (getSubscription,
  deleteAccount, upsert/delete push tokens, auth-event deletion) is gated on
  `VESPER_DB_TESTS` against the local Supabase test DB; pure Zod + secret-gate
  suites run ungated.

## Stripe SDK dependency

- Added `stripe ^14` to `apps/web/package.json`. **`pnpm install` is required**
  before `pnpm type-check` / build will resolve the `stripe` types.

## Files

New routes: `subscription/{route,checkout/route,portal/route,apple-verify/route}.ts`,
`subscription/{operations,schemas}.ts`; `account/{delete/route,restore/route,operations}.ts`;
`push-tokens/{route,[deviceId]/route,operations,schemas}.ts`;
`internal/auth-event/{route,operations,schemas}.ts`;
`apps/web/lib/auth/onAuthStateChange.ts`; `apps/web/lib/subscription/stateMachine.ts`;
migration trio; 4 integration test files; this record. Modified:
`packages/shared/src/errors.ts`, `apps/web/package.json`, `.env.example`.
