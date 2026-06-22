# PERSISTENT — Cross-Chat Open Flags

Last updated: after Chat 076 landed (push-token registration mobile + APNS_KEY_ROTATION runbook; branch chat-076-push-token-registration).

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
**Relevant-to:** 035-W (push_tokens); 081, 089-W, 072 (subscriptions); 064, 034-W (integrations)
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

### SUBSCRIPTION STATE MACHINE (081 — landed; consumers must re-point)
**Owner:** Each consuming chat (072 dunning; 082/084/086/087/088/089-W/090)
**Relevant-to:** 072, 082, 084, 086, 087, 088, 089-W, 090; account-delete owner
**Status:** Open — re-pointing required (highest 081 hazard)
**Detail:** Canonical state machine now lives at `packages/shared/src/subscriptionState.ts`
(re-exported from the shared index). The OLD `apps/web/lib/subscription/stateMachine.ts` still
holds 030's throwing stubs (`transitionToActive(_userId)` / `transitionToReadOnly(_userId)`) —
left untouched by 081. Every consumer must (a) switch the import to @vesper/shared AND (b) adopt
the new signature `fn(db, userId, reason?)` — breaking vs 030's `fn(userId)`; the caller must
thread a Database handle (the dunning worker needs a db client in context). Miss it → runtime
NOT_IMPLEMENTED throw. Other 081-created obligations:
- `requestDeletion` is NOT wired into account-delete — that route still does its own direct
  `users` UPDATE (operations.ts), so it does NOT fire provider side effects (Stripe cancel /
  `deletion_requested_at`). Account-delete owner must adopt `requestDeletion` or replicate them.
- Cancel transitions persist `cancellation_reason` but NOT `subscriptions.canceled_at`; future
  cancel work must set `canceled_at` (the §8 webhook handlers do).
- Referral mint: shared can't import apps/web, so 081 implemented the 6-char base62 generator
  INLINE in subscriptionState.ts. If `apps/web/lib/referral/codeGenerator.ts` later lands, 095-W
  must reuse shared's generator or keep both at 6-char base62 or formats drift.

---

### DELETION STRIPE-CANCEL DRIFT (081)
**Owner:** Reconciliation / hard-delete worker owner (074 / hard-delete chat)
**Relevant-to:** 074, hard-delete worker chat, dunning
**Status:** Open
**Detail:** 081 commits `deletion_scheduled` BEFORE the Stripe cancel (moved after commit to
avoid an un-rollbackable external call inside the txn). If the cancel fails, the row is
`deletion_scheduled` but the Stripe sub stays live → user keeps getting billed, silently, unless
a reconciliation sweep re-issues the cancel. No such sweep ships yet — the owning worker chat must
re-issue failed Stripe cancels for deletion_scheduled rows. Documented in
docs/SUBSCRIPTION_STATE_MACHINE.md.

---

### SUBSCRIPTIONS AUDIT TRIGGER GAP (081 finding #1 — to file)
**Owner:** Owning migration chat (006 / 008 / 011)
**Relevant-to:** 006, 008, 011; any subscriptions forensic/audit work
**Status:** Open — recommendation to file
**Detail:** No `subscriptions` AFTER UPDATE OF status trigger exists; §3 reasons
`subscription_events` covers history, but that table is webhook-only (`UNIQUE(provider,event_id)`)
so non-webhook transitions (trial-end→read_only, referral mint, account-delete→deletion_scheduled)
are unaudited anywhere. Recommend the owning migration chat add `audit_subscriptions_changes()`
AFTER UPDATE OF status → `security_audit_log`. 081 authored no trigger and verified by row update.

---

### referral_code LIVE TYPE = text, NOT varchar(6) (081 confirmed)
**Owner:** Informational / schema-audit correction
**Relevant-to:** Any users-schema or audit chat (006); 095-W
**Status:** Open — informational
**Detail:** Live `users.referral_code` is `text UNIQUE NULL` (migration …0002_users.sql), matching
TECHNICAL_SPEC §3. PHASE_4_BUILD_PLAN.md (L457, L515) and the audit-schema.ts assertion say
`varchar(6)` — WRONG. Encode/assert `text` (no length constraint); the mint is 6-char base62 regardless.

---

