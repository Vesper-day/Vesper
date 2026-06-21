# PERSISTENT — Cross-Chat Open Flags

Last updated: after Chat 063 landed (committed e786a69 on branch chat-063-gcal-oauth-pgsodium; PR pending).

Read this file when writing any Claude Code prompt. Include only flags where
the current chat appears in the Relevant-to column. Do not paste the full file
into kickoffs — reference by flag name only.

---

## How to use

**When writing a kickoff:** List only the flag names relevant to that chat.
One line each. Full text is here; do not re-paste it.

**After a chat lands:** Add any new flags surfaced during the session. Upload
updated file to project knowledge.

---

## Open Flags

### TASKS DRIZZLE MODEL CURRENT
**Owner:** Informational — 028 finding
**Relevant-to:** 054-W, 055, 056, any tasks-touching chat
**Status:** Open — informational
**Detail:** `packages/db/src/schema/daily-planning.ts` tasks table matches
TECHNICAL_SPEC §3 column-for-column (verified in 028); 028 used the Drizzle
model, NOT raw SQL. Stub drift is table-specific — still verify per-table, but
the tasks model needs no raw-SQL fallback.

---

### GCAL TOKEN ENCRYPTION MODEL (063 — decided)
**Owner:** Decided in 063; operational for GCal/encryption chats + Cutover
**Relevant-to:** 064, 034-W, any integrations/token chat; Cutover (prod key)
**Status:** Closed-decision / operational
**Detail:** App-side encryption. `packages/db/src/encryption.ts` uses a Node libsodium AEAD
binding keyed from `process.env.PGSODIUM_KEY` (nonce-prepended bytea ciphertext in
`integrations.access_token_encrypted` / `refresh_token_encrypted`). In-DB pgsodium key store
REJECTED — Supabase has pgsodium pending deprecation and advises against its Server Key
Management / Transparent Column Encryption. §14 #1 / LAYER_3 "pgsodium extension" + build-plan
"Supabase secret" wording are loose, superseded by §13. OAuth: manual {code,redirectUri}
exchange at oauth2.googleapis.com/token; dedicated callback page at
`apps/web/app/(app)/settings/integrations/callback/page.tsx`. Verified end-to-end (293-byte
ciphertext round-trips; connect→audit INSERT, disconnect→audit DELETE).

---

### PGSODIUM_KEY — PROD KEY REQUIRED, IRREVERSIBLE (operational)
**Owner:** Cutover / deploy
**Relevant-to:** Cutover Block; any prod deploy
**Status:** Open — operational
**Detail:** The 063 `PGSODIUM_KEY` lives only in local `.env.local`. Production (Vercel) needs
its own unique `PGSODIUM_KEY`. If the prod key is lost, every stored OAuth token is permanently
unrecoverable (users must re-auth — see `PGSODIUM_KEY_ROTATION.md`). Do NOT reuse the local key
in prod; back up the prod key securely.

---

### PROD GOOGLE CALENDAR OAUTH CLIENT (063 — not prod-ready)
**Owner:** Cutover / deploy
**Relevant-to:** Cutover Block; 064; any GCal prod deploy
**Status:** Open — operational
**Detail:** 063 connect route currently FALLS BACK to `GOOGLE_CLIENT_ID/SECRET` (the
Supabase-Auth sign-in client) because `GOOGLE_OAUTH_*` aren't set. For prod: (a) create a
dedicated Calendar OAuth client with `calendar.readonly`, (b) register prod redirect
`https://vesper.day/settings/integrations/callback`, (c) set `GOOGLE_OAUTH_CLIENT_ID/SECRET` +
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, (d) submit the consent screen for Google verification
(unverified-app warning blocks scale beyond test users).

---

### LOCAL SENTRY DSN MISCONFIG (063)
**Owner:** Operator local env
**Relevant-to:** Any chat relying on local Sentry error capture
**Status:** Open — local-env hygiene
**Detail:** Local `.env.local` `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` hold an `sntryu_…` auth
token, not a DSN, so Sentry silently no-ops locally (no local error reporting). Not a code flag;
fix the DSN values if local Sentry visibility is wanted.

---

