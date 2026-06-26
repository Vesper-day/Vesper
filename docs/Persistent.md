# PERSISTENT — Cross-Chat Open Flags

Last updated: after Chat 038 landed (TanStack Query offline mutation queue + conflict resolution).

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

---

### DEV AUTH BYPASS IN MOBILE SIGN-IN (Expo Go render-check scaffolding)
**Owner:** Apple Developer Program enrollment chat (must delete this) + any mobile auth/sign-in chat
**Relevant-to:** the chat that begins Apple Developer Program / dev-build work; any chat touching `apps/mobile/app/(auth)/sign-in.tsx`
**Status:** Open — TEMPORARY scaffolding, must be removed
**Detail:** A `__DEV__`-guarded "DEV: Skip sign-in" button was added to `apps/mobile/app/(auth)/sign-in.tsx` to reach the post-auth mobile screens (013/053/054/063/090b) in Expo Go for an on-device RENDER check after the SDK 52→54 bump. It sets a mock authenticated session via the existing `setSession` setter (NO `store/auth.ts` edit) — mock data only, no network/auth call, stripped from production by `__DEV__`. It exists because NO real sign-in completes in Expo Go: Google's `makeRedirectUri` emits an `exp://<LAN-IP>:8081/--/auth/callback` redirect that mismatches the `vesper://auth/callback` allow-list entry (and the `matchesDeepLinkPath` validator would reject `exp://` anyway); magic link needs the OS to honor the `vesper://` scheme; native Apple needs the `usesAppleSignIn` entitlement. All three require a dev build (expo-dev-client), blocked on Apple Developer Program enrollment + EAS (no Mac). **Removal:** the Apple-dev-build chat MUST delete this — grep `DEV-BYPASS` in `sign-in.tsx`, remove the whole `{__DEV__ && ( … )}` block plus its two comment fences. **Uncommitted:** lives as a local working-tree change only — NOT committed/pushed. If it ever appears in a commit, revert it.

---