### PSQL NOT INSTALLED — USE THE IN-REPO POSTGRES NODE CLIENT
**Owner:** Operator local env (standing)
**Relevant-to:** Any chat verifying rows/triggers/schema by SQL
**Status:** Open — standing env constraint
**Detail:** `psql` is not installed on the Windows machine. Any DB/SQL verification (row inspection,
trigger/schema checks) must run through the Postgres Node client already in the repo
(`packages/db/src/client.ts`) via a tiny Node script, NOT `psql`. Kickoffs must state this.

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
076 adds `push_token_registered` {platform, has_live_activity_token, device_id_hash} (device_id
hashed via FNV-1a) to the pending 096 taxonomy; emitted via a guarded seam in
apps/mobile/lib/pushTokens.ts, awaits registration in 096.

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

### LIVE ACTIVITY PUSH-TO-START TOKEN SOURCE (076 — resolved)
**Owner:** Native-bridge / widget chat (077/078) + Cutover
**Relevant-to:** 077, 078; any Live Activity push-to-start wiring; Cutover (APNs)
**Status:** Open — finding resolved; bridge wiring deferred
**Detail:** `expo-live-activities` is NOT a dependency. `expo-notifications@0.29.14` provides the regular
APNs token (`getDevicePushTokenAsync`) but no Live Activity push-to-start API. The LA push-to-start
token comes from the native `VesperLiveActivityBridge` (ActivityKit;
`NativeModules.VesperLiveActivityBridge.getPushToStartTokenAsync()`), mirroring `lib/alarm.ts`'s
`VesperAlarmBridge`. Returns null until that bridge is wired (deferred Mac/EAS session — see
IOS_WIDGET_REBUILD.md). Supersedes TECHNICAL_SPEC §7 "Token Storage" wording naming
expo-live-activities — loose spec wording, not the installed dep.

---

### RN CRYPTO ABSENT — Expo SDK 52 winter runtime (076)
**Owner:** Informational — standing mobile constraint
**Relevant-to:** Any mobile (🟢) chat generating IDs or hashing client-side
**Status:** Open — standing
**Detail:** Expo SDK 52 winter runtime polyfills only TextDecoder/URL/URLSearchParams/FormData — NO
crypto (no `crypto.randomUUID`, no `crypto.subtle`), and `expo-crypto` is not a dep. 076 used a
`Math.random` v4 UUID for `device_id` (generate-once, persisted in expo-secure-store) and FNV-1a
one-way hex for `hashDeviceId` (not SHA-256); acceptable because device_id is opaque/non-PII. If a real
cryptographic hash/UUID is ever required, add `expo-crypto` first.

---

### OPERATOR HARDWARE / TEST SURFACES (standing)
**Owner:** Operator env (standing)
**Relevant-to:** Any mobile (🟢) chat scoping on-device testing
**Status:** Open — standing fact
**Detail:** Operator has a physical iPhone for on-device mobile testing; NO Mac. Mac-gated work (native
Swift, Xcode, Expo native dev builds requiring macOS) stays deferred. iPhone-runnable: Expo Go (standard
Expo modules) and EAS cloud builds (no Mac needed). EAS install currently blocked on Apple Developer
Program enrollment. "Needs a device" is not "needs a Mac" — distinguish when scoping device E2E.

---

### CI: react-native imports must be mocked in vitest (076)
**Owner:** Informational — standing mobile-test constraint
**Relevant-to:** Any mobile (🟢) chat with vitest unit tests importing react-native (directly or transitively)
**Status:** Open — standing
**Detail:** Any mobile module that imports react-native (directly or transitively) must be mocked in
every vitest unit test that pulls it in, or vite's SSR transform fails parsing RN's Flow source
(`Expected 'from', got 'typeOf'`). Single-file local runs can hide this — run full `pnpm test` before
pushing. 076 hit this via store/auth.ts -> pushTokens.ts -> react-native.

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
- **On-device APNs / Live Activity push-to-start test (076)** — blocked on Apple Developer Program
  ($99) + APNs .p8 + the native VesperLiveActivityBridge being wired. EAS cloud build needs no Mac
  but is blocked on the Apple-account work; Expo Go does NOT work on SDK 52 (no remote push token /
  no native modules). Defer the real-token E2E.