### STALE push_tokens + subscriptions + integrations DRIZZLE MODELS
**Owner:** Informational — 030 + 063 findings (durable fix = drizzle-kit pull, currently BROKEN)
**Relevant-to:** 076, 035-W (push_tokens); 081, 089-W, 072 (subscriptions); 064, 034-W (integrations)
**Status:** Open — informational
**Detail:** STALE vs TECHNICAL_SPEC §3, confirmed: `push_tokens` (missing live_activity_token,
last_used_at; wrong uniqueness), `subscriptions` (missing provider, status, +5 cols), and
`integrations` (text vs bytea, phantom `scopes`, missing last_synced_at/last_error, 1-value enum,
063 finding). Use raw parameterized SQL against the migration columns. `db:pull` resync is BROKEN
(`./gel-core is not exported` — drizzle-kit↔drizzle-orm version mismatch); recipe to unbreak =
pin drizzle-kit 0.29.1 + drizzle-orm 0.38.4 then `db:pull`, or hand-correct. Stub drift is
table-specific: verify each table column-for-column; treat these three as known-stale → raw SQL.

---

### AUTH-EVENT VAULT SECRETS (operational)
**Owner:** Cutover / deploy
**Relevant-to:** Cutover Block; any staging/prod deploy chat
**Status:** Open — operational, not a code flag
**Detail:** 030's auth.users UPDATE trigger uses pg_net (`net.http_post`) and reads
two Supabase Vault secrets (`auth_event_secret`, `auth_event_base_url`). Both
FAIL-OPEN to a no-op when unset (so `supabase db reset` never blocks). In any
deployed env the secrets must be set manually or the orphan-push-token cleanup
silently does nothing. Mechanism (pg_net + Vault) was chosen, not spec-specified —
flagged for review.

---

### SUBSCRIPTION STATE-MACHINE STUBS
**Owner:** 081
**Relevant-to:** 081, 072 (dunning), 091
**Status:** Open
**Detail:** 030 exported throwing stubs `transitionToActive` / `transitionToReadOnly`
so downstream imports compile. Authoritative names/signatures/module path are owned
by 081 — reconcile there. 072's dunning-check calls `transitionToReadOnly` against
the stub.

---

### APPLE-VERIFY 501 STUB
**Owner:** 086
**Relevant-to:** 086
**Status:** Open
**Detail:** `/api/v1/subscription/apple-verify` ships as a 501 (ErrorCode.NOT_IMPLEMENTED)
stub from 030; Zod request shape already colocated. Full JWS verification lands 086.

---

### @vesper/shared DIST-VS-SRC REBUILD ORDERING
**Owner:** No owner — note only (adjacent to the moduleResolution gotcha)
**Relevant-to:** Any chat adding new exports to @vesper/shared
**Status:** Open — standing build gotcha
**Detail:** @vesper/shared serves TYPES from `dist/` but RUNTIME from `src/`. New
exports are invisible to a consumer type-check until shared is rebuilt:
`pnpm --filter @vesper/shared build` BEFORE type-checking the consumer.
New 037 exports: `realtime/client.ts` (createRealtimeClient) and
`realtime/selfMutationFilter.ts` (selfMutationFilter, SELF_MUTATION_WINDOW_MS),
re-exported from `packages/shared/src/index.ts`.

---

### STALE analytics.ts ORM
**Owner:** Dedicated cleanup chat (TBD — no current owner in build plan)
**Relevant-to:** 027, any chat writing to or reading from completion_log
**Status:** Open
**Detail:** `packages/db/src/schema/analytics.ts` declares `event_name`/`occurred_at`
but the applied migration `…0010_completion_log.sql` has `event_type` + `value jsonb`.
Any chat querying or writing completion_log must use REAL applied columns, not the stale
ORM. Do not absorb a full analytics.ts cleanup into a build chat — flag and defer to the
cleanup owner. 025 noted this; confirm at 025 resolution whether a cleanup chat was filed.

---

### 096 PostHog TAXONOMY
**Owner:** 096
**Relevant-to:** 025 (records-only), 059b, 096
**Status:** Open
**Detail:** 025 emits `plan_generated`/`plan_regenerated` to completion_log. These
await registration in chat 096 (with `plan_fallback_served` and 059b alarm events).
025 records-only; do not build 096 in any earlier chat.
Pending taxonomy events also include: `realtime_connection_state_changed` (037 —
states: subscribing, subscribed, error, closed, reconnecting; payload
{state, reason, plan_date, retry_count}). Emitted via a guarded dev-log seam in
both usePlanRealtime hooks; 096 registers + routes it through PostHog.
037 adds realtime_connection_state_changed (states: subscribing, subscribed, error, closed,
reconnecting; payload {state, reason, plan_date, retry_count}) to the pending 096 taxonomy.

---

