# Architecture Decisions — Vesper V1

**Status:** Locked. Decisions documented in Chat 001 of Phase 4 build. Not re-opened without explicit founder approval.
**Authoritative reference:** `docs/TECHNICAL_SPEC.md`

Each entry states: the decision, the rationale (one sentence), and the consequence of deviation.

---

## Decision 01 — Migration Generation Pattern

**Decision:** Hand-written SQL files in `packages/db/migrations/` with corresponding `.down.sql` files. `drizzle-kit generate` is not used.

**Rationale:** Hand-written migrations give explicit control over index creation, trigger functions, SECURITY DEFINER clauses, and BEGIN/COMMIT wrappers that `drizzle-kit generate` cannot reliably emit for Supabase's pgsodium and RLS patterns.

**Consequence of deviation:** `drizzle-kit generate` produces migrations without trigger functions, without proper RLS policies, and without BEGIN/COMMIT wrappers; the schema deploys in a half-applied state on any SQL error and lacks the security invariants required by Tech Spec §3.

---

## Decision 02 — Supabase CLI Migrations Path

**Decision:** Configure `supabase/config.toml` to read migrations from `packages/db/migrations/` rather than the default `supabase/migrations/` path.

**Rationale:** Collocating migrations with the Drizzle schema in `@vesper/db` keeps the database layer self-contained and allows `pnpm --filter @vesper/db` commands to manage the full migration lifecycle.

**Consequence of deviation:** Using the default path splits schema ownership between `packages/db/` (Drizzle types) and `supabase/` (migrations), creating confusion about the canonical schema location and breaking the `@vesper/db` package boundary.

---

## Decision 03 — API Runtime Per Route

**Decision:** Node.js runtime for any route that touches the Stripe SDK or the Anthropic SDK with extended-output operations. Edge runtime for all other routes. Exceptions documented inline per route file in `apps/web/app/api/v1/`.

**Rationale:** The Stripe SDK and Anthropic extended-output streaming require Node.js APIs unavailable in the V8 Edge runtime; all other routes benefit from Edge's lower cold-start latency.

**Consequence of deviation:** Running Stripe or Anthropic routes on Edge produces runtime errors for Node-only APIs (`stream.pipe`, `Buffer`); running all routes on Node forfeits the Edge cold-start advantage on high-frequency, low-complexity endpoints like status checks and token refresh.

---

## Decision 04 — Supabase Connection Pooling

**Decision:** Use Supavisor in transaction mode (the `pgbouncer://` connection string, stored as `SUPABASE_DB_URL`) from all serverless contexts. Direct connections (`SUPABASE_DIRECT_URL`) used only from local development, from Supabase CLI migration runs (`supabase db push`), and from `drizzle-kit pull` type introspection.

**Rationale:** Serverless functions create a new Postgres connection on every invocation; transaction-mode pooling reuses connections and prevents the free-tier connection limit from exhausting under concurrent load.

**Consequence of deviation:** Using direct connections from Vercel serverless routes exhausts the Supabase free-tier connection limit under any meaningful load, producing `too many connections` errors in production.

---

## Decision 05 — Zustand Persistence Per Slice

**Decision:** Auth slice persisted to `expo-secure-store` on mobile and HTTP-only cookie on web. Plan slice not persisted (always refetched on mount). UI slice not persisted (reset on every session).

**Rationale:** Auth state must survive app restarts without a Supabase round-trip; plan state is cheap to refetch and stale plan data is worse than a loading state; UI state (modals, drawer open/closed) has no value after a session ends.

**Consequence of deviation:** Persisting the plan slice causes users to see a stale prior-day plan on app launch; persisting the UI slice causes persisted modal and drawer states that present as bugs.

---

## Decision 06 — TanStack Query Persistence

**Decision:** Persist `['plan', planDate]` queries on mobile via AsyncStorage. Web uses TanStack Query in-memory defaults with no persistence.

**Rationale:** Mobile users expect the plan to render instantly from cache while a background refetch runs; web users do not need offline-resilient plan caching at V1 given browser session semantics.

**Consequence of deviation:** Not persisting on mobile produces a blank-screen flash on plan view mount every cold start, degrading the perceived performance of the core daily surface.

---

## Decision 07 — Sentry Sampling Rate

**Decision:** 0% in development. 100% in preview. 100% in production initially. Scale-down trigger: reduce production sampling to 25% when the monthly error count exceeds 4,000 (80% of the 5,000 free-tier monthly cap).