### EXPO GO SDK 52-vs-54 RENDER BLOCK (053) — RESOLVED / render-verified
**Owner:** Operator env / SDK-bump owner
**Relevant-to:** closed; reference for any later mobile on-device verification
**Status:** Closed — on-device render verified on Expo SDK 54 (Expo Go, physical iPhone)
**Detail:** SDK 52→54 bump (PRs #62/#63) + barrel split (PR #64) unblocked on-device render; bundle builds clean (2657 modules). On-device Expo Go walk completed via the DEV auth bypass (see DEV AUTH BYPASS flag). RENDER RESULTS (all pass — no redboxes; data/error states expected under bypass + unreachable API):
- 011 sign-in — pass (renders pre-bypass)
- 013 shell — pass (tab bar Plan/Tasks/Calendar/Settings, routed in)
- 054 plan — pass; minimal/near-stub appearance — RE-CHECK appearance once real data + plan synthesis reachable
- 054 tasks — pass (list UI, sort controls, new-task button; "could not load" data error expected)
- 053 calendar — pass (month grid, today highlighted; "could not load" data error expected)
- 063 settings + integrations — pass (settings tree, Connect button navigates)
- 090b privacy — pass (biometric toggle renders; "could not save" write error expected)
NOT covered by this walk (still open, separate track): real auth, real data, and button/mutation behavior — all blocked on a dev build (Apple enrollment + EAS) AND a phone-reachable API (web API currently localhost:3000, unreachable from device; hosted Supabase has no migrations yet). Custom-native screens 059b/077 remain Expo-Go-inert by design.

---

### MOBILE FUNCTIONAL/AUTH/DATA TEST — BLOCKED on dev build + reachable API
**Owner:** Apple Developer Program / dev-build chat; any mobile E2E chat
**Relevant-to:** Apple-dev-build chat; any chat scoping mobile functional (not render) verification
**Status:** Open — deferred to dev-build track
**Detail:** Mobile screens are RENDER-verified (see EXPO GO SDK flag) but NOT functionally verified. Two stacked blockers: (1) no real session on device — Expo Go can't complete any sign-in; needs expo-dev-client (Apple enrollment + EAS, no Mac). (2) Mobile data calls target the web API at `localhost:3000`, unreachable from a physical phone — needs the web app deployed or tunneled. Also: hosted Supabase project (`gexrqyaggqexpfidfwnp.supabase.co`) has NO migrations yet — DB must be migrated/seeded before data renders. Full functional walk needs all three: dev build + reachable+migrated backend.

---

### HOSTED SUPABASE PROJECT EXISTS (mobile on-device test)
**Owner:** Informational — operator env
**Relevant-to:** any chat scoping on-device mobile against a real backend
**Status:** Open — informational
**Detail:** A hosted Supabase project exists (`gexrqyaggqexpfidfwnp.supabase.co`, Free tier, us-west-2), Google provider enabled with the existing `GOOGLE_CLIENT_ID/SECRET` + the Supabase callback added to the Google OAuth client, and `vesper://auth/callback` in the redirect allow-list. `apps/mobile/.env.local` now carries `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` pointing at it (mobile reads `EXPO_PUBLIC_*`, not `NEXT_PUBLIC_*`). Project has NO migrations yet. The `NEXT_PUBLIC_SUPABASE_URL` in that file still points at the local stack (`127.0.0.1:54321`) — harmless for mobile (ignored), but stale if anything web-side ever reads it.

---

### TASKS DRIZZLE MODEL CURRENT
**Owner:** Informational — 028 finding
**Relevant-to:**  055, 056, any tasks-touching chat
**Status:** Open — informational
**Detail:** `packages/db/src/schema/daily-planning.ts` tasks table matches
TECHNICAL_SPEC §3 column-for-column (verified in 028); 028 used the Drizzle
model, NOT raw SQL. Stub drift is table-specific — still verify per-table, but
the tasks model needs no raw-SQL fallback.

---

### BIOMETRIC LOCK (090b — landed)
**Owner:** Cutover (Info.plist) + any mobile settings/auth chat
**Relevant-to:** Cutover Block (Face ID usage string); any chat touching PUT /profile, mobile settings, or store/auth.ts signOut
**Status:** Closed-feature / operational notes
**Detail:** `users.biometric_lock_enabled` is now writable via `PUT /api/v1/profile`
(`biometricLockEnabled` optional bool → `biometric_lock_enabled`). The 030/earlier route was
PARTIAL; 090b extended the Zod schema + handler. The handler writes the scalar via a raw SQL
`UPDATE` because `biometric_lock_enabled` exists in the migration but is MISSING from the
pull-generated Drizzle `users` model — a next `drizzle-kit pull` should surface it (same class as
MIGRATION/DB-INFRA STANDING; `db:pull` still broken). New mobile surface: Settings → Privacy →
Biometric lock, OFF by default, persists the server scalar + a local expo-secure-store cache. Lock
policy: required on cold start and on foreground after >60s background; 3 failed attempts →
shared `store/auth.ts` signOut + magic-link re-auth (no second sign-out path). New dep:
`expo-local-authentication ~15.0.2` (Expo SDK 52) — standard Expo module, testable in Expo Go on
iPhone, NO EAS build needed; `pnpm install` is required before mobile type-check/build.
`app.config.js` has the Face ID `Info.plist` usage string pre-staged — no-op for Expo Go, only
matters at the Cutover native build. `useBiometricLock` now owns the chat-013 `useAppLifecycle`
mount internally; the standalone `useAppLifecycle()` line was removed from `_layout`. PR #53.

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
064 CONFIRMED the helpers are `encryptToken` / `decryptToken` (libsodium XChaCha20-Poly1305,
nonce-prepended bytea, no-AAD). Any consumer outside @vesper/db that imports the encryption helper
must DYNAMIC-import it — a static import pulls libsodium onto the graph and breaks vitest's SSR
transform (same class as the @vesper/db barrel rule). 064 loaded it via dynamic import for this reason.

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

### STALE push_tokens + subscriptions + integrations + calendar_events DRIZZLE MODELS
**Owner:** Informational — 030 + 063 findings (durable fix = drizzle-kit pull, currently BROKEN)
**Relevant-to:** 035-W (push_tokens); 081, 089-W, 072 (subscriptions); 064, 034-W (integrations), 53, any calendar touching chat
**Status:** Open — informational
**Detail:** STALE vs TECHNICAL_SPEC §3, confirmed: `push_tokens` (missing live_activity_token,
last_used_at; wrong uniqueness), `subscriptions` (missing provider, status, +5 cols), and
`integrations` (text vs bytea, phantom `scopes`, missing last_synced_at/last_error, 1-value enum,
063 finding). Use raw parameterized SQL against the migration columns. `db:pull` resync is BROKEN
(`./gel-core is not exported` — drizzle-kit↔drizzle-orm version mismatch); recipe to unbreak =
pin drizzle-kit 0.29.1 + drizzle-orm 0.38.4 then `db:pull`, or hand-correct. Stub drift is
table-specific: verify each table column-for-column; treat these three as known-stale → raw SQL.
- users (090b + 032-W): biometric_lock_enabled present in migration, MISSING from the pull-generated Drizzle users model → 090b wrote the scalar via raw SQL UPDATE. 032-W (CC-reported) found sleep_target_bedtime + sleep_target_wake ALSO absent from the hand-authored users.ts model (only location_lat/lng present); honorific IS present (users.ts:38). Same stale-TS-schema class — whoever wires the real user/profile fetch in the post-032-V onboarding shell may need a raw SQL read for the two sleep_target columns. Verify-per-table still holds.
- calendar_events (052-W): NO Drizzle model exists at all (not just stale) — 052-W ran all CRUD via raw parameterized SQL + validateSession + createDrizzleClient. Same db:pull-broken class. Next drizzle-kit pull should emit it; until then any calendar_events code stays raw SQL + verify columns per-table.
- integrations (064): live column contract re-confirmed (11 cols, access/refresh_token bytea, the two
  enums) via the in-repo Postgres node client; 064 used raw parameterized SQL throughout. The
  audit_integrations_changes-on-UPDATE path was NOT exercised live (no google_calendar row in the local
  DB) — trigger is migration-11 infra, untouched; verify on the first real connect.

---

### GCAL EVENT SYNC (064 — landed)
**Owner:** Each later GCal consumer (034-W connect, 067 conflict UI, 099 reconnect banner, plan synthesis)
**Relevant-to:** 067, 099, 065; any chat importing getTodayEvents / CalendarEvent or reading integration sync state
**Status:** Open — landed-feature forward notes
**Detail:** 064 shipped getTodayEvents + automatic token refresh + rule-first/Haiku event classification + the
plan-synthesis wiring. PR #57.
- PLACEMENT DEVIATION (load-bearing): `getTodayEvents` AND the `CalendarEvent` type live in **@vesper/ai**, NOT
  @vesper/shared as the build-plan path said — @vesper/shared must not depend on @vesper/ai + @vesper/db. Any
  later importer uses **@vesper/ai**, not packages/shared/integrations.
- block_type IS COMPUTED BUT NOT CARRIED: the classifier runs (rule-first → batch 2+ / single 1 / none 0) but
  CalendarEvent stays `{id,title,startTime,endTime}` — the classification is breadcrumb-only and currently has
  NO consumer. 067 (conflict UI) must add a field to the event shape or a side channel, or the classify work
  stays inert. PlanContext.calendarEvents shape was deliberately left unchanged.
- RECONNECT-BANNER TRIGGER: the surface trigger is `integrations.status='error'`, NOT `last_error IS NOT NULL`,
  so a transient error the next sync recovers does not flicker the 099 banner. Sentry breadcrumb fires on every
  refresh attempt (so transient failures stay visible even after last_error is overwritten on recovery).
- DYNAMIC-IMPORT RULE: anything in @vesper/ai that needs @vesper/db/encryption must dynamic-import it (static
  import breaks vitest SSR via libsodium). See the GCAL TOKEN ENCRYPTION MODEL flag.
- getTodayEvents performs integrations bookkeeping writes (last_synced_at / status) inside the generate-only
  synthesis path — sync metadata, not plan persistence; within the Decision-4 boundary.

---

### CALENDAR (052-W + 53 — landed)
**Owner:** Each later calendar surface (053 mobile; any calendar UI/edit chat) + spec maintenance
**Relevant-to:** 053; any chat touching calendar_events, calendar UI, or recurrence
**Status:** Open — landed-feature forward notes
**Detail:** 052-W shipped the web built-in calendar (PR #54).
- LIBRARY: react-big-calendar (web only) — chosen over FullCalendar (lighter bundle, plain-CSS theme maps to @vesper/ui tokens, reuses installed date-fns). FullCalendar rrule plugin moot since recurrence is expanded in-app. Mobile (053) uses react-native-calendars, a separate decision.
- CRUD TRANSPORT: new /api/v1/calendar-events route set (raw parameterized SQL + validateSession + createDrizzleClient), matching the tasks/blocks/push-tokens own-row convention. Mobile + any later surface must CONSUME this route, not author a second transport.
- RECURRENCE: calendar_events stores ONLY the RRULE string + series start/end; instances are EXPANDED ON READ (rrule lib), never persisted. Editing a recurring event edits the WHOLE SERIES by id — no per-instance EXDATE/exceptions. "Edit this occurrence only" needs new design (likely an exceptions table → a migration).
- rbc-theme.css holds LITERAL token hexes (CSS can't read Tailwind tokens) — if @vesper/ui token values change, hand-sync rbc-theme.css (each hex is commented with its token name).
- NEW WEB DEPS: react-big-calendar, rrule, @types/react-big-calendar — pnpm install required before web type-check/build on a fresh checkout. react-big-calendar carries a React-18 peer warning under React 19 (same class as @hello-pangea/dnd); installs/builds fine.
- /calendar route not yet in any nav — page mounts under (app) but no link added (no nav shell exists; plan/week/tasks are stubs). Wire into nav when the app-shell chat lands.
- MIGRATION DOC DRIFT (to file): TECHNICAL_SPEC §3 says calendar_events lives in 000016 new_feature_tables — FALSE. Repo: 000016 = delayed_jobs; calendar_events = standalone 000018 (pkg + supabase mirrors). Repo = truth; spec needs correcting.
- 053 (mobile) shipped (PR #55). react-native-calendars@^1.1312.0 has NO native RRULE support; the existing GET /api/v1/calendar-events already returns server-expanded instances (operations.ts→recurrence.ts), so mobile CONSUMES server-expanded instances — no client expander, no rrule mobile dep (avoids drift from the canonical web expander). Files: apps/mobile/app/(tabs)/calendar.tsx, apps/mobile/lib/calendarEvents.ts (thin CRUD client over apps/mobile/lib/api/client.ts), + calendarEvents.test.ts. This thin-client + consume-existing-route shape is the parity pattern for later mobile surfaces (054-W).
- MOBILE DAILY-PLAN FIXED-BLOCK SURFACING = forward gap: apps/mobile plan.tsx / store/plan.ts are still stubs; surfacing calendar-events as fixed blocks in the mobile plan needs a server-synthesis change (apps/web / packages/ai owned) — out of 053 scope; no web/ai touched.

---

### 107/107a DESIGN PRIMITIVES ABSENT
**Owner:** 107/107a design-system chats; any UI chat told to compose from their primitives
**Relevant-to:** any web/mobile UI chat referencing 107/107a primitives
**Status:** Open — standing until 107/107a land
**Detail:** components/ui is empty, no `cn`, no shadcn set despite `apps/web/components.json` present —
contradicts the build-plan claim that 052/054 compose from 107/107a primitives [PHASE_4_BUILD_PLAN.md L1630].
052-W composed the web calendar chrome from @vesper/ui Tailwind tokens (packages/ui/src/tokens.ts,
tailwind.ts) + token-mapped CSS; 053 mobile used RN styles. Any UI chat must compose from @vesper/ui
tokens (web) / RN styles (mobile) until the real primitives land, then refactor onto them.

---

### EXPO GO SDK RENDER — bundle wall cleared; on-device VISUAL render pending (053→081)
**Owner:** Operator (on-device visual confirm)
**Relevant-to:** Any 🟢 mobile chat needing an on-device Expo Go render check
**Status:** Open — narrowed to operator visual confirmation only
**Detail:** Two stacked blockers, both now down except the final visual check. (1) SDK MISMATCH — RESOLVED: project on Expo SDK 54 (staged 52→53→54, PRs #62 / SDK-54 / #64), App Store Expo Go is SDK 54, so it matches and the app loads on-device. (2) BUNDLE WALL — RESOLVED in 081 (#64): `expo export -p ios` previously failed both ways (hatch-on → node:crypto from subscriptionState; hatch-off → @vesper/db no main) because the mobile graph reached the server-pulling bare @vesper/shared barrel. 081 collapsed mobile onto client-safe subpaths and went Metro-exports-ON; `expo export -p ios` now bundles (2657 modules → 7.25 MB hbc). REMAINING: on-device VISUAL render unconfirmed — `cd apps/mobile && npx expo start`, scan QR. A clean bundle proves load, not render. Custom native bridges (Alarm / LiveActivity) do NOT load in Expo Go → return null by design; alarm/LA features are inert, not broken, in Expo Go — true test needs Mac/EAS. Retire fully only after the operator sees screens render.

---

### EXPO SDK 52→54 BUMP — LANDED (053 / 054)
**Owner:** Any later mobile chat assuming the old stack; SDK-bump maintenance
**Relevant-to:** Any 🟢 mobile chat; any chat citing SDK 52 / RN 0.76 / React 18 / Old-Arch assumptions
**Status:** Open — landed-feature forward notes
**Detail:** apps/mobile bumped 52→53→54 across three PRs (#62 = 53; SDK-54 PR merged; #64 = 081 unblock). Current mobile stack: expo ~54.0.35, react-native 0.81.5, react 19.1.0, New Architecture ON (newArchEnabled unset = SDK default), react-native-reanimated 4.1.x + react-native-worklets 0.5.1 (SDK pin — do NOT install worklets@latest, needs RN 0.83+), babel plugin path `react-native-worklets/plugin` (swapped from `react-native-reanimated/plugin`), expo-router 6.0.x (migration zero-code), @sentry/react-native 7.2.x. Config: Sentry v7 moved its Expo config plugin to the package ROOT (`@sentry/react-native`, was `/expo`); `expo-web-browser` config plugin added by `expo install --fix`. Now-DIRECT deps: react-native-safe-area-context ~5.6.x, react-native-svg. MOOT findings (absent from repo — do NOT re-scope as 54 work): expo-file-system (not a dep, zero imports → /legacy migration moot), SafeAreaView (zero usages → RN-0.81 deprecation migration moot), react-native-draggable-flatlist (dep present, ZERO imports — unused; Reanimated-4 drag-test "swing factor" moot; removal candidate, left in place). Custom Swift bridges' New-Arch native verification stays Mac/EAS-gated (OPERATOR HARDWARE) — not cleared by this bump nor by an Expo Go render.

---

### SENTRY ErrorEvent NAMESPACE (053 / 054 — resolved, watch)
**Owner:** Informational — watch on next @sentry/react-native bump
**Relevant-to:** Any chat editing apps/mobile/lib/sentry.ts or bumping @sentry/react-native
**Status:** Open — resolved, standing watch
**Detail:** @sentry/react-native ≥6.14 dropped `ErrorEvent` from its namespace (only `Event`, from @sentry/core). apps/mobile/lib/sentry.ts was made generic — `scrubEvent<E extends Sentry.Event>(event: E): E` — to round-trip the type `beforeSend` provides without naming ErrorEvent. Confirmed still valid under the 6→7 major (SDK 54). If a future Sentry bump changes the event-type surface again, this is the line to re-check.

---

### TASKS UI (054-W — landed)
**Owner:** Each later tasks surface (055 placement, 056 reflow, any task UI/edit chat); shared-api maintenance
**Relevant-to:** 055, 056; any chat using the shared apps/web lib/api.ts .delete() against a 204 route; any web component test
**Status:** Open — landed-feature forward notes
**Detail:** 054-W shipped the task list UI on web + mobile consuming the existing /api/v1/tasks (PR #__).
- SORT: client-side only (path b). A Priority↔Deadline toggle re-sorts the already-fetched list; default
  reproduces the server order (priority DESC, deadline ASC NULLS LAST). NO route/?sort change — GET exposes
  no sort param.
- in_progress: the list fetches the FULL set with no ?status (a ?status=in_progress would 400); status
  filter tabs + sort are client-side off each task's own status field; in_progress is SET via the edit
  form's status control and shown as a badge — never via a GET filter.
- DELETE 204 / SHARED lib/api.ts BUG (to fix): the shared apps/web lib/api.ts `.delete()` calls res.json()
  and throws on the empty 204 body. 054-W used a DIRECT fetch for task delete rather than editing the shared
  lib (calendar depends on it). ANY future client call to a 204-returning route via api.delete() hits this;
  fix = make api.delete() tolerate an empty body. NOT absorbed — owner = a shared-api cleanup chat.
- vitest discovery: apps/web/vitest.config.ts include + coverage globs were widened from {app,lib} to also
  include components, or new component tests aren't discovered by pnpm test.
- NO @testing-library/react in web deps: 054-W tested an EXTRACTED PURE helper (TaskForm buildSubmission:
  validation/payload builder) instead of a DOM render. Pattern for future web component logic tests until a
  DOM testing lib is added.
- Files: apps/web/components/tasks/{TaskList,TaskCard,TaskForm}.tsx (+ TaskForm.test.tsx), tasks/page.tsx
  mounts TaskList, plan/page.tsx adds a Link href="/tasks"; apps/mobile/lib/tasks.ts (thin CRUD client over
  lib/api/client; listTasks restricts ?status to pending|completed) (+ tasks.test.ts), app/(tabs)/tasks.tsx
  full RN list/card/form, app/(tabs)/plan.tsx adds a Link to /tasks.

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
**Owner:** No owner — note only
**Relevant-to:** Any chat adding new exports to @vesper/shared
**Status:** Open — standing build gotcha
**Detail:** @vesper/shared serves TYPES from `dist/` but RUNTIME from `src/`. New exports are invisible to a consumer type-check until shared is rebuilt: `pnpm --filter @vesper/shared build` BEFORE type-checking the consumer. Declared subpath exports (each: types → `./dist/<name>/index.d.ts`, default → `./src/<name>/index.ts`): `./queries`, `./onboarding`, and `./realtime` (added in 081 — `src/realtime/index.ts` re-exporting createRealtimeClient / createSelfMutationFilter / selfMutationFilter / SELF_MUTATION_WINDOW_MS + realtime types). A new export consumed by the web client must update BOTH `src/index.ts` (barrel) AND the relevant subpath entry, or web/mobile drift. See the @vesper/shared BARREL PULLS SERVER CODE flag.

---

### @vesper/shared BARREL PULLS SERVER CODE INTO CLIENT BUNDLES (038)
**Owner:** Future shared-barrel cleanup for WEB (unowned); mobile half resolved in 081
**Relevant-to:** Any new 'use client' web file importing @vesper/shared; any chat adding a shared export consumed by the web client (032-W, 039, 042, …)
**Status:** Open — ACTIVE for WEB only; MOBILE resolved (081)
**Detail:** The @vesper/shared barrel (`src/index.ts`) statically re-exports `subscriptionState` (node:crypto + @vesper/db) and `api/auth`/`api/route` → @vesper/db → postgres (Node fs/net/tls). Bare barrel is server-pulling; named subpaths are client-safe.
- WEB (still ACTIVE): ANY new `'use client'` web file importing the BARE `@vesper/shared` barrel breaks `next build` (`Can't resolve 'fs'`). Mitigation: import client-safe pieces from a SUBPATH (`@vesper/shared/queries`, `/onboarding`, `/realtime`), not the barrel. Web's bare-barrel `.` imports (createRoute/validateSession/ApiError across api routes) remain server-pulling BY DESIGN — the structural fix (Option B: make `.` client-safe) was deliberately REJECTED in 081 (would ripple to every web/api import). Web hazard persists intentionally.
- MOBILE (RESOLVED, 081 / #64): mobile imported the bare barrel only in providers.tsx + usePlanRealtime.ts. 081 switched them to `@vesper/shared/queries` and a NEW `@vesper/shared/realtime` subpath, then REMOVED the Metro exports hatch (now exports-ON). Mobile graph no longer reaches subscriptionState / api/auth / @vesper/db / node:crypto. `expo export -p ios` bundles clean.
- STALE prior wording (now false under SDK 54): the old "asymmetry is deliberate / mobile node-classic can't resolve subpaths (TS2307) / latent if Metro tightens / do NOT unify" notes are SUPERSEDED — SDK 54 set moduleResolution: bundler + customConditions: react-native, so mobile resolves subpaths and the asymmetry was deliberately collapsed on the mobile side.
- `sideEffects: false` still does NOT work here (tried/reverted in 038) — subpath exports are the mitigation.

---

### OFFLINE MUTATION QUEUE (038 — landed)
**Owner:** Each later block-mutation / day-view consumer (039, 042) + spec maintenance
**Relevant-to:** 039, 042; any chat editing apps/{web,mobile}/app/providers.tsx or the queue helpers
**Status:** Open — landed-feature forward notes
**Detail:** 038 shipped the TanStack Query offline mutation queue + conflict resolution.
- Files: `packages/shared/src/queries/mutationQueue.ts` + `conflictToast.ts` (+ tests), re-exported from the
  barrel AND `@vesper/shared/queries`. providers.tsx (web + mobile) wire the mutationCache + mutation
  defaults; mobile adds the shared mutation persister + cold-start hydrate (own AsyncStorage key, separate
  from chat-013's query cache) + foreground flush; web has NO mutation-cache persistence and flushes on the
  window `online` event. Single flush path (web online / mobile foreground); no NetInfo dep.
- conflictToast is a FIXED-window coalescer (NOT sliding/debounce): the 5s window opens on the first 409 and
  emits once; later 409s only bump the count, never reset the timer. There is intentionally NO clearTimeout /
  teardown — a chat "fixing" it to clear-on-new-409 would break the documented contract + the coalescing test.
- Constraints to preserve in ANY provider edit: self-mutation window = 60s; web has NO mutation-cache
  persistence (mobile only); 409 OPTIMISTIC_LOCK_FAILURE → invalidate + toast (never retried), distinct from
  other 4xx (dropped, surfaced via dev-log + Sentry breadcrumb) and network errors (backoff-retried).
- clientMutationId is minted once, persisted on the mutation, reused across retries AND cold-start rehydrate
  (so `(user_id, client_mutation_id)` idempotency holds); selfMutationFilter.record(id) fires at send.

---

### 032-W PARTIAL — spine landed, all screens/auth BLOCKED on 032-V (Fable)
**Owner:** 032-W completion (resumes when 032-V ships); 033-W (EO 47, gated on 032-W)
**Relevant-to:** 032-V, 032-W-resume, 033-W; any chat importing @vesper/shared/onboarding
**Status:** Open — partially built, blocked on hard prereq
**Detail:** Model claude-opus-4-8 (Fable deferred — Fable chats not run; 032-V the visual half never
shipped, absent from main and all branches [PHASE_4_BUILD_PLAN.md L1163]). Per operator call, 032-W built
ONLY the screen-independent spine; zero screens/shells/routes/auth authored.
LANDED:
- packages/shared/src/onboarding/state.ts — deriveOnboardingStep(user, profile): OnboardingStep, PURE
  (no @vesper/db, no RN, no I/O), + zero-mock state.test.ts.
- @vesper/shared/onboarding subpath export, mirroring 038 ./queries: src/onboarding/index.ts + barrel
  re-export + package.json exports["./onboarding"]. NO consumer imports it yet (the web shell that will is
  blocked) — expected. Subpath resolution UNVERIFIED until pnpm --filter @vesper/shared build runs at the
  gate; confirm green before relying on it.
- Honorific persistence: NO edit needed. PUT /profile already accepts honorific (schemas.ts:56,
  HonorificSchema sir|madam|none) and maps to users.honorific via typed Drizzle write (operations.ts:150);
  users.honorific present in live Drizzle model (users.ts:38).
PROVISIONAL field→step map (derived from PRD §3.1 ALONE — 032-V unreadable; marked provisional in code):
terminal-guard-first then earliest-incomplete PRD screen — onboarding_completed_at set → Done(14);
no archetype → Archetype(3); location_lat/lng OR sleep_target incomplete → WakeBedLocation(5); honorific
unchosen → FormOfAddress(10); else Done(14). Build-plan integers (archetype→4, location→6, sleep→7)
REJECTED — conflict PRD §3.1 (archetype=Screen 3, wake/bed/location=Screen 5); PRD screen identities used
as canonical. Honorific is NOT NULL DEFAULT 'none' so the column can't distinguish defaulted-vs-chose-none;
the pure fn relies on the CALLER passing null until an explicit choice (any concrete value incl. 'none' =
chosen) — documented on the input type. Screens not gated by the four contract fields (4-Calendar branch,
6-Module, 7-Prefs, 11-Goals, 12/13) are not derivable and not emitted; OnboardingProfileFields
(modules/base_profile) declared but reserved for post-032-V. The Screen-4 calendar-vs-no-plan branch split
may reshape ordering — RECONCILE the map against the real 032-V surfaces when they land.
BLOCKED on 032-V (resume post-Fable, on Opus): web (onboarding)/layout.tsx shell; mobile
(onboarding)/_layout.tsx shell (+ its deferred unit test); back-button affordance; per-screen
onboarding_step_completed analytics emission (records-only via the guarded dev-log seam — event is in the
§3 taxonomy [TECHNICAL_SPEC.md L2262], NOT yet emitted because emission lives in the blocked shells, so
nothing added to the 096 pending taxonomy); resume-on-entry UI; auth reposition (Google/Apple/magic-link
onto the repositioned sign-in surface); honorific-screen → PUT /profile call.
AUTH SURFACES THAT EXIST: standalone (auth)/sign-in only — web page.tsx, mobile sign-in.tsx, from 010/011.
The onboarding-repositioned sign-in surface 032-W targets does NOT exist (it's a 032-V surface). The
resume chat REUSES the 010/011 flows onto the repositioned surface — does not author a new auth path.
PR #__.

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
038 emits offline_queue_flush_started {queued_mutation_count} and offline_queue_flush_completed
{succeeded_count, conflict_count, network_error_count, total_duration_ms} via the guarded dev-log seam
(records-only); both await registration/routing in 096.
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
**Detail:** Root pnpm.overrides pins `@types/react` 18.3.28 monorepo-wide (React runtime 19) to silence a mobile type-check skew; load-bearing for apps/web. This pin was the deliberately-fragile item flagged to "revisit on a React/Expo bump" — that bump HAPPENED (SDK 52→54, React 18→19.1) and the pin HELD: mobile + web type-check/build stayed green at 18.3.28 through 53 and 54, no forced move (no new react-skew failure). The "revisit on bump" framing is spent; the pin survives 19.x runtime and STAYS until the web skew is fixed independently. Live note: `next build` for @vesper/web can still trip ONLY in generated `.next/types/validator.ts` (bigint→ReactNode) for untouched layout.tsx — pre-existing, intermittent (did not surface in the 081 run), do NOT absorb. expo-doctor under SDK 54 now warns it wants @types/react ~19.1.10 — NON-blocking, intentionally ignored (moving it re-opens the web skew).

---

### @vesper/shared TSC moduleResolution GOTCHA — STALE under SDK 54
**Owner:** No owner — note only
**Relevant-to:** Historical (pre-SDK-54)
**Status:** Stale — kept for history
**Detail:** Pre-SDK-54, @vesper/shared subpath types could fail to resolve under mobile's node-classic moduleResolution (surfaced 059b / 077), forcing the web-subpath / mobile-bare-barrel asymmetry. SDK 54's expo/tsconfig.base sets moduleResolution: bundler + customConditions: ["react-native"], so mobile now resolves `@vesper/shared/<subpath>` types. Confirmed in 081 (mobile type-check green importing ./queries and ./realtime). No longer a live constraint; do not cite it to justify bare-barrel mobile imports.

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

### RN CRYPTO ABSENT — node:crypto unavailable in RN (076; SDK now 54)
**Owner:** Informational — standing mobile constraint
**Relevant-to:** Any mobile (🟢) chat generating IDs or hashing client-side
**Status:** Open — fact, not a blocker
**Detail:** React Native has no `node:crypto`. 076 (under SDK 52) used a Math.random v4 UUID for `device_id` (persisted in expo-secure-store) and FNV-1a hex for `hashDeviceId` (not SHA-256) — fine because device_id is opaque/non-PII. After 081, node:crypto is NEVER in the mobile bundle graph (subscriptionState, its only user, is off the mobile graph) → inert fact, not a gate. If a real cryptographic hash/UUID is ever needed on mobile, add `expo-crypto` first. NEEDS RE-VERIFY UNDER SDK 54: the original 076 detail enumerated the SDK-52 winter-runtime polyfill set (TextDecoder/URL/URLSearchParams/FormData, no crypto). Whether SDK 54 / RN 0.81 changes that set is UNVERIFIED — do not assume the SDK-52 enumeration still holds; re-check against the SDK 54 runtime before relying on it.

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

