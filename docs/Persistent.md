# PERSISTENT — Cross-Chat Open Flags

Last updated: after Chat 086 landed (Apple receipt verification — server-side StoreKit 2 JWS x5c-chain verify route + apple subscriptions upsert + subscription_events idempotency — CLOSES the apple-verify 501 stub). Prior: Chat 066 (Google Calendar channel-renewal daily-cron worker + channel-state migration 24 + channel→user mapping — CLOSES the 065 channel-state persistence + mapping gap), Chat 065 (GCal push webhook receiver + authored-but-uninvoked registerWatch — web), Chat 083 (Stripe Checkout + Customer Portal completion + cutover runbook — web billing; PR #77), Chat 085 (Apple StoreKit 2 IAP client — mobile iOS).

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

### STRIPE WEBHOOK HANDLER landed (084); Stripe live cutover OPEN
**Owner:** The Cutover operator (test→live key/Tax/webhook registration + `STRIPE_WEBHOOK_SECRET`); Chat 074 (delayed_jobs reconcile consumer)
**Relevant-to:** any chat touching subscription state, the subscriptions row, the web billing surface, or the reconcile-job queue; the Cutover chat
**Status:** Open — 083 (checkout+portal) + 084 (webhook handler) both shipped; only the live cutover (key swap, live webhook endpoint registration) NOT done
**Detail:** 083 completed the two web-only Stripe billing entry points on `@vesper/web`. Session creation ONLY — no state write, no webhook, no migration, no new copy. Durable facts:
- **Both routes were already correct on main** (Chat 030 landed more than "stubs"): `apps/web/app/api/v1/subscription/{checkout,portal}/route.ts` + pure builders in the co-located `operations.ts` + `schemas.ts`. 083 did NOT re-edit them (reuse directive; live repo = truth). It added the missing **portal unit tests** + the **runbook**.
- **checkout route** → `POST /api/v1/subscription/checkout` returns `{ url }` (Stripe-hosted Checkout). Builder `createCheckoutSession(stripe, {userId,email})` sets §8 params verbatim: `mode:'subscription'`, `line_items:[{price: STRIPE_PRICE_ID, quantity:1}]`, `customer_email`, `metadata:{vesper_user_id}`, `automatic_tax:{enabled:true}`, `subscription_data:{trial_period_days:0}`, success/cancel on `/settings/billing`. Throws `INTEGRATION_ERROR` if Stripe returns no url.
- **portal route** → `POST /api/v1/subscription/portal` returns `{ url }` (Stripe billing portal). Builder `createPortalSession(stripe, db, userId)` reads `stripe_customer_id` via **raw parameterized SQL** through the in-repo Postgres client (`db.execute(sql\`SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId}::uuid\`)`) — the subscriptions Drizzle model is KNOWN-STALE (missing provider/status/stripe_customer_id/+others), so never use the ORM model for this read. **No `stripe_customer_id` (never checked out) ⇒ typed 409 CONFLICT**, before any Stripe call; the portal route NEVER creates a customer.
- **Seam mirrored (single, not a second one):** both routes use `createRoute<StripeUrlResponse>` (auth via the injected `user` + version-gate + §9 error map) and construct `new Stripe(STRIPE_SECRET_KEY)` in the route, injecting the client into the PURE builder so tests pass a plain-object mock (no module mock). `runtime='nodejs'` (Stripe SDK needs Node, not Edge).
- **URL base convention = `NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`** (helper `appBaseUrl()` in operations.ts; matches the `getReferralCode` precedent). Not a hardcoded domain.
- **STRIPE_PRICE_ID read from env** (`requireEnv`) — the price ($19.99) and price id are NEVER hardcoded in app code. All Stripe env vars already in `.env.example` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`) — no env change.
- **Test approach = PURE builders, Stripe MOCKED** in `subscription.integration.test.ts` "Stripe sessions (mocked)" suite (ungated, offline). 083 ADDED the portal happy-path (asserts `customer` + `return_url` + `{url:session.url}` mapping via a mocked `db.execute` returning a `stripe_customer_id` row) and the no-customer CONFLICT-without-DB case; the checkout params + INTEGRATION_ERROR tests pre-existed. The DB-gated integration suite (VESPER_DB_TESTS) still covers `getSubscription` + the DB-backed portal 409.
- **Runbook `docs/RUNBOOKS/STRIPE_CUTOVER.md`** (Chat 083, in README index): (1) Stripe Tax onboarding prerequisite — accept Tax terms + register nexus before first live Checkout (`automatic_tax` fails the session otherwise), confirm product tax code `txcd_10103001`; (2) test→live key swap ORDER — `STRIPE_SECRET_KEY`+`STRIPE_PRICE_ID` (both differ live) flipped LAST, after the live webhook exists; (3) webhook endpoint registration at the CF Worker `…/webhooks/stripe` + capture `STRIPE_WEBHOOK_SECRET` (handler itself is a later chat — out of scope); (4) verification (Checkout opens, Portal for a test customer — deferred until a `stripe_customer_id` exists post-webhook, automatic-tax renders, where to watch failures).
- **Explicitly OUT of 083:** no webhook handler, no state transition, no subscriptions-row write, no `users.subscription_status` write, no `subscriptionState.ts` call, no migration/column/trigger, no new voice/butler copy.

**084 — webhook handler landed (new CF Worker).** Durable facts:
- **Placement = a NEW per-worker dir `workers/stripe-webhook/`** (daily-cron is scheduled-only; an HTTP webhook is its own worker). Handler `src/index.ts`; `wrangler.toml` → `main = "src/index.ts"`, `name = "vesper-stripe-webhook"`, `compatibility_flags = ["nodejs_compat"]`, `[vars] RUNTIME = "worker"` (so `createDrizzleClient()` selects the Supavisor pooler). Siblings mirror the 066 worker: `package.json` / `tsconfig.json` (module ESNext, moduleResolution bundler, `lib ["ES2022","DOM"]` for Request/Response globals) / `vitest.config.ts`. NO cron triggers — HTTP `fetch` worker; default export 405s non-POST.
- **State-machine import = `@vesper/shared/subscriptionState` (a NEW export subpath added this chat).** The state machine was exported ONLY via the barrel, which pulls realtime/api-auth/react-email into the bundle. 084 ADDED `./subscriptionState` to `packages/shared/package.json` exports (worker pulls only `@vesper/db`, which it needs anyway) and rebuilt `@vesper/shared` (dist type emitted). Mirrors the queries/onboarding subpath pattern. The old throwing stubs at `apps/web/lib/subscription/stateMachine.ts` are NEVER called.
- **All subscriptions/subscription_events/delayed_jobs I/O is raw parameterized SQL** via `db.execute(sql\`…\`)` (subscriptions Drizzle model is KNOWN-STALE — same rule as 083). userId + current row resolved by raw lookup on `stripe_subscription_id` OR `stripe_customer_id`.
- **Signature verify on the RAW body BEFORE any parse.** `stripe@14.25.0` `constructEvent(payload, sigHeader, secret, tolerance?)` takes tolerance as a **POSITIONAL number, NOT a `{ tolerance }` object** (the object form type-errors) — called `constructEvent(raw, sig, secret, 31536000)`. Mismatch → `400`, no DB touch.
- **Six event → transition mappings** (pure `mapEventToTransition(type, objectStatus?)` in `src/dispatch.ts`, unit-tested): `customer.subscription.created` → `transitionToActive`; `customer.subscription.updated` dispatches on status (`active`→active, `past_due`→past_due, `canceled`|`unpaid`→read_only + set `canceled_at`, other→audit-only no-transition); `customer.subscription.deleted` → `transitionToReadOnly` + set `canceled_at`; `invoice.payment_succeeded` → `transitionToActive`; `invoice.payment_failed` → `transitionToPastDue`; `customer.subscription.trial_will_end` → NO transition, sets `pending_trial_reminder = true` (audit only).
- **Idempotency:** `INSERT INTO subscription_events … ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`; zero rows → replay → `200`, no re-process. (`subscription_events` already carries `UNIQUE(provider, event_id)` live.)
- **Monotonic-ordering guard:** reads `last_event_at`; inbound `event.created` older than `last_event_at − 24h` grace → audit + skip + `200`. Every real transition advances `last_event_at`.
- **Already-in-target guard = choice (a):** pre-read locked status, skip the transition when `current == target`. Needed because a healthy renewal while already `active` isn't a legal source for `transitionToActive` (the state machine would throw on normal traffic). `IllegalSubscriptionTransitionError` is caught → writes a `processing_error` audit row → `200` (no 5xx storm); other errors re-throw → 5xx (Stripe retries).
- **Reconcile enqueue:** on real transitions only, `INSERT INTO delayed_jobs (job_type, payload, scheduled_for) VALUES ('reconcile_subscription', jsonb_build_object('userId', $1), now() + interval '5 minutes')`. INERT until the Chat 074 tick worker consumes `delayed_jobs`.
- **Migration 31 authored** (`20260601000031_subscription_webhook_columns` — up + `.down` + supabase up-only mirror; suffix 31 = lowest free in Block 8-11, highest prior = 24). Both columns were ABSENT: `ALTER TABLE public.subscriptions ADD COLUMN last_event_at timestamptz` (nullable) `, ADD COLUMN pending_trial_reminder boolean NOT NULL DEFAULT false`. Additive-nullable, no enum/trigger. `canceled_at` (pre-existing) is now SET on cancel/delete (081 left it to this chat).
- **NO user-facing copy, NO web route, NO mobile code.** Worker + migration only.
- **Verification (operator ran local Supabase + author ran the rest):** first-ever `supabase db reset --local` applied migrations 24 AND 31 up clean (this was migration 24's first apply anywhere — no edit needed). Reversibility proven via the in-repo Postgres node client (`max: 1`, `sql.unsafe`) against `localhost:54322`: 31.down drops both cols → 31.up re-adds; 24.down → 24.up clean. Full offline gate green: type-check 12/12, test 11/11 (stripe-webhook incl.), lint 8/8, build 5/5 (web compiled).

---

### STOREKIT 2 IAP CLIENT landed (085); server verify + native/device path OPEN
**Owner:** Chat 086 (server-side JWS verify + subscriptions upsert); the Apple-dev-build / EAS / Cutover chat (native + on-device purchase)
**Relevant-to:** 086; any chat touching subscription state, the apple-verify route, or the mobile subscription surface; the EAS/Apple-Developer-Program chat
**Status:** Open — client steps 1–4 shipped; server verify (step 5) + all native/device verification NOT done
**Detail:** 085 built the iOS StoreKit 2 in-app purchase CLIENT + UI on `@vesper/mobile`. No DB, no migration, no server verify (apple-verify is still a 501 stub). Durable facts:
- **Native mechanism = `expo-iap@4.3.6`** (OpenIAP), ADDED as a dependency (neither it nor a native bridge pre-existed). Registered as a config plugin (bare `'expo-iap'`) in `apps/mobile/app.config.js`. The plugin's native mods run ONLY at prebuild/EAS — **inert in Expo Go** (native module absent there), so the real product-fetch / purchase-sheet / JWS path is UNTESTED until an EAS dev build. Peer deps are all `*`, zero runtime deps — low-risk install.
- **JWS field = `purchase.purchaseToken`** — the OpenIAP unified token carries the signed StoreKit 2 JWS on iOS. Mapped to the request body `{ jwsTransaction }` by the PURE helper `lib/subscriptionVerify.ts` (`toVerifyPayload`).
- **apple-verify is a 501 (NOT_IMPLEMENTED) stub** (`apps/web/app/api/v1/subscription/apple-verify/route.ts`) — request Zod `{ jwsTransaction }` in place for 086; full verify + subscriptions upsert is 086. The client treats **any non-200 as "verification pending" without crashing** (`classifyVerifyStatus`: 200→verified, else→pending). `apiClient` throws `ApiError(status)` on non-2xx, so the thin client `lib/subscription.ts` catches it, RE-THROWS the global gates (401/426, owned by `api/client`), and maps everything else (incl. 501) to pending.
- **`finishTransaction` is DELIBERATELY NOT called** by the client — the transaction stays in the StoreKit queue until 086 verifies server-side, so an unverified purchase is never dropped. 086 (or the client once 086 lands) must finish it after a verified 200.
- **Price is NEVER hardcoded** — product name + price render from the runtime-fetched `Product.displayName` / `Product.displayPrice`. `lib/storeKit.config.ts` holds only the product id `com.vesper.standard.monthly` (subscription group "Vesper", display "Vesper Standard") — no price const. `lib/storeKit.testConfig.ts` captures $19.99 ONLY as the Xcode LOCAL-simulation price for a deferred `.storekit` file — read by nothing at runtime.
- **Upgrade UI path = `apps/mobile/app/(tabs)/settings/subscription.tsx`** (a Settings-stack sub-screen, registered in `settings/_layout.tsx`; entry `<Link>` added to `settings/index.tsx`, always shown / not module-gated). Composed from the 107/107a primitives (`Card`, `Button`) + `@vesper/ui` `colors.bronze` (no hardcoded hex). Subscribe → `storeKit.purchaseStandard()` → `verifyApplePurchase()`; a 501 shows "Activation is pending." "Manage subscription" button → `storeKit.showManageSubscriptions()` → `deepLinkToSubscriptions()` (iOS system UI).
- **Mobile-graph safety:** imports only client-safe subpaths — no bare `@vesper/shared` barrel, no `subscriptionState` (server-side), no `api/auth`, no `@vesper/db`, no `@vesper/ai`. The pure helper imports nothing native (testable with no mock).
- **PostHog autocapture OFF** on the new screen — no posthog import, no `track()` call (Decision 08).
- **No new voice/butler copy** — fixed labels are minimal functional strings; product name/price come from StoreKit.
- **vitest globs already cover `lib/*.test.ts`** (`{src,lib,store,app,hooks,components}/**/*.{test,spec}.{ts,tsx}`) — no widen needed. Native-importing modules are mocked (`./api/client` wholesale; the ApiError stand-in is defined INSIDE the hoisted `vi.mock` factory, not top-level, or it errors "cannot access before initialization").

---

### completion_log.value IS NOT NULL (057 finding)
**Owner:** Informational — standing DB-schema constraint
**Relevant-to:** any chat that INSERTs into `completion_log` (analytics writes, plan-gen, block completion, any test seeding block/energy events)
**Status:** Open — standing fact
**Detail:** The applied `completion_log` (migration 20260601000010) columns are `(user_id, block_id, event_type, value, logged_at)` and **`value` is NOT NULL** — every INSERT must supply a `value` jsonb (use `'{}'::jsonb` when there's no payload). 057's DB-gated seed initially omitted it and hit `null value in column "value" ... violates not-null constraint`. `generatePlan.ts` / `logEnergy.ts` always pass a real `value`; mirror that. Reads stay raw parameterized SQL on the real columns (the ORM model `analytics.ts` is STALE — event_name/occurred_at — do not use it; chat-006 drizzle-kit pull is the durable fix). `block_id` is nullable (plan_* / energy rows omit it).

---

### WEEKLY-PLANNING SESSION — steps 1–3 landed (057); steps 4+ OPEN
**Owner:** Any future weekly-planning chat (steps 4+, plan-regeneration handoff)
**Relevant-to:** the chat building weekly-planning steps 4+; any chat touching weekly-priorities, the Sunday prompt, or `/weekly-review`
**Status:** Open — steps 1–3 shipped, steps 4+ / plan regeneration / regeneration handoff NOT built
**Detail:** 057 built steps 1–3 dual-surface (web `app/(app)/weekly-planning/page.tsx`, mobile `app/weekly-planning.tsx`). Key durable facts:
- **Target week = the COMING Monday** (`addDays(mondayOf(now),7)`) — a Sunday session plans the week ahead; surfaces pass `weekStart=comingMonday`, server derives the reviewed prior window `[targetMonday−7, targetMonday)`.
- **Step-1 completion source (DECISION A):** new thin **`GET /api/v1/weekly-review[?weekStart]`** reads `completion_log` block events; denominator = **actioned-share** `block_completed / (block_completed+block_skipped+block_rescheduled)`; `rate=null` when 0 actioned → plain "nothing to review yet" (never `weekly_priorities.completedAt`, which is structurally always null).
- **AI suggestion seam (DECISION B):** no route exposed `suggestWeeklyPriorities`, so 057 added thin stateless **`POST /api/v1/weekly-priorities/suggest`** (body-driven, mirrors `ai/command`); mobile reaches it via the thin client and NEVER imports `@vesper/ai`.
- **029 weekly-priorities API consumed as-is** — camelCase boundary, 3–5 enforced server-side, PUT items carry only `{ text, source }`; source flips `ai_suggested`→`user` on edit (pure `buildPrioritiesSubmission`, DUPLICATED per surface, not shared).
- **Step 3 (DECISION D):** READ-ONLY event review over the target-week Mon–Sun window via the landed `/calendar-events` range route; edits link out to the Calendar surface (web `/calendar`, mobile `/(tabs)/calendar`); Confirm persists nothing. No calendar CRUD/DELETE here (avoids the 054-W `.delete()` 204 bug).
- **Sunday-prompt dismissal (DECISION C):** client-only, NO API/DB. Web = `localStorage`; mobile = existing `secureStorageAdapter` (expo-secure-store; same adapter `device_id` uses — no new dep). Keyed `userId + targetWeekStartDate` (re-appears next Sunday, no cross-account leak). Two lines transcribed verbatim from PRD §6.7 — NOT voice-gated.
- **Mobile route placement:** mobile has no `(app)` route group (root Stack over `(auth)`+`(tabs)`); the session screen lives at **root `app/weekly-planning.tsx`** (NOT under `(tabs)`, which would register a stray 5th tab) and is reached via `router.push('/weekly-planning')`. Prompt hosted in the real `app/(tabs)/plan.tsx` day view (chat 040 — it is NOT a stub, contrary to earlier assumptions).

---

### TYPED ROUTES stale on a NEW route → standalone tsc fails (057 finding)
**Owner:** Informational — standing gotcha for any chat that adds a NEW route + links to it
**Relevant-to:** any chat adding a new web route (Next `experimental.typedRoutes`) or a new expo-router route and navigating to it (`Link href` / `router.push`)
**Status:** Open — standing
**Detail:** Both apps use typed routes. The literal route-type union is regenerated only by a build/dev run (web: `.next/types/*`; mobile: expo-router's generated types). `pnpm type-check` runs `tsc --noEmit` standalone against the STALE generated types, so a brand-new route fails: web `Type '"/x"' is not assignable to RouteImpl<...>`, mobile `Argument of type '"/x"' is not assignable to ... RelativePathString | ...`. Fixes that don't depend on regeneration: **web** — pass the `UrlObject` form `href={{ pathname: '/x' }}` (the Link union accepts `UrlObject`); **mobile** — `router.push('/x' as Href)` (`import { type Href } from 'expo-router'`; it is re-exported from the root via `export type * from './types'`). 057 hit this for `/weekly-planning` on both surfaces. Existing routes are unaffected (already in the generated types).

---

### pnpm build CRASHES with access violation on Windows (057 observation)
**Owner:** Informational — operator env (Windows)
**Relevant-to:** any chat running `pnpm build` in the local gate on Windows
**Status:** Open — environmental, non-deterministic
**Detail:** `next build` for `@vesper/web` on this Windows machine has crashed with exit code **3221225477** (`0xC0000005` STATUS_ACCESS_VIOLATION) during "Creating an optimized production build", AFTER type-check/lint were clean — i.e. a native SWC/Node crash, NOT a TS/lint error. Also: `pnpm type-check` can take ~18min (mobile `tsc` over RN types is genuinely slow) and the batch prompt "Terminate batch job (Y/N)?" can look like a hang — it's waiting on input, not stuck. Guidance: judge build "no NEW errors vs main" from the ERROR OUTPUT, not the crash exit; retry the build once; don't chase the crash as a code defect. The pre-existing `@types/react` 18-vs-19 skew in `apps/web` is a separate known non-issue.

---

### DEV AUTH BYPASS IN MOBILE SIGN-IN (Expo Go render-check scaffolding)
**Owner:** Apple Developer Program enrollment chat (must delete this) + any mobile auth/sign-in chat
**Relevant-to:** the chat that begins Apple Developer Program / dev-build work; any chat touching `apps/mobile/app/(auth)/sign-in.tsx`
**Status:** CLOSED — bypass no longer present (verified Chat 084 gate). `git grep DEV-BYPASS` returns nothing repo-wide; `apps/mobile/app/(auth)/sign-in.tsx` has no `__DEV__` block and last changed in Chat 011; working tree clean. Was never committed and is gone from the working tree, so the "Apple-dev chat must delete it" / "revert if it appears in a commit" / `git add -A` staging-hazard instructions are all SPENT. Do NOT carry this caveat into future CC prompts. Detail retained below for history only.
**Detail:** A `__DEV__`-guarded "DEV: Skip sign-in" button was added to `apps/mobile/app/(auth)/sign-in.tsx` to reach the post-auth mobile screens (013/053/054/063/090b) in Expo Go for an on-device RENDER check after the SDK 52→54 bump. It sets a mock authenticated session via the existing `setSession` setter (NO `store/auth.ts` edit) — mock data only, no network/auth call, stripped from production by `__DEV__`. It exists because NO real sign-in completes in Expo Go: Google's `makeRedirectUri` emits an `exp://<LAN-IP>:8081/--/auth/callback` redirect that mismatches the `vesper://auth/callback` allow-list entry (and the `matchesDeepLinkPath` validator would reject `exp://` anyway); magic link needs the OS to honor the `vesper://` scheme; native Apple needs the `usesAppleSignIn` entitlement. All three require a dev build (expo-dev-client), blocked on Apple Developer Program enrollment + EAS (no Mac). **Removal:** the Apple-dev-build chat MUST delete this — grep `DEV-BYPASS` in `sign-in.tsx`, remove the whole `{__DEV__ && ( … )}` block plus its two comment fences. **Uncommitted:** lives as a local working-tree change only — NOT committed/pushed. If it ever appears in a commit, revert it.
**git add -A hazard:** until removed, this uncommitted change will be staged by any `git add -A` — every chat must add selectively (see REPO WORKING-TREE LITTER + git add -A HAZARD flag).

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

### STALE push_tokens + subscriptions + integrations + calendar_events + bills DRIZZLE MODELS
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
- bills (061): a `bills` Drizzle model DOES exist in `packages/db/src/schema/modules.ts` but has DRIFTED HARD from the live migration-0006 DDL - it carries a phantom `autopay boolean` column that does NOT exist on the DB, marks `amount`/`due_day_of_month` NOT NULL (both are NULLABLE live), and OMITS the real `frequency bill_frequency_enum NOT NULL` + `category text` columns. Using it would fail at runtime (insert of a non-existent column / missing NOT NULL frequency). 061 therefore ran ALL bills CRUD via raw parameterized SQL (calendar_events/push-tokens precedent) and did NOT edit the model (out of scope). A future drizzle-kit pull / schema-resync should replace the drifted stub; until then bills code stays raw SQL. Live bills cols (verified via node client): id, user_id, name(NN), amount numeric(10,2) NULL, due_day_of_month int NULL CHECK 1..31, frequency bill_frequency_enum{monthly,quarterly,annually,one_time} NN, category text NULL, created_at, updated_at.
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

### GCAL PUSH WEBHOOK (065 — landed; channel-state persistence CLOSED by 066)
**Owner:** the Cutover operator (C-17 real channel registration — the only remaining open item)
**Relevant-to:** 034-W / Cutover (registerWatch call site); any chat touching the integrations row or GCal sync
**Status:** Channel-state persistence + channel→user mapping CLOSED by 066 (migration 24 + wired resolveChannelUser). Only real channel registration remains, Cutover-blocked (C-17).
**Detail:** 065 shipped the push-notification receiver + an authored-but-uninvoked `registerWatch`. 066 added the persistence + mapping (see GCAL CHANNEL RENEWAL (066) below).
- **ROUTE CONVENTION:** unauthenticated raw `POST` handler at `apps/web/app/webhooks/google-calendar/route.ts`
  (OUTSIDE /api/v1). `runtime='nodejs'`, `dynamic='force-dynamic'`. NO createRoute / validateSession /
  checkAppVersion — Google is the only caller and cannot present a session. No prior `app/webhooks/` route
  existed (Stripe/Apple webhooks are on Cloudflare Workers); it follows the `api/v1/internal/auth-event`
  secret-validated raw-handler shape (constant-time compare, fail-closed).
- **TOKEN VALIDATION = ENV SECRET, not a DB row:** the `X-Goog-Channel-Token` is validated (constant-time)
  against the deployment env var **`GOOGLE_WEBHOOK_CHANNEL_TOKEN`** (added to `.env.example`, placeholder only).
  Mismatch → 401 + Sentry alert + NO sync. NOT a per-channel DB value — integrations has no channel columns.
  The pure classifier `validateNotification.ts` (co-located; imports nothing native) maps headers →
  `{action:'ignore'|'ack'|'sync', tokenValid}`: `sync` state → ack (200, no sync); `exists` → trigger; else ignore.
- **SYNC SEAM = INLINE re-invocation of 064 `getTodayEvents`, NOT enqueued:** the `delayed_jobs` table exists
  (migration 16) but has ZERO code refs — no enqueue helper, no tick worker dispatching job_types — so the
  enqueue seam is not reusable. `exists` therefore RE-RUNS `getTodayEvents` (a re-fetch through the existing
  seam). There is **NO persisted Google syncToken anywhere** (no column), so this is NOT a true Google delta.
- **CHANNEL-STATE PERSISTENCE GAP — CLOSED by 066:** `events.watch` returns `{id, resourceId, expiration}`; 066's
  migration 24 added `integrations.channel_id / resource_id / channel_expiration` (all nullable; `channel_id` indexed),
  and `persistChannelState` (`@vesper/ai`) is the single write path. The **channel→user mapping is CLOSED** too:
  `resolveChannelUser` now does a real `SELECT user_id ... WHERE channel_id = $1` lookup (an unresolvable channel still
  logs `syncOutcome:'error'` + 200s — fail-soft unchanged). NO `sync_token` column (no delta anywhere; full re-fetch).
- **registerWatch AUTHORED BUT NOT INVOKED (re-homed to `@vesper/ai` by 066):** the implementation moved from
  `apps/web/lib/googleCalendar/registerWatch.ts` to `packages/ai/src/integrations/registerWatch.ts` so the daily-cron
  worker can import it worker-safely; the old path is now a thin re-export (065's landed test still passes). It calls
  `events.watch` (generated channel id, the same `GOOGLE_WEBHOOK_CHANNEL_TOKEN`, address
  `${NEXT_PUBLIC_APP_URL}/webhooks/google-calendar`, type `web_hook`), decrypts via `import('@vesper/db/encryption')`.
  Still nothing invokes it in dev — real channel registration is **Cutover-blocked (C-17)** (verified public HTTPS
  domain), deferred to 034-W / Cutover.
- **RECEIPT→SYNC = ONE Sentry event:** every receipt logs one structured `Sentry.captureMessage` entry carrying
  channel id / resource id / message number / token-validation result; on a triggered sync the outcome
  (success | no-changes | error) is appended to that same entry. Reuses 064's `@sentry/nextjs` — no second client.
- **ENV ADDED:** `GOOGLE_WEBHOOK_CHANNEL_TOKEN` (placeholder). `NEXT_PUBLIC_APP_URL` reused (already present) for the
  webhook address — no new base-URL var. NO migration / column / trigger / UI / React / mobile / butler copy authored.
- **TESTS:** pure `validateNotification.test.ts` (9 offline cases: valid+exists→sync, valid+sync→ack, mismatch/missing/
  no-secret→tokenValid:false, malformed→ignore, not_exists→ignore) + `registerWatch.test.ts` (5 cases, fetch mocked +
  `@vesper/db/encryption` decrypt stubbed — NO libsodium module-graph mock; asserts the watch request body + the
  `{id,resourceId,expiration}` mapping). Web vitest glob `{app,lib,components}/**` already covered both — no widening.

---

### GCAL CHANNEL RENEWAL (066 — landed)
**Owner:** the Cutover operator (C-17 first real channel registration; the worker is inert until then)
**Relevant-to:** 034-W / Cutover; any chat adding a daily-cron module; any chat touching the integrations channel columns or GCal push
**Status:** Landed — channel-state migration + renewal worker + channel→user mapping done; runs live only post-Cutover.
**Detail:** 066 built the daily renewal worker + the channel-state schema 065 had no column for, CLOSING the 065 persistence + mapping gap.
- **MIGRATION 24 — `20260601000024_gcal_channel_state`:** adds `integrations.channel_id text`, `resource_id text`,
  `channel_expiration timestamptz` (all NULLABLE — add-nullable pre-launch shape) + partial index
  `idx_integrations_channel_id ON (channel_id) WHERE channel_id IS NOT NULL` (receiver looks up user by channel_id per
  push). Suffix **24** (22 RETIRED per allocation doc, 23 taken; 24 is lowest genuinely-free in 14–30). BEGIN/COMMIT,
  matching `.down.sql` + up-only `supabase/migrations` mirror. **NO `sync_token`** (065 persists no delta), **NO enum value**
  (sink is Sentry-only, see below) — so the migration is pure reversible column-adds. Drizzle model
  `packages/db/src/schema/integrations.ts` extended with the 3 camelCase columns + the index (model otherwise still
  stale vs the real bytea columns — not reconciled here; channel state is read/written by raw SQL, per 063/064).
- **COMPLETION-LOG SINK = option B (Sentry-only), NOT a completion_log row:** the run is observed via ONE structured
  `Sentry.captureMessage('gcal-channel-renewal run', {attempted,succeeded,failed})`. Reason: `completion_log.user_id` is
  NOT NULL + FK, so there is no valid aggregate/run-level row, and per-user rows would need a non-reversible
  `ALTER TYPE completion_event_enum ADD VALUE`. This SUPERSEDES the build-plan's aggregate-completion_log line. Per-user
  FAILED renewals are still Sentry-logged individually (`renewal-failed`, carries userId + integrationId).
- **RENEWAL DECISION = pure helper `selectChannelsToRenew(rows, now)`** (`workers/daily-cron/modules/gcal-channel-renewal.logic.ts`,
  no I/O): select `status='connected'` AND `channel_expiration` non-null AND `<= now + 24h` (Decision 19; past-expiry
  included). The SQL is a COARSE prefilter (`provider='google_calendar' AND channel_id IS NOT NULL`); the precise
  connected+24h decision lives ONLY in the helper so the boundary is unit-tested offline. **Batch isolation:** each user's
  renewal is try/caught — one failure increments `failed`, Sentry-logs, and NEVER aborts the batch.
- **RENEWAL PATH:** `registerWatch(userId,{db})` (re-registers — Google has no extend) → `persistChannelState(userId,channel,{db})`
  writes the new `{id→channel_id, resourceId→resource_id, expiration→channel_expiration}`. Both from `@vesper/ai` (single
  registration + single persistence path — importable by the worker AND the deferred Cutover call site).
- **DAILY-CRON SCAFFOLD (Decision 20) — ESTABLISHED this chat:** `workers/daily-cron` did NOT exist; 066 scaffolds the
  MINIMAL consolidated shell — `wrangler.toml` (single hourly cron `0 * * * *`, `nodejs_compat`), `src/index.ts` dispatches
  hour-of-UTC → module, `gcal-channel-renewal` registered at the **05:00 UTC** tick. New workspace glob **`workers/*`**
  added to `pnpm-workspace.yaml`; package `@vesper/daily-cron`. Later daily modules (trial-reminder, dunning-check,
  hard-delete, reconciliation, bill-reminder, spend-monitor) extend the `HOURLY_DISPATCH` table — they do NOT restructure
  the shell. DB access = canonical `createDrizzleClient` (Supavisor pooler in worker ctx, Decision 04); real CF-runtime
  Postgres driver/binding (Hyperdrive) + Sentry transport are operator/Cutover concerns (worker inert pre-Cutover).
- **HEARTBEAT:** the one `run` summary message per dispatch is the signal the 097a "worker-didn't-run" defense keys on
  (expected within a 90-min window of the 05:00 UTC tick).
- **RESOLVE-CHANNEL-USER wired:** `apps/web/app/webhooks/google-calendar/resolveChannelUser.ts` (extracted from the 065
  route's null seam) does `SELECT user_id FROM integrations WHERE channel_id=$1 AND provider='google_calendar'`; injectable
  db for offline tests; route shape/token/runtime unchanged. Unresolvable → null → `syncOutcome:'error'` + 200 (fail-soft
  unchanged from 065).
- **RUNBOOK:** `docs/RUNBOOKS/GCAL_CHANNEL_RENEWAL.md` (detection query for past-expiry channels; manual re-register via the
  same registerWatch+persist path; email-affected decision tree; verification incl. confirming the worker fired). Index
  entry in `RUNBOOKS/README.md` pre-existed (already listed Chat 066) — no index edit.
- **ENV:** none new (065's `GOOGLE_WEBHOOK_CHANNEL_TOKEN` + `NEXT_PUBLIC_APP_URL` reused).
- **TESTS:** `gcal-channel-renewal.test.ts` (helper boundary offline: connected+24h/past selected, disconnected/error/null/
  outside-window excluded, edge inclusive; module with db+registerWatch+persist injected: only within-24h connected
  attempted, success persists mapped state, single failure isolated + counts correct) + `resolveChannelUser.test.ts`
  (seeded row→user, no row→null).

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

### DESIGN SYSTEM PART 2 (107a — landed)
**Owner:** Each later web/mobile UI chat composing form controls / pickers / butler-line / motion; the -V surface halves
**Relevant-to:** 093-V, 032-V, 033-V, 034-V, 035-V, 036-V, 041-V, 044-V, 046-V, 089-V, 095-V, any UI chat
**Status:** Closed — 107/107a DESIGN PRIMITIVES flag CLOSED; part-2 landed (PR #69). Forward notes only.
**Detail:** 107a (PR #69) closed the component library: part-2 primitives in apps/web/components/ui +
apps/mobile/components/ui — TextField, Toggle, Select (web-only), SegmentedControl, TimePicker, DatePicker,
ButlerVoice, and the motion primitives. Compose these; do not re-derive a second form/motion system.
- PICKERS: no picker lib in either app. Web = token-skinned native <input type="time">/<input type="date">
  (time = "HH:mm", date = "YYYY-MM-DD"), round-tripping wakeTarget/bedtimeTarget with zero conversion (matches
  TaskForm). Mobile = composed from TextField (onChangeText string entry); NO datetime-picker dep; the native
  wheel is a deferred on-device pass.
- MOTION: web = CSS transitions on the preset token classes (duration-quick/considered/instant + the standard-
  out/in easing classes) + a useReducedMotion hook over prefers-reduced-motion. Mobile = react-native-
  reanimated (live dep) — declarative FadeIn at band duration + the spring token (damping 18 / stiffness 150);
  reads motion tokens from @vesper/ui, never hardcoded; reduced via AccessibilityInfo.isReduceMotionEnabled →
  instant. (Verify no literal ms/cubic-bezier leaked into the motion files — shallow tests do not catch it.)
- BUTLER SURFACE: ButlerVoice is a THIN WRAPPER composing the existing 107 ButlerLine container — ONE
  container, a copy slot, no authored copy, renders nothing when empty. The copy library is still authored
  later (044). Not a scorekeeping surface.
- WEB/MOBILE ASYMMETRY: Select (native <select>) is web-only; mobile uses SegmentedControl for the select/
  segmented role (RN has no <select>). Stated in both index barrels + DESIGN_SYSTEM.md.
- MOBILE-ONLY NOTES (not relevant to web chats): the mobile TextInput placeholder rides the
  placeholder:text-cream-faint NativeWind variant (no inline hex) — depends on NativeWind v4 placeholder-
  variant support resolving on-device (gated build/lint/test only here). Mobile pickers are text-entry until a
  future on-device pass — same class as the existing expo-font/vellum on-device deferrals.
- NO TOKEN VALUE CHANGED by 107a → rbc-theme.css needed no sync.

---

### DESIGN STRATEGY (106 — landed)
**Owner:** Each design-build chat (107/107a) + every later `-V` surface half; the referral chats (095-V, 095-W)
**Relevant-to:** 107a, 095-V, 095-W, any `-V` visual half, any conversion/retention surface chat
**Status:** Open — landed-doc forward notes
**Detail:** Chat 106 committed `docs/DESIGN_STRATEGY.md` — the binding design-strategy doc every design-build
chat (107 onward) and every later `-V` half follows.
- REFERRAL IS TWO SURFACES: the strategy splits referral into §2.3a referee landing `/r/[code]` (built by
  095-V) and §2.3b referrer settings panel (built by 095-W). Each carries its own Layer 4 persuasion principle
  and its own 24-hr honesty bar — referee landing: Tactical empathy, real/disclosed discount, mistyped code
  soft-redirects, nothing baited; referrer panel: Reciprocity through "together" framing, mutual disclosed
  discount, applied-only, no count/leaderboard. Both UIs are NOT-YET-SCAFFOLDED; 095-V / 095-W build them.
- SCOREKEEPING IS A PRIMITIVE-LEVEL CONSTRAINT: §3 promotes the anti-scorekeeping/anti-gamification discipline
  from a voice rule to a layout+component constraint binding on every surface designed after the doc — no
  grade/score-as-headline/streak/badge/points/level/leaderboard/progress-bar primitive may be built into the
  library. Enforced as component ABSENCE (107 honored this).
- NATIVE SWIFT = BUILD-TRACK-FROM-SPEC: §5 assigns the native Swift surfaces (059b alarm, 077/078 Live
  Activity) to the build track, implemented from a design-track-authored visual spec delivered by 107. The
  design track does not author Swift.
- Persuasion-principle names in the strategy are traceable verbatim to LAYER_4_EXPERIENCE_IDENTITY.md
  "Persuasion Principles Quietly Applied."

---

### DESIGN SYSTEM (107 — landed)
**Owner:** Each later UI chat (composes from these primitives/tokens); 107a (part-2); the native build chats
(059b/077/078)
**Relevant-to:** 107a, every web/mobile UI chat, 059b, 077, 078, any chat editing packages/ui
**Status:** Open — landed-feature forward notes (PR #67)
**Detail:** Chat 107 consolidated the design system onto a single token home and built the part-1 primitives.
- CANONICAL TOKEN HOME = @vesper/ui: `packages/ui/src/tokens.ts` (raw token object) + `packages/ui/src/
  tailwind.ts` (preset), exported via `index.ts`. Web Tailwind and mobile NativeWind both consume the same
  preset; RN style consumers and the Swift mirror read the raw object. Do NOT stand up a second token system —
  extend these.
- PRIMITIVES: Card / Button / BlockRow / ButlerLine in BOTH `apps/web/components/ui/` and
  `apps/mobile/components/ui/`, plus the `cn` helper (web). Later screens compose from these, never re-derive
  tokens. `docs/DESIGN_SYSTEM.md` is the composition reference.
- SCOREKEEPING-AS-ABSENCE confirmed: no grade/score/streak/badge/points/level/leaderboard/progress-bar
  primitive exists in the library.
- FONTS NOT LOADED ON MOBILE: web loads Fraunces/Inter/JetBrains Mono via a Google-Fonts `@import` in
  `globals.css`; mobile `font-display`/`font-mono` classes resolve to family names only (no expo-font dep, no
  font assets). On device, ButlerLine/mono fall back to system fonts until a later on-device chat wires
  expo-font. (107 gate was build/lint only — never rendered on device.)
- WEB FONT @import IS RENDER-BLOCKING + not self-hosted (top of `globals.css`). If the waitlist/landing chat
  cares about LCP, migrate to next/font (needs layout.tsx edits) — deliberately deferred by 107.
- MOTION DURATION TOKENS ARE BAND MIDPOINTS: `duration-quick`=200ms, `duration-considered`=400ms, etc. are
  representative picks; the authoritative `[min,max]` bands live in `motion.duration.bands` (TS) / the Swift
  `*Band` constants. Do NOT treat a single duration token as a locked value — read the band.
- DesignTokens.swift lives at `apps/mobile/ios/Shared/`. The native build chats (059b/077/078) must add it to
  BOTH the VesperAlarmExtension and VesperLiveActivity target memberships and keep it hand-synced with
  `tokens.ts` — no automated check enforces the mirror. Visual specs are at `docs/native/` (alarm 059b, Live
  Activity 078).
- KEEP `packages/ui/src/tailwind.ts` TYPE-ONLY: the `index.ts` barrel now pulls `tailwind.ts`, which
  type-imports `tailwindcss` (erased at runtime → no tailwindcss in the RN bundle). A VALUE import from
  `tailwindcss` into `tailwind.ts` would leak into the mobile bundle via the barrel. Keep that file type-only.

---

### VITEST JSX RUNTIME + PRIMITIVE TESTS ARE SHALLOW (107)
**Owner:** Informational — standing test-infra constraint
**Relevant-to:** Any chat adding web or mobile component tests, or relying on the 107 primitive tests
**Status:** Open — standing
**Detail:** 107 set `esbuild: { jsx: 'automatic' }` in BOTH vitest configs (web tsconfig is `jsx: preserve` →
classic runtime → "React is not defined" without it). JSX no longer needs a React import, but any web component
using `forwardRef` or a VALUE use of React still needs its own `import * as React`. Also the 107 primitive
tests are SHALLOW: mobile tests call the component as a function and read `element.props.className` (NativeWind's
className→style transform is a build step that does not run under vitest); web tests assert class attributes via
react-dom/server markup, not computed CSS. A class typo that Tailwind/NativeWind silently drops at build still
PASSES these tests — a green primitive test is not proof the styles resolve.

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

### TASK PLACEMENT ALGORITHM (055 — landed)
**Owner:** 056 (mid-day reflow/over-commit consumes placement); any chat touching synthesis block output
**Relevant-to:** 056; @vesper/ai synthesis path; anyone reading work-block details.tasks
**Status:** Open — landed-feature forward notes
**Detail:** 055 shipped the deterministic greedy task→work-block placement inside plan synthesis (PR #78).
- PURE MODULE: `packages/ai/src/scheduling/taskPlacement.ts` (+ `.test.ts`, 14 offline tests). No I/O, no DB,
  no model call, no clock. Signature built against the LIVE `PendingTask` from context/planContext.ts
  (`{id,title,estimatedMinutes:number,priority:string,deadline:string|null}`), NOT the §3 snake_case row.
- CARRIER = live-schema truth, NOT build-plan prose. Build-plan says "task → focus block" but the committed
  chat-006 `BlockDetailsSchema` carries the list on the **WORK** variant (`tasks: z.array(z.string())`);
  `focus` is a notes-only GENERIC variant with NO task array. Output populates work `details.tasks`. Element
  = task **ID** string (the tasks-row uuid), NOT the title (2nd commit c75cbeb switched it). Rationale: titles
  are non-unique and a split task repeats across blocks, so a title cannot be joined back to a tasks row (two
  distinct same-title tasks would be indistinguishable); id is the durable join-back key that 056 reflow
  (move/re-status a displaced chunk) and completion logging need. Same id in >1 work block = unambiguously ONE
  split task. Placement OWNS every work block's tasks array when it runs (overwrites model placeholder titles,
  empties non-placed work blocks); model title-ish strings only survive on a ZERO-pending-task day where
  placement is a no-op and there is nothing to join. NO live consumer reads details.tasks today (persist
  stores details as opaque jsonb passthrough; no plan/tasks UI renders it; blocks has NO FK to tasks) — so
  this is forward-safety, no current runtime-behavior change.
- INTEGRATION = deterministic POST-PROCESS (path b), NOT prompt-side. `applyTaskPlacement(plan, pendingTasks,
  calendarEvents)` runs in synthesizePlan.fallback.ts on the GENERATED success path only (right after
  `outcome.plan`, before gatePlanStrings), threaded from synthesizePlan.ts via new optional
  FallbackChainParams `pendingTasks`/`calendarEvents` (default [] → no-op for breaker-open/eval/existing
  tests). NOT applied to the Step-3 hardcoded fallback. Model still decides WHEN work windows sit; the
  algorithm only fills them. NO prompt text changed → **NO version bump** (the 🤖 flag on 055 was a
  prediction; pure post-process closes it without a bump).
- NO VOICE GATE: placement writes only details.tasks (task ids / user's own task rows, never AI copy);
  gatePlanStrings only gates block.title + note, so tasks are never gated. Consistent, no new gate call.
- OPEN WINDOWS: the pure `placeTasks` TAKES windows as input (`OpenWindow{id,start,end}` minutes-from-
  midnight). Windows derived at the integration site FROM the model's work blocks, then `carveOpenWindows`
  subtracts busy intervals (`calendarEventsToBusy` maps timed events; ALL-DAY/date-only events skipped so
  they don't blank the day) → placement can never overlap a fixed calendar event. Carved sub-windows keep a
  `<blockIndex>::<k>` id so capacity is per-piece but placed ids group back (de-duped) per block.
- ALGO: sort priority DESC (high>medium>low) → deadline ASC nulls-last, stable (mirrors readPendingTasks
  fetch order). First-fit whole task into earliest window large enough; else split across LARGEST windows;
  leftover carries to next same-day window; once same-day windows exhausted the remainder is DROPPED (V1
  single-day horizon — cross-day/cross-week rebalance is V2). No min-chunk floor in V1 (MIN_CHUNK_MINUTES is
  a V2 refinement).
- NO migration / NO new column / NO new trigger / NO DB write / NO new persistence path / NO UI/route / NO
  new butler copy. Pure @vesper/ai build.
- Files: packages/ai/src/scheduling/taskPlacement.ts (+ .test.ts); synthesizePlan.fallback.ts (params +
  applyTaskPlacement call + imports); synthesizePlan.ts (forwards pendingTasks/calendarEvents).

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

### APPLE-VERIFY 501 STUB — CLOSED (086)
**Owner:** 086 (done)
**Relevant-to:** Any chat touching the apple-verify route, subscription state, Apple PKI rotation, or the mobile subscription surface; the Cutover chat
**Status:** CLOSED — server-side StoreKit 2 verify landed 086
**Detail:** `/api/v1/subscription/apple-verify` is now a full implementation (was a 501 NOT_IMPLEMENTED stub from 030). Durable facts:
- **JWS verify is x5c-CHAIN, NOT JWKS.** `apps/web/lib/apple/jws.ts` reads the leaf→intermediate→root chain from the JWS `x5c` protected header, requires the chain to terminate in a PINNED Apple root (the traveling root is NOT trusted), then verifies the JWS signature with the leaf public key via `jose`. Deliberately does NOT fetch `appleid.apple.com/auth/keys` (that JWKS is for Sign In with Apple identity tokens, chats 010/011 — wrong endpoint here). The chain is self-contained ⇒ **NO per-transaction network call to Apple.**
- **keyCache.ts caches the PARSED pinned root(s) only** — `apps/web/lib/apple/keyCache.ts` is a parse-memo of the inline base64 DER constants, NOT the build-plan's "1-hour cache for Apple's intermediate certificates." No JWKS, no network fetch, no TTL. (§8 authoritative over the build-plan wording.)
- **Pin set = inline base64 DER constants** in `apps/web/lib/apple/appleRootCerts.ts` (chose inline constant over a committed .cer asset). Holds TWO slots: current **Apple Root CA - G3** (populated) + an **upcoming-root** slot (empty `der`, filtered out by the accessor) so a PKI rotation is a data-only deploy, never an emergency. Rotation procedure: `docs/RUNBOOKS/APPLE_ROOT_CA_ROTATION.md` (indexed in RUNBOOKS/README.md, Chat 086).
- **event_id form for a StoreKit TRANSACTION** = `originalTransactionId + '_' + transactionId` (the §8 App Store Server Notification form — `origTxnId_notificationType_signedDate` — does not apply; a transaction has no notificationType/signedDate). Stable across re-posts ⇒ `subscription_events (provider, event_id) UNIQUE` fires the idempotency path on replay (`ON CONFLICT DO NOTHING` ⇒ return current state, no re-transition).
- **subscriptions UPSERT** is raw parameterized SQL (the Drizzle model is KNOWN-STALE), `provider='apple'`, CHECK-compliant (apple_original_transaction_id set, all stripe ids NULLed on a provider switch), keyed `ON CONFLICT (user_id)`. Transition via `transitionToActive` from `@vesper/shared/subscriptionState`; an **already-in-target guard** pre-reads status and SKIPS the transition when already `active` (its legal sources are trial/past_due/read_only/archived, NOT active) so a replay/re-verify can never 5xx. Server does NOT finish the StoreKit transaction — the client finishes on a verified 200.
- **jose** (`^5.9.0`) added to `apps/web/package.json` for `compactVerify`/`importX509` (was NOT previously present).
- **Production E2E stays Cutover-blocked**: real signed transactions need the Apple Developer Program + an EAS dev build (expo-iap native module inert in Expo Go). The offline gate uses a dev-signed self-generated EC chain fixture — no Apple account/key needed.
- **Raw-SQL timestamp bind gotcha** (surfaced by the 086 DB smoke): postgres.js cannot serialize a JS `Date` through the Drizzle `sql\`\`` param path (`TypeError: ... Received an instance of Date`). Bind timestamps as ISO strings + cast `${iso}::timestamptz` (mirrors the persistChannelState / googleCalendar precedent). Applies to any chat writing timestamptz columns via raw parameterized SQL.
- **subscription_events test-isolation gotcha** (surfaced by the 086 DB smoke): `subscription_events.user_id` is `ON DELETE SET NULL`, NOT CASCADE — deleting `auth.users` ORPHANS the event rows rather than removing them, and their `(provider, event_id)` UNIQUE key then makes a later run's FIRST insert look like a replay (`ON CONFLICT DO NOTHING` → empty RETURNING → early return, no subscriptions row). Any DB-gated test touching subscription_events must delete the events explicitly in cleanup AND use unique event_ids per run.

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

### PLAN DAY VIEW (039 — landed)
**Owner:** Each later day-view consumer (041-V/041-W block detail, 042 block actions, 043 drag-reorder) + the energy/check-in chat + the icon-primitive chat
**Relevant-to:** 041-V, 041-W, 042, 043; any chat touching `apps/web/app/(app)/plan` or the `['plan', planDate]` cache
**Status:** Open — landed-feature forward notes (PR #__)
**Detail:** 039 shipped the web read-only vertical block timeline (skeleton / timeline / empty), Realtime-synced, day-rollover.
- MOUNT DEVIATION (load-bearing): the brief named `apps/web/app/(app)/page.tsx`, but that route-group index resolves to `/` and COLLIDES with `(marketing)/page.tsx` (`/`) → hard `next build` error (two parallel pages, same path). The day view mounts at **`apps/web/app/(app)/plan/page.tsx`** (route `/plan`) — the existing 054-W scaffold, now `'use client'`, Tasks link preserved. Any chat expecting the day view at `/` must use `/plan`.
- QUERY HOOK: `apps/web/hooks/usePlanQuery.ts`, cache key **`['plan', planDate]`** (planDate = `YYYY-MM-DD`), GET `/api/v1/plans/date/[date]` (NOT `/today` — client computes the local date). Throws `PlanQueryError{status, code, isPlanNotFound}`; a PLAN_NOT_FOUND 404 is retry-suppressed and drives the empty state. 041-W hydrates block detail from THIS cache — reuse the key, do not author a second plan query/client.
- RENDER CONTRACT: BlockTimeline/BlockCard render **§9 PlanResponse** (`apps/web/app/api/v1/plans/operations.ts`) ONLY — camelCase, ISO `startTime`/`endTime`, server-computed `status` rendered AS-IS (`in_progress` NOT recomputed client-side). Never DailyPlanSchema. All PlanResponse/PlanBlock imports are `import type` (erased → no `@vesper/db`→`fs` pull; see the @vesper/shared BARREL flag).
- REALTIME: reuses 037 `usePlanRealtime` + `selfMutationFilter` invalidating `['plan', planDate]`; `SELF_MUTATION_WINDOW_MS` (60s) constant, no hardcoded number. No second subscription; provider mutation defaults untouched (read-only render).
- SSE PATH: POST `/plans/generate` is a **HAND-ROLLED** SSE (`event: plan|done|error`), NOT the `@ai-sdk/react` data-stream protocol — the SDK gives no usable completion callback, so 039 consumes the stream MANUALLY (fetch + ReadableStream reader) inline in the page: `plan` frames raise the skeleton `filledCount`; the terminal `done` frame either shows the fallback empty state (`source:'fallback'` + `fallbackNotice`) or invalidates `['plan', planDate]` → BlockTimeline (SSE partials never render a real BlockCard). Any regeneration UI (042) reuses this consumer shape.
- GENERATE CTA ENERGY DEFAULT (flag): the empty-state "Generate plan" CTA posts `energyScore: 5` (DEFAULT_ENERGY_SCORE) — energy capture is the daily check-in surface, not this read-only view. The check-in/energy chat must feed a real score here.
- NO ICON PRIMITIVE: `@vesper/ui` exports tokens only (no icon component), so BlockCard uses a per-block-type unicode glyph. 041-V (visual half) swaps for a real icon primitive when one ships.
- DAY ROLLOVER: `useDayRollover` = `visibilitychange` (immediate foreground check) + 60s poll, both gated on pure `hasRolledOver`; advances to the CURRENT local date (browser IANA zone as the client proxy for the authoritative `users.timezone`). Pure helpers in `apps/web/components/plan/planViewHelpers.ts` (+test) — no DOM (web has no @testing-library/react; 054-W pure-helper pattern). NO vitest glob change (`components/**` already covered).

---

### PLAN DAY VIEW MOBILE (040 — landed)
**Owner:** Each later mobile day-view consumer (041-V/041-W block detail, 042 block actions, 043 drag-reorder) + the icon-primitive chat
**Relevant-to:** 041-V, 041-W, 042, 043; any chat touching `apps/mobile/app/(tabs)/plan.tsx`, `apps/mobile/components/plan/*`, or the mobile `['plan', planDate]` cache
**Status:** Open — landed-feature forward notes (PR #__)
**Detail:** 040 shipped the mobile RN read-only vertical block timeline (skeleton / timeline / empty), Realtime-synced, day-rollover, + mobile-only pull-to-refresh, swipe-to-reveal action affordance, and Reanimated layout animation. Replaced the 054-W near-stub at `apps/mobile/app/(tabs)/plan.tsx` (the router mounts `/(tabs)/plan` — confirmed in `app/_layout.tsx` RootNavigator; the build-plan's older `(tabs)/index.tsx` reference is stale).
- RENDER CONTRACT: BlockTimeline/BlockCard render the §9 PlanResponse (camelCase, ISO `startTime`/`endTime`, server-computed `status` AS-IS — `in_progress` NOT recomputed). Mobile cannot import `apps/web/.../operations.ts`, so the shape is MIRRORED by hand in `apps/mobile/components/plan/types.ts`. Never DailyPlanSchema.
- QUERY HOOK: `apps/mobile/hooks/usePlanQuery.ts`, cache key `['plan', planDate]` — SAME key usePlanRealtime invalidates + the chat-013 provider dehydrates to AsyncStorage. Goes through the shared `lib/api/client` (bearer + X-Vesper-Client/X-App-Version + 401/426 handling), NOT a bespoke fetch. Throws `PlanQueryError{status}`; `isPlanNotFound === (status===404)` — a status-based PLAN_NOT_FOUND signal (the web hook parses the §9 error code, but the mobile client throws a generic `ApiError(status)` and /plans/date only 404s for PLAN_NOT_FOUND; invalid date → 400). 404 retry-suppressed → empty state. 041-W hydrates block detail from THIS key — do not author a second plan query/client.
- SSE TRANSPORT (chat-040 determination = NON-STREAMING): RN core fetch cannot stream a body — Hermes exposes no ReadableStream reader on `res.body`, so the web 039 per-chunk `filledCount` pattern has no RN equivalent. Mobile shows PlanSkeleton for the DURATION of POST `/plans/generate`, then reads the fully-buffered `res.text()`, parses SSE frames for the terminal `done`/`error`, detects a `source:'fallback'` done frame (→ apology empty state), else invalidates `['plan', planDate]` → BlockTimeline. The settled timeline ALWAYS renders from the §9 GET, never the DailyPlan partial. (Generate uses a direct `fetch` to `${EXPO_PUBLIC_API_URL}/plans/generate` with the bearer — apiClient.post can't be used, it `res.json()`s an event-stream.) Generate CTA posts `energyScore: 5` (DEFAULT_ENERGY_SCORE) — same energy-default flag as 039; the check-in chat feeds a real score.
- ROLLOVER SHARE-VS-DUPLICATE (chat-040 determination = DUPLICATE): 039's rollover/tz math lives in web-local `apps/web/lib/dates/localDate.ts` + `apps/web/components/plan/planViewHelpers.ts` (un-importable from mobile). Rather than extract a new `@vesper/shared` export (index + subpath + rebuild-before-typecheck surface), the ~10-line pure Intl math is DUPLICATED in `apps/mobile/components/plan/planViewHelpers.ts` (`localDateInTimeZone`/`nextLocalMidnight`/`hasRolledOver`), kept equivalent to the web helper. NO shared edit. `useDayRollover` = AppState `'active'` foreground + 60s poll (RN app-lifecycle, NOT web visibilitychange, NOT expo-notifications), both gated on pure `hasRolledOver`.
- FOREGROUND SEAM: chat-013 `useAppLifecycle()` is `(): void` with no callback seam (already mounted at root via useBiometricLock, invalidates `['plan']` on foreground). Like usePlanRealtime, `useDayRollover` attaches its OWN AppState listener rather than a second useAppLifecycle mount — the pre-existing no-seam limitation persists.
- REALTIME: reuses chat-037 `usePlanRealtime(userId, planDate)` + `selfMutationFilter`; `SELF_MUTATION_WINDOW_MS` (60s) via `@vesper/shared/realtime` — no hardcoded number, no second subscription, provider mutation defaults untouched (read-only render).
- SWIPE AFFORDANCE = SHELLS ONLY (042 wires mutations): BlockCard is wrapped in `react-native-gesture-handler/ReanimatedSwipeable`; left-swipe reveals complete/skip/reschedule button SHELLS (no-op, `accessibilityState.disabled`). react-native-gesture-handler `~2.28.0` was ALREADY a dep (SDK-54 pin) — NO dep add, NO `pnpm install` needed. `GestureHandlerRootView` wraps the plan SCREEN subtree (not the root layout — self-contained; expo-router root-wrap not relied on).
- LAYOUT ANIMATION: `BlockTimeline` configures Reanimated `LinearTransition.springify()` with the @vesper/ui spring token (damping 18 / stiffness 150) + `FadeIn` at band `quick`, via the shared `components/ui/motion` helpers — never a hardcoded ms/stiffness. Reduced motion (`useReducedMotion` → AccessibilityInfo.isReduceMotionEnabled) drops both to instant. Did NOT bump reanimated (`~4.1.7`) or worklets (`0.5.1`) — SDK pin held.
- NO ICON PRIMITIVE (same as 039): BlockCard uses per-block-type unicode glyphs; 041-V swaps for a real icon primitive when one ships.
- PULL-TO-REFRESH: `RefreshControl` on the ScrollView; refetch attempted UNCONDITIONALLY (no NetInfo pre-gate); on error the chat-013 persisted cache stays rendered + a 2s `enqueueToast` "Showing your saved plan" (info) shows — no spinner-lock, no error state.
- PURE HELPERS / TESTS: `apps/mobile/components/plan/planViewHelpers.ts` (+`.test.ts`, 11 tests) holds the extracted blockSortComparator / selectEmptyStateVariant / rollover math — no RN import (no @testing-library in mobile deps; 054-W/039 pure-helper pattern). vitest `include` already covers `components/**`+`hooks/**` → NO glob change.

---

### MEDICATIONS MODULE (060 — landed)
**Owner:** Each later medications consumer (the screen↔scheduler wiring chat; any med UI/edit chat); quiet-hours-window chat (046/059a)
**Relevant-to:** Any chat touching `apps/web/app/api/v1/medications/*`, `apps/mobile/app/(tabs)/settings/medications.tsx`, `apps/mobile/lib/medication*`, or the medication reminder engine
**Status:** Open — landed-feature forward notes (PR #__)
**Detail:** 060 shipped the Medications module dual-surface: web CRUD API + web surface + mobile surface + a built-but-unwired local-notification scheduling engine. Table/RLS/audit-trigger already existed (migrations 0006 + 0011 + migration-20 shift column) — 060 authored NO migration.
- MODULE GATE: Medications is a MODULE, OFF by default, gated on `modulesEnabled.medication.enabled` — the `modules_enabled` JSONB uses the SINGULAR key `medication`. NOT a core tab.
- MOUNT PATTERN: web app shell has NO persistent nav, so the page (`app/(app)/medications/page.tsx`) self-gates via `GET /api/v1/profile`, rendering a "module off" card until enabled. Mobile tab bar is a FIXED four-tab (plan/tasks/calendar/settings) — a top-level tab was forbidden, so Medications mounts as a **Stack sub-screen of Settings** (`settings/medications.tsx`, registered in `settings/_layout.tsx`), reached from a link in `settings/index.tsx` hidden while off; the screen ALSO self-gates a deep link.
- SCREEN↔SCHEDULER WIRING DEFERRED (load-bearing gap): the reminder engine (pure `medicationSchedule.ts` compute + `medicationReminders.ts` expo-notifications wrapper + failure telemetry) is built and unit-tested, but the mobile surface does NOT yet call `scheduleMedicationReminders` on save. Correct lifecycle (schedule on create, cancel+reschedule on edit, cancel on delete) needs persisted notification-ids per medication — left as its own unit of work rather than shipped half-correct (a partial wire leaks duplicate notifications). This is the primary follow-up.
- F2 SCHEDULING CONTRACT: fire-on-time is the DEFAULT and enforced in the pure helper — `shift_out_of_quiet_hours=false` NEVER delays a dose. `=true` shifts out of a quiet-hours window ONLY when a window is supplied. Frequency map: daily/twice_daily/custom → one DAILY reminder per time; weekly → one WEEKLY reminder per time on the start-date weekday (expo convention 1=Sun..7=Sat). Reminders are LOCAL triggers only (never `getDevicePushTokenAsync`), timeSensitive foreground banner, SOFT permission gate (requests only when `canAskAgain`, else routes to iOS Settings — never re-prompts after denial).
- QUIET-HOURS WINDOW ABSENT: repo has NO quiet-hours window utility (046/059a not landed) — only `BaseProfile.wakeTarget`/`bedtimeTarget`. So `shift=true` is a DEFENSIVE NO-OP today (`applyQuietHoursShift` returns the dose time unchanged when no window supplied). Full window logic (incl. wrap-past-midnight) IS implemented in the pure helper, so when a window source lands ONLY the caller changes — not the core.
- MOBILE PICKER IS TEXT-ENTRY (TimePicker→"HH:mm", DatePicker→"YYYY-MM-DD") until a future on-device wheel pass — matches the 107a primitive mechanism.
- MEDICATIONS DRIZZLE MODEL NOW CURRENT: the pull-generated `medications` stub had drifted (modelled `dosage text`/`schedule_time text`, lacked `frequency`/`times`/`start_date`/`end_date`/`shift_out_of_quiet_hours`); 060 re-synced it to the LIVE applied DDL (enum `medication_frequency_enum`={daily,twice_daily,weekly,custom}; `times time[] NOT NULL DEFAULT '{}'`). No migration — a future `drizzle-kit pull` produces the same. The ORM path is now typed correctly; verify-per-table still holds.
- ANALYTICS: emits ONE event `medication_notification_schedule_failed {medication_id, scheduled_times_count, error_class}` via the mobile `track()` seam only (no PII — row id, count, error constructor name). Autocapture OFF. Pending 096 registration (see 096 PostHog TAXONOMY). On a schedule throw the wrapper ALSO captures to Sentry (no-ops without DSN). Local notification CONTENT may carry med name/dose (on-device only, never emitted).

---

### FINANCE/BILLS MODULE (061 — landed)
**Owner:** Bill reminder worker chat (075); copy-library chat (044); any bills UI/edit chat
**Relevant-to:** Any chat touching `apps/web/app/api/v1/bills/*`, `apps/web/app/(app)/bills/page.tsx`, `apps/mobile/app/(tabs)/settings/bills.tsx`, `apps/mobile/lib/bills.ts`, `packages/shared/src/copy/*`, or the bill reminder worker
**Status:** Open - landed-feature forward notes (PR #__)
**Detail:** 061 shipped the Finance/Bills module dual-surface: web CRUD API + web surface + mobile surface + a thin mobile client + one voice-gated butler-line copy entry. Table/RLS/two indexes already existed (migration 0006) - 061 authored NO migration, column, trigger, or enum. Simpler than medications (060): NO scheduling, NO times[]/quiet-hours, NO reminder worker (that is 075).
- MODULE GATE: gated on `modulesEnabled.finance.enabled` - the `modules_enabled` JSONB key is the SINGULAR `finance` (NOT `bills`). OFF by default, NOT a core tab.
- MOUNT PATTERN (mirrors 060): web page `app/(app)/bills/page.tsx` self-gates via `GET /api/v1/profile`, "module off" card until enabled. Mobile mounts as a Stack sub-screen of Settings at `apps/mobile/app/(tabs)/settings/bills.tsx` (registered in `settings/_layout.tsx`), reached from a link in `settings/index.tsx` hidden while off; the screen self-gates a deep link. (Actual settings dir is under `(tabs)/`; the kickoff's `app/settings/bills.tsx` was approximate.)
- RAW SQL, NOT ORM: bills Drizzle model is drifted/unusable - all CRUD via raw parameterized SQL. See STALE ... + bills DRIZZLE MODELS flag for the exact drift.
- RLS CONFIRMED STRICTEST (direct SQL, `packages/db/scripts/verify-bills-rls.mjs`): row security enabled; SELECT/INSERT/UPDATE/DELETE all own-row `auth.uid() = user_id`; live enforcement confirmed a 2nd user cannot SELECT/UPDATE/DELETE another user's bill and cannot INSERT a row owned by another user; both migration-0006 indexes present.
- BILLS-AUDIT DETERMINATION (drift filed): bills has NO `audit_bills_changes` trigger and is INTENTIONALLY EXCLUDED from audit coverage (TECHNICAL_SPEC §11/§19 - audit scoped to medications + integrations only). The verify script confirmed ABSENT. **PHASE_4_BUILD_PLAN §061 end-of-session checks are WRONG** - they assert a bills audit trigger "parallel to medications"; TECHNICAL_SPEC is authoritative, so those checks should be corrected. (Because bills has no audit trigger, it is NOT exposed to the AUDIT-CASCADE FK HAZARD.)
- BUTLER-LINE COPY HOME (new, for 044/075): the copy library (044) has not landed and the ButlerVoice/ButlerLine UI containers hold no authored copy, so 061 authored a minimal client-safe copy module at the NEW subpath `@vesper/shared/copy` (`packages/shared/src/copy/index.ts`, `./copy` added to shared `package.json` exports). Pure string/template, zero imports - safe for web, mobile, and a Cloudflare Worker (075). Entry: `billDueTomorrow(name) -> "<name> is due tomorrow."`, id `finance.bill_due_tomorrow`. 044 should consolidate this into the full copy library and re-point importers. 061 authored the line ONLY - it does NOT render it, schedule it, or build the reminder block/worker (075).
- POSTHOG POSTURE: NO analytics event emitted, NO live PostHog wired. Verified autocapture OFF on both surfaces (no `posthog.capture` on form inputs or amount fields), documented in both file headers. No `data-ph-no-capture` needed at V1 (session recording off); it becomes REQUIRED at V1.5 if recording is enabled on financial fields.
- WEB FREQUENCY CONTROL: used the `Select` native dropdown (4 values, longer labels read better) - note `Select` is a native `<select>`, so its `onChange` is EVENT-based (`e.target.value`), not value-based like `SegmentedControl`. Mobile uses `SegmentedControl`. amount + due-day are text-entry (inputMode/keyboardType numeric).
- TESTS: web `bills.integration.test.ts` = ungated pure-Zod suite (6) + VESPER_DB_TESTS-gated integration suite (8, all green live); mobile `lib/bills.test.ts` = 7 tests with `./api/client` mocked (method+path+camelCase<->snake_case mapping); shared `copy/copy.test.ts` = 2 pure string assertions. No vitest glob change needed - existing include globs already matched all new test paths.

---

### AUDIT-CASCADE FK HAZARD (060 finding — durable, cross-cutting)
**Owner:** Owning migration chat (make FK deferrable); hard-delete worker chat (074); account-delete owner
**Relevant-to:** 074, any hard-delete / user-purge path, any chat populating `medications` or `integrations`, migration chats (006/011)
**Status:** Open — LATENT + PRE-EXISTING (not introduced by 060); recommendation to file
**Detail:** `security_audit_log.user_id` FK → `users(id)` is **NON-deferrable**, and the audit trigger fires on BOTH `medications` and `integrations`. A HARD delete of a user who owns an audited row (e.g. `DELETE FROM auth.users`, or Supabase admin "delete user") cascades → the audited child row is deleted → the AFTER trigger inserts a `security_audit_log` row referencing the user being deleted in the SAME statement → FK violation → the whole delete fails.
- Pre-existing (migrations 0006 + 0011); 060 is simply the FIRST surface to populate `medications` and thus first to trip it. `integrations` has the identical exposure.
- Never observed because production account deletion is a SOFT delete (30-day grace; `apps/web/app/api/v1/account/operations.ts`), which never hard-deletes the user inline.
- 060's integration test `afterEach` + the verify script both delete child `medications` FIRST (trigger fires while the user still exists → OK), then the user; accumulated `security_audit_log` rows then cascade-delete cleanly.
- **RECOMMENDATION (requires a migration — deliberately NOT authored in 060):** make `security_audit_log_user_id_fkey` `DEFERRABLE INITIALLY DEFERRED` (FK check runs at COMMIT, by which point the audit row has itself cascade-deleted), OR ensure every hard-purge path deletes audited children before the user. **Until then, any hard user-deletion routine MUST delete `medications` + `integrations` first.**

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
060 adds `medication_notification_schedule_failed` {medication_id, scheduled_times_count, error_class}
(no PII) to the pending 096 taxonomy; emitted via the mobile track() seam in
apps/mobile/lib/medicationReminders.ts (+ Sentry capture), awaits registration in 096.

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
- **Local dev auth config** — deferred
- **Stripe identity (C-20)** — Cutover step
- **Sentry release placeholders** — Cutover step
- **Founder mailing-address + marketing DNS (C-22a)** — Cutover step
- **091 follow-ups (PR #31)** — deferred
- **@vesper/ai dist-rebuild ordering** — deferred
- **On-device StoreKit 2 purchase E2E (085)** — real product fetch / native payment sheet / signed JWS
  need an EAS dev build (expo-iap native module is inert in Expo Go); the local `.storekit` Xcode file and
  simulator run need a Mac. The `expo-iap` config plugin's native mods are untested until an EAS prebuild.
  Blocked on Apple Developer Program + EAS. Defer until then; server verify is chat 086.
- **On-device APNs / Live Activity push-to-start test (076)** — blocked on Apple Developer Program
  ($99) + APNs .p8 + the native VesperLiveActivityBridge being wired. EAS cloud build needs no Mac
  but is blocked on the Apple-account work; Expo Go does NOT work on SDK 52 (no remote push token /
  no native modules). Defer the real-token E2E.