**Rationale:** Full sampling at launch ensures no bugs are missed during the critical early period; the 4,000-error trigger prevents hitting the free-tier cap before it is operationally visible.

**Consequence of deviation:** Sampling in preview misses bugs that only reproduce under real deployment conditions; failing to scale down production sampling risks exhausting the 5,000/month cap and losing error visibility at the worst possible moment.

---

## Decision 08 — PostHog Autocapture

**Decision:** PostHog autocapture is disabled. The explicit event taxonomy from Tech Spec §11 (the original eighteen events plus observability events enumerated authoritatively in Chat 096) is the sole source of tracked events.

**Rationale:** Autocapture generates noise events (DOM clicks, page scrolls) that dilute funnel analysis and make it hard to distinguish intentional product interactions from incidental UI events.

**Consequence of deviation:** Enabling autocapture pollutes the PostHog event stream, makes funnel queries unreliable, and risks capturing PII (form field content) in autocaptured click payloads.

---

## Decision 09 — React Native New Architecture

**Decision:** React Native New Architecture (Fabric renderer, JSI) enabled per Expo SDK 54 default. Reanimated, Supabase Realtime, and `expo-live-activities` must all be verified as working under Fabric before Chat 037 ships.

**Rationale:** Expo SDK 54 enables Fabric by default; opting out creates a compatibility debt that grows with every Expo minor release and cannot be deferred to V2 without a disruptive migration. SDK 54 is also the final release to support the Legacy Architecture (SDK 55+ is New-Architecture-only), so adopting the New Architecture now avoids a forced migration later.

**Consequence of deviation:** Disabling New Architecture to unblock a library makes the V1.5 migration harder and more expensive; shipping Chat 037 without verifying Fabric compatibility risks a broken Realtime self-mutation filter in production.

---

## Decision 10 — Versioning Convention

**Decision:** Semver application version (`MAJOR.MINOR.PATCH` in `app.config.js` and `package.json`) plus a monotonic build number. Both incremented manually on tag push; no automated version bump tooling.

**Rationale:** Manual version bumps on tag push keep the version visible in git history with no tooling dependency; monotonic build numbers satisfy App Store Connect's requirement for a strictly-increasing build identifier.

**Consequence of deviation:** Automated version bumps create noisy commits and obscure the intentional release boundary; non-monotonic build numbers cause App Store Connect to reject the upload outright.

---

## Decision 11 — Cookie Consent Strategy

**Decision:** No cookie consent banner at V1. The application is US-only; US law (CCPA) does not require opt-in consent for first-party analytics cookies — only opt-out for data sale, which Vesper does not do. This decision is documented here for the V3 EU expansion review.

**Rationale:** A consent banner adds onboarding funnel friction with no corresponding legal obligation in the V1 US-only geography.

**Consequence of deviation:** Adding a banner reduces onboarding completion with no legal benefit; omitting this document risks implementing a banner during EU expansion without understanding that the prior scope analysis was deliberate.

---

## Decision 12 — Service-Role Query Safety Pattern

**Decision:** Every exported query function in `@vesper/db` takes `userId: string` as its required first parameter and applies the filter via Drizzle's typed `eq(table.userId, userId)`. A `UserScopedQuery<T>` TypeScript generic enforces at compile time that no query function can be exported from the queries barrel without consuming `userId`. Application code never constructs queries inline against the service-role client.

**Rationale:** The service role bypasses RLS entirely; a single omitted `userId` filter on a service-role query exposes every user's data — the typed pattern makes this class of bug impossible to compile.

**Consequence of deviation:** Inline service-role queries without the typed wrapper cannot be statically verified; the first forgotten `WHERE user_id = $1` is a data exfiltration bug in production with no compiler or lint signal.

---

## Decision 13 — Content Security Policy Allowlist

**Decision:** Production CSP omits `'unsafe-eval'` from `script-src`. No Three.js shaders are used at V1; any future shader-like code must precompile at build time. The CSP allowlist enumerates only: Sentry, PostHog, Stripe Checkout, and Resend tracking origins.

**Rationale:** `'unsafe-eval'` opens an XSS escalation path that negates the CSP's primary value as a second-line defense against script injection.

**Consequence of deviation:** Adding `'unsafe-eval'` allows injected scripts to call `eval()` with full execution scope; CSP no longer provides meaningful XSS defense.

---

## Decision 14 — API Rate Limiter Implementation

**Decision:** Upstash Redis (free tier: 500,000 commands/month, 256 MB, 200 GB bandwidth) for all API rate limiting. Chosen over Cloudflare KV specifically for strong consistency on the `plans/generate` token-bucket logic.