VITEST UPSTASH ENV — `apps/web/vitest.config.ts` does not load `.env.local`; integration tests need `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set in-shell before running the integration suite. Out of scope to fix in any build chat — just set the vars manually before each integration run.

---

### @types/react 18-vs-19 BUILD SKEW
**Owner:** Pre-existing / no owner — note only
**Relevant-to:** All @vesper/web chats (🔵)
**Status:** Open — pre-existing, do not fix
**Detail:** `pnpm build` for @vesper/web compiles successfully then fails ONLY in
Next's generated `.next/types/validator.ts` for untouched `layout.tsx`
(`bigint→ReactNode`). Pre-existing @types/react version skew. If any chat's
type-check/build trips this: note it, do not absorb. 063 pinned `@types/react` to 18.3.28
(React runtime 19) to silence the mobile type-check skew — deliberately fragile; revisit on a
React/Expo bump (a future `@types/react-dom` mismatch may resurface).

---

### @vesper/shared TSC moduleResolution GOTCHA
**Owner:** No owner — note only
**Relevant-to:** Any chat importing @vesper/shared types in apps/web routes
**Status:** Open — pre-existing, do not fix
**Detail:** Imports of @vesper/shared types under node resolution may not resolve
(surfaced in 059b/077). If it bites in a chat: flag, do not absorb a monorepo
resolution cleanup.

---

### SUPABASE ADVISOR WARNINGS
**Owner:** Future repo-wide forward migration chat (TBD)
**Relevant-to:** Any chat running Supabase advisor / RLS work
**Status:** Open — track only
**Detail:** ~67 WARN-level `auth_rls_initplan` lints, pre-existing. Fixed by a future
repo-wide forward migration; no chat currently owns it. Before relying on the set,
confirm none is severity ERROR. Do NOT fix in any build chat.
**037 publication-RLS / chat-006 gate:** live advisor check found no ERROR-severity
security lints (the ~67 auth_rls_initplan WARNs are pre-existing and expected);
`blocks` confirmed present in the `supabase_realtime` publication. The
publication-RLS gate is satisfied for Realtime broadcasts.

---

### MIGRATION/DB-INFRA STANDING
**Owner:** Active — confirmed in 063
**Relevant-to:** Any chat verifying triggers/schema or resyncing Drizzle (081, 064, 076, …)
**Status:** Open — ACTIVE
**Detail:** `db:pull` confirmed BROKEN in 063 (`./gel-core is not exported` — drizzle-kit↔
drizzle-orm version mismatch); unbreak by pinning drizzle-kit 0.29.1 + drizzle-orm 0.38.4.
`audit-schema.ts` is absent (chat 006) AND not runnable — verify ANY audit/trigger/schema
expectation by DIRECT SQL on the live local DB, never the script. Supabase MCP misconfig;
`config.toml` reads `supabase/migrations` with no override.

---

### CHAT-029 REORDER client_mutation_id ECHO GAP
**Owner:** 029 follow-up (unassigned)
**Relevant-to:** 038; any chat wiring drag-reorder into the day view
**Status:** Open
**Detail:** The chat-029 reorder route writes displayOrder only — it does NOT accept
a clientMutationId header or write blocks.client_mutation_id per row (verified in 037).
Its Realtime broadcasts can't be self-filtered, so a device's own drag-reorder echoes
back (brief flicker). PATCH/POST (chat 027) are unaffected. Fix = add clientMutationId
pass-through + per-row write to the reorder route. NOT absorbed into 037.

---

### SELF-MUTATION WINDOW = 60s; §3 RECONCILE
**Owner:** Spec edit (operator)
**Relevant-to:** 038; spec maintenance
**Status:** Open
**Detail:** 037 set the self-mutation window to 60s (raised from 30s for mobile
background/foreground stalls). TECHNICAL_SPEC.md §3 still reads "30-second sliding
window" — reconcile §3 to 60s.

---

## Standing Deferrals (carry for closure, do not action in build chats)

These are not open flags — they are known deferrals with no action required
in any current build chat. Listed here so they don't re-surface as questions.

- **077 + 059b native iOS halves** — DEFERRED to a Mac session
- **@vesper/ui gaps** — deferred
- **Design-token Fable migration** — deferred (Fable access suspended)
- **Local dev auth config** — deferred
- **Stripe identity (C-20)** — Cutover step
- **Sentry release placeholders** — Cutover step
- **Founder mailing-address + marketing DNS (C-22a)** — Cutover step
- **091 follow-ups (PR #31)** — deferred
- **@vesper/ai dist-rebuild ordering** — deferred