**Rationale:** Cloudflare KV's eventual-consistency model allows token-bucket state to diverge across edge nodes, permitting quota burst overages; Upstash Redis provides atomic `INCR` operations with a single consistent counter.

**Consequence of deviation:** Using Cloudflare KV for rate limiting allows users on different edge nodes to simultaneously exhaust the same quota, causing plan generation cost spikes that bypass the per-user budget cap.

---

## Decision 15 — Built-In Calendar Library

**Decision:** FullCalendar Standard (`@fullcalendar/react` + `@fullcalendar/daygrid` + `@fullcalendar/timegrid`) for the built-in web calendar surface. **Confirmed and locked.** Implementation details revisited only at Chat 052.

**Rationale:** FullCalendar is the dominant React calendar library for time-grid and recurring-event rendering, covering the weekly planner requirements without a custom build.

**Consequence of deviation:** Switching calendar libraries after implementation requires rewriting every event-rendering, drag-resize, and iCal-import interaction; the Chat 052 gate is the only permissible re-evaluation point.

---

## Decision 16 — Webhook Signature Verification Pattern

**Decision:** Always call `request.text()` then `JSON.parse()` when verifying Stripe and Apple webhook signatures. Never use a JSON body-parsing middleware before signature verification runs.

**Rationale:** Both Stripe and Apple compute HMAC signatures over the raw request bytes; any JSON parse-then-stringify round-trip alters whitespace or key ordering, invalidating the signature check.

**Consequence of deviation:** Running JSON middleware before verification causes all webhook signature checks to fail, either accepting unverified payloads (if the check is bypassed on error) or rejecting all legitimate webhook deliveries and breaking the subscription state machine.

---

## Decision 17 — Apple JWS Public Key Cache TTL

**Decision:** Apple's JWS public keys for App Store Server Notification verification are cached for one hour. The cache refreshes immediately on any signature verification failure.

**Rationale:** Apple rotates JWS signing keys infrequently; one-hour caching eliminates redundant round-trips to Apple's JWKS endpoint while the failure-triggered refresh ensures the system recovers within one request of any key rotation.

**Consequence of deviation:** No caching causes unnecessary latency and rate-limit risk on Apple's JWKS endpoint; indefinite caching causes the webhook handler to reject all valid notifications for potentially hours after an Apple key rotation.

---

## Decision 18 — Realtime WebSocket Lifecycle on Mobile

**Decision:** Suspend the Supabase Realtime WebSocket connection on `applicationDidEnterBackground`. Resume on `applicationWillEnterForeground`. No background connection is maintained.

**Rationale:** A persistent background WebSocket drains battery and triggers iOS background-task termination; Realtime is only useful when the user is actively viewing the plan surface.

**Consequence of deviation:** Maintaining the WebSocket in the background exhausts iOS background budget, risks the OS terminating the app's background tasks, and degrades push notification delivery reliability.

---

## Decision 19 — Google Calendar Push Channel Renewal Cadence

**Decision:** Renew Google Calendar push notification channels when the remaining TTL drops below 24 hours. Google's maximum channel TTL is 7 days; the daily-cron worker handles renewal.

**Rationale:** Renewing at sub-24-hours prevents silent sync failures without requiring sub-daily worker invocations; the 7-day Google-enforced maximum makes any renewal threshold under 24 hours the correct trigger.

**Consequence of deviation:** Failing to renew before the 7-day expiry silently kills the push channel; Google stops delivering change notifications and the user's calendar integration drifts out of sync with no visible error.

---

## Decision 20 — Cron Worker Consolidation Pattern

**Decision:** All scheduled workers deploy as named modules inside a single `workers/daily-cron` Cloudflare Worker, dispatched by UTC hour: `trial-reminder`, `dunning-check`, `hard-delete`, `reconciliation`, `bill-reminder`, `gcal-channel-renewal`, `spend-monitor`. Two workers remain separate: `live-activity-pusher` (5-minute cron, tight CPU budget) and `apple-pki-monitor` (weekly schedule, incompatible with hourly dispatch). Cloudflare Workers Paid is required from day one of cron deployment.

**Rationale:** Three worker registrations fit within the 250-cron-trigger Paid limit with headroom; separate workers per module would fragment deployment, split wrangler configs, and waste per-worker cold-start budget for jobs that share the daily-tick semantics.

**Consequence of deviation:** Using the free-tier Cloudflare plan for cron workers hits the 10ms CPU-per-invocation limit, timing out any non-trivial job; creating one worker per module approaches the 250-trigger ceiling as the module count grows past ten.

---

## Decision 21 — Hydration Data Shape

**Decision:** Hydration taps write to a dedicated `hydration_log` event table (one row per glass logged, analogous to `completion_log`). Mutations do NOT increment `user_profiles.base_profile_version`. The daily counter is derived via `SELECT COUNT(*) WHERE logged_at >= start_of_local_day(user.timezone)`.

**Rationale:** Hydration is a high-frequency event; incrementing `base_profile_version` on each tap would invalidate the Anthropic prompt cache multiple times per day, adding approximately $0.028 per extra cold-cache plan synthesis call.

**Consequence of deviation:** Storing hydration counts in `base_profile` and bumping `base_profile_version` on each tap destroys the warm-cache economics of the plan synthesis loop for any user who logs hydration during the day.

---

## Decision 22 — Day-5 Trial Payment Capture

**Decision:** On trial day 5, surface an opt-in payment-method capture UI: Stripe Setup Intent on web, Apple Pay token on iOS. The day-6 one-tap upgrade surface fires only for users who opted in on day 5. Users who did not capture follow the standard Stripe Checkout / StoreKit flow at trial end.

**Rationale:** Capturing payment intent on day 5 — before the trial-ending urgency on day 7 — reduces upgrade friction for engaged users without mandating upfront credit card entry for every trial signup.

**Consequence of deviation:** Skipping day-5 capture forces every user through the full Checkout/StoreKit flow at trial end regardless of engagement level, losing the conversion uplift of the pre-authorized one-tap path.

---

## Hardware Confirmation

| Device | Purpose | Status |
|---|---|---|
| iPhone 16 (Dynamic Island) | Live Activity / Dynamic Island testing from Chat 105 | **Confirmed** |
| iPhone 14 or earlier (no Dynamic Island) | APNs banner-fallback path verification in Chat 105 | Deferred — procure before Chat 105 |

---

## Deferred External Items

These items have multi-day approval windows or are not needed until a specific chat. Do not action before the noted trigger.

| Item | Trigger | Notes |
|---|---|---|
| Stripe identity verification | Cutover step C-20 (live mode activation) | Submit before going live; 1–3 business day review window. Check Stripe Dashboard → Settings → Account details for any "Requirements due" banner. |
| Expo account + `eas init` | Before Block 8 (first mobile build chat) | Run `eas init` from `apps/mobile/`; add the resulting project ID to `app.config.js` under `extra.eas.projectId`. |
| Apple Developer Program enrollment ($99/yr) | ~Chat 100 (pre-Cutover prep) | Required by Cutover step C-04. iOS Simulator is sufficient until enrollment activates. Individual enrollment (not organizational) — sole proprietorship DBA per LAYER_5. |

> **Note on RapidAPI / ExerciseDB:** No account required. ExerciseDB is a public API with no authentication needed for the seed-data access pattern used in Chat 047 (confirmed in ENVIRONMENT_SETUP.md: "Public APIs, no account needed").

---

## Tooling Notes

### `@vesper/ui` `main` field is required for mobile/Metro — do not remove

`packages/ui/package.json` declares both an `exports` map and a legacy `"main": "./src/index.ts"` field. The `main` field is load-bearing for the mobile bundler: Metro does not read the `exports` map by default, so a runtime `import { ... } from '@vesper/ui'` from `apps/mobile` app code only resolves via `main`. Removing `main` breaks the mobile Metro bundle (the first symptom is a "could not be resolved" error on `@vesper/ui` from `app/(tabs)/_layout.tsx`).

The `exports` map is unchanged and still takes precedence for `exports`-aware consumers (TypeScript, Next.js/web). Do **not** "clean up" the redundant-looking `main`. Enabling Metro's `unstable_enablePackageExports` instead is **not** an acceptable substitute — it breaks `@babel/runtime` helper resolution. The same `main`-field fix will be needed on `@vesper/shared` the first time mobile app code imports it at runtime. (Added Chat 013.)

### `@babel/runtime` must be a direct dependency of `apps/mobile`

The Babel preset injects `@babel/runtime/helpers/*` imports into every transpiled file. Under pnpm's strict `node_modules`, those helpers only resolve from `apps/mobile` if `@babel/runtime` is a declared dependency of `@vesper/mobile`; as a mere transitive it is not hoisted to a path Metro searches, and the bundle fails (first symptom: unresolved `@babel/runtime/helpers/interopRequireDefault` from `app/(auth)/sign-in.tsx`). Keep it in `apps/mobile` dependencies. (Added Chat 013.)
