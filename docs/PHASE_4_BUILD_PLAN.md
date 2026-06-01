# Phase 4 Build Plan — Vesper V1

**Status:** Canonical Phase 4 reference. Equivalent role to ENVIRONMENT_SETUP.md in Phase 3.
**Scope:** Project Weeks 6 onward through V1 ship. The 105 Claude Code sessions required to take the monorepo from "type-checks clean, empty migrations dir" to "submitted to App Store with waitlist landing page live on the production domain."
**Source documents:** TECHNICAL_SPEC.md (implementation contract), PRD.md (product contract), all six layer documents (foundation, scope, architecture, experience, business, launch), OPEN_SOURCE_INVENTORY.md, ENVIRONMENT_SETUP.md.
**Author convention:** Every chat in this document represents one Claude Code session driven by one corresponding chat in claude.ai. Sessions are bounded by the Pro plan's 5-hour limit and by Tech Spec §13's coherent-unit-of-work guidance: one API route, one UI component, one Worker per session. Sprawling cross-package sessions are explicitly rejected.

---

## How to Use This Document

At the start of any Claude Code build session, the chat that directs that session loads this document and identifies which numbered chat is being executed. The chat reads the matching numbered section in this document, loads the documents and code paths listed in that section's **Load at session start** block, then proceeds to execute the work described in **Goal** with the deliverables enumerated in **Output**. The session ends when the deliverables exist, the implementation notes have been satisfied, and the end-of-session checks pass.

Dependencies are listed by chat number. A chat with `Dependencies: 023, 026` cannot begin until both 023 and 026 are complete. Parallel execution across multiple Claude Code terminals is encouraged where chats are marked with the parallelization symbol (⇄). The parallelization map at the end of this document enumerates which chat numbers can run concurrently.

Risk-flagged chats (⚠️) require special handling: plan mode on, Opus model, multiple chat iterations if needed, and no shortcuts. The risk map at the end of the document explains why each flagged chat carries elevated risk.

The Cutover Block is not a Claude Code session. It is a sequence of thirty-one manual founder actions (twenty-nine integer-numbered steps C-01 through C-29 plus two letter-suffix steps C-22a and C-27a) that must complete in order before the chats marked 🚧 can run. The exact sequencing of Cutover relative to Phase 4 chats is established in the Critical Path section.

When chat numbering and the Critical Path order disagree, Critical Path is canonical. A small number of chats declare hard dependencies on later-numbered chats (Chat 018 → 019, Chat 020 → 022, Chat 034 → 063/064, Chat 056 → 057, Chat 072 → 091, Chat 074 → 084/087/088). The Critical Path section documents the actual build order for these cases. A Claude Code session must consult Critical Path before opening a chat if there is any doubt about whether its dependencies are satisfied; following chat numbers blindly will produce build-order breaks at those specific points. Each affected chat also restates this caveat inline in its Load-at-session-start or Dependencies line, so the rule is enforced at both the doc level (here) and the per-chat level.

---

## Notation Legend

The symbols used throughout this document carry consistent meanings.

The package origin of a chat's output is marked with one of four colors. 🔵 indicates web work in `@vesper/web` (the Next.js application). 🟢 indicates mobile work in `@vesper/mobile` (the Expo application). 🟣 indicates a Cloudflare Worker in the `workers/` directory. 🟡 indicates shared package work in `@vesper/shared`, `@vesper/db`, or `@vesper/ai`.

Skill flags identify which Claude Code skill must be explicitly invoked during the session. 🗄️ flags chats where the drizzle-best-practices skill is required. 🤖 flags chats that touch the AI layer where prompt versioning matters. 🎩 flags chats where caveman and stop-slop interact through the butler voice gate for user-facing copy.

Risk and dependency flags identify chats requiring special handling. ⚠️ marks chats with elevated risk of architectural backtracking, silent bugs, or revenue impact. 🚧 marks chats that cannot run until the Cutover Block completes. ⇄ marks chats that can run in parallel with sibling chats on separate Claude Code terminals.

---

## Pre-Build Setup — Block 0

Block 0 establishes the foundations every subsequent chat depends on. Skipping any of its three chats forces improvisation under pressure later in the build.

### Chat 001 — Architectural Decisions and External Account Setup

*Block 0 | 🟡 | Skills: context-engineering-kit, caveman*

**Load at session start:** TECHNICAL_SPEC.md (full file, focus on §2 Stack, §3 Conventions, §10 Hosting, §13 Operations); ENVIRONMENT_SETUP.md; LAYER_3_TECHNICAL_ARCHITECTURE.md.

**Goal:** Make every architectural decision that has been implicit until now, document each decision with its rationale and consequences, and submit the time-lagged external applications (Apple Developer, Stripe identity verification) that have multi-day approval windows. The deliverable is a committed `docs/ARCHITECTURE_DECISIONS.md` file and a checklist of externally-submitted items with their expected approval dates.

**Output:**
- `docs/ARCHITECTURE_DECISIONS.md` — covering each of the twenty architectural decisions enumerated in the implementation notes below
- Apple Developer Program enrollment submitted ($99), enrolled as an individual (not organizational; V1 entity is sole proprietorship with DBA per LAYER_5; organizational enrollment requires LLC, which is deferred)
- Stripe identity verification application submitted
- Expo account created and `eas init` run from `apps/mobile/`
- RapidAPI account created (for ExerciseDB seeding access at Block 7)
- Confirmation that an iPhone 14 Pro or later is available for Live Activity testing (required from Chat 105)
- Confirmation that a non-Dynamic-Island iOS device (iPhone 14 or earlier) is available for fallback APNs push verification in Chat 105

**Implementation notes:** The twenty-two decisions to document and lock are as follows. First, migration generation pattern: hand-written SQL files in `packages/db/migrations/` per Tech Spec, with corresponding `.down.sql` files; no `drizzle-kit generate`. Second, Supabase CLI migrations path: configure `supabase/config.toml` to read from `packages/db/migrations/` rather than the default. Third, API runtime per route: Node runtime for any route that touches the Stripe SDK or the Anthropic SDK with extended-output operations; Edge runtime for everything else; document exceptions per route. Fourth, Supabase connection pooling: use Supavisor in transaction mode (the `pgbouncer://` connection string) from all serverless contexts; direct connections only from local development. Fifth, Zustand persistence per slice: auth slice persisted to expo-secure-store on mobile and httpOnly cookie on web; plan slice not persisted (always refetched); ui slice not persisted. Sixth, TanStack Query persistence: persist `['plan', planDate]` queries on mobile via AsyncStorage; web defaults are fine. Seventh, Sentry sampling rate: 0% in development, 100% in preview, 100% in production initially with scale-down trigger at 4,000 errors per month. Eighth, PostHog autocapture: off; the explicit event taxonomy from Tech Spec §11 (the original eighteen events plus the observability events added by the Phase 4 audit, enumerated authoritatively in Chat 096) is the source of truth. Ninth, React Native New Architecture: enabled per Expo SDK 52 default; verify Reanimated, Realtime, and Live Activities all work under Fabric before chat 037. Tenth, versioning convention: semver application version plus monotonic build number; both incremented manually on tag push. Eleventh, cookie consent strategy: no banner at V1 (US-only); decision documented for future jurisdictions. Twelfth, service-role-with-user-filter pattern: a typed query-builder convention in `@vesper/db` where every exported query function takes `userId: string` as its required first parameter and emits the filter through Drizzle's typed `eq(table.userId, userId)` API; a `UserScopedQuery<T>` TypeScript generic enforces at compile time that no query function can be exported from the queries barrel without consuming `userId`. Application code never constructs queries inline against the service-role client — it only calls these exported functions. This prevents the most common Supabase mistake (forgetting the user_id filter on a service-role query). The runtime SQL-string inspection approach is rejected because it produced false negatives on parameterized queries; the typed approach makes the safety property visible to TypeScript at every callsite. Thirteenth, CSP allowlist scope: production CSP omits `'unsafe-eval'` from `script-src`; Three.js shaders are precompiled at build time via `vite-plugin-glsl` so no runtime `eval` is needed; the CSP allowlist enumerates only Sentry, PostHog, Stripe Checkout, and Resend tracking origins (no shader-related entries). Fourteenth, API rate limiter implementation: Upstash Redis on the free tier (500,000 commands per month per Upstash's March 2025 pricing update; ~16K/day average) plus 256 MB storage and 200 GB bandwidth, chosen over Cloudflare KV for strong consistency on `plans/generate` token-bucket logic. Fifteenth, built-in calendar library: defer to chat 052 evaluation, but note that FullCalendar Standard is the leading candidate for web. Sixteenth, webhook signature verification pattern: always use `request.text()` then `JSON.parse()`; never use a JSON middleware before signature verification. Seventeenth, Apple JWS public key cache TTL: one hour, refresh on signature verification failure. Eightteenth, Realtime websocket lifecycle on mobile: suspend on `applicationDidEnterBackground`, resume on `applicationWillEnterForeground`. Nineteenth, GCal push channel renewal cadence: renew at less-than-24-hours remaining; channels max at seven days per Google's policy. Twentieth, cron consolidation pattern: scheduled workers are deployed as one multiplexed Cloudflare Worker — `daily-cron` (dispatches by hour-of-UTC to trial-reminder, dunning-check, hard-delete, reconciliation, bill-reminder, gcal-channel-renewal, spend-monitor); live-activity-pusher remains its own worker (tight CPU budget and 5-minute cron cadence); apple-pki-monitor remains its own worker (weekly schedule does not compose with daily-cron's hourly dispatch model). The Cloudflare Workers paid-tier cron-trigger budget is 250 per account; the three workers (daily-cron, live-activity-pusher, apple-pki-monitor) together consume well under that ceiling. Note: Cloudflare Workers Paid is required from day one of cron deployment per the SCALING_THRESHOLDS update in chat 003; free-tier cron is unusable for production work due to its 10ms CPU limit per cron trigger. Twenty-first, hydration data shape: hydration writes go to a new event-style `hydration_log` table (one row per glass logged, like completion_log); mutations do NOT bump `user_profiles.base_profile_version`; the daily counter is derived via a count query against `start_of_local_day(user.timezone)`. Twenty-second, optional mid-trial payment-method capture: on trial day 5, surface an opt-in payment-method capture UI (Stripe Setup Intent on web, Apple Pay token on iOS); the day-6 one-tap pay surface fires only for users who captured; users who did not capture see the regular trial-end Checkout/StoreKit flow.

The external account submissions are urgent because of approval lag. Apple Developer enrollment review can take a full week. Stripe identity verification typically takes one to three business days. Both must be in flight by the end of this session so they are active by the time the Cutover Block begins.

**Dependencies:** None. This is the first chat of the entire phase.

**End-of-session checks:** `docs/ARCHITECTURE_DECISIONS.md` exists and is comprehensive. Apple Developer enrollment confirmation email received (or screenshot of submission). Stripe identity verification screen reached. EAS project ID present in `apps/mobile/app.config.js`. RapidAPI dashboard accessible. Hardware confirmation noted.

### Chat 002 — Test Infrastructure and CI/CD Pipeline

*Block 0 | 🟡 | Skills: superpowers*

**Load at session start:** TECHNICAL_SPEC.md §13 Operations; ENVIRONMENT_SETUP.md; `package.json` files in `apps/web`, `apps/mobile`, `packages/shared`, `packages/ai`, `packages/db`.

**Goal:** Install and configure the test framework across all packages so that unit tests, contract tests, and end-to-end tests are runnable from a single root command. Build the GitHub Actions workflows that gate pull requests against the test suite, deploy source maps to Sentry on merge, and trigger EAS mobile builds on tag push. Enable branch protection on `main` so that no chat thereafter can merge without these gates passing.

**Output:**
- `vitest.config.ts` at root with workspace configuration
- Per-package `vitest.config.ts` files for `@vesper/web`, `@vesper/mobile`, `@vesper/ai`, `@vesper/db`, `@vesper/shared`
- Playwright configuration in `apps/web/playwright.config.ts` (Playwright is already installed per ENV_SETUP)
- Test database setup script in `packages/db/scripts/setup-test-db.ts` that creates an isolated test schema in the local Supabase instance
- Factory functions for test data (users, plans, blocks, tasks) in `packages/db/src/test/factories.ts`
- `.github/workflows/pr-check.yml` — runs `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm test`, and `pnpm playwright test` on every pull request
- `.github/workflows/sentry-release.yml` — uploads source maps and tags a release on every push to main
- `.github/workflows/mobile-build.yml` — triggers `eas build` on git tag push matching `mobile-v*`
- Branch protection rules configured on `main` requiring all status checks to pass

**Implementation notes:** Vitest is chosen over Jest because it handles ES modules without ceremony and integrates cleanly with TypeScript path aliases. The workspace configuration at the root delegates to per-package configs, allowing `pnpm test` from any directory. The test database pattern uses Supabase's CLI to spawn an isolated local instance per CI run; this keeps tests deterministic and parallelizable. The factory functions take an optional override object so that tests can construct edge cases without rewriting setup. The PR check workflow must be fast: caching `pnpm store`, `node_modules`, and `~/.cache/playwright/browsers` is essential, otherwise PR review latency makes the gate annoying enough to bypass. The Sentry release workflow tags releases with the git SHA and uploads source maps for `apps/web`, `apps/mobile`, and `workers/` so that stack traces in production are symbolicated. The EAS workflow does not auto-submit to TestFlight; it produces a build that the founder manually promotes via `eas submit`.

**Dependencies:** Chat 001 (Expo account exists, RapidAPI key not needed here but documented).

**End-of-session checks:** `pnpm test` from root runs and passes (even with zero tests). `pnpm playwright test` runs and passes. A trivial pull request opened against main triggers all three workflows and they pass. Branch protection on main requires the pr-check workflow status before merge.

### Chat 003 — Documentation Scaffolding

*Block 0 | 🟡*

**Load at session start:** PROJECT_OVERVIEW.md; ENVIRONMENT_SETUP.md; TECHNICAL_SPEC.md (sections 2 and 10 specifically).

**Goal:** Author the repository's top-level documentation surface so that the project is navigable by a hypothetical future contributor (or by the founder returning after a long break). This is not feature work; it is permanent project context that every subsequent chat can reference.

**Output:**
- `README.md` at repository root — project overview, two-paragraph what-and-why, link to TECHNICAL_SPEC.md as the implementation contract, link to PRD.md as the product contract, local-development quickstart with the same content as ENV_SETUP's verification commands
- `CONTRIBUTING.md` — workflow conventions including the rule that every chat ends with `pnpm build && pnpm lint`, the migration discipline rule (never edit a committed migration; always forward), and the env var discipline rule (every new env var updates `.env.example`)
- `docs/ARCHITECTURE.md` — a Mermaid diagram showing Next.js + Expo + Supabase + Cloudflare Workers + Stripe + Anthropic + Resend + Sentry + PostHog with the request flow for a daily plan generation traced through the diagram
- `docs/RUNBOOKS/README.md` — index file listing all runbooks authored across the build. The current set of indexed runbooks and the chats responsible for delivering each:
  - `PGSODIUM_KEY_ROTATION.md` (chat 063) — key rotation procedure for the pgsodium-encrypted columns in the `integrations` table.
  - `STRIPE_CUTOVER.md` (chat 083) — Stripe test-to-live key swap and Stripe Tax onboarding prerequisites (Stripe Tax onboarding is a hard prerequisite to the first paid Checkout session per I-083-b).
  - `HARD_DELETE_RECOVERY.md` (chat 073) — what to do if a hard-delete is run incorrectly; documents the irreversibility boundary and audit-trail expectations. (The cascade-verification artifact is the CI script `workers/daily-cron/scripts/verify-hard-delete-cascade.ts`, not the runbook.)
  - `GCAL_CHANNEL_RENEWAL.md` (chat 066, delivered per I-066-a) — operational runbook for silent multi-day worker failure detection and manual channel re-registration.
  - `APNS_KEY_ROTATION.md` (chat 076, delivered per I-076-a) — zero-downtime rotation procedure for the APNs .p8 signing key including the emergency-rotation variant for compromised-key response.
  - `APPLE_ROOT_CA_ROTATION.md` (chat 086) — procedure to add a new pinned Apple Root CA when Apple rotates its PKI; the action procedure consumed by the apple-pki-monitor alert handler.
  - `APPLE_PKI_MONITOR.md` (chat 086a, delivered per I-086a-b) — alert-handler runbook describing what to do when the apple-pki-monitor Sentry alert fires; refers to `APPLE_ROOT_CA_ROTATION.md` as the action procedure.
  - `IOS_ALARM_REBUILD.md` (chat 059b) — rebuild procedure for the iOS alarm Notification Service Extension.
  - `IOS_WIDGET_REBUILD.md` (chat 077) — rebuild procedure for the SwiftUI Live Activity widget extension.
  - `ALERTING.md` (chat 097a) — on-call runbook covering alert severity matrix, escalation, and acknowledgment workflow for every operational alert wired in Chat 097a (Anthropic spend, Sentry error volume, Cloudflare worker health, Supabase Realtime, Stripe webhook delivery, Apple ASSN, plus the apple-pki-monitor alert handler).
  - Plus the operational drill runbooks: backup-restore drill, incident response, and log retention.
- `docs/RUNBOOKS/INCIDENT_RESPONSE.md` — incident-response skeleton with sections for API 500-storm, database connection saturation, Anthropic spend spike, payment provider outage, Realtime websocket flood. Each section names the detection signal, immediate action steps, escalation contact (founder for V1), and a post-incident review template.
- `docs/RUNBOOKS/BACKUP_RESTORE_DRILL.md` — quarterly procedure for restoring Supabase PITR snapshot to staging, verifying row counts match production, verifying a representative user's data round-trips correctly. First drill scheduled for Phase 5.
- `docs/MIGRATION_DISCIPLINE.md` — full prose explanation of why migrations are forward-only in production, why `.down.sql` exists for local resets only, and why post-launch schema changes use the add-nullable-then-backfill pattern.
- `docs/MIGRATION_NUMBER_ALLOCATION.md` — reserves numeric ranges so that out-of-order chats do not collide on migration numbers. "Number" refers to the numeric suffix after the date prefix in filenames like `20260601000005_templates.sql` (here, `5`). Numbers may carry a single letter suffix (e.g., `4a`) for small helper migrations that fit between integer slots without claiming a full slot (used by Chat 004 for the `start_of_local_day` helper function). Allocation: numbers 1 through 13 (with letter suffixes permitted) are Block 1 foundation (assigned in chats 004 and 005); 14 through 30 are reserved for Blocks 4 through 7 incremental schema additions (chats that need a new column or table during those blocks pick the next number in this range); 31 through 50 are reserved for Blocks 8 through 11 additions; 100001 through 199999 are reserved for seed migrations (chat 048); 200001 and above are reserved for post-launch migrations. Every chat that adds a migration cites this document and picks the next available number in the assigned range.
- `docs/RETENTION_POLICY.md` — documents V1 acceptance that `completion_log` and `security_audit_log` tables grow unbounded for the first 12 months, with a planned V1.5 retention worker that rolls up `completion_log` to daily aggregates after 90 days and retains `security_audit_log` medication-module rows for 7 years (HIPAA-aligned even though the product is not HIPAA-covered at V1) and other audit rows for 1 year.
- `docs/SCALING_THRESHOLDS.md` — documents the upgrade triggers across infrastructure providers: Supabase free-to-Pro tier at approximately 500 active users or when 500MB database / 1GB file storage / 5GB uncached egress limits begin to bite (per Layer 3 and verified May 2026 against Supabase's current free-tier limits), Supabase Realtime free-to-paid upgrade at 75 dual-device users (≈150 concurrent channels, 75% of the free-tier 200 ceiling), Vercel Pro tier bandwidth (1TB/month) and function invocation (1M/day) ceilings — active from Phase 4 build start, no upgrade step required, Cloudflare Workers Paid ($5/month) required from day one of cron deployment because Free-tier cron is unusable for production work (10 ms CPU limit per cron trigger). Also: Free tier caps at 5 cron triggers per account (Paid: 250). The cron consolidation pattern from Chat 001 Decision 20 stays well within these limits. Free-tier 100K-requests-per-day cap is informational only — Workers Paid is required for cron-CPU reasons before request volume becomes relevant., Resend free tier 3,000 emails/month AND 100/day cap (the daily cap may bind earlier than the monthly during traffic bursts); upgrade trigger at 2,500/month sustained OR any single day exceeding 80 sends (80% of the 100/day cap), Stripe API rate limits (100 read / 100 write per second per account; alert if any worker exceeds 50% sustained), and Anthropic spend ceiling (per the formula in chat 097a: max($5/day floor, $1.20/user/month × (active+trial users) / 30); alert at 80%, action at 100%, panic at 200%). Each threshold names the migration steps and the PostHog or Sentry signal that fires the alert.
- `docs/ENV_VAR_DISCIPLINE.md` — explains the `.env.example` source-of-truth pattern and the convention that `NEXT_PUBLIC_*` keys are client-bundled and never sensitive.

**Implementation notes:** The README is the front door; keep it short and link-heavy rather than comprehensive. The Mermaid architecture diagram should fit on one screen and trace one specific user action end-to-end; the morning plan generation is the canonical example because it touches the most services. The runbook index forces runbook authoring in the chats that require them. The migration number allocation document is the single source of truth for any chat that needs to add a migration; chats consult it before picking a number to avoid collisions when sequencing changes.

**Dependencies:** Chat 001 (architecture decisions documented; this chat references them).

**End-of-session checks:** All five documents render correctly in GitHub's markdown view. The Mermaid diagram renders. README links resolve.

---

## Block 1 — Database Foundation

Block 1 produces the seventeen-table V1 schema, runs the first real `supabase db push`, syncs Drizzle types, authors the Zod schemas for JSONB columns, and verifies Row Level Security on every table. Nothing else in the project compiles correctly until Block 1 is complete because the Drizzle types it emits are imported by every API route, every UI component that displays user data, and every test.

### Chat 004 — Migrations Part 1: Foundation Tables

*Block 1 | 🗄️ 🟡 | ⚠️ | Skills: drizzle-best-practices*

**Load at session start:** TECHNICAL_SPEC.md §3 (full Database Schema section); the `packages/db/migrations/` directory (currently empty per ENV_SETUP); `docs/ARCHITECTURE_DECISIONS.md` (migration generation pattern decision).

**Goal:** Author the first four migration files in the sequence defined by Tech Spec §3 Migration Sequence: enums and extensions, users with the `handle_new_user()` trigger function, user_profiles with the trigger extension, and the four coupled daily-planning tables (daily_plans, blocks, tasks, weekly_priorities). Each migration is hand-written SQL wrapped in BEGIN and COMMIT, with a corresponding `.down.sql` file that reverses the operations.

**Output:**
- `packages/db/migrations/20260601000001_enums_and_extensions.sql` and `.down.sql` — enables `pgsodium` and `pgcrypto` extensions; creates all twenty-four enum types listed in Tech Spec §3
- `packages/db/migrations/20260601000002_users.sql` and `.down.sql` — creates the users table with every column from the Tech Spec audit (including `referral_code varchar(6) UNIQUE` (auto-minted by the `transitionToActive` logic in chat 081 on first paid conversion), `onboarding_completed_at`, `referred_by_user_id`, `deletion_requested_at`, all subscription columns referenced in API contracts, plus `last_warmed_at timestamptz` used by the wake-alarm-triggered cache warm path from chat 071, plus `biometric_lock_enabled boolean DEFAULT false` for the optional mobile biometric lock setting from chat 090b); the bedtime and wake-time columns (`sleep_target_bedtime`, `sleep_target_wake`) are declared as `time` (HH:MM, no date) rather than `timestamptz` so daylight-saving transitions do not silently shift the user's stored target; the absolute timestamp is computed per-day at read time from the local time string plus `users.timezone`; creates indexes; enables RLS with standard own-row policies for SELECT and UPDATE on permitted columns only; creates the `handle_new_user()` trigger function with `SECURITY DEFINER`
- `packages/db/migrations/20260601000003_user_profiles.sql` and `.down.sql` — creates the user_profiles table; extends the `handle_new_user()` trigger to also create the matching user_profiles row in the same transaction
- `packages/db/migrations/20260601000004_daily_planning.sql` and `.down.sql` — creates daily_plans, blocks, tasks, and weekly_priorities; the blocks table includes a `client_mutation_id uuid` column plus the constraint `UNIQUE (user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL` (so the same mutation id retried by an offline-queue flush is idempotent rather than producing duplicate rows) used by the Realtime self-mutation filter in chat 037 (every mutation API route writes the inbound client mutation id into this column, the Realtime broadcast carries it, and the originating device drops the broadcast against its own recent-mutation set); the blocks migration also sets `ALTER TABLE blocks REPLICA IDENTITY FULL;` so Realtime broadcasts deliver the full row payload including unchanged columns to subscribers; creates a trigger on the blocks table that updates `daily_plans.updated_at` whenever any child block row is inserted, updated, or deleted (this is the source of truth for the optimistic-concurrency check in chat 027); creates all indexes from Tech Spec including the partial index `idx_tasks_user_id_deadline` and the unique constraints `(user_id, plan_date)` and `(user_id, week_start_date)`; enables RLS with standard own-row patterns
- `packages/db/migrations/20260601000004a_start_of_local_day.sql` and `.down.sql` — creates the `start_of_local_day(tz text) RETURNS timestamptz` Postgres function that takes an IANA timezone string and returns the timestamptz for the start of the current local day in that zone; called by every per-local-day query (trial regen cap in chat 025, hydration counter in chat 050, trial reminder worker in chat 072, 3-regen prompt in chat 100)

**Implementation notes:** The migrations do not run yet; they run in chat 006. The audit against API contracts in chat 008 means that every column referenced by the Tech Spec §9 endpoint responses must exist on the underlying table. The drizzle-best-practices skill is invoked because hand-writing migrations is error-prone and the skill encodes correct patterns for foreign keys, RLS policies, and check constraints. The `handle_new_user()` trigger function must be created with `SECURITY DEFINER` and have its search_path explicitly set to prevent search-path injection attacks. The BEGIN/COMMIT wrapper ensures that if any single statement in a migration fails, the entire file rolls back rather than leaving the schema half-applied.

**Dependencies:** Chat 001 (migration pattern decision), Chat 003 (migration discipline doc).

**End-of-session checks:** All eight files exist with sensible naming. Running each migration's `.sql` against a fresh local database succeeds. Running the corresponding `.down.sql` reverses cleanly. `pnpm lint` passes (linting includes SQL file format checks).

### Chat 005 — Migrations Part 2: Modules, Integrations, Subscriptions, Audit

*Block 1 | 🗄️ 🟡 | ⚠️ | Skills: drizzle-best-practices*

**Load at session start:** TECHNICAL_SPEC.md §3 sections 7 through 20 plus the Migration Sequence list; `packages/db/migrations/` (now containing the four files from chat 004).

**Goal:** Author migrations five through thirteen in the Tech Spec sequence, completing the schema. This chat covers the workout and recipe template tables, the medication/errands/bills module tables, the integrations and push_tokens tables, the subscriptions and subscription_events tables, the waitlist and referral_credits tables, the completion_log table, the security_audit_log table with its two trigger functions, the deleted_user_email_hashes table, and the final generic `set_updated_at()` trigger function applied to every table with an `updated_at` column.

**Output:**
- `20260601000005_templates.sql` and `.down.sql` — workout_templates and recipe_templates with GIN indexes on tag arrays
- `20260601000006_modules.sql` and `.down.sql` — medications (with the strictest RLS verified), recurring_errands, bills
- `20260601000007_integrations.sql` and `.down.sql` — integrations with pgsodium-encrypted token columns (bytea), `status integration_status_enum NOT NULL DEFAULT 'connected'` and `last_error text` columns (the authoritative trigger for the broken-integration banner in chats 064 and 099), push_tokens with the unique constraint on (user_id, device_id)
- `20260601000008_subscriptions.sql` and `.down.sql` — subscriptions with the unique user_id constraint and the CHECK constraints from Tech Spec, subscription_events with the unique (provider, event_id) idempotency constraint
- `20260601000009_waitlist_and_referrals.sql` and `.down.sql`
- `20260601000010_completion_log.sql` and `.down.sql` — with the ON DELETE SET NULL on block_id for log persistence past block deletion
- `20260601000011_security_audit_log.sql` and `.down.sql` — creates the table, the `audit_medications_changes()`, `audit_integrations_changes()`, `audit_bills_changes()`, `audit_subscriptions_changes()`, and `audit_push_tokens_changes()` trigger functions (all with `SECURITY DEFINER` and `STABLE`), and attaches the triggers to the medications, integrations, bills, subscriptions, and push_tokens tables
- `20260601000012_deleted_user_email_hashes.sql` and `.down.sql`
- `20260601000013_updated_at_triggers.sql` and `.down.sql` — the generic `set_updated_at()` function and its attachment to every table with an `updated_at` column
- `20260601000014_hydration_log.sql` and `.down.sql` — creates the `hydration_log` event-style table with `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `logged_at timestamptz NOT NULL DEFAULT now()`, `count integer NOT NULL DEFAULT 1`; index on `(user_id, logged_at DESC)`; RLS own-row policies for SELECT and INSERT; the daily counter in chat 050 derives via `SELECT COUNT(*) FROM hydration_log WHERE user_id = $1 AND logged_at >= start_of_local_day(user.timezone)`
- `20260601000015_email_queue.sql` and `.down.sql` — creates the `email_queue` table with `id uuid PK`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `template_name text NOT NULL`, `scheduled_for timestamptz NOT NULL`, `sent_at timestamptz NULL`, `payload jsonb NOT NULL DEFAULT '{}'::jsonb`; index on `(scheduled_for) WHERE sent_at IS NULL`; consumed by the post-cancel survey email queue (chat 090) and any other deferred Resend send
- `20260601000016_delayed_jobs.sql` and `.down.sql` — creates the `delayed_jobs` table with `id uuid PK`, `job_type text NOT NULL`, `payload jsonb NOT NULL DEFAULT '{}'::jsonb`, `scheduled_for timestamptz NOT NULL`, `processed_at timestamptz NULL`, `attempts integer NOT NULL DEFAULT 0`; index on `(scheduled_for) WHERE processed_at IS NULL`; replaces Upstash QStash for the delayed reconciliation triggers in chats 074, 084, 087, 088 (the daily-cron worker or a dedicated tick worker picks up due rows and dispatches by `job_type`)
- `20260601000017_cancellation_events.sql` and `.down.sql` — creates the `cancellation_events` table with `id uuid PK`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `reason text NOT NULL`, `free_text text NULL`, `archetype text NULL`, `subscription_duration_days integer NULL`, `canceled_at timestamptz NOT NULL DEFAULT now()`; written by chat 090 in addition to the PostHog event so cancellation data is queryable in the application database for post-launch analysis without round-tripping PostHog
- `20260601000018_calendar_events.sql` and `.down.sql` — creates the `calendar_events` table consumed by the built-in calendar in chat 052: `id uuid PK`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `title text NOT NULL`, `start_time timestamptz NOT NULL`, `end_time timestamptz NOT NULL`, `rrule text NULL` (RFC 5545 recurrence rule, expanded at read time), `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`; RLS own-row policies; ownership of this migration is in Chat 005 so the schema is in place before chat 052 builds against it

**Implementation notes:** The security_audit_log triggers must run with SECURITY DEFINER so they can write to a table the calling user has no policies to write to directly. The audit triggers fire AFTER INSERT OR UPDATE OR DELETE; for DELETE, the OLD row is captured in `old_values` and `new_values` is NULL; for INSERT, the reverse; for UPDATE, both are populated. The extended audit coverage (bills, subscriptions, push_tokens beyond the original medications and integrations) exists because each of these surfaces carries either financial or security sensitivity: bills hold financial info, subscriptions hold the canonical paid-state, and push_tokens are the delivery target for time-sensitive notifications including medication reminders. The audit_log rows reference `user_id` with `ON DELETE CASCADE` because the V1 retention policy (documented in `docs/RETENTION_POLICY.md` from chat 003) accepts right-to-erasure deleting audit rows along with the user; the product is not HIPAA-covered at V1 so no regulatory retention floor applies, and the cleaner GDPR/CCPA-compatible posture is to wipe everything on hard-delete. The `set_updated_at()` generic trigger is attached only to tables where `updated_at` should be mutated by the database rather than the application; reference tables like workout_templates and recipe_templates do not need it because they are mutation-by-seed-migration only. The pgsodium-encrypted columns in integrations are bytea, not text; the encryption itself happens in API route code in chat 063 using the pgsodium key (the application holds the encryption key, not Postgres). The completion_log table uses a uuid primary key (not bigint), so it is not the same shape as security_audit_log. The new event-style tables (hydration_log, cancellation_events) match the completion_log pattern: append-only, immutable rows, queried by date range; mutations on hydration_log specifically do NOT increment `user_profiles.base_profile_version` because hydration is high-frequency event data, not a profile preference. The delayed_jobs table replaces the prior QStash dependency entirely; the tick worker (or the daily-cron consolidated worker dispatching by `job_type`) polls for due rows, dispatches them, and updates `processed_at`.

**Dependencies:** Chat 004 (migrations one through four must exist first because foreign keys reference users and user_profiles).

**End-of-session checks:** All migration files exist with naming conventions correct. Each `.sql` runs cleanly on a fresh database. Each `.down.sql` reverses cleanly. The audit triggers are attached to medications, integrations, bills, subscriptions, and push_tokens — verified via `pg_trigger` lookup; only these five tables have audit triggers and none others. This aligns with the Chat 005 Output line that creates the triggers on all five tables.

### Chat 006 — First `supabase db push` plus Drizzle Sync, Zod Schemas, RLS Audit

*Block 1 | 🗄️ 🟡 | ⚠️ | Skills: drizzle-best-practices*

**Load at session start:** All migration files from chats 004 and 005; TECHNICAL_SPEC.md §3 plus the JSONB shape specifications in §3.2 (base_profile and modules_enabled), §3.4 (block.details discriminated union by block_type), §3.6 (weekly_priorities), and §3.18 (completion_log.value discriminated union by event_type); `packages/db/` package root; `packages/shared/` package root.

**Goal:** Run the first real `supabase db push` to deploy all thirteen migrations to the local Supabase instance, then run `drizzle-kit pull` to introspect the resulting schema into TypeScript types in `packages/db/src/schema/`. Then author the Zod schemas for every JSONB column in `packages/shared/src/schemas/jsonb/` so that runtime validation matches the database structure and TypeScript types match Zod types end-to-end. Finally, run a Row Level Security audit against every table to verify the deny-all default plus per-table policies are correct.

**Output:**
- Local Supabase database with all seventeen tables, twenty-four enums, three trigger functions, and one generic trigger function deployed
- `packages/db/src/schema/index.ts` and per-table files generated by `drizzle-kit pull`
- `packages/shared/src/schemas/jsonb/baseProfile.ts` — Zod schema matching the Tech Spec base_profile structure (work_schedule, sleep_preferences, fitness_preferences, location_bound_events, goals, preferences)
- `packages/shared/src/schemas/jsonb/modulesEnabled.ts` — Zod schema with discriminated structures for each of the seven modules
- `packages/shared/src/schemas/jsonb/blockDetails.ts` — Zod discriminated union by `block_type` with branches for work, fitness, nutrition, sleep, errands, medication, finance, focus, commute, custom
- `packages/shared/src/schemas/jsonb/weeklyPriorities.ts` — Zod array schema with text, source, completed_at per item; array length validation between three and five
- `packages/shared/src/schemas/jsonb/completionLogValue.ts` — Zod discriminated union by `event_type` with the appropriate value shape per event
- `packages/db/scripts/test-rls.ts` — a script that connects as the anon role and attempts to SELECT, INSERT, UPDATE, and DELETE every table, verifying that public tables (workout_templates, recipe_templates, waitlist insert) return data and all other tables return zero rows or permission denied
- `packages/db/scripts/audit-schema.ts` — a script that introspects the database and verifies all foreign keys, indexes, and check constraints from Tech Spec §3 are present. Explicit assertions include: `users.referral_code` exists as `varchar(6)` with a `UNIQUE` constraint (referenced by the mint-on-active logic in chat 081), `blocks.client_mutation_id` exists with the partial unique constraint `(user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL` (referenced by chat 037 Realtime self-mutation filter and the offline-queue idempotency in chat 038), `blocks` has `REPLICA IDENTITY FULL` set (verified via `pg_class.relreplident = 'f'`; required so Realtime broadcasts deliver the full row to subscribers in chat 037), `start_of_local_day(text)` Postgres function exists and returns `timestamptz`, audit triggers exist on `bills`, `subscriptions`, and `push_tokens` in addition to `medications` and `integrations` (verified via `pg_trigger` lookup), tables `hydration_log`, `email_queue`, `delayed_jobs`, `cancellation_events`, and `calendar_events` exist with correct RLS own-row policies (specifically verified for Realtime-broadcast tables that RLS gates the broadcast channel, not only the API), the trigger that updates `daily_plans.updated_at` on any child block INSERT/UPDATE/DELETE exists and fires correctly (verified by inserting a test block and asserting the parent row's `updated_at` advanced), `users.last_warmed_at` exists (referenced by chat 071 cache warm dedup), `users.biometric_lock_enabled` exists with a default of false (referenced by chat 090b), `users.sleep_target_bedtime` and `users.sleep_target_wake` are declared as `time` not `timestamptz`, `integrations.status` and `integrations.last_error` columns exist, and `security_audit_log.user_id` foreign key uses `ON DELETE CASCADE`. The script fails the build if any assertion fails.

**Implementation notes:** The `supabase db push` command reads from the directory configured in `supabase/config.toml` (per the chat 001 architecture decision, this is configured to read `packages/db/migrations/`). Before pushing, run `supabase db reset` to ensure a clean state. After pushing, run `drizzle-kit pull` with the connection string pointing at the local database; this generates the TypeScript types automatically from the running schema rather than from the migration files. The Zod schemas must match the TypeScript types exactly; mismatches will surface as runtime validation errors against valid database rows. The RLS audit script is critical because manual RLS verification is error-prone; an automated script that fails CI if any expected policy is missing prevents data leaks. The audit-schema script is the safety net against missing columns mentioned in chat 004's column audit; if any column referenced by Tech Spec §9 API contracts is missing, this is where to catch it and add a migration.

**Dependencies:** Chats 004 and 005 (migrations exist), chat 001 (Supabase config path is set).

**End-of-session checks:** `supabase db push` runs to completion with no errors. `drizzle-kit pull` produces complete schema files matching all seventeen tables. All Zod schemas in `packages/shared/src/schemas/jsonb/` exist and pass their own unit tests against representative valid and invalid inputs. `pnpm tsx packages/db/scripts/test-rls.ts` reports zero leaked rows on any private table. `pnpm tsx packages/db/scripts/audit-schema.ts` reports all expected schema elements present. `pnpm build` clean. `pnpm lint` clean.

### Chat 007 — Supabase Connection Pooling and Drizzle Client Pattern

*Block 1 | 🟡*

**Load at session start:** TECHNICAL_SPEC.md §10 Hosting (Supabase section); `docs/ARCHITECTURE_DECISIONS.md` (connection pooling decision); `packages/db/` package root; Supabase project dashboard for the local instance (note the Supavisor connection string format).

**Goal:** Configure the Drizzle client to use Supavisor in transaction mode for all serverless contexts (Vercel API routes, Cloudflare Workers) and direct connections only for local development scripts. Author the canonical client initialization pattern that every API route and worker imports. Author the service-role-with-user-filter wrapper utility that the architecture decision in chat 001 mandated.

**Output:**
- `packages/db/src/client.ts` — exports `createDrizzleClient()` that takes a connection string parameter (defaulting to environment-driven selection between pooler URL and direct URL based on `process.env.NODE_ENV` and `process.env.RUNTIME`), returns a typed Drizzle client; uses `postgres-js` driver with `prepare: false` for the pooler-compatibility flag that is required in transaction mode
- `packages/db/src/withUserFilter.ts` — exports `withUser<T>(userId: string, query: (db: Database, userId: string) => T)` that takes a service-role Drizzle client and enforces per-user scoping via a typed query-builder pattern: every exported query function in `packages/db/src/queries/*.ts` takes `userId: string` as its required first parameter and emits the `eq(table.userId, userId)` filter through Drizzle's typed API; TypeScript enforces at compile time that no query function can be defined without consuming the parameter (achieved via a `UserScopedQuery<T>` generic that the file's query barrel re-exports). The runtime SQL-string inspection approach is rejected because it produced false negatives on parameterized queries and added per-call overhead; the typed approach makes the enforcement a compile-time concern instead.
- `packages/db/.env.example` updated to include both `SUPABASE_DB_URL` (direct) and `SUPABASE_POOLER_URL` (Supavisor)
- `apps/web/.env.local` and `apps/mobile/.env.local` updated similarly
- `packages/db/CLIENT_PATTERN.md` — full prose documentation of the connection model, when to use direct versus pooler, the wrapper utility's purpose, and an example API route showing correct usage

**Implementation notes:** Supavisor in transaction mode does not support prepared statements, which is why `prepare: false` is required on the postgres-js driver. Without this flag, every query that uses prepared statements (which is most of them with Drizzle's default) will fail with cryptic errors at runtime, not at compile time, and only in serverless environments where pooling is enabled. The withUserFilter wrapper is the architectural enforcement of the service-role pattern; the Supabase service role bypasses RLS entirely, so application code is responsible for per-user filtering. Without enforcement, a developer who forgets the filter clause leaks every user's data. The wrapper relies on a typed query-builder convention rather than runtime SQL inspection: each query function lives in `packages/db/src/queries/*.ts`, takes `userId` as its required first parameter, and emits the filter through Drizzle's typed `eq(table.userId, userId)` API. The compile-time `UserScopedQuery<T>` generic ensures a query cannot be exported from the queries barrel without consuming `userId`. Application code never constructs queries inline against the service-role client; it only calls these exported functions. This eliminates the runtime SQL-parsing overhead, removes the false-negative window on parameterized queries, and makes the safety property visible to TypeScript at every callsite.

**Dependencies:** Chat 006 (Drizzle schema exists).

**End-of-session checks:** A test API route that uses `createDrizzleClient()` with the pooler URL runs successfully against the local database. The `withUserFilter` wrapper throws when given a query that omits the filter, and succeeds when given one that includes it. Documentation is complete and references real code patterns. `pnpm build` clean.

---

## Block 2 — Auth, API Foundation, and Shell

Block 2 brings the monorepo from "schema deployed" to "user can sign up, see an authenticated empty plan view on both web and mobile." Authentication works through magic link and Google OAuth. The API has a foundational pattern that every subsequent route follows. The shells boot, gate authentication, and render placeholder screens. Security headers are configured for the web. A build-verification gate locks discipline for all subsequent chats.

### Chat 008 — `@vesper/shared` API Foundation

*Block 2 | 🟡*

**Load at session start:** TECHNICAL_SPEC.md §9 Conventions (full subsection on error shapes, pagination, date format, authorization); `packages/shared/` package root.

**Goal:** Author the shared utilities that every API route imports: the error codes catalog, the standard response shape types, the auth middleware factory that validates Supabase session tokens, the minimum-app-version header check, the API route template that bundles all of these into a Next.js route handler, and the Sentry capture / request-correlation-ID emission in the route template's error-catching layer (so every unhandled exception in any subsequent API route is automatically reported to Sentry with the request method, path, user ID if authenticated, and a request-correlation-ID that downstream logs can join on). After this chat completes, every subsequent API chat follows the same pattern.

**Output:**
- `packages/shared/src/errors.ts` — exports `ErrorCode` as a const object with every SCREAMING_SNAKE_CASE error code identified across Tech Spec §9 (PLAN_NOT_FOUND, INVALID_REQUEST, UNAUTHORIZED, FORBIDDEN, RATE_LIMITED, READ_ONLY_MODE, OPTIMISTIC_LOCK_FAILURE, INTEGRATION_ERROR, etc.); exports `ApiError` class with code, message, and httpStatus
- `packages/shared/src/api/response.ts` — exports `successResponse<T>(data: T, status?: number)` and `errorResponse(code: ErrorCode, message: string, status: number)` helpers that produce the standard `{ error: { code, message } }` shape
- `packages/shared/src/api/auth.ts` — exports `validateSession(request: Request): Promise<AuthenticatedUser>` that reads the Authorization Bearer token, calls Supabase Auth to verify, returns the user record with derived subscription_status; throws `ApiError` with 401 if invalid
- `packages/shared/src/api/minAppVersion.ts` — exports `checkAppVersion(request: Request): void` that reads the `X-App-Version` header from mobile clients and throws `ApiError` with 426 Upgrade Required if below the constant `MIN_APP_VERSION`; web clients are exempt (no header check)
- `packages/shared/src/api/route.ts` — exports `createRoute<T>(handler: AuthenticatedHandler<T>): NextRouteHandler` that wraps a handler function with session validation, app version check, error catching, and response serialization
- Unit tests for each utility in `packages/shared/src/api/__tests__/`

**Implementation notes:** The error code enum is the source of truth; any new error code added in a subsequent chat must be added here first, then used. CORS posture: Next.js API routes at `/api/v1/*` accept Authorization-Bearer requests without an explicit CORS allowlist (the bearer-auth flow is a simple cross-origin request that does not trigger a preflight under the CORS spec, and no cookies or credentials are read from request headers other than Authorization). The mobile app's bundle origin is therefore acceptable as-is. If a future chat adds cookie-based auth, multipart uploads, or any custom request header beyond `Authorization`, `Content-Type`, or `X-App-Version`, that chat MUST add an explicit CORS allowlist and document the threat model — the silent default is no longer safe in that scenario. The route template factory is the most important deliverable: it removes the need to remember session validation in every route by enforcing it at the wrapper level. The `AuthenticatedUser` type returned from `validateSession` is the same shape used throughout the application; it includes the derived `subscription_status` so downstream code can gate access without an additional query. The app version check is a no-op for web because web is always at the latest deploy; the header check applies only when `X-Vesper-Client: mobile` is set (or when `X-App-Version` is present at all). `MIN_APP_VERSION` is declared as `process.env.MIN_APP_VERSION` (string semver, e.g. `"1.0.3"`) so it can be bumped by changing the Vercel/Cloudflare environment variable without a code deploy; the package exports a `getMinAppVersion()` helper that reads the env var with a fallback to the package-default constant (`"1.0.0"` at initial ship). Bumping the env var forces clients below the new threshold to receive 426 on the next API call, which triggers the Chat 013 update-required modal.

**Dependencies:** Chat 007 (Drizzle client exists; validateSession queries the users table).

**End-of-session checks:** Unit tests for all five files pass. A trivial test API route in `apps/web/app/api/v1/test/route.ts` that uses `createRoute` returns the expected response shape with valid auth and the expected error shape with invalid auth. `pnpm build` clean.

### Chat 009 — API Rate Limiting Middleware

*Block 2 | 🟡 🟣*

**Load at session start:** TECHNICAL_SPEC.md §9 (Pagination note about Cloudflare-edge rate limiting on the waitlist endpoint and referral endpoint); `docs/ARCHITECTURE_DECISIONS.md` (rate limiter implementation: Upstash Redis).

**Goal:** Implement the rate limiting pattern that protects expensive endpoints from misuse. Two distinct rate-limit surfaces are configured: Cloudflare-edge limiting for unauthenticated public endpoints (waitlist, referral track) where IP-based limiting is appropriate, and Upstash Redis token-bucket limiting for authenticated endpoints where per-user limiting is needed (especially `POST /plans/generate` which burns Anthropic credits).

**Output:**
- Upstash Redis account created on free tier; `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` added to `apps/web/.env.local` and the relevant Cloudflare Worker secrets
- `packages/shared/src/api/rateLimit.ts` — exports `withRateLimit(limiterName: 'plan-generate' | 'ai-command' | ..., key: string)` middleware that takes the user ID as the key, queries Upstash with `@upstash/ratelimit` library, returns the route's response or a 429 ApiError; configurations include `plan-generate` at five-per-hour, `ai-command` at sixty-per-hour
- `apps/web/middleware.ts` updated to apply Cloudflare-style edge rate limiting (which, when running on Vercel Edge, uses the platform's KV-backed rate limit primitives) to `/api/v1/waitlist` at one-hundred-per-IP-per-hour and `/api/v1/referral/track` at two-hundred-per-IP-per-hour
- `packages/shared/RATE_LIMITING.md` — documentation of every rate-limited endpoint with its current limits and the rationale
- Structured logging on every rate-limit trip: when `withRateLimit` returns a 429, the middleware emits a Sentry breadcrumb plus a PostHog event `rate_limit_tripped` carrying `{user_id, endpoint, limiter_name, window_seconds, retry_after_seconds}` (the user_id is the authenticated principal; for edge-tier IP-based limits on unauthenticated endpoints the field is `anonymous_ip_hash`, a SHA-256 of the IP plus a daily-rotating salt to avoid persisting raw IPs). Without this, debugging "why is user X getting 429" or "is anyone hammering /plans/generate" is impossible.
- Structured logging on every rate-limit trip: when `withRateLimit` returns a 429, the middleware emits a Sentry breadcrumb plus a PostHog event `rate_limit_tripped` carrying `{user_id, endpoint, limiter_name, window_seconds, retry_after_seconds}` (the user_id is the authenticated principal; for edge-tier IP-based limits on unauthenticated endpoints the field is `anonymous_ip_hash`, a SHA-256 of the IP plus a daily-rotating salt to avoid persisting raw IPs). Without this, debugging "why is user X getting 429" or "is anyone hammering /plans/generate" is impossible.

**Implementation notes:** The two-tier approach matches the two-tier nature of the endpoints. Unauthenticated endpoints have no user ID to limit by, so IP-based limits at the edge are appropriate. Authenticated endpoints have a user ID, so per-user limits are appropriate (an authenticated user could otherwise hammer `/plans/generate` and burn unbounded Anthropic credits). The Upstash free tier provides 500,000 commands per month (per Upstash's March 2025 pricing change; the prior 10,000-commands-per-day tier is retired); each rate-limited request is one command, so this comfortably supports thousands of users at typical activity levels (roughly 16,667 commands per day on average). The 429 response includes a `Retry-After` header with the seconds remaining in the bucket. The `plans/generate` route specifically uses a two-path hand-off implemented in chat 025: trial users (subscription_status='trial') go through a per-local-day completion_log count query against `start_of_local_day(user.timezone)`; active subscribers go through the Upstash token bucket configured here. The two paths are mutually exclusive — a single request takes one path based on subscription_status and never composes both — so the Upstash command budget is consumed only by active-subscriber requests, keeping the free-tier comfortable.

**Dependencies:** Chat 008 (the route template integrates with this middleware).

**End-of-session checks:** A test request to a rate-limited endpoint succeeds on the first invocation and returns 429 with `Retry-After` after exceeding the limit. The middleware applies correctly to both authenticated and public endpoints.

### Chat 010 — Web Authentication, Magic Link Email, and Resend Integration

*Block 2 | 🔵 🎩*

**Load at session start:** TECHNICAL_SPEC.md §4 Authentication; PRD §3.1 (onboarding screen 2 — authentication options); LAYER_4_EXPERIENCE_IDENTITY.md (Onboarding Flow section, Screen 2); `apps/web/app/` directory.

**Goal:** Implement Supabase Auth on web with three live sign-in methods at V1: Google OAuth, Sign in with Apple, and email magic link. Author the React Email template for the magic link, configure Supabase Auth to route transactional email through Resend's SMTP relay so deliverability matches production from day one, and configure the OAuth callback route with allowlist enforcement to prevent open-redirect attacks. All three methods feed the same Supabase Auth identity and are surfaced as equal-weight options on the sign-in screen because App Store Review guideline 4.8 mandates Sign in with Apple whenever any other third-party social login is offered.

**Output:**
- `apps/web/app/(auth)/sign-in/page.tsx` — the sign-in page with three stacked options (Google, Apple, email magic link), all live
- `apps/web/app/auth/callback/route.ts` — the OAuth callback handler that exchanges the OAuth code for a Supabase session for both Google and Apple flows; validates the `next` redirect parameter against an allowlist of internal paths to prevent open-redirect attacks
- `apps/web/lib/auth/apple-sign-in.ts` — the Apple Sign in flow using the Services ID provisioned in Cutover step C-09; redirects to Apple's authorization endpoint, handles the form-post return, and forwards to the Supabase OAuth callback
- `packages/shared/emails/MagicLinkEmail.tsx` — the React Email template; voice-gated copy with a single short paragraph and a prominent CTA button styled with the Layer 4 design tokens (cream on espresso, bronze accent on the button)
- `apps/web/app/api/v1/auth/magic-link/route.ts` — the API route that triggers magic link sending via Supabase Auth
- `apps/web/lib/supabase/server.ts` and `apps/web/lib/supabase/client.ts` — the Supabase client factories for server-side and client-side use following the Supabase App Router patterns
- Supabase Dashboard configuration step (documented in the chat output as a manual checklist): configure Supabase Auth → SMTP settings to relay through Resend using the `RESEND_API_KEY` credentials and the `noreply@vesper.day` sender; configure Apple OAuth provider in Supabase Auth → Providers using the Services ID and private key from C-09

**Implementation notes:** Without the Supabase-to-Resend SMTP relay configuration, magic links go through Supabase's built-in email service, which has a three-per-hour per-project rate limit and a generic template that breaks the butler-voice posture. Configuring SMTP relay through Resend at first ship means dev and production behavior are identical and the rate limit ceiling matches Resend's plan. The OAuth callback redirect allowlist is non-obvious but critical. Without it, an attacker constructs a URL like `https://vesper.day/auth/callback?next=https://evil.com` and any authenticated user who clicks the link is redirected to the attacker's site with their session token in the URL fragment, allowing token theft. The allowlist uses a proper URL parser, not a character-prefix check: the `next` parameter is fed to `new URL(next, request.url)`; the parsed URL's `origin` must exactly match the request's origin, otherwise it is rejected. A character-prefix check ("starts with `/` but not `//`") is insufficient because it misses backslash variants (`/\evil.com`), Unicode line separators (`/​evil.com` with U+2028), URL-encoded variants (`%2F%2Fevil.com`), and other parser-confusion payloads that browsers resolve as external origins. Threat model documented inline: any value that the platform's URL constructor resolves to a non-same-origin destination is treated as hostile and produces a redirect to the default `/dashboard`. The magic link email goes through the voice gate at copy authoring time; the regex layer strips em-dashes and exclamation points, and the Haiku review layer is invoked for the body text since it exceeds thirty words. Sign in with Apple on web is a redirect flow (not the native iOS dialog); the user is taken to Apple's authorization page, signs in, and is form-posted back to the callback. The first-time Apple sign-in returns the user's email and (optionally) name only once; the callback persists these into the Supabase user record on initial creation.

Auth-event audit logging: every auth flow path writes a row to `security_audit_log` (table owned by Chat 005) with event_type in the set {magic_link_requested, magic_link_request_failed, magic_link_clicked, magic_link_clicked_invalid_or_expired, oauth_callback_success, oauth_callback_rejected_open_redirect, oauth_callback_provider_error, apple_signin_success, apple_signin_failed}, plus user_id (if known), ip_address (hashed), user_agent (truncated), and an event-specific JSONB detail. The open-redirect rejection event in particular is the canary for any future exploit attempt; logging it explicitly enables a Sentry alert (Chat 097a) when the rejection rate spikes.

**Dependencies:** Chat 008 (API route template), chat 017 (voice gate must exist and pass tests before this chat ships user-facing email copy), Cutover step C-09 (Apple Services ID and private key provisioned), Cutover step C-22 (Resend domain authentication completed for production sender). For the development environment, the Resend sandbox sender from ENV_SETUP suffices and C-22 dependency applies only to production deploys.

**End-of-session checks:** A user can sign up via Google OAuth in development. A user can sign up via Apple Sign in in development. A user can request a magic link, receive it through the Resend relay (not Supabase's default sender), click the link, and arrive authenticated at the dashboard. The OAuth callback rejects any `next` parameter that is not an allowed path. All three buttons render with consistent Layer 4 styling.

### Chat 011 — Mobile Authentication, EAS, Deep Links, and Secure Storage

*Block 2 | 🟢 | ⇄ 010*

**Load at session start:** TECHNICAL_SPEC.md §4 Authentication; PRD §3.1 (onboarding screen 2); LAYER_4_EXPERIENCE_IDENTITY.md (Screen 2); `apps/mobile/` directory; `apps/mobile/app.config.js`.

**Goal:** Implement Supabase Auth on mobile with three live sign-in methods at V1: Google OAuth via `expo-auth-session`, native Sign in with Apple via `expo-apple-authentication`, and email magic link. Configure the deep link scheme `vesper://` for development OAuth callbacks. Prepare the Universal Links configuration (the `apple-app-site-association` file) for the eventual production cutover; this chat does not deploy the file but creates the source of truth for it. Store the Supabase session token in `expo-secure-store` and wire the Zustand auth slice to persist through it. Native Sign in with Apple is the recommended provider on iOS because it uses the system dialog (no browser bounce), and App Store Review guideline 4.8 requires it to be offered when any other social login is offered.

**Output:**
- `apps/mobile/app/(auth)/sign-in.tsx` — sign-in screen with three options, all live; Apple Sign in renders the native system button per Apple HIG
- `apps/mobile/lib/auth/google-oauth.ts` — Google OAuth flow using expo-auth-session with the deep link scheme `vesper://auth/callback` for development; production callback URL (`https://vesper.day/auth/callback`) declared in the config for switching at Cutover
- `apps/mobile/lib/auth/apple-sign-in.ts` — native Apple Sign in flow using `expo-apple-authentication`; on first sign-in, captures the `fullName` and `email` returned by Apple (only returned on first auth) and forwards both with the identity token to Supabase Auth's Apple provider; subsequent sign-ins forward only the identity token
- `apps/mobile/lib/auth/magic-link.ts` — magic link request flow that opens the email client via Linking API; the magic link in the email opens back into the app via the deep link
- `apps/mobile/lib/auth/secureStorage.ts` — wrapper around expo-secure-store with namespaced keys for session token and refresh token
- `apps/mobile/store/auth.ts` — the Zustand auth slice that loads session from secure storage on app start, persists changes back to secure storage, and exposes `signIn`, `signOut`, `currentUser`
- `apps/mobile/app.config.js` updated with the URL scheme `vesper`, the iOS bundle identifier `com.vesper.app`, the deployment target `iOS 17.2` (raised from 16.1 per H-10 decision; enables Live Activity Push Start without a degraded-fallback code path; 91.5% of iOS devices support 17.2+ as of April 2026 per iOScompatibility.com, sufficient coverage for indie launch),, the `expo-apple-authentication` plugin entry, and the `usesAppleSignIn: true` capability flag
- `apps/web/public/.well-known/apple-app-site-association.template.json` — the AASA template that will be hosted at the production domain at Cutover step C-23; the team ID and bundle ID placeholders will be replaced at Cutover
- App icon assets in `apps/mobile/assets/` (multi-size from the Layer 4 brand assets)
- Splash screen configuration in `app.config.js` referencing the cream-on-espresso splash design

**Implementation notes:** The deep link scheme is a workaround for development; in production, Universal Links (which require the AASA file hosted at the verified domain) provide a smoother UX because the OS opens the app without an intermediate "Open in Vesper?" prompt. The AASA file pre-authoring means that the only remaining work at Cutover is to host the file at the right path; the content is already correct. Secure storage on iOS uses the Keychain, which is encrypted at rest and survives app reinstalls (with a configurable accessibility option; the default `whenUnlocked` is appropriate for auth tokens). The Zustand auth slice hydrates from secure storage during the initial render, so the first frame may show a loading state; the auth gate in chat 013 reads from this slice and decides whether to render the auth flow or the main app. The native Apple Sign in dialog is materially better UX than the web redirect (no browser launch, biometric confirmation, no password entry), which is why iOS uses native and web uses the redirect flow. Apple returns the user's email and name only on the first authentication; the implementation must persist these to Supabase immediately because Apple will not return them again, and the `fullName` object can be null on subsequent sessions if the user revoked the data sharing.

Auth-event audit logging on mobile: every flow path (Google OAuth start, Google OAuth callback, native Apple Sign in start, native Apple Sign in callback, magic link request, magic link deep-link return, session restore from secure storage, sign-out) calls the internal auth-event endpoint (added in Chat 030's `onAuthStateChange`) which writes to `security_audit_log` with the same event_type taxonomy as Chat 010 plus mobile-specific variants {oauth_native_apple_signin_success, oauth_native_apple_signin_user_canceled, deep_link_callback_received, deep_link_callback_invalid, session_restored_from_secure_storage, secure_storage_read_failed}.

**Dependencies:** Chat 008 (auth middleware on web validates these tokens), chat 003 (architecture decisions doc includes the secure storage choice), Cutover step C-09 (Apple Sign in capability provisioned in the App ID). Parallel with chat 010.

**End-of-session checks:** A user can sign in via Google OAuth in the iOS Simulator. The session token persists across app cold starts (verified by killing and reopening the app). The AASA template renders correctly when manually inserting the team ID. The app icon and splash screen display correctly.

### Chat 012 — Web Shell with TanStack Query, Zustand, and Sentry

*Block 2 | 🔵*

**Load at session start:** TECHNICAL_SPEC.md §2 Stack and §10 Hosting (Vercel section); `docs/ARCHITECTURE_DECISIONS.md` (Zustand persistence, TanStack Query persistence, Sentry sampling decisions); `apps/web/` directory.

**Goal:** Build the application shell: the Next.js App Router structure with route groups for marketing, auth, and authenticated app surfaces; the middleware that enforces the auth gate by redirecting unauthenticated users; the TanStack Query provider with default options for retry and stale time; the Zustand stores for auth, plan, and UI slices (with the plan slice stubbed since the data shape doesn't exist yet); and Sentry initialization with the `beforeSend` PII scrub hook.

**Output:**
- `apps/web/app/(marketing)/layout.tsx` — marketing route group layout (no auth required)
- `apps/web/app/(auth)/layout.tsx` — auth route group layout
- `apps/web/app/(app)/layout.tsx` — authenticated app route group layout that requires a valid session
- `apps/web/middleware.ts` — Next.js middleware that intercepts requests to `(app)/*` paths, validates the session cookie, and redirects to `/sign-in` if absent
- `apps/web/app/providers.tsx` — wraps the app with TanStack Query provider and Zustand store provider; configures TanStack Query with `staleTime: 30_000`, `retry: 2`, `refetchOnWindowFocus: true`
- `apps/web/store/auth.ts` — auth slice
- `apps/web/store/plan.ts` — plan slice with `currentPlanDate`, `isStreamingPlan`, `optimisticBlockUpdates` (stubs; concrete shape filled in chat 039)
- `apps/web/store/ui.ts` — UI slice with toast queue, modal state, theme preference
- `apps/web/sentry.client.config.ts`, `apps/web/sentry.server.config.ts`, `apps/web/sentry.edge.config.ts` — Sentry initialization with `tracesSampleRate: 0` in dev, `1.0` in preview and production; `beforeSend` hook that scrubs known PII patterns from URLs, request bodies, and breadcrumbs (emails, tokens, phone numbers)

**Implementation notes:** The route group pattern in App Router is the cleanest way to apply layout-level concerns; `(app)/` routes never render without authentication because their layout enforces it via the middleware. The TanStack Query stale time of thirty seconds means that fresh navigation back to a screen reuses cached data without refetch for thirty seconds; this is appropriate for most surfaces and is overridden per-query where needed (the plan view will use a longer stale time). The Zustand stores follow the slice pattern where each slice is a separate hook; this keeps the surface narrow and prevents accidental cross-slice subscriptions. The Sentry PII scrub hook is critical because Sentry's default behavior captures everything in stack traces, including any URL parameters that might contain emails or session tokens; the hook removes anything matching known patterns before transmission.

**Dependencies:** Chat 010 (Supabase web client exists), chat 008 (auth middleware integrates).

**End-of-session checks:** A request to an `(app)/*` route without a session redirects to `/sign-in`. A request with a valid session renders the placeholder dashboard. TanStack Query's devtools open and show no errors. Zustand stores hydrate correctly. Sentry captures a deliberate test error in development without leaking PII. `pnpm build` clean.

### Chat 013 — Mobile Shell with TanStack Query, Zustand, and Sentry

*Block 2 | 🟢 | ⇄ 012*

**Load at session start:** TECHNICAL_SPEC.md §2 Stack (mobile dependencies table); `docs/ARCHITECTURE_DECISIONS.md`; `apps/mobile/` directory; LAYER_4_EXPERIENCE_IDENTITY.md (design tokens, spacing).

**Goal:** Build the mobile application shell: the Expo Router structure with auth-gated and tab navigation groups; the TanStack Query provider with `persistQueryClient` configured to persist plan queries to AsyncStorage so cold starts render immediately from cache; the Zustand stores (same shape as web); Sentry mobile initialization; iOS app group identifier and keychain access group configuration to enable Live Activity widget sharing later; and the application lifecycle hooks that refresh on foreground and clean up on background.

**Output:**
- `apps/mobile/app/_layout.tsx` — root layout with auth gate, providers, and lifecycle hooks
- `apps/mobile/app/(auth)/_layout.tsx` — auth route group layout
- `apps/mobile/app/(tabs)/_layout.tsx` — tab navigator with Plan, Tasks, Calendar, Settings tabs
- `apps/mobile/app/providers.tsx` — TanStack Query provider with `persistQueryClient` using AsyncStorage adapter; configured to persist queries matching `['plan', *]` and `['weeklyPriorities', *]`
- Mobile Zustand stores at `apps/mobile/store/` mirroring the web stores
- `apps/mobile/lib/sentry.ts` — Sentry initialization via `@sentry/react-native`; same sampling rates and PII scrub hook as web
- `apps/mobile/lib/api/client.ts` — the shared mobile fetch wrapper that automatically attaches the Supabase session token, handles 401 by clearing the session and routing to sign-in, and handles HTTP 426 by surfacing a full-screen non-dismissible modal "Vesper has updated. Update to continue." with a single button that deeplinks to the App Store at `itms-apps://apps.apple.com/app/id<APP_ID>`. The 426 handler exists because chat 008's `min-app-version` middleware returns 426 to clients running older versions than the server requires; without this client-side handling the user sees only an opaque error toast and tends to uninstall.
- `apps/mobile/app.config.js` updated with iOS `appGroup` (group identifier `group.com.vesper.app`) and `keychainAccessGroups` for shared Keychain between the app and the future Live Activity widget extension
- `apps/mobile/hooks/useAppLifecycle.ts` — hook that listens to AppState changes, invalidates plan queries on foreground, and triggers Realtime cleanup on background (Realtime client wired in chat 037)

**Implementation notes:** The TanStack Query persistence pattern means the plan view renders instantly on cold start with the last-known plan data, then refetches in the background; this is the difference between a snappy mobile experience and a sluggish one. The app group and keychain access group are configured now even though Live Activity isn't built until Block 10; configuring them later requires rebuilding the iOS project with prebuild, which is disruptive mid-build. The lifecycle hook centralizes the foreground/background patterns; subsequent chats subscribe to it rather than implementing their own listeners.

**Dependencies:** Chat 011 (mobile auth exists), chat 008. Parallel with chat 012.

**End-of-session checks:** The app launches in the iOS Simulator and renders the sign-in screen without an authenticated session. After signing in, the app navigates to the tab navigator and renders placeholder screens. Killing and reopening the app shows the previously authenticated state with the placeholder plan view rendered from persisted cache. Sentry captures a deliberate test error.

### Chat 014 — Security Headers and Content Security Policy for Web

*Block 2 | 🔵 | ⚠️*

**Load at session start:** `docs/ARCHITECTURE_DECISIONS.md` (CSP allowlist scope decision); OWASP Secure Headers reference; the actual list of third-party origins that need allowing (Sentry's ingest, PostHog's app and ingest hosts, Stripe Checkout redirect, Resend tracking pixels in emails).

**Goal:** Configure the full set of HTTP security headers on the Next.js web application so that XSS, clickjacking, and protocol downgrade attacks are mitigated at the platform level. The CSP is the most demanding header to author correctly because it must allow every legitimate third-party origin without leaving the application open to arbitrary script injection.

**Output:**
- `apps/web/next.config.js` updated with the `async headers()` configuration block emitting Content-Security-Policy, Strict-Transport-Security (with `max-age=31536000; includeSubDomains; preload`), X-Frame-Options (`DENY`), X-Content-Type-Options (`nosniff`), Referrer-Policy (`strict-origin-when-cross-origin`), and Permissions-Policy (denying camera, microphone, geolocation by default; geolocation re-enabled for the location capture flow only via the JS API which prompts the user)
- `docs/CSP_NOTES.md` — comprehensive documentation of every CSP directive value with the rationale for each allowed origin; documents the deliberate exclusion of `'unsafe-eval'` from `script-src` and the precompiled-shader strategy that makes this possible (Three.js shaders are precompiled at build time via a Vite/webpack plugin in chat 093, eliminating the runtime `eval` requirement)
- `apps/web/lib/csp/nonce.ts` — utility that generates a per-request nonce for inline scripts that cannot be moved to external files (Sentry tracker bootstrap is one such case); the nonce is embedded in the CSP header and in the inline script tag

**Implementation notes:** The production CSP omits `'unsafe-eval'` from `script-src` (this is Decision 13 from chat 001, made canonical here). The CSP is written in a single string with the directives listed: `default-src 'self'`, `script-src 'self' https://js.stripe.com https://app.posthog.com 'nonce-{NONCE}'`, `style-src 'self' 'unsafe-inline'` (Next.js requires unsafe-inline for its CSS-in-JS solution), `img-src 'self' data: blob:`, `font-src 'self' data:`, `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.posthog.com https://*.sentry.io https://api.stripe.com`, `frame-src 'self' https://js.stripe.com https://checkout.stripe.com`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self' https://checkout.stripe.com`. The deliberate omission of `'unsafe-eval'` is a hard requirement; this directive would broadly weaken XSS defense across the entire site, and any XSS finding could escalate to arbitrary script execution. Three.js compiles shaders via `eval` at runtime by default, so the precompiled-shader approach from chat 093 is the architectural workaround: shaders are extracted to GLSL files, compiled at build time via `vite-plugin-glsl`, and loaded as static assets. The HSTS preload entry should be added to the [HSTS preload list](https://hstspreload.org) only after the production domain has been live for at least a few weeks; the configuration enables HSTS but the preload submission is a manual cutover task.

**Dependencies:** Chat 012 (web shell exists).

**End-of-session checks:** The web application loads in a browser with no CSP violation reports in the console. A deliberate test of CSP enforcement (attempting to load a script from an unauthorized origin) produces a violation report. The site scores A on observatory.mozilla.org's HTTPS observatory.

### Chat 015 — Monorepo Build Verification Gate

*Block 2 | 🟡*

**Load at session start:** All `package.json` files; `pnpm-workspace.yaml`; `tsconfig.json` files; `.eslintrc.*` files.

**Goal:** Run `pnpm build` and `pnpm lint` from the repository root and resolve every error and warning that has accumulated through Block 1 and Block 2. From this chat onward, every subsequent chat ends with these same two commands passing, and that discipline is enforced by the CI gate from chat 002. This chat is the formal locking of that discipline.

**Output:** A clean `pnpm build` and `pnpm lint` from the repository root. Any cross-package type errors fixed. Any deprecation warnings addressed. The `CONTRIBUTING.md` updated to formally state the end-of-session check rule.

**Implementation notes:** It is normal for cross-package type errors to accumulate when many packages are being built in parallel. Common causes include circular imports between `@vesper/shared` and `@vesper/db` (resolved by moving the offending types to the lower-dependency package), missing exports from package barrels (resolved by adding to `src/index.ts`), and TypeScript path alias mismatches between `tsconfig.json` and `vitest.config.ts` (resolved by ensuring both reference the same paths).

**Dependencies:** Chats 004 through 014.

**End-of-session checks:** `pnpm build` from root completes with no errors. `pnpm lint` from root completes with no errors. Both commands run in under three minutes from a cold cache.

---

## Block 3 — AI Engine

Block 3 builds the AI layer of the application. The voice gate ships first because every subsequent chat that produces user-facing copy must pass through it. The Layer 1 system prompt is the highest-stakes single chat in Phase 4 because it determines plan quality. An evaluation harness is built so that prompt iteration is rubric-driven rather than vibes-driven. Hardcoded fallback templates are authored so the fallback chain has something to fall back to. The full plan synthesis function lands at the end of the block.

### Chat 016 — `@vesper/ai` Package Scaffold

*Block 3 | 🟡 🤖*

**Load at session start:** TECHNICAL_SPEC.md §5 AI Architecture (Model Selection, Prompt Constants and Versioning); LAYER_3_TECHNICAL_ARCHITECTURE.md (AI Architecture section); `packages/ai/` package root.

**Goal:** Author the `@vesper/ai` package structure with the Anthropic client wrappers (Haiku 4.5 and Sonnet 4.6), the Vercel AI SDK integration, the prompt versioning constants pattern, and the cost-tracking utility that logs token usage per call. The package after this chat is empty of business logic but provides the foundation for every AI operation that follows.

**Output:**
- `packages/ai/src/client.ts` — exports `createAnthropicClient()` that returns a Vercel AI SDK provider configured with the Anthropic SDK; environment-driven API key
- `packages/ai/src/models.ts` — exports `MODELS = { HAIKU: 'claude-haiku-4-5', SONNET: 'claude-sonnet-4-6' }` as the model identifier constants
- `packages/ai/src/cacheConfig.ts` — exports the cache TTL strategy per model and prompt type: both Sonnet daily plan synthesis (covered by chat 071's HTTP-triggered cache pre-warm for the morning-alarm cohort) and all Haiku operations (template selection, NL parsing, classification, check-in question generation) use the default 5-minute ephemeral cache TTL. The 1-hour extended TTL was considered for Haiku and rejected because Haiku call density per user per day is single-digit and spread across the day; the 1-hour TTL's 2× input-rate write cost (versus 1.25× for the 5-min TTL) is rarely earned back by reads within the hour, and the prior assumed "~30% net cost reduction" was not derived from any documented call-density model. The 5-minute default is the operative configuration per the project-wide operative principles
- `packages/ai/src/streamText.ts`, `packages/ai/src/generateText.ts`, `packages/ai/src/generateObject.ts` — thin wrappers around the Vercel AI SDK functions that integrate the voice gate (when chat 017 lands) and the cost tracker; the wrappers consult `cacheConfig.ts` to apply the correct TTL on each call
- `packages/ai/src/prompts/types.ts` — type definitions for the prompt versioning pattern: each prompt is a constant string plus a sibling version constant string in the format `v{N}-{YYYY}-{MM}-{DD}`
- `packages/ai/src/cost/tracker.ts` — exports `trackCost(model, inputTokens, outputTokens, cachedTokens?)` that logs to the completion_log table with `event_type='ai_call'` and a value JSONB containing the token counts and the calculated cost
- `packages/ai/src/index.ts` — package barrel exports
- `packages/ai/tsconfig.json` with proper path setup

**Implementation notes:** The Vercel AI SDK provides streaming, structured outputs via Zod schemas, and provider abstraction; the wrappers in this package extend it with the voice gate integration and cost tracking. The cost tracker writes to completion_log because that table is the canonical event log; an alternative would be Sentry as a custom event, but the database is more durable and queryable. The prompt versioning constants pattern means that every prompt change requires both the prompt string and the version string to be updated atomically; this is documented in the package README so the discipline is preserved. The Vercel AI SDK entrypoint convention is also documented as a decision in the package README: use `streamText` for streaming Sonnet (plan synthesis, where the SSE stream is piped to the client); use `generateObject` for Haiku structured-output operations (NL command parsing, calendar event classification, template selection, check-in question generation — anywhere the model must return JSON matching a Zod schema); use `generateText` for Sonnet freeform copy (the 3-regen empathetic prompt from chat 023 and any similar freeform-text generation). All three entrypoints apply the voice gate automatically via the wrappers per the source-aware sampling rules in chat 017.

**Dependencies:** Chat 015 (build gate; subsequent packages compile clean).

**End-of-session checks:** `pnpm test packages/ai` passes (with no tests yet, the suite is empty but the runner works). A trivial test call to Anthropic via the wrapper succeeds in development. `pnpm build` clean.

### Chat 017 — Butler Voice Gate

*Block 3 | 🟡 🤖 🎩 | ⚠️*

**Load at session start:** PRD §5 (Butler Voice Specification, full); LAYER_4_EXPERIENCE_IDENTITY.md (Voice rules); the Layer 4 line library; `packages/ai/` package.

**Goal:** Implement the two-layer butler voice gate that every user-facing copy must pass through before display. The regex layer catches prohibited characters and strings (em-dashes, exclamation points, emoji, "AI" and related self-references). The Haiku review layer reads any AI-generated string longer than thirty words and reviews it against the butler voice specification, returning either an approved version or a revision. This chat must complete and pass tests before any user-facing copy ships from any subsequent chat.

**Output:**
- `packages/ai/src/voiceGate.ts` — exports `voiceGate(text: string, options?: { allowAi?: false, source?: 'freeform' | 'constrained' }): Promise<string>` that runs the regex layer synchronously and then the Haiku review layer asynchronously when the text is in scope. The `source` parameter defaults to `'freeform'` when not provided so that callers who forget to specify get the safer (max-coverage) behavior on unknown surfaces; explicit `'constrained'` is required to opt into sampling. The `source` parameter governs sampling: `freeform` outputs (AI-generated copy that follows a loose prompt) trigger the Haiku review layer for every string longer than thirty words; `constrained` outputs (AI-generated copy where the source prompt strongly constrains tone and structure, such as block titles in the DailyPlan schema) trigger the Haiku review on a 20% sample. The sampling rate is configurable per source via the same module. This sampling exists because the voice gate's Haiku review at ~$0.001 per call across many calls per user per day represents a non-trivial portion of total AI cost; sampling on constrained outputs (where voice violations are rare by construction) captures the same quality signal at one-fifth the cost. Free-form outputs are never sampled because their voice risk is high. Degraded-mode behavior is also defined: when the chat 022 circuit breaker is open (Anthropic unreachable), the Haiku review layer is skipped entirely for freeform outputs and the function falls through to regex-only mode; this is documented in the voice gate module so that the degraded behavior is auditable and the regex layer is understood to be the floor of voice safety during Anthropic outages.
- `packages/ai/src/prompts/voiceGateReview.ts` — the Haiku prompt that instructs the model to review the input string against the butler voice specification and return either the original text (if compliant) or a revision (if not), in a structured JSON object with `{ compliant: boolean, revision?: string, issues?: string[] }`
- `packages/ai/src/voiceGate.regex.ts` — the regex catalog with each prohibited pattern, its detection regex, and an optional replacement (e.g., em-dash becomes period-space)
- Unit tests in `packages/ai/src/__tests__/voiceGate.test.ts` that cover every entry in the Layer 4 line library plus a battery of synthetic test cases including edge cases (the word "AI" appearing inside a legitimate word like "available" must not be flagged), plus tests verifying the sampling logic correctly invokes the Haiku review at the configured rate
- The wrappers from chat 016 (`streamText`, `generateText`, `generateObject`) updated to invoke `voiceGate` automatically on AI output, passing the appropriate `source` value based on which prompt produced the output (the prompt constant carries metadata indicating its constraint level)

**Implementation notes:** The regex layer must be careful with substring matching. The string "AI" must be matched as a word, not a substring; otherwise "available" gets flagged. The pattern `\bAI\b` with case-insensitive matching is appropriate; the same for "artificial intelligence" and "machine learning". Emoji detection uses the Unicode property `\p{Extended_Pictographic}` which catches all emoji code points reliably. The em-dash replacement is straightforward; the exclamation point replacement requires more care because "!" sometimes appears in valid text (e.g., a brand name); the policy is strict (no exceptions), with the replacement being a period. The Haiku review layer is non-negotiable for AI-generated strings because the regex layer cannot catch every voice violation; tone mismatches, validation-seeking behavior, and over-explanation are all violations that only a language model can detect reliably.

**Dependencies:** Chat 016 (Anthropic client and wrappers exist).

**End-of-session checks:** All unit tests pass. The voice gate applied to every line in the Layer 4 line library returns the line unchanged. The voice gate applied to deliberately violating strings ("Awesome!", "Wow — that's great", "Hey there 👋") returns approved revisions or throws. `pnpm test packages/ai` passes.

### Chat 018 — Hardcoded Archetype Fallback Plans

*Block 3 | 🟡 🤖 🎩*

**Load at session start:** PRD §6 (Module Specifications for each of the seven modules); LAYER_2_PRODUCT_SCOPE.md (Pillar 2 module list); the DailyPlan Zod schema (from chat 019; per Critical Path Block 3, this chat ships after 019 even though it's listed before in chat-number order — Critical Path order is canonical, not chat number; see the "How to Use This Document" section's note on Critical-Path-canonical ordering); the six archetype enum values.

**Goal:** Author six JSON files representing a hardcoded fallback day plan per archetype. These are used by the synthesizePlan fallback chain (step three) when both the primary Anthropic call and the simplified retry fail. Without these files, the fallback chain has nothing to serve and the user sees a blank plan view on their first day if AI is unavailable.

**Output:**
- `packages/ai/src/fallback/nine_to_five.json` — DailyPlan-shaped fallback for a generic nine-to-five professional
- `packages/ai/src/fallback/remote.json` — fallback for a remote worker
- `packages/ai/src/fallback/student.json` — fallback for a student
- `packages/ai/src/fallback/athlete.json` — fallback for an athlete-focused user
- `packages/ai/src/fallback/founder.json` — fallback for a founder
- `packages/ai/src/fallback/mixed.json` — fallback for the mixed archetype
- `packages/ai/src/fallback/index.ts` — exports `getFallbackPlan(archetype: ArchetypeEnum, planDate: Date): DailyPlan` that loads the appropriate file, sets the dates correctly (the JSON stores times as HH:MM strings; this function combines them with the requested plan date), and returns a valid DailyPlan object

**Implementation notes:** Each fallback plan contains roughly eight to twelve blocks representing a balanced day for the archetype: wake-up window, morning routine, focused work or class blocks, exercise block, meal blocks, and an evening wind-down. The block titles and any text fields are voice-gated at authoring time. The blocks reference generic title strings rather than template UUIDs (since templates are seeded in chat 048 and may not exist at the moment the fallback is served on a first-day failure). The block source is set to `ai_generated` so downstream code treats them identically to a real plan.

**Dependencies:** Chat 019 (DailyPlan Zod schema must exist for type validity), chat 017 (voice gate for copy authoring).

**End-of-session checks:** Each fallback JSON validates against the DailyPlan Zod schema. `getFallbackPlan` returns a valid plan for each archetype with the requested date applied correctly. The block titles pass the voice gate.

### Chat 019 — Layer 1 System Prompt and DailyPlan JSON Schema

*Block 3 | 🟡 🤖 🎩 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §5 (Prompt Structure and Caching, Layer 1 description); PRD §5 (full Butler Voice Specification); LAYER_4_EXPERIENCE_IDENTITY.md (Voice rules); LAYER_2_PRODUCT_SCOPE.md (the seven modules); the daily_plans and blocks Drizzle schemas.

**Goal:** Author the canonical system prompt for daily plan synthesis (the largest cache layer; changes only on prompt version updates) and the DailyPlan JSON schema (Zod) that the prompt instructs the model to output. This chat is the highest-impact single chat in Phase 4 because the plan quality the application produces is largely determined by the quality of this prompt. The chat does not ship the prompt without testing; it requires at least three test cycles against representative inputs before committing.

**Output:**
- `packages/ai/src/prompts/dailyPlanSynthesis.ts` — exports `DAILY_PLAN_SYNTHESIS_PROMPT` (the full system prompt as a multi-paragraph string) and `DAILY_PLAN_SYNTHESIS_VERSION` (e.g., `'v1-2026-XX-XX'`). The prompt is authored with caveman-style compression applied to the production version while preserving the butler voice specification fidelity (the verbose reference version lives in a sibling file `dailyPlanSynthesis.reference.ts` for human review, but the production constant is the compressed form). Target compression: roughly half the token count of an uncompressed equivalent without quality regression, verified through the eval harness from chat 020.
- `packages/shared/src/schemas/dailyPlan.ts` — exports `DailyPlanSchema` (Zod) describing the output structure: a `blocks` array where each block has `startTime` (HH:MM string for the day), `endTime`, `blockType`, `title`, `details` (discriminated by blockType), `source` ('ai_generated' always for this output), `displayOrder`. The schema deliberately omits any `rationale` or `notes` field per block (users do not see them; storing them is waste); the schema is audited during this chat to remove any redundant or unused fields that would inflate output tokens.
- Inline documentation in the prompt file explaining each section of the prompt and why it is shaped that way; this is the prompt's commentary track

**Implementation notes:** Explicit token budget for the synthesisPlan call (locked here so cost projections in LAYER_5, SCALING_THRESHOLDS, and Chat 097a remain rederivable): Layer 1 system prompt target ≤ 5K input tokens; Layer 2 (user context) + Layer 3 (template subset) + Layer 4 (today's specifics) combined target ≤ 5K input tokens; output target ≤ 2K tokens. Total: 10K input + 2K output per cold-cache call. These targets feed the cold-cache cost calculation of $0.060/plan (`10K/1M × $3 + 2K/1M × $15 = $0.030 + $0.030 = $0.060`) and the warm-cache equivalent of ~$0.036/plan (9K of the 10K input is cache-shared at 0.1× input rate, 1K fresh, 2K output: `9K/1M × $3 × 0.1 + 1K/1M × $3 + 2K/1M × $15 = $0.0027 + $0.003 + $0.030 = $0.0357 ≈ $0.036`). If a prompt iteration exceeds these targets, the eval harness's p95 latency criterion (< 12 seconds) plus the LAYER_5 cost projections must be revisited.

The prompt is structured in distinct sections in this order: a one-sentence role establishment ("You are a calm, butler-tone life planner..."), the voice rules (briefly restated), the output instructions ("Respond only with valid JSON matching this schema. No prose. No backticks."), the schema description (a TypeScript-style interface for clarity), examples of well-formed output for one archetype, and edge case handling ("If the user has explicitly fixed events that occupy the entire day, return an empty blocks array with a `note` field explaining this. If energy is below three, prefer recovery-oriented blocks. If energy is above seven, allow more demanding blocks. Always include a brief breakfast block if the wake time is before nine AM. Always end the day with a wind-down block before bedtime_target."). The prompt is written with the assumption that Layer 2 (user context), Layer 3 (template subset), and Layer 4 (today's specifics) will be appended by the caller; the prompt itself is generic across all users. The prompt does not include any examples of bad output (per the voice rules, the model should never see what we don't want it to do); it includes only good examples. After authoring, the prompt is tested by manually running it against three representative user profiles (a nine-to-five professional with three meetings, a student with classes and a gym goal, a founder with no fixed events and three tasks) and reviewing the output for voice compliance, block coherence, and schema validity. Iteration continues until the output is consistently good across all three profiles.

**Dependencies:** Chat 017 (voice gate; the prompt itself is reviewed for voice compliance), chat 016 (AI scaffold).

**End-of-session checks:** Manual test against three representative inputs produces high-quality plans with correct voice. The output validates against the DailyPlanSchema. The prompt file commits with the version constant.

### Chat 020 — AI Evaluation Harness

*Block 3 | 🟡 🤖*

**Load at session start:** Chat 019 (prompt and schema); the six archetype enum values; representative user profile structures from PRD §6 (modules) and Tech Spec §3.2 (base_profile shape).

**Goal:** Build the evaluation harness so that future prompt iterations are rubric-driven rather than vibes-driven. The harness is a CLI tool that runs the daily plan synthesis prompt against a fixture set of user profiles and outputs the resulting plans for human review. This harness will be re-run whenever the prompt is updated (in chat 019 iterations, in chat 049 fitness adaptation, in chat 058 weekly synthesis, and any post-launch prompt changes).

**Output:**
- `packages/ai/eval/fixtures/` directory with ten JSON files, one per fixture user profile spanning all six archetypes and various edge cases (high energy, low energy, sparse calendar, dense calendar, every module enabled, only work and sleep modules enabled, etc.)
- `packages/ai/eval/runPlanEval.ts` — the CLI script that loads each fixture, builds the plan context, calls `synthesizePlan` (stub-callable until chat 022), and writes the output plans to `packages/ai/eval/output/{timestamp}/`
- `packages/ai/eval/SCORING_RUBRIC.md` — the scoring rubric document with criteria for voice adherence, block coherence (do block types make sense given the archetype?), archetype fit, schema validity, and edge case handling; each criterion is scored zero through three with explicit examples
- `packages/ai/eval/PASS_BAR.md` — the quantitative pass bar that any prompt version must meet before shipping: (a) 100% structural validity across all ten fixtures (every output parses against DailyPlanSchema), (b) zero voice-gate regex violations, (c) mean rubric score of 4.0 or higher out of 5.0 on a manual 20-sample review per prompt version, (d) p95 plan-generation latency under 12 seconds end-to-end. A prompt version that fails any criterion is not shipped; the eval harness reports each criterion's status at the end of each run.
- `packages/ai/eval/stopSlopComparison.ts` — an A/B comparison harness that runs the same fixture set against two prompt variants (canonical vs stop-slop-constrained) and reports the token-count difference and the rubric-score difference. As a baseline step before any A/B run, the harness runs the v1 prompt against the ten fixtures and records the average output token count per fixture and the suite-wide average in `packages/ai/eval/output/baseline.json`; subsequent compression iterations target a 30–50% reduction from this measured baseline rather than the prior "roughly half the token count of an uncompressed equivalent" heuristic. The stop-slop variant adds output instructions to the synthesis prompt ("Block titles ≤6 words. Omit filler phrases. Prefer noun phrases over sentences."); the comparison determines whether the constrained variant achieves token reduction within the 30–50% target band without quality regression. If the A/B comes back voice-safe and rubric-neutral and hits the band, the stop-slop variant becomes the production prompt.
- `package.json` script `eval:plan` that runs the evaluator and `eval:slop` that runs the A/B comparison

**Implementation notes:** The fixtures should span the full space of realistic inputs. Two should be at the energy extremes (one with energyScore 2, one with energyScore 9). One should have a calendar that is nearly full (six fixed events). One should have an empty calendar. One should have all seven modules enabled with realistic preferences. One should have only work and sleep enabled. The output directory uses a timestamp suffix so that historical runs are preserved for comparison; this makes it easy to verify that a prompt change improves quality across the suite rather than just on the cases that motivated the change. The scoring rubric is human-applied because automating the scoring would itself require a large prompt that's potentially as fragile as the prompt under test.

**Dependencies:** Chat 019 (prompt exists), chat 022 (synthesizePlan stub callable; if 022 not ready, the harness can be wired to call the prompt directly).

**End-of-session checks:** `pnpm eval:plan` runs to completion and produces ten output plans. Each plan validates against the schema. Manual scoring against the rubric produces a baseline score for the v1 prompt.

### Chat 021 — Context Builders and Cache Wiring

*Block 3 | 🟡 🤖*

**Load at session start:** TECHNICAL_SPEC.md §5 (Prompt Structure and Caching, full); the users table schema; the user_profiles table schema; the workout_templates and recipe_templates schemas.

**Goal:** Author the three context-building functions that assemble the prompt layers for the AI call. `buildUserContext` produces the Layer 2 content (user base profile, archetype, modules enabled, location, timezone). `buildTemplateSubset` produces the Layer 3 content (a pre-filtered subset of workouts and recipes relevant to the user; this is stubbed with empty arrays until chat 048 lands real templates). `buildPlanContext` assembles all four layers into the final message structure with appropriate cache_control markers on the cacheable layers.

**Output:**
- `packages/ai/src/context/userContext.ts` — `buildUserContext(userId: string): Promise<UserContext>` returns a JSON-serializable object with archetype, timezone, location_lat, location_lng, base_profile, modules_enabled; queries the users and user_profiles tables via the Drizzle client
- `packages/ai/src/context/templateSubset.ts` — `buildTemplateSubset(modulesEnabled): Promise<TemplateSubset>` filters workouts to at most ten matching the user's fitness goal, equipment, and level; filters recipes to at most fifteen matching diet_tags and cooking_time_max; returns empty arrays if templates have not been seeded yet (stub behavior)
- `packages/ai/src/context/planContext.ts` — `buildPlanContext(userId, planDate, energyScore, calendarEvents, pendingTasks): Promise<PlanContext>` assembles all four layers into a message array with Layer 1 as system message (with cache_control), Layer 2 as user message part (with cache_control), Layer 3 as user message part (with cache_control), Layer 4 as user message part (no cache); ready for direct submission to the AI SDK
- `packages/ai/src/context/cacheObservability.ts` — utility that logs cache hit/miss to Sentry breadcrumbs and to completion_log; useful for diagnosing why the cache pre-warm worker is or isn't producing hits

**Implementation notes:** The cache_control marker is the Anthropic SDK's way of indicating ephemeral cache scope; the marker is placed at the end of each cacheable layer. The Layer 1 cache is the largest and most stable; the Layer 2 cache is per-user and changes weekly at most; the Layer 3 cache is per-user-configuration and changes when the user toggles a module or updates a preference. Layer 4 is small and changes daily, so caching it provides little benefit. The template subset stub returning empty arrays is intentional; the AI prompt is robust to empty template lists (the model will improvise without templates), and chat 048 wires the real implementation. The observability utility is a small but important deliverable because debugging cache miss issues without it is extremely difficult.

**Dependencies:** Chat 019 (prompt exists), chat 007 (Drizzle client and withUserFilter wrapper), chat 006 (user_profiles JSONB Zod schemas for parsing base_profile and modules_enabled).

**End-of-session checks:** A manual call to `buildPlanContext` for a test user returns a well-formed message array with cache_control markers in the correct positions. The empty template stub does not break the prompt. The Zod schemas validate the returned context objects.

### Chat 022 — synthesizePlan and Fallback Chain

*Block 3 | 🟡 🤖 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §5 (Fallback Handling, Cost Estimate); chat 019 prompt; chat 021 context builders; chat 018 fallback plans; chat 020 eval harness.

**Goal:** Implement the primary plan synthesis function with the full three-step fallback chain. Step one is the canonical streaming Sonnet call. Step two is a retry after 1.5 seconds with a simplified prompt (Layer 3 reduced to five workouts and five recipes; Layer 4 reduced to date and energy only). Step three is to serve the most recent prior plan or, if none exists, the hardcoded archetype fallback from chat 018. Every failure logs to completion_log with the failure reason. The fallback's apology line passes through the voice gate.

**Output:**
- `packages/ai/src/synthesizePlan.ts` — exports `synthesizePlan(userId, planDate, energyScore, options?: { signal?: AbortSignal }): AsyncIterable<DailyPlanChunk>` that yields partial plan chunks as the SSE stream arrives and returns the final plan on completion; internally orchestrates the three-step fallback chain. The `signal` parameter wires AbortController cancellation end-to-end: when the calling API route detects that the client SSE connection has closed, it aborts the signal, which propagates through the Anthropic SDK and stops the upstream generation; output tokens stop billing immediately rather than continuing to generate after the user closed the app.
- `packages/ai/src/synthesizePlan.fallback.ts` — the fallback orchestration logic, separated for testability
- `packages/ai/src/synthesizePlan.simplifiedContext.ts` — the simplified context builder used by fallback step two
- `packages/ai/src/synthesizePlan.circuitBreaker.ts` — a per-user circuit-breaker utility that tracks recent synthesis failures keyed by user_id (stored in Upstash Redis with a 5-minute sliding window per user). When a single user's failure count crosses three within five minutes, that user's circuit opens and their subsequent calls skip steps one and two of the fallback chain and go directly to step three (cached or hardcoded fallback). The breaker auto-closes after five minutes of no new failures for that user. The per-user (rather than global) scope means one bad user's input pattern or one failing OAuth-dependent path does not cause every active user to be degraded to fallback simultaneously; global Anthropic outages still surface via the per-user breakers opening in aggregate. While any user's breaker is open, the global degraded-mode banner from chat 099 is shown to that user (and only to that user). This prevents thundering-herd retries during Anthropic outages from amplifying spend and worsening user latency without painting all users with the same brush.
- Unit tests covering each of the three fallback steps with mocked Anthropic responses, plus circuit-breaker open/close transitions and abort-signal propagation
- `packages/ai/src/synthesizePlan.observability.ts` — emits a structured log entry to completion_log (or a new ai_call_log table) for every synthesizePlan call (success or failure) capturing: user_id, plan_date, prompt_version (from `DAILY_PLAN_SYNTHESIS_VERSION`), model (`claude-sonnet-4-6`), cache_hit (boolean, from chat 021's cacheObservability), input_token_count, output_token_count, latency_ms, fallback_step (1 if step one succeeded, 2 if step two succeeded, 3 if hardcoded fallback), error_code (if any). Without this, post-launch debugging "why did this plan generation take 15 seconds" or "why did the AI bill double this week" is much harder.
- After the implementation, run the eval harness from chat 020 against the full synthesizePlan (not just the prompt) to verify integration and confirm the chat 020 pass bar holds
- `apps/web/app/api/v1/health/circuit-breaker/route.ts` — GET handler that returns the per-user circuit-breaker state for the authenticated user as JSON `{ open: boolean, opensAt?: string, closesAt?: string }`. Used by Chat 099's DegradedModeBanner to surface degraded mode to the user when the per-user Anthropic circuit breaker is open. Auth required; the endpoint reads only the current user's breaker state from Upstash (no admin/system-wide query path).

**Implementation notes:** The streaming behavior is critical to UX (the user sees the plan render block by block as the model generates) and to keeping the function within Vercel's serverless timeout. The Vercel AI SDK's `streamText` returns a stream that the caller can pipe into an HTTP response; the synthesizePlan function exposes this as an async iterable for caller flexibility. The fallback chain is non-trivial: step one's failure modes include network timeout (caught by AbortController with a fifteen-second timeout), rate limit 429 (parsed and respected), API error 5xx (logged and retry), and malformed response (Zod validation failure on the final chunk). Each failure type is logged with its specific cause. The apology line for the fallback is a static voice-gated string and is prepended to the plan's metadata so the UI can surface it. Buffer-then-commit semantics are explicit: chunks are accumulated in an in-memory buffer keyed by the request's idempotency lock. On AbortController fire (client disconnect, timeout), the buffer is discarded, the idempotency lock from chat 025 is released, and no partial plan is ever written to the database — the next user retry starts clean rather than colliding with orphan state. The Postgres transaction opens only at stream-end, after Zod validation of the assembled plan succeeds; the transaction writes the plan row and all child block rows atomically and commits in roughly 50-200ms. After the implementation, the eval harness is re-run; the expectation is that step one succeeds for all ten fixtures, and the resulting plans match or improve on the chat 019 prompt-only baseline.

**Dependencies:** Chats 017, 018, 019, 020, 021.

**End-of-session checks:** All unit tests pass. Eval harness produces plans at or above the v1 prompt baseline. A deliberate test of fallback step three (mock both Anthropic calls to fail) returns a hardcoded archetype plan with the apology line in metadata. `pnpm test packages/ai` passes.

### Chat 023 — Other AI Operation Scaffolds

*Block 3 | 🟡 🤖 🎩*

**Load at session start:** TECHNICAL_SPEC.md §5 (Model Selection, all Haiku operations described); chat 017 voice gate; chat 016 wrappers.

**Goal:** Author the remaining AI operation functions that will be wired into specific features in later chats. Each function is implemented with its prompt, its versioning constant, its return type schema (via Zod), and its tests. The functions are not invoked anywhere yet; they are scaffolded for chats 029, 049, 050, 064, 067, and 100 to call.

**Output:**
- `packages/ai/src/parsePlanEditCommand.ts` — Haiku call that translates natural-language input ("move gym to 7pm") into a structured `PlanEditCommand` object with discriminated `type` field (reschedule_block, complete_block, skip_block, add_block, remove_block, regenerate_plan, unknown) and the corresponding payload. The implementation guarantees no raw user input is persisted: only the parsed structural command is forwarded; if telemetry needs to dedupe similar phrasings, a SHA-256 hash of the user input is what gets logged, never the input itself.
- `packages/ai/src/selectWorkoutTemplate.ts` — Haiku call that takes user fitness preferences and energy score, returns a workout template UUID from a candidate set passed in; falls back to the lowest-rest-required candidate if the AI returns nothing useful
- `packages/ai/src/selectRecipeTemplate.ts` — Haiku call equivalent for recipe selection
- `packages/ai/src/classifyCalendarEvent.ts` — Haiku call that takes a Google Calendar event summary and returns a `block_type_enum` value (or `null` if no good classification)
- `packages/ai/src/classifyCalendarEventsBatch.ts` — Haiku call that takes an array of calendar event summaries and returns an array of classifications in a single API call. The classification step in chat 064 calls this batched form whenever more than one event needs classification (which is the common case at morning sync), saving roughly 30% of Haiku spend by amortizing the system prompt and cache write across the batch.
- `packages/ai/src/generateCheckInQuestion.ts` — Haiku call that produces one or two short morning check-in questions based on recent context
- `packages/ai/src/suggestWeeklyPriorities.ts` — Haiku call consumed by chat 057's weekly-planning step 2; takes the user's outstanding tasks plus the prior week's completion data and returns 3–5 suggested priority strings; the structured-output schema is `{ suggestions: string[] }` with 3 ≤ length ≤ 5 enforced
- `packages/ai/src/generateRegenerationPrompt.ts` — Sonnet call that produces the empathetic "what's not working?" prompt after three failed regenerations
- `packages/ai/src/prompts/` files for each of the above with their version constants
- Tests with mocked responses for each function, including a test for the batched classifier that verifies the array form returns the same per-event classifications as N individual calls

**Implementation notes:** Each function follows the same pattern: define the prompt as a constant, define the version, define the return type schema, call `generateObject` (Haiku) or `generateText` (Sonnet, for the regeneration prompt which is freeform copy), pass through the voice gate. The voice gate is invoked on the freeform copy outputs but not on the structured outputs (the schema validation is sufficient because structured outputs are not displayed verbatim to the user). The natural-language command parser is the most complex of these because its return type is a discriminated union; the prompt must instruct the model carefully to choose the right type and populate only the relevant fields.

**Dependencies:** Chats 016, 017.

**End-of-session checks:** All unit tests pass. Each function called with a representative input via the CLI returns a well-formed output. The voice gate is invoked where appropriate.

---

## Block 4 — Core API Routes

Block 4 implements the API surface that authenticated clients call. The routes use the foundation pattern from chat 008 and the rate limiting from chat 009. The plan generation route is the highest-stakes because of its streaming behavior, idempotency requirements, and cost-protection rate limit. The block update route encodes the optimistic concurrency check that resolves Tech Spec Open Question 2.

### Chat 024 — Profile and Energy APIs

*Block 4 | 🔵*

**Load at session start:** TECHNICAL_SPEC.md §9 (Profile section, Energy section); chat 008 API foundation; the users and user_profiles Drizzle schemas; the base_profile and modules_enabled Zod schemas.

**Goal:** Implement the profile read and write API routes plus the energy logging route. Profile writes enforce the base_profile_version increment invariant. The modules toggle convenience endpoint mutates the modulesEnabled JSONB atomically. The energy log endpoint writes to completion_log with the energy_logged event type and does not trigger plan generation.

**Output:**
- `apps/web/app/api/v1/profile/route.ts` — GET and PUT handlers using `createRoute` from chat 008
- `apps/web/app/api/v1/profile/modules/[moduleId]/route.ts` — PATCH handler for the convenience module toggle
- `apps/web/app/api/v1/energy/route.ts` — POST handler
- Request body Zod schemas in `apps/web/app/api/v1/profile/schemas.ts`
- Response shape types matching Tech Spec §9
- Integration tests using the test database from chat 002

**Implementation notes:** The PUT /profile handler must increment base_profile_version every time base_profile changes; this is enforced in the handler rather than at the database level because it is a logically simple invariant. The PATCH module toggle reads the current modulesEnabled JSONB, mutates the specified module key, and writes back atomically; the increment to base_profile_version also happens here because module configuration changes affect plan generation cache. The energy POST writes to completion_log only; plan generation is a separate route (chat 025). The Zod schemas for request bodies are co-located with the routes for ease of maintenance.

**Dependencies:** Chats 008, 009, 007, 006.

**End-of-session checks:** Integration tests pass for all three routes. Manual testing via curl with a real auth token produces the expected responses. base_profile_version increments correctly on every PUT.

### Chat 025 — Plan Generation API with Streaming and Idempotency

*Block 4 | 🔵 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §9 (Plans section, POST /plans/generate); chat 022 synthesizePlan; chat 009 rate limiting; `apps/web/app/api/v1/plans/` directory.

**Goal:** Implement the plan generation streaming endpoint with all the cross-cutting concerns: heartbeat-extended idempotency locking to prevent concurrent generation for the same (user_id, plan_date), per-user rate limiting that distinguishes trial-state from active-state users (two generations per day during trial, five per hour for active subscribers), buffer-then-commit atomic writing of the plan and its blocks on stream completion (the database transaction is opened only at stream-end rather than held open across the entire generation), regeneration_count increment when a plan already exists, fallback handling when the AI fails, AbortController propagation when the client disconnects mid-stream, and completion_log writes for analytics.

**Output:**
- `apps/web/app/api/v1/plans/generate/route.ts` — POST handler that returns a streaming `text/event-stream` response; orchestrates synthesizePlan, the heartbeat idempotency lock, the buffer-then-commit atomic write, the AbortController wiring, and the analytics logging
- `apps/web/lib/idempotency.ts` — utility for the (user_id, plan_date) lock using Upstash Redis with a 300-second initial TTL plus a heartbeat that extends the TTL by 60 seconds every 30 seconds while the stream is active; on stream end (success or error), the lock is explicitly deleted; on crash, the TTL expires naturally within 5 minutes. If a lock is already held when a request arrives, the client receives a 409 with the message "A plan is being generated for this date; try again in a moment."
- `apps/web/lib/regenerationLimits.ts` — utility that enforces the trial-vs-paid regeneration cap: trial users (subscription_status='trial') are capped at 2 plan generations per local day (queried via completion_log for `event_type IN ('plan_generated', 'plan_regenerated')` rows with `created_at >= start_of_local_day(user.timezone)` — using the Postgres function added in chat 004 so the day boundary is computed in the database and is DST-correct); active subscribers are capped at 5 per rolling hour via the Upstash token bucket from chat 009. The two paths are mutually exclusive on each request: the handler reads `subscription_status` once at request entry and routes to exactly one of the two paths, never both, so the trial completion_log count and the active token bucket never compose. The cap exists during trial to protect margin on non-converting users without degrading core experience; the limit is well above typical use (most users generate at most once a day) but blocks regen-abuse patterns.

**Implementation notes:** Streaming responses on Vercel are supported when the runtime is set to Node and the response is constructed via the Web Streams API; the Vercel AI SDK abstracts this for AI streams specifically. The buffer-then-commit pattern is the architectural fix to a subtle resource-exhaustion bug: holding a Postgres transaction open across an 8-15 second AI stream consumes one of the limited Supavisor transaction-mode connection slots for the entire stream duration; at 15 concurrent users with a 15-slot free-tier cap, the connection pool is exhausted and unrelated API routes return 503. The correct pattern is: stream Anthropic chunks to the SSE client immediately for UX, accumulate the complete plan in worker memory, open the database transaction at stream completion, write plan plus blocks atomically, commit, close. The transaction holds for ~50-200ms instead of ~10 seconds. The heartbeat idempotency lock prevents the double-tap race; without heartbeat, the 60-second initial TTL would expire mid-stream on slow generations (Anthropic p99 latency can exceed 60s under load), the lock would release prematurely, and a second client request could initiate a parallel generation that conflicts at commit time. The AbortController wiring propagates client disconnection upstream: when the SSE connection closes (client navigation, app backgrounding, network drop), the route's request handler receives an abort signal, which forwards into the synthesizePlan call's `signal` option from chat 022, which forwards into the Anthropic SDK, which closes the upstream stream and stops billing output tokens.

**Dependencies:** Chats 008, 009, 022, 024.

**End-of-session checks:** A streaming request from a real test client produces SSE chunks as the plan generates. A second request fired immediately (before the first completes) receives the 409 conflict response. The plan_generated event appears in completion_log. The trial regeneration cap blocks the third generation in a single local day for a trial user. The active-subscriber rate limit kicks in on the sixth request within an hour. A deliberate client disconnect during stream verifies the upstream abort fires (Anthropic logs show the stream terminated).

### Chat 026 — Plan Retrieval APIs

*Block 4 | 🔵 | ⇄ 025*

**Load at session start:** TECHNICAL_SPEC.md §9 (Plans section, GET endpoints); the day rollover decision (midnight in user's timezone per architecture decisions).

**Goal:** Implement GET /plans/today and GET /plans/date/:date. The "today" endpoint computes the current local date based on the authenticated user's timezone and serves the plan for that date; the date-specific endpoint serves any historical or future plan if one exists. Both return 404 if no plan exists for the requested date.

**Output:**
- `apps/web/app/api/v1/plans/today/route.ts` — GET handler that computes the user's local date and queries the database
- `apps/web/app/api/v1/plans/date/[date]/route.ts` — GET handler with date validation (must be YYYY-MM-DD format)
- `apps/web/lib/dates/localDate.ts` — utility that takes a user's timezone (IANA string) and the current server timestamp, returns the user's current local date in YYYY-MM-DD format; handles DST transitions correctly using the `Intl.DateTimeFormat` API or the `date-fns-tz` library

**Implementation notes:** The day rollover logic is subtle. If the user is in `America/Los_Angeles` and the current UTC time is 06:00 on January 2nd, the user's local date is 22:00 on January 1st, so "today" is January 1st. The IANA timezone identifier accommodates DST automatically. The handler queries the daily_plans table by (user_id, plan_date) and joins blocks; the response shape matches Tech Spec §9 exactly. The withUserFilter wrapper from chat 007 ensures the query is properly scoped.

**Dependencies:** Chats 008, 024 (profile route exists; user data is queryable). Parallel with chat 025.

**End-of-session checks:** Integration tests pass for both endpoints. The local date computation handles a representative DST transition correctly. 404 returns when no plan exists; 200 returns with the full plan shape when one does.

### Chat 027 — Block APIs with Optimistic Concurrency and In-Progress Transition

*Block 4 | 🔵 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §9 (Blocks section); TECHNICAL_SPEC.md §14 (Open Question 2 about displayOrder concurrency); the blocks table schema.

**Goal:** Implement PATCH /blocks/:blockId with single-field updates (status, time, displayOrder), the plan-level updated_at optimistic concurrency check applied to every mutation (not only displayOrder), and the in_progress auto-transition computed at read time in the API layer rather than via a database trigger. Also implement POST /blocks for user-added blocks.

**Output:**
- `apps/web/app/api/v1/blocks/[blockId]/route.ts` — PATCH handler with the optimistic concurrency check that fires on every block mutation
- `apps/web/app/api/v1/blocks/route.ts` — POST handler for user-added blocks
- `apps/web/lib/blocks/effectiveStatus.ts` — utility used by GET /plans/today (chat 026) and GET /blocks/:id serializers that computes the displayed status: `effective_status = (status === 'scheduled' && start_time !== null && end_time !== null && end_time > start_time && now >= start_time && now < end_time) ? 'in_progress' : status`. The null-and-ordering guards exist because user-added blocks may legitimately omit times, and synthesis-generated blocks always have non-null end_time > start_time but the read-time computation does not trust the invariant. Blocks never cross local midnight: the synthesis prompt is instructed to split any spanning interval at the day boundary, so the `now >= start_time && now < end_time` comparison can safely use a single day's clock without wraparound handling. The database stores the authoritative status (one of scheduled, complete, skipped, rescheduled); the in_progress visual state is derived at read time, eliminating the need for a database trigger that would otherwise need to fire on SELECT (which Postgres does not support) or on every mutation that touches the table.
- Request body Zod schemas

**Implementation notes:** The optimistic concurrency check works as follows. The client always sends the plan's `updated_at` timestamp it last saw, in every block mutation request (not only reorder). The PATCH handler reads the current plan's `updated_at` in the same transaction as the block update; if they differ, the request is rejected with 409 Optimistic Lock Failure. The client refreshes its view and retries via the conflict-toast flow in chat 038. Expanding the check to all mutations (not only displayOrder per Tech Spec §14 Open Question 2's narrow framing) prevents a different race where two devices simultaneously mutate the same block (one marks complete, one reschedules) and the second mutation overwrites the first with no toast. The in_progress derivation at read time was selected over a database trigger because the natural trigger condition (status='scheduled' AND start_time <= now AND end_time > now) cannot be expressed as a Postgres trigger on SELECT (no such hook exists), and an UPDATE-only trigger fires too late (the next mutation may be hours after the actual transition). Computing in the API layer is simpler, has no migration overhead, and produces the correct effective status on every read. The POST handler for user-added blocks requires the plan to exist; if not, it returns 400 with an error indicating that the plan must be generated first. Interaction with chat 029's batch reorder endpoint: both endpoints share the `daily_plans.updated_at` OCC check (advanced by the child-block trigger from chat 004); concurrent batch reorders from the same device are serialized by the per-user mutation queue on the client, so the in-flight ordering is preserved; if two batch reorders nonetheless arrive at the server (multi-device), last write wins on `displayOrder` because each commit advances `daily_plans.updated_at` and any later request whose claimed `updated_at` is stale receives a single 409. Mark the interaction in this chat's notes so the reorder endpoint chat does not re-invent the OCC plumbing.

**Dependencies:** Chats 008, 026.

**End-of-session checks:** Integration tests pass including a deliberate optimistic lock failure scenario on a status update (not only reorder). The effective_status computation returns 'in_progress' for a block whose start_time is in the past and end_time is in the future. POST /blocks validates against the schema and rejects requests for non-existent plans.

### Chat 028 — Task APIs

*Block 4 | 🔵 | ⇄ 027*

**Load at session start:** TECHNICAL_SPEC.md §9 (Tasks section); the tasks table schema; PRD §6.1 (Work and Tasks module spec).

**Goal:** Implement GET /tasks (with optional status filter), POST /tasks, PATCH /tasks/:taskId (with status, title, estimatedMinutes, deadline, priority all optional), and DELETE /tasks/:taskId. Order results by priority descending and deadline ascending. Validate that estimatedMinutes is positive and that the deadline is in the future on creation.

**Output:**
- `apps/web/app/api/v1/tasks/route.ts` — GET and POST handlers
- `apps/web/app/api/v1/tasks/[taskId]/route.ts` — PATCH and DELETE handlers
- Request body Zod schemas

**Implementation notes:** Tasks are not paginated at V1 because user task backlogs are bounded (the user manages their own list). Sorting by priority descending requires mapping the enum to a numeric order (high=3, medium=2, low=1) since the enum's text comparison is not what we want. The deadline validation on creation is a soft check (rejection at creation); deadline mutation on PATCH does not re-validate (users can move deadlines into the past if needed for archival purposes). The DELETE is a hard delete; there is no soft-delete pattern on tasks per Tech Spec.

**Dependencies:** Chats 008, 024.

**End-of-session checks:** Integration tests pass. The sort order is correct (high-priority then earliest-deadline). Validation rejects invalid bodies.

### Chat 029 — Natural Language Command and Weekly Priorities APIs

*Block 4 | 🔵 🤖 🎩*

**Load at session start:** TECHNICAL_SPEC.md §9 (AI Commands, Weekly Priorities); chat 023 (parsePlanEditCommand); the weekly_priorities table schema.

**Goal:** Implement POST /ai/command which parses a natural-language string into a structured PlanEditCommand and returns it (the client applies the edit via the other APIs). Implement GET and PUT /weekly-priorities with array length validation (between three and five priorities required). For unknown commands, return a butler-tone clarification line that has passed through the voice gate.

**Output:**
- `apps/web/app/api/v1/ai/command/route.ts` — POST handler invoking parsePlanEditCommand
- `apps/web/app/api/v1/weekly-priorities/route.ts` — GET and PUT handlers
- `apps/web/app/api/v1/plans/[date]/reorder/route.ts` — POST handler that accepts `{ blocks: [{ id, displayOrder }], planUpdatedAt }` and applies all displayOrder updates atomically within a single transaction with the optimistic concurrency check from chat 027. This batch endpoint exists because the drag-and-drop reorder UX in chat 043 needs to apply N displayOrder updates atomically; issuing N parallel PATCH /blocks calls produces partial-failure states when a 409 fires on some blocks but not others. The batch endpoint either commits all updates or rejects the entire reorder with one 409.
- Request body Zod schemas

**Implementation notes:** The AI command route returns the structured edit operation; the application of that operation is the client's responsibility (the client then calls PATCH /blocks or POST /blocks or POST /plans/generate or the batch reorder endpoint as appropriate). This separation keeps the AI route stateless. The clarification line for unknown commands is a hardcoded string constant authored once and passed through the voice gate at authoring time; there is no runtime Haiku call to generate the clarification (the same fixed string serves every unknown-command response across the application). The weekly priorities PUT replaces the entire priorities array atomically; the array length validation rejects anything outside three-to-five items; the PUT also increments `user_profiles.base_profile_version` because priorities materially affect plan generation context and the cache layer must invalidate when they change. The batch reorder endpoint serializes all displayOrder updates inside one Postgres transaction with the optimistic concurrency check at the top; if planUpdatedAt mismatches, the transaction rolls back and the client sees a single 409 instead of a partial-success state.

**Dependencies:** Chats 008, 023.

**End-of-session checks:** Integration tests pass including a deliberately ambiguous command that produces an `unknown` type with a clarification line. Weekly priorities PUT with two or six items returns 400.

### Chat 030 — Subscription, Account, and Push Token API Scaffolds

*Block 4 | 🔵*

**Load at session start:** TECHNICAL_SPEC.md §9 (Subscriptions, Account, Push Tokens sections); Block 11 chats (the full logic lands later; this chat builds the route scaffolds).

**Goal:** Implement the scaffolds for all subscription, account, and push token routes. The full state machine logic lands in Block 11; this chat builds the route handlers that delegate to the state machine (which is stubbed) and the push token registration that does not yet trigger Live Activity flows.

**Output:**
- `apps/web/app/api/v1/subscription/route.ts` — GET handler
- `apps/web/app/api/v1/subscription/checkout/route.ts` — POST handler that creates a Stripe Checkout session
- `apps/web/app/api/v1/subscription/portal/route.ts` — POST handler that creates a Stripe Customer Portal session
- `apps/web/app/api/v1/subscription/apple-verify/route.ts` — POST handler returning 501 until chat 086 lands real verification
- `apps/web/app/api/v1/account/delete/route.ts` — POST handler that sets deletion_requested_at, transitions subscription_status to deletion_scheduled, cancels any active Stripe subscription via the Stripe API, AND writes a security_audit_log row with event_type='account_deletion_requested' carrying {user_id, requested_at, subscription_source_at_request, stripe_subscription_cancellation_result_if_applicable}. The audit row is the canonical record of user intent for any future dispute or recovery.
- `apps/web/app/api/v1/account/restore/route.ts` — POST handler that clears deletion_requested_at and transitions back to read_only, AND writes a security_audit_log row with event_type='account_deletion_restored' carrying {user_id, restored_at}. Both row writes happen inside the same transaction as the state mutation so audit-log presence cannot diverge from state.
- `apps/web/app/api/v1/push-tokens/route.ts` — POST handler that upserts the push_tokens row
- `apps/web/app/api/v1/push-tokens/[deviceId]/route.ts` — DELETE handler
- `apps/web/lib/auth/onAuthStateChange.ts` — server-side hook driven by a Supabase database trigger on `auth.users` UPDATE that calls a Vesper-internal HTTP endpoint (`/api/v1/internal/auth-event`, authenticated via a shared-secret header set as a Supabase database secret) with the user id and event type (sign-out, password change, session expired, hard-delete cascade); the endpoint deletes all push_tokens rows for that user_id. The database trigger is a sub-deliverable of this chat: it is created as a migration in the chat's output. The hook fires on user sign-out, password change, session expiration, and hard-delete cascade. This prevents the orphan-token bug where a user signs out of one device but their push tokens remain registered, causing later Live Activity and notification deliveries to land on a device the user no longer controls.

**Implementation notes:** The Checkout and Portal handlers use the Stripe SDK and require the Node runtime. The apple-verify handler is a stub that returns 501 with a clear error code (NOT_IMPLEMENTED) so that integration tests can distinguish "scaffolded but not yet wired" from "broken." The account delete handler behavior depends on the subscription source. For Stripe-managed subscriptions, the handler cancels the Stripe subscription synchronously via the Stripe API (a stripe.subscriptions.cancel call); this is critical because otherwise the user is charged again before the hard-delete worker runs. For Apple StoreKit-managed subscriptions, the server cannot cancel on behalf of the user (Apple's policy); instead the handler sets `deletion_requested_at` and the UI surface displays a clear instruction directing the user to cancel their Apple subscription via iOS Settings → Apple ID → Subscriptions before the 30-day grace period elapses, and offers an `itms-apps://` deeplink to that surface. The push tokens POST upserts on (user_id, device_id) per the unique constraint.

**Dependencies:** Chats 008, 024.

**End-of-session checks:** Integration tests pass for each scaffolded route. The Stripe Checkout session creation succeeds in test mode. The push token upsert handles both insert and update paths.

### Chat 031 — Waitlist and Referral APIs

*Block 4 | 🔵 | ⇄ 030*

**Load at session start:** TECHNICAL_SPEC.md §9 (Waitlist, Referral sections); the waitlist and referral_credits table schemas.

**Goal:** Implement POST /waitlist (public, rate-limited at the edge), POST /referral/track (public, sets attribution cookie and redirects), and GET /referral/code (authenticated). The waitlist insert returns 409 if the email exists. The referral track endpoint validates the code against users.referral_code (the column is added in chat 095 if not already present in the schema audit from chat 006).

**Output:**
- `apps/web/app/api/v1/waitlist/route.ts` — POST handler that validates email format, checks for duplicates, inserts; 409 on duplicate
- `apps/web/app/api/v1/referral/track/route.ts` — POST handler that validates the code, sets the `vesper_ref` cookie (max-age 30 days, SameSite=Lax, Secure), and returns a 302 redirect to the marketing landing page
- `apps/web/app/api/v1/referral/code/route.ts` — GET handler that returns the authenticated user's referral code with summary statistics

**Implementation notes:** The waitlist endpoint is unauthenticated and rate-limited at the Cloudflare edge (configured in chat 009). The referral track cookie is set with HttpOnly false because the client may want to read it for UTM enrichment; the cookie's value is the referral code only, not any sensitive identifier. The referral code GET handler returns 404 with reason `not_eligible` if the user has never reached an active subscription (referral codes are minted only at paid conversion in chat 095).

**Dependencies:** Chats 008, 009.

**End-of-session checks:** Integration tests pass. Rate limiting fires after the configured threshold. The cookie is set correctly on referral track.

---

## Block 5 — Onboarding

Block 5 takes the user from sign-up to landing on a fully populated day view. The flow is screen-by-screen exactly as locked in Layer 4. The voice gate from chat 017 must be active and all hardcoded copy must have passed through it. The resume-state derivation handles users who drop mid-flow and return.

### Chat 032 — Onboarding State Machine and Screens 1 through 3

*Block 5 | 🔵 🟢 🎩*

**Load at session start:** PRD §3.1 (full Onboarding Flow); LAYER_4_EXPERIENCE_IDENTITY.md (Onboarding Flow section, Screens 1, 2, 3); chats 010, 011 (auth flows); chat 017 (voice gate); chats 012, 013 (shells).

**Goal:** Build the onboarding state machine that tracks which screen the user is on (derived from which fields have been populated rather than a separate column), implement the welcome screen with its four-second sequential reveal animation, implement the authentication screen (which is the same auth surface from chats 010 and 011, repositioned within the onboarding flow), and implement the honorific selection screen.

**Output:**
- `packages/shared/src/onboarding/state.ts` — exports `deriveOnboardingStep(user, profile): OnboardingStep` that returns the screen the user should see next based on which fields are populated (no archetype → step 4; no location_lat → step 6; no sleep_target → step 7; etc.)
- `apps/web/app/(onboarding)/welcome/page.tsx` and `apps/mobile/app/(onboarding)/welcome.tsx` — the welcome screen with the sequential reveal animation (1.0s + 0.2s crossfade + 1.0s + 0.2s + 1.4s + 0.3s = ~4 seconds total) and a Begin button that appears at the end; tap-to-skip advances to the button state immediately
- `apps/web/app/(onboarding)/sign-in/page.tsx` and `apps/mobile/app/(onboarding)/sign-in.tsx` — the sign-in screen with three live options (Google, Apple, email magic link); all three options are functional on both surfaces (Apple uses the web redirect flow on web and the native `expo-apple-authentication` dialog on mobile per chats 010 and 011)
- `apps/web/app/(onboarding)/honorific/page.tsx` and `apps/mobile/app/(onboarding)/honorific.tsx` — the honorific selection (Sir, Madam, No honorific) with the small footnote "You can change this anytime in settings"
- `apps/web/app/(onboarding)/layout.tsx` and `apps/mobile/app/(onboarding)/_layout.tsx` — the onboarding shell that handles the back-button affordance, the analytics emission (`onboarding_step_completed` event per screen), and the resume state derivation on entry

**Implementation notes:** The sequential reveal animation is built using `react-native-reanimated` on mobile and Framer Motion on web; the timing matches the Layer 4 specification exactly. The resume state derivation is the key architectural choice; rather than storing `onboarding_step` on the users table (which would require a schema migration and would be redundant with the fields themselves), we derive the step from which fields exist. This is robust to the user signing in on a second device mid-flow. The back-button affordance respects the linear flow; pressing back at screen 5 returns to screen 4 without losing data already entered.

**Dependencies:** Chats 010, 011, 012, 013, 017.

**End-of-session checks:** A new user can complete screens 1 through 3 on both web and mobile. The honorific is persisted to the users.honorific column. Refreshing the app on screen 3 returns to screen 3 (resume state works). Analytics events fire for each step completion.

### Chat 033 — Onboarding Screen 4: Archetype and Branch Routing

*Block 5 | 🔵 🟢*

**Load at session start:** PRD §3.1 (Screen 4); LAYER_4_EXPERIENCE_IDENTITY.md (Screen 4); the archetype enum values.

**Goal:** Implement the archetype selection screen with six tab-style buttons (Nine-to-Five Professional, Remote Worker, Student, Athlete-Focused, Founder Mode, Mixed) and the branch routing logic that sends users with implied existing planning surfaces to screen 5A (calendar-connected branch) and others to screen 5B (no-existing-plan branch).

**Output:**
- `apps/web/app/(onboarding)/archetype/page.tsx` and `apps/mobile/app/(onboarding)/archetype.tsx`
- `packages/shared/src/onboarding/branch.ts` — exports `getOnboardingBranch(archetype: ArchetypeEnum): 'calendar-connected' | 'no-existing-plan'` per the PRD logic
- On selection, the archetype is written to the users table via the PUT /profile endpoint and the next screen is determined by the branch logic

**Implementation notes:** The branch logic per PRD: nine-to-five, remote, athlete, founder, and mixed go to the calendar-connected branch (5A); only student goes to the no-existing-plan branch (5B) by default, though the user can skip 5A and effectively land in the same place as 5B. Rationale for routing Mixed to 5A specifically: Mixed-archetype users typically come from professional-plus-personal calendar realities where at least one calendar (work or personal) is connectable; offering the connect surface first respects that reality and gives users without a connectable calendar a single tap (the Skip option in 5A) to land in 5B's effective state without forcing two-branch authoring of the same content. The tab UI is implemented with the Layer 4 styling tokens (bronze for selected state, cream on espresso otherwise).

**Dependencies:** Chats 032, 024.

**End-of-session checks:** Each archetype selection routes correctly. The archetype persists. The next screen renders.

### Chat 034 — Onboarding Screens 5 and 6: Calendar Connect, Built-in Walkthrough, Location Capture

*Block 5 | 🔵 🟢*

**Load at session start:** PRD §3.1 (Screens 5A, 5B, 6); LAYER_4_EXPERIENCE_IDENTITY.md (corresponding screens); TECHNICAL_SPEC.md §6 (Google Calendar OAuth flow).

**Goal:** Build the calendar branching screens (5A for users on the calendar-connected branch with a "Connect Google Calendar" CTA and a skip option; 5B for users on the no-existing-plan branch with a three-screen walkthrough explaining how to enter fixed events into the built-in calendar) and the location capture screen 6 (device geolocation permission prompt with a manual coordinate fallback for web).

**Output:**
- `apps/web/app/(onboarding)/calendar/page.tsx` and `apps/mobile/app/(onboarding)/calendar.tsx` — branches into 5A or 5B based on the archetype
- `apps/web/app/(onboarding)/calendar/walkthrough/[step]/page.tsx` and `apps/mobile/app/(onboarding)/calendar/walkthrough/[step].tsx` — the three-screen walkthrough for the 5B branch
- `apps/web/app/(onboarding)/location/page.tsx` and `apps/mobile/app/(onboarding)/location.tsx` — the location capture using browser Geolocation API (web) and expo-location (mobile); stores lat/lng to the user row; manual skip stores null
- A rationale screen before the iOS location permission prompt explaining why location is needed

**Implementation notes:** The calendar OAuth from 5A initiates the same Google OAuth flow built in chat 063 with full functionality: the integrations row is created, OAuth tokens are encrypted via pgsodium, and the user is returned to the onboarding flow with the integration active. This requires chat 063 to ship first in the build order; the critical path reflects this with chat 063 moved from Block 8 to run before chat 034. The rationale screen before the location permission prompt is an iOS HIG best practice; per L4 copy library, the copy is "Vesper uses your location to personalise your schedule."

**Dependencies:** Chats 033, 063 (hard dependency; 063 ships before this chat in the build order), 064 (token refresh and calendar event classification must exist before onboarding can finish with a connected calendar that does anything meaningful with its events). Critical-path ordering: 063 → 064 → 034.

**End-of-session checks:** A user on the calendar-connected branch can connect Google Calendar (or skip). A user on the no-existing-plan branch sees the three-screen walkthrough. Location capture works on both web (browser Geolocation or skip) and mobile (expo-location permission prompt or skip). Lat/lng writes correctly to the user row.

### Chat 035 — Onboarding Screens 7 through 11: Preferences, Modules, Trial Confirmation

*Block 5 | 🔵 🟢 🎩*

**Load at session start:** PRD §3.1 (Screens 7-11); LAYER_4_EXPERIENCE_IDENTITY.md (corresponding screens); PRD §6 (each module's onboarding preferences); LAYER_2_PRODUCT_SCOPE.md (Pillar 2 default state per module).

**Goal:** Build screens 7 (sleep target with two time pickers), 8 (goals with three open text fields), 9 (module toggles with all seven modules, six default ON and finance default OFF), 10 (per-module quick preferences for the enabled modules), and 11 (trial confirmation that transitions subscription_status to trial). The contextual push notification permission prompt timing is decided here: the prompt fires after module preferences are captured but before plan generation, so the user has agency over the prompt timing.

**Output:**
- `apps/web/app/(onboarding)/sleep/page.tsx` and `apps/mobile/app/(onboarding)/sleep.tsx`
- `apps/web/app/(onboarding)/goals/page.tsx` and `apps/mobile/app/(onboarding)/goals.tsx`
- `apps/web/app/(onboarding)/modules/page.tsx` and `apps/mobile/app/(onboarding)/modules.tsx` — the module toggles
- `apps/web/app/(onboarding)/preferences/[moduleId]/page.tsx` and the mobile equivalents — the per-module quick preference sub-flow; the user steps through each enabled module's preference screen in sequence
- `apps/web/app/(onboarding)/trial/page.tsx` and `apps/mobile/app/(onboarding)/trial.tsx` — the trial confirmation CTA
- The push notification permission rationale and prompt on mobile (after preferences, before trial confirmation)

**Implementation notes:** The per-module preference sub-flow is a non-trivial UI piece. For each enabled module, the user sees one or two screens of preferences (fitness asks goal, equipment, level, days-per-week; nutrition asks dietary restrictions, cooking time tolerance, dislikes; sleep asks targets but those are captured on screen 7; medications offers an optional add-one screen; errands captures any initial recurring chores; finance, if enabled, asks for first bill entry). Each module's sub-flow writes to user_profiles.modules_enabled. The PUT /profile endpoint is called once per sub-flow to update the JSONB atomically. The push permission prompt on mobile uses expo-notifications; if denied, the user can still complete onboarding and the medication module's notification feature is degraded with a banner explaining the limitation. The trial confirmation does NOT change subscription_status (the handle_new_user trigger already set it to `trial` at sign-up per Tech Spec); the confirmation step only sets the trial_started_at timestamp to the current time and records the user's explicit acknowledgment of the 7-day trial window. The trial_ends_at field is computed as trial_started_at + interval '7 days' and stored at the same time so downstream queries (Chat 072 trial-reminder worker, Chat 089 day-6 prompt) read a stable end-of-trial timestamp.

**Dependencies:** Chats 034, 024, 030.

**End-of-session checks:** A new user can complete all five screens for each archetype. The user_profiles.base_profile JSONB and modules_enabled JSONB are populated correctly. The trial confirmation transitions to the next state correctly. The push permission prompt fires at the correct moment.

### Chat 036 — First Plan Generation, Streaming Skeleton, and Feature Tour

*Block 5 | 🔵 🟢 🎩*

**Load at session start:** PRD §3.1 (first plan and tour); LAYER_4_EXPERIENCE_IDENTITY.md (Screen 12 and feature tour); chat 025 (plan generation API); chat 017 (voice gate).

**Goal:** Trigger the user's first plan generation at the end of onboarding, render a streaming skeleton state while the SSE response arrives (with voice-gated loading copy), show the feature tour after the plan completes (four to five swipeable screens covering mark complete, NL input, Dynamic Island, weekly planner; all skippable at any point), and land the user on the day view.

**Output:**
- `apps/web/app/(onboarding)/generating/page.tsx` and `apps/mobile/app/(onboarding)/generating.tsx` — the streaming skeleton screen with voice-gated copy ("Setting up your day, [honorific].") and a progress indicator that animates with the SSE chunks arriving
- `apps/web/app/(onboarding)/tour/[step]/page.tsx` and the mobile equivalents — four to five tour screens with skip option
- `apps/web/lib/firstPlan.ts` and the mobile equivalent — the orchestration: call POST /plans/generate with the user's onboarding-derived energy default of 5, stream the response into the skeleton, navigate to the tour on completion, navigate to day view on tour completion or skip

**Implementation notes:** The streaming skeleton is a critical UX moment; users wait roughly five to fifteen seconds for the plan to generate, and the skeleton must feel intentional and calm rather than slow. The blocks render in placeholder form (gray rectangles with subtle shimmer) and fill in as the SSE chunks arrive. The voice-gated copy rotates through three or four lines during the generation. The tour content is hardcoded copy (voice-gated) describing each feature in one or two sentences with a small visual or icon. The skip button is always available; users who skip arrive at the day view directly.

**Dependencies:** Chats 035, 025.

**End-of-session checks:** A fresh user completes onboarding and sees a streaming first plan. The plan completes successfully (using the real synthesizePlan from chat 022). The tour renders correctly with skip available. The user lands on the day view.

---

## Block 6 — Plan Experience

Block 6 builds the core daily surface of the application. The Supabase Realtime client subscribes to block changes for live sync across devices. The TanStack Query offline mutation queue handles connectivity loss with conflict resolution. The plan day view, block detail views, block actions, drag-and-drop reorder, ambient line, natural-language input, and week view all land in this block.

### Chat 037 — Supabase Realtime Client Setup

*Block 6 | 🟡 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §11 (Realtime and Offline); chat 013 (mobile shell with app lifecycle hook); chat 026 (plan retrieval).

**Goal:** Build the Supabase Realtime client abstraction shared between web and mobile. The client subscribes to changes on the blocks table filtered to the current plan's user_id and plan_date. It provides a self-mutation filter so that the device's own writes are not re-applied (which would cause double-application). It integrates with TanStack Query so that incoming changes invalidate the relevant queries. It handles reconnection on network blips and respects the mobile lifecycle (suspend on background, resume on foreground).

**Output:**
- `packages/shared/src/realtime/client.ts` — exports `createRealtimeClient()` that returns a typed client with `subscribeToBlocks(userId, planDate, onUpdate)` and `unsubscribe()` methods
- `packages/shared/src/realtime/selfMutationFilter.ts` — utility that maintains a sliding-window set of recent `client_mutation_id` values the device has generated (one mutation id is minted per outbound mutation request, attached to the request, written to the `blocks.client_mutation_id` column by the API route, and echoed in the Realtime broadcast); incoming Realtime events whose `client_mutation_id` matches the local set are dropped because the device already applied them optimistically and re-applying would produce visible flicker or worse, a double-apply. The window expires entries after 60 seconds (raised from the prior 30-second value to tolerate longer network stalls and background-then-foreground refetch windows on mobile).
- `apps/web/hooks/usePlanRealtime.ts` and `apps/mobile/hooks/usePlanRealtime.ts` — React hooks that subscribe to Realtime for the current plan, integrate with TanStack Query invalidation, and handle the mobile lifecycle (the mobile hook uses the useAppLifecycle hook from chat 013). Both hooks emit PostHog event `realtime_connection_state_changed` on every subscription state transition (subscribing, subscribed, error, closed, reconnecting) with payload `{state, reason, plan_date, retry_count}`, and a Sentry breadcrumb on any non-recoverable error so that "edits from my other device aren't showing up" reports can be triaged against actual connection state. The event is added to chat 096's PostHog taxonomy.

**Implementation notes:** The Realtime subscription is configured with a filter on the blocks table to limit the rows the device receives; without filtering, every block change for every user would be broadcast (which would exhaust the free tier quickly). The filter clause is `daily_plan_id=eq.{planId}`, computed from (user_id, plan_date) at subscription time. The self-mutation filter relies on the `client_mutation_id` column added in chat 004's blocks migration. Every block mutation API route (PATCH /blocks, POST /blocks, the batch reorder endpoint from chat 029) accepts a `clientMutationId` header from the device, writes it into the row, and the Supabase Realtime broadcast carries the full updated row (because of the `REPLICA IDENTITY FULL` on blocks from chat 004) including this column. The TanStack Query integration invalidates `['plan', planDate]` on incoming changes that pass the filter; the next read refetches the full plan. The mobile lifecycle hook suspends the subscription on background (cleaning up the websocket) and resumes on foreground (re-subscribing); on foreground, the hook also explicitly invalidates the `['plan', currentDate]` query so any broadcasts that occurred while the websocket was suspended are picked up via refetch — without this explicit invalidation, the resume-then-no-changes path silently misses background updates. Without the background suspend, the websocket persists in background and burns battery and Supabase Realtime connection quota. Security model: Realtime broadcasts bypass the API layer entirely; their only gate is the RLS policy on the broadcast (publication) table. The chat 006 audit script explicitly verifies that RLS gates the publication, not only direct SELECT, so a misconfigured publication policy that broadcasts cross-user rows would fail the audit before reaching production.

**Dependencies:** Chats 007, 013, 026.

**End-of-session checks:** Two devices signed into the same user account see each other's block updates in real time (within one second). Backgrounding the mobile app stops the websocket; foregrounding resumes it. Self-mutations do not echo.

### Chat 038 — TanStack Query Offline Mutation Queue and Conflict Resolution

*Block 6 | 🟡 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §11 (Offline Behavior); chat 027 (optimistic concurrency); chat 013 (TanStack Query persistence on mobile).

**Goal:** Build the offline mutation queue using TanStack Query's mutationCache with custom retry on reconnect. When the user makes an edit while offline, the mutation queues locally and the UI updates optimistically. On reconnect, the queue flushes in order; mutations that fail with 409 Optimistic Lock Failure trigger a refresh and a toast notification ("Your other device edited this — refreshed"). The queue persists across app cold starts on mobile via AsyncStorage.

**Output:**
- `packages/shared/src/queries/mutationQueue.ts` — exports configuration for TanStack Query's mutationCache with custom retry logic, persistence (mobile only), and conflict toast emission
- `apps/web/lib/queries/queryClient.ts` and `apps/mobile/lib/queries/queryClient.ts` updated to use the configured mutation cache
- `packages/shared/src/queries/conflictToast.ts` — utility that emits a toast through the UI store with the conflict copy (voice-gated)
- PostHog event emission on offline queue lifecycle: `offline_queue_flush_started` (carrying `{queued_mutation_count}`) when reconnect triggers the flush, and `offline_queue_flush_completed` (carrying `{succeeded_count, conflict_count, network_error_count, total_duration_ms}`) when the flush settles. Without these, "the offline queue silently dropped my edits" cannot be distinguished from "the user just had unusually consistent network." Events are added to chat 096's PostHog taxonomy.

**Implementation notes:** TanStack Query's mutationCache exposes a serializable state that can be persisted; the mobile implementation uses AsyncStorage to write the cache on every mutation and rehydrate on cold start. The custom retry logic uses exponential backoff on network errors but does not retry on 4xx errors (those are client mistakes). The 409 handling is special: instead of retrying, it triggers a query invalidation and a toast. The toast utility coalesces multiple 409 events fired within a five-second window into a single toast message so that flushing a long offline queue does not produce a flood of redundant notifications; the coalesced toast reads "Refreshed — your other device made changes." The single-event toast reads "Your other device edited this — refreshed." Both pass through the voice gate.

**Dependencies:** Chats 037, 027, 013.

**End-of-session checks:** Going offline mid-edit queues the mutation. Coming back online flushes it. A deliberate 409 scenario produces the toast and refreshes the query.

### Chat 039 — Plan Day View on Web

*Block 6 | 🔵*

**Load at session start:** PRD §3.2 (Daily Journey); LAYER_4_EXPERIENCE_IDENTITY.md (plan view design); chats 037, 038 (Realtime and offline); chat 026 (plan retrieval).

**Goal:** Build the web plan view as a vertical block timeline with Realtime sync wired, streaming render hook for the first plan or regenerations, empty state when no plan exists, loading skeleton during SSE, and day rollover logic (the view advances to the next day at midnight in the user's timezone).

**Output:**
- `apps/web/app/(app)/page.tsx` — the day view page
- `apps/web/components/plan/BlockTimeline.tsx` — the vertical block list component
- `apps/web/components/plan/BlockCard.tsx` — individual block card with type-specific styling
- `apps/web/components/plan/PlanSkeleton.tsx` — the loading skeleton shown during SSE
- `apps/web/components/plan/PlanEmpty.tsx` — the empty state component shown when no plan exists
- `apps/web/hooks/useDayRollover.ts` — hook that detects the local midnight and advances the displayed date; uses both a `document.visibilitychange` listener (immediate advancement when the tab returns to foreground after midnight) and a 60-second polling fallback (because browser timers may be throttled or stopped entirely when the tab is backgrounded for long periods, so a single `setTimeout` to the next midnight cannot be trusted to fire)

**Implementation notes:** The block timeline is ordered by start_time ascending with displayOrder as a tiebreaker; blocks render with their type-specific icon, title, time range, and current status. The empty state distinguishes between "no plan generated yet for today" (with a CTA to generate) and "no plan can be generated right now" (with the fallback apology line if applicable). The loading skeleton renders placeholder cards that fill in as SSE chunks arrive. The day rollover hook computes the next local midnight and sets a timer; when the timer fires, the date advances and a new plan query fires for the new date.

**Dependencies:** Chats 037, 038, 026, 012.

**End-of-session checks:** The day view renders a real plan correctly. The empty state renders when no plan exists. Streaming a new plan via the API shows the skeleton animation. Day rollover at midnight advances correctly.

### Chat 040 — Plan Day View on Mobile

*Block 6 | 🟢 | ⇄ 039*

**Load at session start:** Same as chat 039 plus mobile design considerations (touch targets, pull-to-refresh).

**Goal:** Build the mobile equivalent of the day view with parity to the web. Add pull-to-refresh, swipe gestures on blocks for quick actions, and Reanimated layout animations for block changes (e.g., when a block reschedules, it slides smoothly to the new position rather than jumping).

**Output:**
- `apps/mobile/app/(tabs)/index.tsx` — the day view tab
- `apps/mobile/components/plan/BlockTimeline.tsx` and `BlockCard.tsx` with mobile-specific styling and gestures
- `apps/mobile/components/plan/PlanSkeleton.tsx` and `PlanEmpty.tsx`
- `apps/mobile/hooks/useDayRollover.ts` (shared logic with web, but listens via expo-notifications local triggers or app lifecycle)

**Implementation notes:** Reanimated's layout animations are configured at the BlockTimeline level so that any list reorder produces a smooth transition. Pull-to-refresh attempts the refetch unconditionally rather than pre-gating on `NetInfo.isConnected`; if the fetch errors out (no network), the cached plan from chat 013's persistQueryClient remains rendered and a 2-second voice-gated toast displays "Showing your saved plan." No spinner, no error state. The pre-gate-then-refetch pattern was rejected because NetInfo state can be stale across captive-portal transitions and the unconditional-attempt-then-handle-error pattern is simpler and produces the same UX on the actual-offline path. Swipe gestures on a block reveal action buttons (complete, skip, reschedule) without requiring an expand step.

**Dependencies:** Chats 037, 038, 026, 013. Parallel with chat 039.

**End-of-session checks:** The day view renders correctly on the iOS Simulator. Pull-to-refresh works. Swipe gestures reveal actions. Animations are smooth.

### Chat 041 — Block Detail Views for All Ten Block Types

*Block 6 | 🔵 🟢*

**Load at session start:** PRD §4 and §6 (each module's block detail content); chats 039, 040 (block timeline base); the block_details JSONB Zod schemas from chat 006.

**Goal:** Build the expanded block detail views for each of the ten block_type values (work, fitness, nutrition, sleep, errands, medication, finance, focus, commute, custom). Each block type has its own detail layout: fitness shows exercises and sets, nutrition shows recipe ingredients and instructions, errands shows a flat checklist of errand stops ordered by deadline (no routing or sequencing — the local intelligence layer has been removed from V1), medications show dose and times, etc.

**Output:**
- `apps/web/components/plan/details/` and `apps/mobile/components/plan/details/` directories with one component per block type
- A discriminated dispatcher component `BlockDetail.tsx` that renders the appropriate detail view based on the block's blockType field
- Empty or minimal states for each block type (e.g., a fitness block with no template detail renders a generic "exercise block" state)

**Implementation notes:** The discriminated union pattern in the Zod schemas (from chat 006) flows through to the UI; each detail component is typed against its specific branch of the union, so TypeScript catches mismatches at compile time. The detail views are designed to be scannable rather than information-dense; the goal is the user knows what to do without reading carefully.

**Dependencies:** Chats 039, 040, 006.

**End-of-session checks:** Each block type renders its detail view correctly when expanded. Empty states render when details are sparse.

### Chat 042 — Block Actions and State Transitions

*Block 6 | 🔵 🟢 🎩*

**Load at session start:** PRD §3.2 (block actions copy from L4 line library); chat 027 (PATCH /blocks); chat 038 (offline queue); chat 026 (plan retrieval).

**Goal:** Implement the three primary block actions: mark complete, skip, and reschedule. Each writes to completion_log via the API and produces a butler-voiced confirmation. Mark complete triggers haptic feedback on mobile with no on-screen copy per Layer 4. Skip and reschedule emit their respective butler lines through the voice gate.

**Output:**
- `apps/web/components/plan/BlockActions.tsx` and `apps/mobile/components/plan/BlockActions.tsx` — the action button row that appears on block expand or swipe
- `apps/web/components/plan/RescheduleModal.tsx` and `apps/mobile/components/plan/RescheduleModal.tsx` — the time picker modal for reschedule
- Optimistic UI updates via TanStack Query with rollback on error
- Toast notifications for skip and reschedule using the voice-gated copy

**Implementation notes:** The mark-complete action is the most common and is therefore optimized: a single tap on the complete button (or swipe right gesture on mobile) writes optimistically, fires haptic feedback on mobile, and rolls back if the PATCH fails. The PATCH /blocks server handler writes both the block status update and the corresponding completion_log row inside the same transaction, so the optimistic mutation routes through a single API call rather than two parallel writes; this guarantees analytics never diverges from block state. The reschedule modal opens a time picker; the user selects a new start time, the modal computes the new end time based on the block's original duration, and the PATCH fires with both startTime and endTime. The skip action is one tap with no confirmation modal; the optimistic update removes the block from the timeline immediately. The optimistic-update conflict-with-Realtime sequence is documented explicitly because the interaction is subtle: (1) the user taps mark-complete; (2) the client mints a `clientMutationId`, applies the optimistic update to the local cache, and sends PATCH /blocks; (3) the server writes the row with `client_mutation_id = $1` and Realtime broadcasts the change; (4) the broadcast arrives at the originating device; (5) the chat 037 self-mutation filter drops the broadcast against the local recent-mutation set (preventing flicker); (6a) if the PATCH returned 2xx, the optimistic update is confirmed by the server response; (6b) if the PATCH returned 409 Optimistic Lock Failure, the chat 038 conflict-toast flow fires: the optimistic update is rolled back, the plan query is invalidated, and the voice-gated conflict toast displays. The end state is identical regardless of whether the Realtime broadcast or the PATCH response arrives first.

**Dependencies:** Chats 041, 027, 038.

**End-of-session checks:** Each action works on both web and mobile. Optimistic updates render immediately. Failures roll back correctly. Voice-gated copy displays on skip and reschedule.

### Chat 043 — Block Drag-and-Drop Reorder

*Block 6 | 🔵 🟢 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §14 (Open Question 2 resolution); chat 027 (optimistic concurrency); OPEN_SOURCE_INVENTORY.md (@hello-pangea/dnd and react-native-draggable-flatlist).

**Goal:** Implement drag-and-drop reorder on the block timeline. On web, use @hello-pangea/dnd. On mobile, use react-native-draggable-flatlist. Both surfaces emit PATCH /blocks with the new displayOrder values for the affected blocks. The optimistic concurrency check from chat 027 fires on each PATCH; if any returns 409, the entire reorder operation rolls back and the conflict toast displays. Keyboard reorder is supported on web for accessibility.

**Output:**
- `apps/web/components/plan/DraggableBlockTimeline.tsx` — wraps the block list with @hello-pangea/dnd
- `apps/mobile/components/plan/DraggableBlockTimeline.tsx` — wraps with react-native-draggable-flatlist
- Mutation orchestration that issues a single POST to the batch reorder endpoint from chat 029 (`POST /plans/:date/reorder`) with all affected block displayOrder values plus the plan's `updatedAt`; the entire reorder either commits atomically or returns one 409
- Keyboard handlers on web for arrow-key reorder when a block is focused (per WCAG 2.1 SC 2.1.1 Keyboard and WCAG 2.2 SC 2.5.7 Dragging Movements, which requires every drag operation to have a single-pointer / non-drag alternative)

**Implementation notes:** Drag-and-drop reorder is the hardest interaction to get right in this block. The optimistic UI shows the new order immediately; the single batch POST request issues; if it succeeds, the optimistic state is confirmed; if it returns 409, the UI snaps back to the server's order and the conflict toast displays once. The client serializes drag-drop operations per-device: a second drag-drop is held in a per-device mutation queue until the prior PATCH resolves; this avoids the in-flight race where two batch reorders submitted in quick succession produce a server-side last-write-wins on `displayOrder` while the device's optimistic UI shows the second order. Using the batch endpoint (rather than N parallel PATCH /blocks calls) eliminates the partial-failure window where some block updates commit and others 409. The keyboard reorder on web allows up/down arrow keys to move a focused block; this is critical for accessibility per WCAG 2.1 SC 2.1.1 and is also the dragging-movements alternative required by WCAG 2.2 SC 2.5.7.

**Dependencies:** Chats 042, 027, 029 (the batch reorder endpoint authored in chat 029 is the only mutation surface this chat calls).

**End-of-session checks:** Drag-and-drop works on both surfaces. The optimistic concurrency check fires correctly. Keyboard reorder works on web with a screen reader navigating.

### Chat 044 — Line Rotation Engine and 80-Line Library

*Block 6 | 🟡 🎩*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (Voice section, Line Rotation, Line Library); chat 017 (voice gate); chat 035 (honorific captured in onboarding).

**Goal:** Build the line rotation engine that selects a contextually-appropriate butler line for display in the ambient surface. The engine considers time of day, completion state, recent activity, and user honorific preference. No line repeats within four hours; this is enforced via local storage on web and MMKV on mobile.

**Output:**
- `packages/shared/src/butlerLines/library.ts` — the eighty-line library from Layer 4, organized by context category, with `[HONORIFIC]` placeholders
- `packages/shared/src/butlerLines/rotation.ts` — exports `selectLine(context: LineContext): string` that returns a contextually appropriate line, applies the honorific substitution, and respects the no-repeat-within-four-hours rule
- `apps/web/hooks/useAmbientLine.ts` and `apps/mobile/hooks/useAmbientLine.ts` — React hooks that subscribe to context changes (current time, plan state, recent block completions) and return the current ambient line
- `apps/web/components/plan/AmbientLine.tsx` and `apps/mobile/components/plan/AmbientLine.tsx` — the rendered ambient line component; tap opens the natural-language input sheet (built in chat 045)

**Implementation notes:** The line library is authored as a TypeScript constant with each line tagged by context (morning, afternoon, evening, all_complete, post_skip, etc.). The selection algorithm scores each candidate by context match strength and recency; the highest-scoring non-recent line wins. The honorific substitution replaces `[HONORIFIC]` with `, sir` or `, madam` or empty string based on the users.honorific field. The no-repeat rule tracks the last shown line per context bucket in local storage; the timestamp is checked against the current time minus four hours.

**Dependencies:** Chats 039, 040, 017, 035.

**End-of-session checks:** The ambient line renders correctly on both surfaces. Lines rotate as context changes. Honorific substitution works. The no-repeat rule is enforced.

### Chat 045 — Natural Language Input Sheet and Command Pipeline

*Block 6 | 🔵 🟢 🎩*

**Load at session start:** PRD §4.2 and §4.3 (NL input); chat 029 (POST /ai/command); chat 044 (ambient line tap-to-open); LAYER_4_EXPERIENCE_IDENTITY.md (input sheet design).

**Goal:** Build the natural-language input sheet that opens when the user taps the ambient line. The user types a command (voice input is V1.5; at V1, long-press also opens the keyboard rather than starting a voice recording). The command is sent to POST /ai/command, the structured response is applied via the appropriate block API or plan generation API, and a butler-voiced confirmation displays.

**Output:**
- `apps/web/components/plan/NLInputSheet.tsx` — bottom sheet on web with a text input and send button
- `apps/mobile/components/plan/NLInputSheet.tsx` — native sheet on mobile
- `apps/web/lib/nlCommand/applyCommand.ts` and the mobile equivalent — the command applier that takes a parsed PlanEditCommand and calls the right API; handles reschedule, complete, skip, add, remove, regenerate types
- Voice-gated confirmation copy displayed in a toast after successful command application
- PostHog event emission on every NL command lifecycle stage: `nl_command_submitted` (carrying `{input_length_chars, source: 'ambient_tap'}`; raw input is NEVER captured per the privacy posture documented in chat 023), `nl_command_parsed` (carrying `{command_type, parse_latency_ms}` where command_type is one of {reschedule_block, complete_block, skip_block, add_block, remove_block, regenerate_plan, swap_workout, unknown}), and `nl_command_applied` (carrying `{command_type, apply_outcome: 'success'|'api_error', apply_latency_ms}`). Without these, NL prompt tuning is blind — there is no signal on which command types are dominant or where parsing fails most often. Events are added to chat 096's PostHog taxonomy.

**Implementation notes:** The input sheet is invoked from the ambient line tap; tap is the only invocation surface at V1 (voice input and any long-press-to-record gesture are deferred to V1.5 entirely; there is no long-press handler in this chat's mobile code). The user submits, the loading state shows, and the command response either applies (with a confirmation toast) or returns unknown (with a clarification prompt asking the user to rephrase). The command applier handles the dispatch to the various block APIs; it does not re-parse the natural language because that's already done server-side.

**Dependencies:** Chats 044, 029, 042.

**End-of-session checks:** A user can type "move gym to 7pm" and see the gym block reschedule. A user can type "add pick up dry cleaning at 3" and see a new block appear. An unparseable command surfaces the clarification.

### Chat 046 — Week View, Evening Summary, Morning Brief, Energy Slider, Quiet Hours

*Block 6 | 🔵 🟢 🎩*

**Load at session start:** PRD §3.2 and §3.3 (full daily journey beyond the day view); LAYER_4_EXPERIENCE_IDENTITY.md (evening summary, morning brief).

**Goal:** Build the remaining plan surfaces: the week view (web only, seven-day horizontal grid), the evening summary at end of day (completed/missed/energy trend/tomorrow preview), the morning brief on app open (next three blocks plus weather stub plus commute stub), the energy slider screen (mobile full-screen post-alarm, web on first morning open), the proactive end-of-block check-in (in-app and Dynamic Island only, never push), and the quiet hours enforcement that suppresses notifications between bedtime and wake.

**Output:**
- `apps/web/app/(app)/week/page.tsx` — the week view
- `apps/web/components/plan/EveningSummary.tsx` and `apps/mobile/components/plan/EveningSummary.tsx`
- `apps/web/components/plan/MorningBrief.tsx` and `apps/mobile/components/plan/MorningBrief.tsx`
- `apps/mobile/app/(modal)/energy-slider.tsx` — the full-screen energy slider on mobile
- `apps/web/components/plan/EnergySliderInline.tsx` — the inline equivalent on web
- `apps/web/components/plan/EndOfBlockCheckIn.tsx` and `apps/mobile/components/plan/EndOfBlockCheckIn.tsx` — the proactive prompt that appears when a block's end_time passes without being marked complete
- `apps/mobile/lib/quietHours.ts` — utility that consults the user's sleep targets and suppresses local notifications between bedtime and wake

**Implementation notes:** The week view is web-only because mobile screens are too narrow for a seven-day grid; mobile users see a single-day view. The evening summary trigger uses two mechanisms in combination: a local notification (mobile) or scheduled in-app event (web) at the user's stated bedtime minus thirty minutes, plus an on-open check that displays the summary if the app is opened within four hours after the trigger time and the user has not yet seen the summary for the current day. Relying only on a JS timer fails when the app is closed or the tab is throttled past the trigger time; the on-open fallback guarantees the summary surfaces on the first interaction within the window. Coordination with the wind-down block from chat 059a: the wind-down block is a scheduled plan block in the timeline (a work item the user is asked to do); the evening summary is a reflective UI surface (modal overlay on the plan view). Both can appear on the same evening — the wind-down sits in the timeline at its scheduled time, the summary appears as a modal — and they do not collide because they occupy different surfaces. The morning brief appears on the first app open of the day; if the user opens the app multiple times in the morning, the brief shows only the first time. The energy slider on mobile is full-screen because it appears post-alarm; on web there is no alarm, so the slider is inline at the top of the plan view on first morning open. The end-of-block check-in is a soft prompt; it does not push-notify the user (per the privacy posture), but it does appear in-app and on the Dynamic Island. The quiet hours utility wraps expo-notifications scheduling to respect the user's sleep window; medications can override per the user's per-medication preference set in chat 060.

**Dependencies:** Chats 042, 026, 035.

**End-of-session checks:** Each surface renders correctly. The energy slider triggers a fresh plan generation when submitted. The evening summary computes correctly. Quiet hours suppress test notifications.

---

## Block 7 — Modules

Block 7 implements the seven modules: fitness, nutrition, sleep, medication, finance, errands, and tasks (which is the work module). The template seed migrations run early in this block so that fitness and nutrition template selection works in subsequent chats. The weekly planning session lands at the end as the cross-module Sunday surface.

### Chat 047 — Seed Sourcing Scripts

*Block 7 | 🟡*

**Load at session start:** TECHNICAL_SPEC.md §6 (TheMealDB and ExerciseDB Seed-Only); OPEN_SOURCE_INVENTORY.md (template sourcing); chat 001 (RapidAPI key acquired).

**Goal:** Author the scripts that source workout templates from ExerciseDB (via RapidAPI) and recipe templates from TheMealDB. Each script outputs a JSON file in `packages/db/seed/` validated against the corresponding Zod schema. Manual curation passes refine the diet tags and other metadata since the source APIs don't perfectly map.

**Output:**
- `packages/db/seed/scripts/buildWorkoutTemplates.ts` — fetches from ExerciseDB via RapidAPI, transforms to workout_templates row shape, validates with Zod, writes to `packages/db/seed/workout_templates.json`
- `packages/db/seed/scripts/buildRecipeTemplates.ts` — same for TheMealDB, free API, writes to `recipe_templates.json`
- Both scripts produce approximately 150 workouts and 300 recipes respectively, tagged across the required dimensions
- The RapidAPI key is used only during the seed run; it is not stored in production environments

**Implementation notes:** ExerciseDB returns individual exercises; the script aggregates them into workout templates by grouping by goal and equipment. TheMealDB's free API has limited query depth; the script makes paginated calls to assemble the 300-recipe set. Manual curation involves reviewing the generated JSON for diet tag accuracy (TheMealDB doesn't reliably tag vegetarian, so the script applies heuristics based on ingredients), cooking time accuracy, and any obviously inappropriate content. The manual review is a one-time activity captured in the script's commit message.

**Dependencies:** Chat 001 (RapidAPI key acquired during external-account submissions), chat 005 (workout_templates and recipe_templates schemas exist).

**End-of-session checks:** Running each script produces a JSON file with the expected row count. Each row validates against its Zod schema. Manual spot-check confirms diet tags are reasonable.

### Chat 048 — Seed Migrations and First Seed Deploy

*Block 7 | 🗄️*

**Load at session start:** TECHNICAL_SPEC.md §3 (Seed Data); chat 047 outputs; chat 021 (the template subset stub that needs to be replaced with real data).

**Goal:** Author the seed migrations 14 and 15 that truncate and bulk-insert the workout_templates and recipe_templates tables from the JSON files. Deploy them via `supabase db push`. Update the template subset function from chat 021 to use the real data (replacing the empty array stub).

**Output:**
- `packages/db/migrations/20260601100001_seed_workout_templates.sql` and `.down.sql` — truncate workout_templates, bulk insert from the JSON
- `packages/db/migrations/20260601100002_seed_recipe_templates.sql` and `.down.sql` — same for recipes
- After `supabase db push`, the tables contain the seeded rows
- `packages/ai/src/context/templateSubset.ts` updated to filter the real templates by user fitness preferences and nutrition preferences

**Implementation notes:** The bulk insert pattern uses a single INSERT INTO ... VALUES (...), (...), ... statement; for 150 and 300 rows respectively, this is efficient and fits within Postgres statement size limits. The migrations are idempotent because they truncate first; running them again produces the same final state. The template subset filter logic is straightforward: for workouts, filter by `goal`, `equipment ARRAY contains user's equipment`, and `level <= user's level`, limit ten; for recipes, filter by `diet_tags ARRAY contains user's diet_tags`, `total_minutes <= user's cooking_time_max`, limit fifteen.

**Dependencies:** Chats 047, 005, 006, 021.

**End-of-session checks:** Running `supabase db push` applies the seed migrations cleanly. The workout_templates and recipe_templates tables contain the expected row counts. The template subset function returns non-empty arrays for representative user profiles.

### Chat 049 — Fitness Module: Selection, Adaptation, UI

*Block 7 | 🔵 🟢 🤖 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §5 (Fitness in Model Selection); PRD §6.2 (Fitness module spec); chat 023 (selectWorkoutTemplate); chat 022 (synthesizePlan integration).

**Goal:** Wire the fitness template selection into the plan synthesis flow, implement the Sonnet contextual adaptation that scales workouts (e.g., a 60-minute template adapted down to 30 minutes for a tight morning), build the fitness block detail UI showing the exercise list with sets and reps, and implement the workout swap command path (when the user says "give me something shorter" or "I want a home workout").

**Output:**
- `packages/ai/src/synthesizePlan.fitness.ts` — the fitness-specific synthesis hook that calls selectWorkoutTemplate and optionally contextual adaptation
- `apps/web/components/plan/details/FitnessBlock.tsx` and `apps/mobile/components/plan/details/FitnessBlock.tsx` — the fitness detail view
- `apps/web/components/plan/SwapWorkoutSheet.tsx` and the mobile equivalent — the swap UI invoked by the swap command
- The Sonnet adaptation prompt iterated against test cases

**Implementation notes:** The fitness template selection runs as part of the plan synthesis prompt; the selected template UUID is referenced in the block.details. The contextual adaptation is a separate Sonnet call invoked when the available time slot is shorter than the template's standard duration; the call takes the template and the available time and returns a modified version (fewer sets, shorter rest intervals). The workout swap is invoked via the natural-language command pipeline from chat 045 ("give me something shorter", "I want a home workout") rather than a distinct gesture; `SwapWorkoutSheet` is the UI surface the command applier opens when the parser returns a `swap_workout` command type. The swap and the NL command path are the same feature with different surfaces (input is NL, surface is the sheet). The sheet presents the next-best matching template based on the user's modified preference.

**Dependencies:** Chats 048, 023, 042.

**End-of-session checks:** A user with a fitness module enabled receives a fitness block in their daily plan. Adaptation scales workouts correctly. The swap command produces a new template.

### Chat 050 — Nutrition Module: Selection, Recipe UI, Hydration

*Block 7 | 🔵 🟢 🤖 | ⇄ 049*

**Load at session start:** TECHNICAL_SPEC.md §5; PRD §6.3 (Nutrition module spec); chat 023 (selectRecipeTemplate).

**Goal:** Wire recipe template selection into plan synthesis, build the recipe detail UI showing ingredients and step-by-step instructions, implement the recipe swap command path, and add the hydration sub-feature as an inline tracker within the nutrition module.

**Output:**
- `packages/ai/src/synthesizePlan.nutrition.ts` — the nutrition-specific synthesis hook
- `apps/web/components/plan/details/NutritionBlock.tsx` and the mobile equivalent
- `apps/web/components/plan/SwapRecipeSheet.tsx` and the mobile equivalent
- `apps/web/components/plan/HydrationTracker.tsx` and the mobile equivalent — a simple counter for water intake; each tap inserts a row into the `hydration_log` table from chat 005 with `user_id`, `logged_at = now()`, `count = 1`; the visible counter is derived from `SELECT COUNT(*) FROM hydration_log WHERE user_id = $1 AND logged_at >= start_of_local_day(user.timezone)`

**Implementation notes:** Nutrition is similar to fitness in pattern. The hydration tracker is intentionally minimal at V1; users tap a button to record an event row in `hydration_log`. The counter is derived at read time from the count of rows since the local-day boundary; daily resets are a consequence of the query (no mutation runs at rollover). Hydration mutations do NOT bump `user_profiles.base_profile_version` because hydration is high-frequency event data, not a profile preference, and does not affect plan generation context caching. No notifications or goals at V1 beyond the count display.

**Dependencies:** Chats 048, 023, 042.

**End-of-session checks:** Nutrition blocks generate with recipe details. Swap works. Hydration tracker increments and resets.

### Chat 051 — Meal Planning and Grocery List

*Block 7 | 🔵 🟢 🤖 🎩 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §5 (Sonnet meal planning); PRD §6.3 (weekly meal planning, grocery list).

**Goal:** Implement weekly meal plan synthesis via Sonnet (seven days times meal slots) and grocery list aggregation from the week's ingredients as a simple checklist.

**Output:**
- `packages/ai/src/weeklyMealPlan.ts` — Sonnet call that takes the user's nutrition preferences and produces a weekly meal plan
- `apps/web/app/(app)/meal-plan/page.tsx` and `apps/mobile/app/(tabs)/meal-plan.tsx` — the weekly meal plan view
- `apps/web/app/(app)/grocery-list/page.tsx` and the mobile equivalent — the grocery list view
- `packages/shared/src/grocery/aggregator.ts` — utility that takes a week's recipes and aggregates ingredients
- Voice-gated copy for the grocery list ("Your list is ready.")

**Implementation notes:** The meal plan is triggered during the Sunday weekly planning session (chat 057) or on user demand. The grocery aggregator combines duplicate ingredients (two recipes calling for 2 cups of rice each become 4 cups total). The grocery list is a flat checklist; no store routing is implemented.

**Dependencies:** Chats 050, 022.

**End-of-session checks:** A weekly meal plan generates. The grocery list aggregates correctly and renders as a checklist.

### Chat 052 — Built-in Calendar: Library Selection and Web Implementation

*Block 7 | 🔵 | ⚠️*

**Load at session start:** LAYER_2_PRODUCT_SCOPE.md (Pillar 3 — Calendar Layer); OPEN_SOURCE_INVENTORY.md (FullCalendar, react-big-calendar); PRD calendar dual-surface requirements.

**Goal:** Evaluate FullCalendar Standard vs react-big-calendar, decide based on RRULE recurrence support and theming flexibility, implement the web calendar with event CRUD and RRULE recurrence for fixed weekly events (work hours, classes, recurring appointments).

**Output:**
- A decision documented in `docs/CALENDAR_LIBRARY_CHOICE.md`
- The chosen library integrated in `apps/web/app/(app)/calendar/page.tsx`
- Event CRUD operations writing to the `calendar_events` table owned by chat 005 (this chat consumes the existing table; it does not own a new migration)
- RRULE recurrence parser for events like "every Monday and Wednesday 9am-10am for work"

**Implementation notes:** This chat carries elevated risk because the library choice is hard to undo. FullCalendar Standard is the leading candidate because of mature RRULE support and a well-documented theming API. react-big-calendar is the alternative with a smaller bundle but weaker RRULE support. The `calendar_events` table migration is owned by chat 005 and lives in the Block 1 migration set at allocation number 14 (the first available number in the Blocks 4–7 range per `docs/MIGRATION_NUMBER_ALLOCATION.md`); this chat does not add a migration and there is no "retroactive to Block 1" reordering. Calendar events are user-owned recurring entities separate from generated plans, which is why they live in their own table rather than as an extension of daily_plans.

**Dependencies:** Chat 015.

**End-of-session checks:** The chosen library renders correctly. Event CRUD works. RRULE recurrence produces correct instances.

### Chat 053 — Built-in Calendar: Mobile Implementation

*Block 7 | 🟢 | ⚠️*

**Load at session start:** Chat 052 (library decision and web implementation); OPEN_SOURCE_INVENTORY.md (react-native-calendars); the calendar_events table schema.

**Goal:** Implement the mobile calendar with feature parity to web. Use react-native-calendars. Verify RRULE recurrence support; if the library does not support RRULE natively, implement in-app recurrence expansion (the app stores RRULE strings and expands them to event instances on read).

**Output:**
- `apps/mobile/app/(tabs)/calendar.tsx` and supporting components
- Event CRUD parity with web
- RRULE expansion utility if needed
- The events-to-blocks pipeline: built-in calendar events become source=user_added blocks at plan synthesis time

**Implementation notes:** If react-native-calendars supports RRULE, use it directly. If not, the in-app expansion pattern is: the calendar_events table stores the RRULE string and the start/end dates of the series; on read, the app expands the RRULE to individual instances using the rrule library; the expanded instances are not stored (only the RRULE is). This pattern is the standard for calendar applications and is well-documented.

**Dependencies:** Chat 052.

**End-of-session checks:** Mobile calendar renders correctly. Event CRUD works. RRULE recurrence produces correct instances. Events appear in the daily plan as fixed blocks.

### Chat 054 — Tasks Module: UI and CRUD

*Block 7 | 🔵 🟢*

**Load at session start:** PRD §6.1 (Work and Tasks module); chat 028 (task APIs).

**Goal:** Build the task list UI on web and mobile. The list is sortable by priority and deadline; users can create, edit, complete, and delete tasks. The UI is accessible from the plan view (secondary surface) and from the natural-language input.

**Output:**
- `apps/web/app/(app)/tasks/page.tsx` and `apps/mobile/app/(tabs)/tasks.tsx`
- `apps/web/components/tasks/TaskList.tsx`, `TaskCard.tsx`, `TaskForm.tsx` and mobile equivalents
- Empty state for users with no tasks

**Implementation notes:** Tasks are not paginated at V1 per Tech Spec. The list is rendered as a flat scroll. The task form opens as a modal for creation and edit.

**Dependencies:** Chat 028.

**End-of-session checks:** Task CRUD works on both surfaces. Sorting is correct.

### Chat 055 — Tasks Module: Placement Algorithm

*Block 7 | 🟡 🤖*

**Load at session start:** PRD §6.1 (focus block placement); chat 022 (synthesizePlan); chat 054 (tasks UI).

**Goal:** Implement the algorithm that places pending tasks into focus blocks during plan synthesis. Tasks are sorted by priority and deadline proximity; they are split across multiple focus windows if longer than available time; they respect calendar event boundaries.

**Output:**
- `packages/ai/src/scheduling/taskPlacement.ts` — the algorithm that takes a list of pending tasks and the available open time windows in the day, returns the focus block assignments
- Documentation in the file explaining the algorithm
- Integration into `synthesizePlan` so that focus blocks reference the placed tasks

**Implementation notes:** The algorithm is greedy: sort tasks by priority descending, then deadline ascending, then iterate; for each task, find the next available window large enough; if no single window is large enough, split the task across the largest available windows. This is not optimal in the operations-research sense, but it is good enough for V1 and easy to understand.

**Dependencies:** Chats 022, 054.

**End-of-session checks:** A user with several pending tasks of varying priorities sees them placed correctly in the generated plan.

### Chat 056 — Tasks Module: Reflow and Over-Commit Prompt

*Block 7 | 🔵 🟢 🎩*

**Load at session start:** PRD §6.1 (mid-day reflow, over-commit prompt); chat 055.

**Goal:** Implement the mid-day reflow logic that activates when a new calendar event displaces a task chunk; the engine attempts a silent reshuffle, and only surfaces a prompt when no resolution exists within the day. The prompt is voice-gated and asks the user to choose which items move to tomorrow.

**Output:**
- The reflow logic invoked when the calendar sync detects a new conflicting event (the trigger from chat 067)
- `apps/web/components/plan/OverCommitPrompt.tsx` and the mobile equivalent — the prompt UI

**Implementation notes:** The silent reshuffle attempts to fit displaced task chunks into the next available windows; if all task work cannot fit in the remaining day, the over-commit prompt fires. The prompt presents the conflicting items as a list and asks the user to select which to keep and which to defer. Precedence ordering with chat 067: when a calendar sync delivers a new or modified event, chat 067's conflict resolution runs FIRST (any AI-placed blocks overlapping the new event are set to `rescheduled` and removed from the visible plan), then this chat's reflow runs SECOND on any remaining task displacement caused by the removal. Documented in both chats so the order is unambiguous.

**Dependencies:** Chat 055.

**End-of-session checks:** A reflow scenario produces a silent successful reshuffle. An over-commit scenario surfaces the prompt with the correct items.

### Chat 057 — Weekly Planning Session: Steps 1 through 3

*Block 7 | 🔵 🟢*

**Load at session start:** PRD §3.3 (Weekly Planning Flow); chat 029 (weekly priorities API); LAYER_4_EXPERIENCE_IDENTITY.md (Sunday prompt copy).

**Goal:** Build the first three steps of the weekly planning session: the Sunday prompt (dismissible butler line plus banner), step 1 prior week review (completion percentage), step 2 priority entry (three to five fields with AI pre-suggestion from outstanding tasks via Haiku), and step 3 fixed event confirmation.

**Output:**
- `apps/web/app/(app)/weekly-planning/page.tsx` — the weekly planning surface, web-primary
- `apps/mobile/app/(app)/weekly-planning.tsx` — mobile parity
- Sunday morning prompt component that displays in the day view
- Step-by-step UI for the first three steps

**Implementation notes:** The Sunday prompt fires on Sunday mornings in the user's local timezone; it is dismissible without action. The session is accessible all day Sunday via the weekly planner navigation. Step 1 displays the prior week's completion percentage; step 2 uses the suggested priorities from chat 023's `suggestWeeklyPriorities` Haiku call (which takes outstanding tasks and the prior week's completion data and returns 3–5 suggested priority strings — this function is added to chat 023's outputs and replaces the prior incorrect reference to `generateCheckInQuestion`), with the user able to overwrite; step 3 displays the upcoming week's calendar events for review.

**Dependencies:** Chats 029, 023.

**End-of-session checks:** A user can engage the weekly planning session on Sunday and complete the first three steps.

### Chat 058 — Weekly Planning Session: Steps 4 and 5

*Block 7 | 🔵 🟢 🤖 🎩 | ⚠️*

**Load at session start:** PRD §3.3 (Steps 4-5); chat 022 (synthesizePlan); chat 057.

**Goal:** Build the final two steps of the weekly planning session: step 4 module adjustments (pause modules for travel, dinner-out flags), and step 5 the Sonnet weekly template generation (seven-day grid review). The user accepts the plan or makes block-level adjustments, after which the per-day plans are written.

**Output:**
- The step 4 UI for module adjustments
- The step 5 weekly synthesis call to Sonnet and the seven-day review grid
- `packages/ai/src/weeklyTemplate.ts` — the Sonnet call

**Implementation notes:** The weekly template generation is the most complex Sonnet call in the application; it produces seven days of plans simultaneously with consistent priority threading. The user reviews the entire week in a grid view and either accepts in bulk or adjusts individual blocks. On accept, the per-day plans are written via batch insert to daily_plans and blocks. Timezone handling: the 7-day window starts at `start_of_local_day(user.timezone)` on the Sunday of generation, computed by the same Postgres function added in chat 004 so DST transitions during the week are handled correctly and per-day boundaries align with the user's local calendar. Anthropic spend interaction with chat 097a: weekly synthesis amortizes to roughly $0.004/day per active user, but the actual spend lands ~$0.030 on Sunday per user as a burst. The $0.030 figure assumes approximately 5K input tokens (Layer 1 system prompt is cache-shared with daily synthesis, paid at 0.1× input rate) plus approximately 1.5K output tokens (compressed weekly view across 7 days, roughly 200 tokens per day): `(5,000/1,000,000) × $3 × 0.1 + (1,500/1,000,000) × $15 = $0.0015 + $0.0225 = $0.024` warm-cache or up to `$0.0375` fully cold-cache. The $0.030 midpoint assumes a partial cache hit on the system prompt. If a future prompt change pushes the weekly output above 1.5K tokens, the Sunday spike scales linearly with output volume; chat 058's eval-baseline verification on Chat 020 captures regressions. The chat 097a budget formula (`max($5/day floor, $1.20/user/month × (active+trial users) / 30)`) and its 80%/100%/200% alert thresholds accommodate this Sunday spike — alerts are tuned to expect the burst rather than firing on it. (Per H-1 decision: coefficient is $1.20 to match operative AI cost.)

**Dependencies:** Chats 057, 022.

**End-of-session checks:** A full weekly planning session completes successfully. The generated plan is consistent across days. User adjustments persist.

### Chat 059a — Sleep Module Logic

*Block 7 | 🟡 🎩*

**Load at session start:** PRD §6.4 (Sleep module); chat 022 (synthesizePlan).

**Goal:** Implement the sleep module's plan synthesis hooks: wind-down block placement N minutes before bedtime_target, bedtime butler line trigger, and quiet hours enforcement integration.

**Output:**
- `packages/ai/src/synthesizePlan.sleep.ts` — adds wind-down block to the plan based on user's bedtime_target
- Integration with the quiet hours utility from chat 046

**Implementation notes:** The wind-down block default is fifteen minutes before bedtime; the user can adjust in module preferences. The bedtime butler line fires from the ambient line engine when the current time is within five minutes of bedtime.

**Dependencies:** Chats 035, 022.

**End-of-session checks:** A user with sleep enabled sees a wind-down block in their daily plan. The bedtime butler line fires correctly.

### Chat 059b — iOS Alarm Screen

*Block 7 | 🟢 | ⚠️*

**Load at session start:** PRD §3.2 (Morning alarm); LAYER_4_EXPERIENCE_IDENTITY.md (alarm design); Apple Human Interface Guidelines for notifications.

**Goal:** Build the iOS native alarm screen with two edge-to-edge buttons (SNOOZE and STOP) that dismisses on a single tap without requiring phone unlock. This is a Notification Service Extension or actionable notification with custom UI, both of which require native iOS work.

**Output:**
- `apps/mobile/ios/VesperAlarmExtension/` — a Notification Service Extension target added to the Xcode project (via Expo prebuild + manual Xcode work)
- The extension implements custom UI for the alarm notification with the two-button layout
- The alarm scheduling logic in `apps/mobile/lib/alarm.ts` that schedules local notifications at the user's wake_target, with PostHog event emission at each lifecycle stage: `alarm_scheduled` (carrying `{wake_target_local, scheduled_at, snooze_minutes}`), `alarm_fired` (carrying `{fired_at, latency_from_target_ms}`, set on the Notification Service Extension via app-group shared UserDefaults so the React Native side can read on next foreground), `alarm_dismissed` (carrying `{action: 'snooze'|'stop', dismissed_at}`). Without these, post-launch "why didn't my alarm fire" debugging has no client-side trail beyond the user's verbal report. Events are added to chat 096's PostHog taxonomy.
- `docs/RUNBOOKS/IOS_ALARM_REBUILD.md` — runbook describing the manual Xcode steps required to recreate the Notification Service Extension target after `expo prebuild --clean` regenerates the iOS project; same pattern as the widget rebuild runbook owned by chat 077

**Implementation notes:** This chat involves manual Xcode work because Expo does not have first-class support for Notification Service Extensions; the prebuild generates the iOS project, then the founder adds the target manually in Xcode. The extension's UI is implemented in SwiftUI. The two-button layout with edge-to-edge buttons is achieved via the notification's category configuration. The dismissal-without-unlock requires the notification's `interruption-level` to be set to `time-sensitive` or `critical`; time-sensitive is the appropriate choice for normal alarms (critical is reserved for emergency alerts). The runbook is essential because every `expo prebuild --clean` wipes the manually-added target; recovery requires the documented step list rather than improvisation.

**Dependencies:** Chat 013.

**End-of-session checks:** A scheduled alarm fires on the physical iPhone with the two-button layout. Tapping either button dismisses the alarm.

### Chat 060 — Medications Module

*Block 7 | 🔵 🟢 | ⚠️*

**Load at session start:** PRD §6.5 (Medications); TECHNICAL_SPEC.md §3.9 (medications table); chat 005 (audit trigger).

**Goal:** Build the medications module with the strictest RLS verified, the audit trigger firing on every CRUD verified end-to-end, the times[] picker for daily dose times, local notification scheduling via expo-notifications, quiet hours respect with per-medication override, and PostHog session recording masking on the medications surface.

**Output:**
- `apps/web/app/(app)/medications/page.tsx` and `apps/mobile/app/(tabs)/medications.tsx`
- Medication CRUD UI with times[] picker
- `apps/web/app/api/v1/medications/route.ts` and `apps/web/app/api/v1/medications/[id]/route.ts` — medication CRUD API
- Local notification scheduling in `apps/mobile/lib/medicationReminders.ts`

**Implementation notes:** Medications are the most sensitive data in the application. RLS strictest means the SELECT, INSERT, UPDATE, DELETE policies all check `auth.uid() = user_id` with no exceptions. The audit trigger fires on every operation and writes to security_audit_log. The times[] picker allows the user to specify multiple times of day for a daily medication; for weekly or custom frequency, the picker UI adjusts. The local notifications are scheduled by expo-notifications at the user's specified times; quiet hours suppress them unless the medication has the override flag set. The push permission posture is soft-gate, not hard-gate: iOS does not allow re-prompting the system permission dialog after a user denies it, so at medication-add time the surface displays a contextual in-app rationale explaining that reminders only work when notifications are enabled, with a direct deep link to iOS Settings → Vesper → Notifications where the user can toggle the permission. A persistent prominent in-app banner with a red-priority style appears at each scheduled dose time when the app is in the foreground. If the app is closed and permission is denied, the dose reminder cannot fire — this is the user's informed choice. The settings panel always exposes the same iOS Settings deep link for users who want to enable notifications later. Failure-mode capture: any `expo-notifications` schedule call that throws is captured to Sentry with the error message and a PostHog event `medication_notification_schedule_failed` is emitted with `{medication_id, scheduled_times_count, error_class}`. This catches the silent-failure window between "user added medication" and "user reports never receiving reminder" — without the explicit capture, support triage has no breadcrumb. PostHog session-recording masking is not applied at V1: autocapture is OFF (chat 096) and session recording is not enabled at V1, so the prior `data-ph-no-capture` instruction is unnecessary. If session recording is enabled at V1.5, every surface that displays medication content must be wrapped with the `data-ph-no-capture` attribute at that time.

**Dependencies:** Chats 005, 028.

**End-of-session checks:** Medication CRUD works on both surfaces. Notifications fire at the configured times. The audit trigger writes to security_audit_log on every change (verified by inserting a test medication and confirming the security_audit_log row). PostHog autocapture is verified OFF on the medications routes (no `posthog.capture` calls on form inputs or sensitive fields); when session recording is enabled at V1.5, this check is replaced with the masking verification — every surface that displays medication content carries the `data-ph-no-capture` attribute and PostHog session recordings produce blank frames for those regions.

### Chat 061 — Finance and Bills Module

*Block 7 | 🔵 🟢 🎩*

**Load at session start:** PRD §6.7 (Finance); TECHNICAL_SPEC.md §3.11 (bills table).

**Goal:** Build the bills CRUD UI and API, defaulting the finance module to OFF at onboarding, with bill-due-tomorrow butler line copy authored for the worker in chat 075. PostHog session recording is also masked on the bills surface.

**Output:**
- `apps/web/app/(app)/bills/page.tsx` and `apps/mobile/app/(tabs)/bills.tsx`
- Bills CRUD UI
- `apps/web/app/api/v1/bills/route.ts` and `apps/web/app/api/v1/bills/[id]/route.ts`
- The voice-gated bill reminder copy

**Implementation notes:** Bills CRUD includes name, amount, due_day_of_month, frequency, and category. The module is OFF by default; users must enable it explicitly via the module toggle.

**Dependencies:** Chat 028.

**End-of-session checks:** Bills CRUD works. Module toggle correctly hides the surface when disabled. The audit trigger writes to security_audit_log on every bills CRUD operation (verified by inserting a test bill and confirming the security_audit_log row, parallel to the medications verification in chat 060). RLS on the bills table verified: SELECT, INSERT, UPDATE, DELETE all check `auth.uid() = user_id` with no exceptions. PostHog autocapture is verified OFF on the bills routes; session-recording masking via `data-ph-no-capture` is V1.5 work conditional on session recording adoption (same posture as chat 060 per the documented PostHog hygiene).

### Chat 062 — Errands Module

*Block 7 | 🔵 🟢 🎩*

**Load at session start:** PRD §6.6 (Errands); TECHNICAL_SPEC.md §3.10 (recurring_errands table).

**Goal:** Build the errands module with recurring errand CRUD (frequency plus day-of-week anchor), one-off errand creation via the natural-language input, and the errands block detail UI showing the errand checklist.

**Output:**
- `apps/web/app/(app)/errands/page.tsx` and `apps/mobile/app/(tabs)/errands.tsx` — recurring errands management
- `apps/web/app/api/v1/recurring-errands/route.ts` and the [id]/route.ts equivalent
- `apps/web/components/plan/details/ErrandsBlock.tsx` and the mobile equivalent — the errands block detail view with a flat checklist of errand stops ordered by deadline (no routing or sequencing is applied; the local intelligence layer has been removed from V1)

**Implementation notes:** Recurring errands have a frequency (weekly, biweekly, monthly) and an optional day_of_week anchor. The errands block detail renders stops as a flat checklist ordered by deadline. No routing or sequencing is applied.

**Dependencies:** Chats 028, 045.

**End-of-session checks:** Recurring errands CRUD works. Errand blocks appear in the plan on the right days. The errands block detail renders the stops correctly.

---

## Block 8 — Integrations (Google Calendar)

Block 8 brings Google Calendar online, with the pgsodium key rotation runbook authored as a non-negotiable deliverable.

### Chat 063 — Google Calendar OAuth, pgsodium Encryption, and Key Rotation Runbook

*Block 8 | 🔵 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §6 (Google Calendar OAuth); TECHNICAL_SPEC.md §14 (Open Question 1 — pgsodium key rotation); the integrations table schema; LAYER_3_TECHNICAL_ARCHITECTURE.md (encryption).

**Goal:** Implement the Google Calendar OAuth flow with token storage encrypted via pgsodium. Author the key rotation runbook as a committed file in `docs/RUNBOOKS/PGSODIUM_KEY_ROTATION.md` before any production OAuth token is ever encrypted. Build the integrations settings UI on web and mobile with the reconnect banner pattern for error states. The Apple Calendar option renders disabled with "Coming soon."

**Output:**
- `apps/web/app/api/v1/integrations/google-calendar/connect/route.ts` — POST handler that exchanges the OAuth code for tokens, encrypts via pgsodium, writes the integrations row
- `apps/web/app/api/v1/integrations/[provider]/route.ts` — DELETE handler that revokes the token with Google and deletes the row
- `apps/web/app/(app)/settings/integrations/page.tsx` and the mobile equivalent
- `docs/RUNBOOKS/PGSODIUM_KEY_ROTATION.md` — the full step-by-step rotation procedure
- `packages/db/src/encryption.ts` — the encryption helpers that wrap pgsodium
- Ownership statement: `docs/RUNBOOKS/APPLE_ROOT_CA_ROTATION.md` is authored in chat 086 (not this chat); the pgsodium runbook lives here, the Apple Root CA runbook lives in chat 086, and `docs/RUNBOOKS/README.md` from chat 003 indexes both

**Implementation notes:** The pgsodium key is a server-held key (stored as a Supabase secret); decryption happens only inside API routes that need to call the third-party provider. The runbook describes the rotation procedure: generate a new key, add it alongside the old key (pgsodium supports multiple keys), re-encrypt all integrations rows with the new key, mark the old key inactive, and after a verification period remove the old key. The runbook also describes the recovery procedure if the encryption key is ever lost (data is unrecoverable; users must re-authenticate). The runbook is critical because rotation is a security operation that cannot be improvised under pressure. Both the OAuth code-for-token exchange (Google's `https://oauth2.googleapis.com/token` endpoint) and the token-revoke call on disconnect are wrapped in try/catch with Sentry capture of the response status code, the error body, and a correlation ID; structured log includes the user_id, the provider, and the operation outcome (success / auth-error / network-error). This is the diagnostic trail for "I clicked Connect and nothing happened" reports.

**Dependencies:** Chats 030, 012, 013, 008.

**End-of-session checks:** A user can connect Google Calendar. Tokens are encrypted at rest (verified by inspecting the integrations row). The audit trigger writes to security_audit_log on every integrations row INSERT and DELETE (verified by the chat 006 audit-schema.ts script and by inspecting security_audit_log after a test connect-then-disconnect cycle). The runbook is complete and committed.

### Chat 064 — Google Calendar Sync Logic, Token Refresh, Event Classification

*Block 8 | 🔵 🤖*

**Load at session start:** TECHNICAL_SPEC.md §6 (Google Calendar sync behavior, token refresh); chat 023 (classifyCalendarEvent); chat 063.

**Goal:** Implement the Google Calendar event fetch with automatic token refresh on expiry, the Haiku event classification for ambiguous events (e.g., a calendar event titled "Meeting with Sam" classified as work block_type), and the integration of these events into plan synthesis as fixed constraints.

**Output:**
- `packages/shared/integrations/googleCalendar.ts` — `getTodayEvents(userId): Promise<CalendarEvent[]>` with automatic refresh
- Integration with the Layer 4 of plan synthesis context builders
- `last_synced_at` and `last_error` updates on the integrations row

**Implementation notes:** The token refresh logic checks the integrations.expires_at field before each call; if expired or within five minutes of expiry, it calls the Google OAuth token endpoint with the refresh token to get a new access token, then re-encrypts and updates the integrations row. If the refresh call fails (typically because the user has revoked access in their Google account), the integrations row transitions from `status='connected'` to `status='error'`, `last_error` is populated with the failure cause, every refresh attempt logs a Sentry breadcrumb with the user_id, the response status, and the error code on any non-2xx response (so transient errors that subsequently succeed remain visible in Sentry breadcrumbs even when `last_error` is overwritten on recovery), and the plan synthesis context builder explicitly checks `integrations.status` before treating calendar events as available: if `status='error'`, the synthesis call surfaces a chat 099 broken-integration banner trigger and degrades the plan with an empty calendar events array — no silent degradation, no further retry until the user explicitly reconnects. The reconnect banner in chat 099 reads the `status='error'` field as the surface trigger rather than `last_error IS NOT NULL`, so transient errors that the next sync recovers from do not flicker the banner. The event classification calls the batched Haiku classifier from chat 023 (`classifyCalendarEventsBatch`) when 2 or more ambiguous events need classification in a single sync (the common case at morning sync); exactly 1 ambiguous event uses the single `classifyCalendarEvent` call (no batching overhead for a one-element batch). Events with words like "gym" or "lunch" are classified by rules first and never reach the Haiku call.

**Dependencies:** Chats 063, 023.

**End-of-session checks:** A user with Google Calendar connected sees their calendar events as fixed blocks in the daily plan. Token refresh works automatically.

### Chat 065 — Google Calendar Push Webhook Channel Registration and Receiver

*Block 8 | 🔵 🚧*

**Load at session start:** Google Calendar Push Notifications API documentation; chat 064.

**Goal:** Register a push webhook channel with Google so that calendar changes propagate to the application in near-real time rather than only at plan generation time. Implement the receiver endpoint that validates the Google headers and triggers an incremental sync. This chat is partially Cutover-blocked: channel registration requires the production HTTPS endpoint, but the receiver endpoint can be implemented and tested with mock requests in development.

**Output:**
- `apps/web/app/webhooks/google-calendar/route.ts` — POST handler that validates the X-Goog-Resource-State and X-Goog-Channel-Token headers, then triggers an incremental sync via the channel's resource URI
- `apps/web/lib/googleCalendar/registerWatch.ts` — the channel registration function called when an integration is connected

Channel registration is Cutover-blocked because Google requires an HTTPS endpoint with a verified domain (the Google Site Verification step in Cutover C-17). In development, channels are not registered, and the sync logic from chat 064 runs only at plan generation time. After Cutover, channels are registered automatically when integrations are created. Every receipt logs a structured entry with the X-Goog-Channel-ID, X-Goog-Resource-ID, X-Goog-Message-Number, and the X-Goog-Channel-Token validation result. On token-mismatch, the receiver returns 401 with no sync trigger and a Sentry alert (the only legitimate sender is Google, so a mismatch indicates either a misconfigured channel or an attempted spoof). On successful receipt, the incremental sync trigger outcome (success / error / no-changes) is appended to the same log entry so the full receipt-to-sync flow is observable in a single Sentry event.

**Dependencies:** Chats 064, Cutover C-17 for full functionality.

**End-of-session checks:** The receiver endpoint validates mock requests correctly. The channel registration code is correct (verified against the Google API documentation).

### Chat 066 — Google Calendar Channel Renewal Worker

*Block 8 | 🟣*

**Load at session start:** Chat 065; Google Calendar push channel expiration policy (max 7 days).

**Goal:** Build the Cloudflare Worker that runs daily and renews Google Calendar push channels that are expiring within 24 hours. Without this worker, push sync silently dies after a week of channel expiration.

**Output:**
- `workers/daily-cron/modules/gcal-channel-renewal.ts` — the channel renewal module dispatched from the consolidated daily-cron worker at the 5am UTC tick (per Chat 001 Decision 20); no longer a standalone `workers/gcal-channel-renewal/` directory
- `docs/RUNBOOKS/GCAL_CHANNEL_RENEWAL.md` — the operational runbook covering (a) detection of silent multi-day worker failure via the integrations table query for channels with expiration in the past; (b) manual channel re-registration procedure for affected users; (c) decision tree on whether to email affected users; (d) post-fix verification steps; (e) how to confirm the worker is firing on schedule via the daily-cron logs

**Implementation notes:** The module queries integrations where the channel expiration is within 24 hours, re-registers the channel via Google's API, and updates the integrations row with the new expiration. Each module run logs start time, end time, integrations processed, and renewals attempted / succeeded / failed counts to completion_log with event_type='gcal_channel_renewal_run'. Failed renewals are individually logged to Sentry with the user_id and the Google API error. The Chat 097a alerting layer fires if the module does not execute its 5am UTC dispatch within a 90-minute window (worker-didn't-run defense).

**Dependencies:** Chat 065.

**End-of-session checks:** The worker runs locally via wrangler and successfully renews a test channel.

### Chat 067 — Google Calendar Conflict Resolution

*Block 8 | 🔵 🎩 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §6 (Conflict resolution); chat 045 (ambient line for prompt display).

**Goal:** Implement the conflict resolution logic: when a Google Calendar sync delivers a new or modified event that overlaps an existing AI-placed block, the block is silently set to `rescheduled` status and removed from the visible plan, and a butler-voice prompt offers to regenerate the rest of the day.

**Output:**
- `packages/shared/integrations/googleCalendar.conflict.ts` — conflict detection logic
- The integration with the ambient line and butler prompt UI for surfacing the resolution choice
- A completion_log write with event_type=plan_regenerated and trigger source=calendar_conflict
- PostHog events `calendar_conflict_detected` (on detection, with payload `{conflict_count, user_action_pending}`) and `calendar_conflict_resolved` (on user action, with payload `{user_action: 'regenerated' | 'dismissed', conflict_count}`) so post-launch analysis of conflict frequency and resolution choices is queryable. Add both events to chat 096's PostHog taxonomy.

**Implementation notes:** The conflict detection runs after each calendar sync. It checks for overlap between the new/modified event and existing blocks; for each conflict, the block's status is updated to rescheduled and the block is removed from the timeline. The butler-voice prompt appears in the ambient line surface: "Your plan needs another look. Shall I redo the rest of today?" If accepted, plan generation fires for the affected day. If dismissed, the plan remains in its post-removal state. Precedence ordering with chat 056: this chat's conflict resolution runs FIRST on every calendar sync (AI-placed overlapping blocks set to `rescheduled`); chat 056's reflow runs SECOND on any task displacement that results. Documented in both chats so the order is unambiguous.

**Dependencies:** Chats 064, 045.

**End-of-session checks:** A test scenario with a conflicting event triggers the prompt correctly. Acceptance regenerates the plan. Dismissal leaves the gap.

### Chat 68,69,70 have been deleted intentionally since features here have been removed. future chats start from 71 there will just be no chat 68,69,70 right now.

## Block 9 — Cloudflare Workers

Block 9 builds the scheduled workers that handle autonomous timed actions. Per Chat 001 Decision 20 (cron consolidation pattern), the Block 9 footprint on Cloudflare Workers is:

- `cache-prewarm` — HTTP-triggered, no cron (chat 071); fires from the iOS alarm path
- `daily-cron` — single consolidated worker that dispatches by hour-of-UTC to its registered modules: trial-reminder and dunning-check (chat 072), hard-delete (chat 073), reconciliation (chat 074), bill-reminder and apns-token-cleanup (chat 075), gcal-channel-renewal (chat 066), spend-monitor (chat 097a). The apple-pki-monitor (chat 086a) is intentionally kept as a standalone weekly-cron worker because its weekly schedule does not compose cleanly with daily-cron's hourly dispatch model; standalone keeps the worker logic simple. The Cloudflare Workers paid-tier cron-trigger budget is 250 per account, so the one extra trigger from 086a is well within budget.
- `live-activity-pusher` — stays separate (chat 080) because of its tight CPU budget and 5-minute cron cadence

Each chat in this block still describes its own logic; the worker boundary is purely a deployment concern. The consolidation keeps the cron-job count under the Cloudflare Workers free-tier ceiling without changing the per-feature implementation.

### Chat 071 — Cache Pre-Warm Worker

*Block 9 | 🟣 🤖 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §10 (Cloudflare Workers, cron triggers); TECHNICAL_SPEC.md §5 (Cache pre-warm strategy); chats 021, 022 (context builders and synthesizePlan); chat 059b (iOS alarm firing path).

**Goal:** Build the Cloudflare Worker that warms the Anthropic prompt cache shortly before a user opens the app each morning, dropping first-plan latency from approximately 8 seconds to approximately 2 seconds on cache-hit mornings. The warm trigger is event-driven (fired by the iOS alarm path in chat 059b for mobile users with sleep alarms configured) rather than cron-based; this targets warming to users who are about to open the app and avoids the wasted spend of broadcast-style warming.

**Output:**
- `workers/cache-prewarm/index.ts` — the worker entry point exposing a single HTTP endpoint `/warm?userId=X` authenticated via internal shared-secret
- `workers/cache-prewarm/wrangler.toml` — no cron schedule; the worker runs only on HTTP trigger
- The iOS alarm firing path in chat 059b calls this worker via fetch when the alarm fires; web users and mobile users without alarms get cold-cache first-plan generation (acceptable; cold-cache adds ~6 seconds, which is fine for users who are not in a morning-ritual mode)
- The worker logic: read the user's last_warmed_at column; if it was within the past 5 minutes, no-op (avoids double-warm on rapid alarm dismiss-then-snooze); otherwise, make a lightweight Anthropic call with Layer 1, Layer 2, and Layer 3 cache markers populated but Layer 4 left empty; update users.last_warmed_at to now; log to completion_log with event_type=cache_prewarm
- Sentry breadcrumbs for each warm attempt
- CPU time monitoring (the worker must complete within Cloudflare's 10ms CPU limit on the free tier or 50ms on the paid tier; the warm call's network wait is not CPU time)

**Implementation notes:** The earlier design used a per-minute cron with timezone-aware queries to warm the cache during a 5:20-5:30 local window; that design wasted significant spend because the 5-minute Anthropic cache TTL meant warms more than 5 minutes before app open were entirely wasted, and users opening the app outside the window got cold cache anyway. The alarm-triggered design warms only when the user is about to open the app (statistical likelihood is high: the alarm just fired). The `last_warmed_at` deduplication prevents the snooze loop from triggering N warm calls in 10 minutes. The warm path is iOS-sleep-alarm-only: web users, Android users, and iOS users without the sleep module enabled do NOT get pre-warm and see cold-cache first-plan latency (~6 seconds added). This is an acceptable cost trade because those cohorts produce lower-stakes first impressions (web users typically check Vesper on desktop in mid-morning rather than as a morning ritual; Android is V1.5). The Anthropic spend formula in chat 097a (`max($5/day floor, $1.20/user/month × (active+trial users) / 30)`) explicitly accounts for the lower cache-hit rate across the non-prewarmed cohorts: cost per first plan is ~$0.060 cold versus ~$0.036 warm (per the operative AI-cost numbers locked in chat 019's token budget: cold = 10K input × $3/M + 2K output × $15/M = $0.030 + $0.030 = $0.060; warm assumes 9K of the 10K input is cache-shared at 0.1× input rate while 1K is fresh per-call: warm = 9K × $3/M × 0.1 + 1K × $3/M + 2K × $15/M = $0.0027 + $0.003 + $0.030 = $0.0357 ≈ $0.036), so the budget formula assumes a blended cost weighted by the iOS-sleep-alarm penetration rate observed in PostHog. The warm savings per first plan are ~$0.024 (40% reduction); the prewarm-for-iOS-sleep-alarm-cohort decision remains correct at the rederived numbers because even a 40% cost reduction on a high-volume morning-ritual cohort is material. The Anthropic call uses the same context builders as the real plan generation but with an empty Layer 4 (no calendar events, no pending tasks, no energy score); the call's only purpose is to populate the cache. The worker logs each warm attempt to completion_log with event_type=cache_prewarm and the user_id; this enables post-launch analysis of cache hit rates.

**Dependencies:** Chats 021, 022, 059b, 005 (last_warmed_at column).

**End-of-session checks:** The worker runs locally via wrangler and produces a cache hit on a subsequent real plan generation call. The chat 059b alarm firing path successfully POSTs to `/warm`. CPU time per invocation is within limits. A double-fire (alarm dismiss + immediate snooze) is correctly deduplicated by last_warmed_at.

### Chat 072 — Trial Reminder and Dunning Check Workers

*Block 9 | 🟣 🎩*

**Load at session start:** TECHNICAL_SPEC.md §10 (Cloudflare Workers); LAYER_5_BUSINESS_MONETIZATION.md (trial reminder schedule, dunning policy); chat 091 (Resend templates; this chat consumes templates that chat 091 produces, so it ships with stubs or runs after chat 091).

**Goal:** Build two modules under the consolidated `daily-cron` worker (per Chat 001 Decision 20). The trial reminder module runs once per hour from inside the consolidated worker, identifying each user whose local 9am has just passed and who is at a trial-end checkpoint; it sends Resend emails plus sets in-app banner flags at two-day, one-day, and zero-day trial-end checkpoints (trial day 5, day 6, and day 7 respectively for the 7-day trial). The query is timezone-aware via the `start_of_local_day` Postgres function from chat 004 rather than referencing chat 071's HTTP-triggered pattern: the 2-day reminder uses `SELECT * FROM users WHERE date_trunc('day', start_of_local_day(timezone)) = date_trunc('day', trial_ends_at - interval '2 days')`, with analogous queries for the 1-day and 0-day checkpoints. The dunning check module runs once daily at 4am UTC and transitions users whose past_due window has elapsed (seven days per Tech Spec) into read_only status.

**Output:**
- `workers/daily-cron/modules/trial-reminder.ts` — the trial reminder module dispatched from the consolidated daily-cron worker at the appropriate hour tick
- `workers/daily-cron/modules/dunning-check.ts` — the dunning check module dispatched at the 4am UTC tick
- The `workers/daily-cron/wrangler.toml` cron registration covers both modules; there is no longer a standalone `workers/trial-reminder/` or `workers/dunning-check/` directory
- Both modules use the auth-aware Resend SDK for email delivery
- The dunning check module invokes the subscription state machine transition function from chat 081 to move users to read_only

**Implementation notes:** The trial reminder worker computes for each user whether today is two days before trial_ends_at, one day before, or the day-of (trial_ends_at == current local date). For each matching user, it sends the corresponding Resend email template and sets a banner flag on the user record so the app surfaces the reminder visually. The 7-day trial leaves no room for a 3-day-before reminder (that would land on day 4 of 7, too early to be useful); the compressed schedule of day-5, day-6, day-7 reminders matches the trial length. The dunning check worker queries users where subscription_status='past_due' and the past_due transition was more than seven days ago; for each, it transitions to read_only via the state machine. Both workers log each notification or transition to completion_log for analytics.

**Dependencies:** Chat 030 (subscription state machine stub for the dunning-check `transitionToReadOnly` function name), chat 081 (full subscription state machine implementation — the dunning-check module's `transitionToReadOnly` call against Chat 030's stub compiles in Block 9 but the real transition behavior is gated on Chat 081 landing; trial-reminder module is unaffected by 081), chat 091 (Resend templates; hard dependency, not stub — the trial reminder worker imports the email components from chat 091 directly, and TypeScript compile fails if a referenced template is missing, eliminating the risk of placeholder copy reaching production).

**End-of-session checks:** The trial reminder worker correctly identifies test users at the two-day, one-day, and day-of points and sends the expected emails. The dunning check worker correctly transitions test users from past_due to read_only after the configured window.

### Chat 073 — Hard-Delete Worker with Stripe Cleanup

*Block 9 | 🟣 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §10 (hard-delete worker); TECHNICAL_SPEC.md §4 (Account Deletion Flow); chat 030 (account delete API).

**Goal:** Build the daily worker that finds users whose deletion_requested_at is more than 30 days old, computes the SHA-256 hash of their email and inserts it into deleted_user_email_hashes, cancels their Stripe subscription if any remains active, deletes their Stripe Customer record, and then deletes the users row (which cascades via foreign keys to every child table). Verify cascade behavior before deploying to production.

**Output:**
- `workers/daily-cron/modules/hard-delete.ts` — the hard-delete module dispatched from the consolidated daily-cron worker at the 2am UTC tick (per Chat 001 Decision 20); no longer a standalone `workers/hard-delete/` directory
- A pre-deployment verification script in `workers/daily-cron/scripts/verify-hard-delete-cascade.ts` that creates a test user, populates child rows in every table, runs the deletion, and confirms all child rows are gone
- Sentry info-level log for each successful deletion
- A `docs/RUNBOOKS/HARD_DELETE_RECOVERY.md` runbook describing what to do if a deletion is run incorrectly (the answer is essentially nothing; the operation is irreversible)

**Implementation notes:** This chat carries elevated risk because hard deletion is irreversible. The cascade verification script is non-negotiable; without it, a missing ON DELETE CASCADE on any table would cause the deletion to fail (good) or leave orphan rows (bad). The script tests every child table: user_profiles, daily_plans, blocks, tasks, weekly_priorities, medications, recurring_errands, bills, integrations, push_tokens, subscriptions, completion_log, security_audit_log, referral_credits, calendar_events, hydration_log, email_queue, delayed_jobs, and cancellation_events. Note that security_audit_log uses ON DELETE CASCADE per the V1 retention policy from chat 003; audit rows are wiped along with the user, which aligns with GDPR/CCPA right-to-erasure and is acceptable because the product is not HIPAA-covered. Before invoking the SQL DELETE on `users` (and therefore the cascade), the module ends every active Live Activity for the user: it queries the user's active block set, then calls the live-activity-pusher worker's immediate-trigger endpoint with `action='end'` for each active block, sequentially. This step runs BEFORE the push_tokens cascade so that the worker still has valid tokens to authenticate the end-call. Without this, devices would continue showing the orphan activity until ActivityKit's stale-date expiry hours later. The Stripe cleanup is essential because if the Stripe subscription continues to exist, the user is charged on the next renewal even though their Vesper account is gone. The cancellation-then-delete sequence handles Stripe's internal propagation delay: `stripe.subscriptions.cancel(subId, { invoice_now: false, prorate: false }, { idempotencyKey: `hard-delete-cancel-${userId}` })` is called first, followed by polling `stripe.subscriptions.retrieve(subId)` until status returns 'canceled' or up to 5 retries with 500ms backoff; only then is `stripe.customers.del(customerId, { idempotencyKey: `hard-delete-del-${userId}` })` called. Both outbound Stripe calls pass an explicit Idempotency-Key per chat 084's Stripe outbound-idempotency convention, so a retry of the hard-delete module after a partial failure does not produce duplicate cancel attempts or duplicate del attempts. Without this poll, an immediate customer deletion can fail with "customer has active subscriptions" because Stripe takes 100-500ms to mark the subscription canceled internally.

**Dependencies:** Chats 030 (account delete sets the trigger field), 005 (deleted_user_email_hashes table), 080 (live-activity-pusher immediate-trigger endpoint — hard cross-block dependency from Block 9 to Block 10; the end-active-Live-Activities-before-cascade step requires Chat 080's HTTP endpoint and `LIVE_ACTIVITY_TRIGGER_SECRET` to authenticate end-calls; either Chat 080 ships before Chat 073's logic completes, or Chat 073's first build stubs the LA-end step and a follow-up chat after Chat 080 integrates it; the second option leaves a documented gap where deleted users' devices retain orphan Dynamic Island activities until ActivityKit's staleDate fires hours later).

**End-of-session checks:** The verification script confirms all cascade behaviors work. The worker runs successfully against a test user. The Stripe customer is deleted. The user's row and all child rows are gone. The email hash is inserted into deleted_user_email_hashes.

### Chat 074 — Reconciliation Worker

*Block 9 | 🟣 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §10 (reconciliation worker); chat 084 (Stripe webhook handler); chats 087, 088 (Apple ASSN V2 worker). This chat must ship after chats 084, 087, and 088 because it consumes the subscription_events table that those chats populate.

**Goal:** Build the nightly worker that compares the canonical subscription state in the subscriptions table against the source-of-truth events in subscription_events. For each user, it determines whether the subscriptions table accurately reflects the most recent active event from either Stripe or Apple. When there is a discrepancy, it logs the conflict to Sentry for manual review and, in low-risk cases, automatically corrects the subscriptions row.

**Output:**
- `workers/daily-cron/modules/reconciliation.ts` — the reconciliation module dispatched from the consolidated daily-cron worker at the 3am UTC tick (per Chat 001 Decision 20) plus an HTTP-triggered path exposed on the same worker for inline calls; no longer a standalone `workers/reconciliation/` directory
- Inline reconciliation triggers: chats 084 and 087/088 (Stripe and Apple webhook workers) insert a row into the `delayed_jobs` table from chat 005 with `job_type='reconcile_subscription'`, `payload={ userId }`, and `scheduled_for = now() + interval '5 minutes'`; the daily-cron worker (running at each hour tick) picks up due `delayed_jobs` rows and dispatches them to the reconciliation HTTP endpoint, marking `processed_at` on success. This replaces the prior Upstash QStash delay queue dependency end-to-end.
- Reconciliation logic that handles the cross-provider precedence rule: most recent active event wins; if Stripe shows active and Apple shows active, the more recently updated wins
- Sentry alerts for any unresolvable discrepancy

**Implementation notes:** Cross-provider reconciliation is subtle because a user may have an active Stripe subscription from a previous web sign-up and an active Apple subscription from a later iOS sign-up. The application has a one-row-per-user constraint on subscriptions, but the source-of-truth events show both. The precedence rule resolves this: the most recent active event determines the canonical subscription. The 5-minute delayed inline trigger (now via `delayed_jobs` rather than QStash) ensures a paying user does not sit in a wrong-state read_only for up to 23 hours waiting for the nightly cron. Upstash Redis remains in the architecture for rate limiting (chat 009), the heartbeat-extended idempotency lock (chat 025), and the per-user circuit breaker (chat 022); only the QStash delay-queue dependency is removed in favor of the in-database `delayed_jobs` table. The worker logs each reconciliation outcome to completion_log; manual review surfaces happen via Sentry alerts on the unresolvable cases (e.g., both providers show conflicting cancellation dates within the same hour).

**Dependencies:** Chats 084, 087, 088.

**End-of-session checks:** A test scenario with conflicting Stripe and Apple states produces the correct canonical state. The worker correctly logs ambiguous cases to Sentry.

### Chat 075 — Bill Reminder Worker and APNs Token Cleanup Worker

*Block 9 | 🟣 🎩*

**Load at session start:** PRD §6.7 (bill reminder copy); chat 061 (bills CRUD); chat 080 (live-activity-pusher generates 410 responses).

**Goal:** Build two workers. The bill reminder worker runs daily at 9am in each user's local time and sends a butler-voice in-app notification one day before each upcoming bill due date. The APNs token cleanup worker handles the case where the live-activity-pusher worker receives a 410 Gone response from Apple's APNs servers, indicating that the device's push token is invalid and should be removed from the database.

**Output:**
- `workers/daily-cron/modules/bill-reminder.ts` — the bill reminder module dispatched from the consolidated daily-cron worker; the daily-cron dispatches at hour-of-UTC ticks (matching chat 072's pattern), and on each tick the module queries users whose local time is within the 9am hour using the `start_of_local_day` Postgres function and a timezone offset filter, then for each matching user identifies bills due within 24 hours and queues a butler-voice in-app reminder; no longer a standalone `workers/bill-reminder/` directory and no per-user cron registration (per Chat 001 Decision 20)
- `workers/daily-cron/modules/apns-token-cleanup.ts` — the APNs cleanup module dispatched from daily-cron; reads recent 410 Gone responses logged by the live-activity-pusher worker and nulls the matching push_tokens rows
- The `workers/daily-cron/wrangler.toml` cron registration covers both modules
- The bill reminder copy is voice-gated and uses the butler line library entry "Your [bill name] is due tomorrow."

**Implementation notes:** The bill reminder is an in-app notification surface, not a push notification, because the privacy posture forbids push notifications for financial reminders. The notification is delivered as an ambient line on the next app open; the prior Dynamic Island prompt for bill reminders is removed (in-app ambient line only — financial reminders never surface on the Dynamic Island per the privacy posture). The APNs cleanup logic processes 410 responses from the APNs servers (the response indicates that the device's token is no longer registered with Apple) and nulls the corresponding push_tokens row. Without this cleanup, the live-activity-pusher worker continues attempting to deliver to dead tokens, wasting Cloudflare Worker invocations and adding noise to Sentry logs. Each module run (bill-reminder and apns-token-cleanup) logs to completion_log with the module name, items processed, and success/failure counts; Sentry breadcrumbs cover any APNs API call failure (apns-token-cleanup side) or any in-app notification dispatch failure (bill-reminder side). The Chat 097a alerting layer fires if either module fails to execute its scheduled tick within a 90-minute window.

**Dependencies:** Chats 061, 080.

**End-of-session checks:** The bill reminder worker correctly identifies upcoming bills and queues the butler line. The APNs cleanup correctly nulls a test invalid token.

---

## Block 10 — Live Activity and Push Notifications

Block 10 implements the iOS Dynamic Island Live Activity feature plus the underlying push notification infrastructure. The SwiftUI widget extension is genuine native iOS work that requires manual Xcode setup beyond what Expo provides. The live-activity-pusher worker drives the Live Activity transitions on a five-minute cron schedule plus an immediate-trigger path for user actions. Full end-to-end verification requires a physical iPhone 14 Pro or newer and the Apple Developer Program enrollment from Cutover.

### Chat 076 — Push Token Infrastructure

*Block 10 | 🟢 🔵*

**Load at session start:** TECHNICAL_SPEC.md §7 (Live Activity push tokens); TECHNICAL_SPEC.md §9 (push-tokens API endpoints); chat 030 (the push-tokens API scaffold); chat 013 (mobile shell).

**Goal:** Wire the push token registration flow on app launch. The mobile app, when it boots, requests both the regular APNs token (for standard push notifications) and the Live Activity push-to-start token (for Dynamic Island lifecycle pushes) via expo-notifications, then reports both to the server via POST /push-tokens. Tokens persist across app launches per device_id.

**Output:**
- `apps/mobile/lib/pushTokens.ts` — the token registration logic that fires on app launch from the root layout
- The push tokens are reported to POST /push-tokens with the platform set to 'ios' and both token strings included
- The DELETE /push-tokens/:deviceId is called on sign-out
- `docs/RUNBOOKS/APNS_KEY_ROTATION.md` — the operational runbook covering APNs .p8 key rotation: (a) Apple-side procedure to generate a replacement .p8, capture the new Key ID, and confirm Team ID is unchanged; (b) Cloudflare-side procedure to roll the `APNS_PRIVATE_KEY` and `APNS_KEY_ID` secrets across every worker that signs APNs JWTs (live-activity-pusher per chat 080, apns-token-cleanup per chat 075); (c) zero-downtime sequencing: Apple permits up to two active APNs keys per team simultaneously, so the runbook adds the new key alongside the old, verifies push delivery on a test device with the new key, then retires the old key; (d) post-rotation verification: confirm pushes are still landing on a sample of production devices via the live-activity-pusher logs; (e) emergency-rotation variant for compromised-key response with abbreviated grace-window guidance.

**Implementation notes:** Both APNs token types are needed: the regular token is for standard push notifications (medication reminders, fallback Live Activity transitions), and the live_activity_token is for the push-to-start mechanism that wakes up the Live Activity for the next block. The two tokens are different strings; both are obtained via expo-notifications APIs. The device_id is a stable device identifier generated once on first launch and persisted in expo-secure-store. Real APNs token retrieval requires the production APNs keys from Cutover step C-08; in development, expo-notifications returns development tokens that work against the development APNs servers. Each token registration emits PostHog event `push_token_registered` with payload `{platform, has_live_activity_token, device_id_hash}` (device_id is hashed before sending to avoid sending the raw stable device identifier to PostHog), and any registration failure is captured to Sentry with the expo-notifications error code and the platform. Add the event to chat 096's PostHog taxonomy.

**Dependencies:** Chats 030, 013.

**End-of-session checks:** A fresh mobile app install registers tokens correctly. The push_tokens table contains the expected row. Sign-out deletes the row. The audit trigger writes to security_audit_log on every push_tokens row INSERT and DELETE (verified by the chat 006 audit-schema.ts script and by inspecting security_audit_log after a test install-then-signout cycle on a development device).

### Chat 077 — SwiftUI Live Activity Widget Extension Setup

*Block 10 | 🟢 | ⚠️ 🚧*

**Load at session start:** TECHNICAL_SPEC.md §7 (SwiftUI Widget Extension); LAYER_4_EXPERIENCE_IDENTITY.md (Dynamic Island design specifications, design tokens); Apple's WidgetKit and ActivityKit documentation.

**Goal:** Set up the SwiftUI Widget Extension target in the iOS project so that subsequent chats can implement the widget's UI and behavior. This requires running `expo prebuild` to generate the iOS project, then manually adding a Widget Extension target in Xcode (Expo does not have first-class config-plugin support for Live Activity widget extensions). Configure the target's bundle identifier, deployment target, shared keychain access group, and app group identifier so that the widget can read shared state from the main app.

**Output:**
- `apps/mobile/ios/VesperLiveActivity/` — the directory containing the SwiftUI widget extension target after manual Xcode setup
- The bundle identifier `com.vesper.app.liveactivity` configured
- Deployment target iOS 17.2 set (raised from 16.1 per H-10 decision; matches the main app target so Widget Extension and main app share the same iOS floor)
- Shared keychain access group `$(AppIdentifierPrefix)com.vesper.app` configured on both the main app and the widget extension
- App group identifier `group.com.vesper.app` configured similarly
- ActivityAttributes and ContentState Swift type declarations in `VesperLiveActivity/ActivityModels.swift`, generated from a single shared JSON Schema source-of-truth at `packages/shared/src/liveActivity/schema.json`; the same schema generates the TypeScript types consumed by chat 079's JS bridge via a small codegen step (`pnpm gen:live-activity-types`) so the Swift and TypeScript representations cannot drift apart
- Apple App Group identifier `group.com.vesper.app` registered as a sub-step of Apple Developer Portal step C-05; the identifier appears in both the main app's entitlements and the widget extension's entitlements so they can share UserDefaults and Keychain items
- `apps/mobile/app.config.js` updated with the iOS infoPlist entries `NSSupportsLiveActivities: true` and `NSSupportsLiveActivitiesFrequentUpdates: true`; these keys are required at runtime for Live Activities to function and for high-frequency push updates respectively, and without them the widget extension builds successfully but Live Activities silently fail to start on real devices
- `docs/RUNBOOKS/IOS_WIDGET_REBUILD.md` — runbook explaining the manual Xcode steps so that they can be re-applied if `expo prebuild --clean` is ever run (which regenerates the iOS project and would lose the target)

**Implementation notes:** This chat has a strong manual component; the founder runs Xcode and adds the target manually, with the chat directing each step. The runbook is essential because Expo prebuild regenerates the iOS project from scratch when run with --clean, which would wipe the manually-added target. Future prebuilds without --clean preserve the manual additions, but the runbook covers the recovery path. ActivityAttributes are the static metadata for a Live Activity (the block ID, the block type); ContentState is the mutable state (current time progress, completion status) that can be updated via push without restarting the Live Activity. The shared keychain access group and app group identifier allow the widget extension to read the user's auth token and current plan state without requiring its own auth mechanism.

**Dependencies:** Chat 013.

**End-of-session checks:** The widget extension target builds successfully in Xcode. A test Live Activity can be initiated from the main app's debug menu. The runbook is complete and committed.

### Chat 078 — SwiftUI Live Activity Widget UI

*Block 10 | 🟢 | ⚠️ 🚧*

**Load at session start:** Chat 077 (widget extension target exists); LAYER_4_EXPERIENCE_IDENTITY.md (full Dynamic Island design with all three states); Apple's Activity Kit and Dynamic Island design guidelines.

**Goal:** Implement the SwiftUI views for the Live Activity widget covering all three required states: compact leading (the icon plus a two-character abbreviation of the current block type), compact trailing (a countdown timer in JetBrains Mono bronze), and expanded (the full block title, end time, and two action buttons for Mark Complete and Reschedule, plus a strip showing the next block). All three views use the Layer 4 design tokens (espresso, cream, bronze) translated into Swift constants.

**Output:**
- `VesperLiveActivity/LiveActivityView.swift` — the main widget view file containing all three view variants
- `VesperLiveActivity/DesignTokens.swift` — the design tokens translated to Swift constants (Color.espresso, Color.cream, Color.bronze; Font.jetBrainsMono for monospace)
- `VesperLiveActivity/ActionIntents.swift` — the App Intents that handle the Mark Complete and Reschedule button taps from the expanded view

**Implementation notes:** Live Activity widgets must be implemented in SwiftUI; React Native cannot render in the Dynamic Island. The design tokens from Layer 4 (specifically the cream/espresso/bronze palette) translate to SwiftUI Color values with hex initializers. The action buttons in the expanded view are implemented as App Intents (Apple's interactivity framework introduced in iOS 17); each intent, when triggered, performs the action via the app's shared state (mark complete writes to a queue read by the main app on next launch, or makes a direct API call if network is available). The simulator can preview Live Activities through Xcode's debug menu; full physical-device testing happens in chat 105.

**Dependencies:** Chat 077.

**End-of-session checks:** All three view variants render correctly in Xcode previews. The design tokens match Layer 4 specifications. The action intents are wired and trigger correctly when tapped in preview mode.

### Chat 079 — expo-live-activities JS Bridge

*Block 10 | 🟢*

**Load at session start:** Chat 078 (widget UI exists); TECHNICAL_SPEC.md §7 (Mobile-Side Live Activity API); the expo-live-activities library documentation.

**Goal:** Build the JavaScript bridge that allows the React Native code to start, end, and update Live Activities. The bridge wraps the native ActivityKit APIs with TypeScript functions. The Mark Complete action handler in the widget extension routes through the bridge to call PATCH /blocks with the block's ID. The Reschedule action handler opens the app to the plan view at the relevant block.

**Output:**
- `apps/mobile/lib/liveActivities.ts` — the TypeScript wrapper exposing `startActivity(block: Block)`, `endActivity(activityId: string)`, `updateActivity(activityId: string, state: Partial<ContentState>)`
- `apps/mobile/lib/liveActivityHandlers.ts` — the handlers that respond to Mark Complete and Reschedule callbacks from the widget extension
- The plan view integration so that block transitions trigger startActivity for the current block and endActivity for the prior block

**Implementation notes:** The bridge is a thin wrapper over expo-live-activities. The Mark Complete callback comes through as a JS event when the user taps the button in the expanded Dynamic Island; the handler reads the block ID from the activity's static attributes and calls PATCH /blocks to mark it complete. The Reschedule callback opens the app via a deep link (`vesper://plan?focus=blockId`) that the plan view interprets to scroll to and expand the relevant block. Limited simulator testing is possible via Xcode's Live Activity preview; full integration testing requires a physical device and happens in chat 105. The bridge emits PostHog events `live_activity_started`, `live_activity_ended`, and `live_activity_update_failed` on every lifecycle call with payload `{block_id, success, error_code?}`; Sentry captures any thrown error from the underlying expo-live-activities call with the block_id and the activity attribute set. Push-side logging (the APNs delivery path) is owned by chat 080; device-side logging (the bridge call path) is owned here so the two surfaces produce a complete activity-lifecycle trail. Add the three events to chat 096's PostHog taxonomy.

**Dependencies:** Chats 078, 027.

**End-of-session checks:** The bridge functions call through to the native side correctly. Mark Complete callback successfully writes to the API in a simulator integration test. Deep link from Reschedule opens the plan view correctly.

### Chat 080 — Live Activity Pusher Worker with Immediate-Trigger Path

*Block 10 | 🟣 | ⚠️ 🚧*

**Load at session start:** TECHNICAL_SPEC.md §7 (live-activity-pusher worker); TECHNICAL_SPEC.md §10 (Cloudflare Workers); the APNs push API documentation; chat 076 (push tokens infrastructure); chats 077-079 (widget and bridge).

**Goal:** Build the Cloudflare Worker that drives Live Activity transitions via APNs push. The worker runs every five minutes (not every minute) and handles only the start-the-next-Live-Activity case where the next block starts within thirty minutes; routine in-progress-to-end transitions are handled device-side via ActivityKit's `staleDate` parameter so the Dynamic Island updates locally at the exact block boundary without requiring a push. The worker exposes an immediate-trigger HTTP endpoint that the PATCH /blocks API and the batch reorder endpoint call when a user marks a block complete or reorders the day, so that the Dynamic Island updates within seconds rather than waiting for the cron cycle.

**Output:**
- `workers/live-activity-pusher/index.ts` — the worker with both the cron-scheduled path and the HTTP-triggered path
- `wrangler.toml` entry with cron `*/5 * * * *` (every five minutes)
- APNs JWT signing using the `jose` library with the .p8 key from Cutover step C-07; the signed JWT is cached at module scope for 50 minutes so each warm worker invocation reuses the JWT rather than re-signing per push
- The chain-to-next-block logic: when a block ends, if the next block starts within 30 minutes, start its Live Activity immediately; otherwise, no Live Activity until closer to the next block's start time
- Payload size enforcement: block titles are truncated to 80 characters before APNs payload assembly to stay under the 4KB Live Activity payload limit. Budget breakdown: APNs Live Activity payloads cap at 4KB; the fixed-overhead fields (icon reference, countdown timer state, next-block strip, push payload metadata, and base64 expansion overhead) consume ~400 bytes; the title is the only variable-length field, and 80 ASCII characters leaves ~3.6KB of headroom for the remaining fields and worst-case UTF-8 expansion. Truncations are logged to Sentry with the original length so prompt iterations can constrain title length over time
- Shared-secret storage for the immediate-trigger HTTP endpoint: the endpoint authenticates inbound calls via a `LIVE_ACTIVITY_TRIGGER_SECRET` Cloudflare Worker secret set via `wrangler secret put LIVE_ACTIVITY_TRIGGER_SECRET`; this secret is referenced by the Vesper API (chats 027 and 029 call the endpoint after PATCH /blocks and POST /plans/:date/reorder) and the production value is provisioned during the Cutover Block adjacent to C-08
- Fallback path for non-Dynamic-Island devices: when live_activity_token is null on the push_tokens row, the worker sends a standard APNs push notification with the block info as a banner notification instead
- Sentry breadcrumbs for each push attempt; 410 Gone responses route to the APNs cleanup worker from chat 075

**Implementation notes:** The earlier design fired the cron every minute and handled all transitions via push; this proved both excessive (1440 cron invocations per day per user across all workers) and laggy (the cosmetic transition between two adjacent blocks could be off by up to 60 seconds depending on when the cron fired relative to the block boundary). The new design uses ActivityKit's `staleDate` parameter, set at activity-start time to the block's end time, so the device handles the cosmetic transition locally with no network involvement. Push is reserved for state-change events: user actions (mark complete, reschedule), AI plan regeneration, and the start-the-next-Live-Activity hand-off. APNs JWT signing is non-trivial because the JWT must be signed with the .p8 EC private key from Apple, with the correct algorithm (ES256), the correct claims (iss = team ID, iat = current timestamp), and the JWT must be regenerated approximately every hour (Apple rotates token validity). The `jose` library handles the signing; the .p8 key content is stored as a Cloudflare Worker secret (set via `wrangler secret put APNS_PRIVATE_KEY`). The module-scope JWT cache uses the standard Cloudflare Workers warm-isolate pattern: the JWT is stored in a module-level variable with the sign timestamp; on each push, the worker re-uses the cached JWT if it is less than 50 minutes old and re-signs otherwise. The immediate-trigger HTTP endpoint accepts a block ID and the action (start, update, end), authenticates the caller as the internal Vesper API (via a shared secret), and sends the push synchronously. The chain-to-next-block logic is critical to UX; without it, the user sees the Dynamic Island go blank after a block ends, then re-appear when the next block starts, which feels jarring. With chaining and `staleDate`, the transition is smooth: the device locally ends the activity at the block boundary, and a queued push from the worker starts the next block's activity if it begins within thirty minutes.

**Dependencies:** Chats 076, 079, 027, 075.

**End-of-session checks:** The worker correctly identifies upcoming block transitions and constructs valid APNs payloads. The immediate-trigger endpoint authenticates correctly. The fallback for non-DI devices sends a standard push. The cron path runs within CPU time limits.

---

## Block 11 — Payments and Subscription Lifecycle

Block 11 is one of the highest-stakes blocks in Phase 4 because errors here translate directly into lost revenue or locked-out paying users. The subscription state machine module is built first as the canonical source of truth for state transitions. Read-only mode enforcement is treated as cross-cutting because it touches every mutation API and every UI surface. Stripe and Apple integrations land next, with the Apple Server Notifications V2 handler split across two chats because it must handle fifteen distinct notification types. The lifecycle UI ties everything together.

### Chat 081 — Subscription State Machine Module

*Block 11 | 🟡 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §8 (Subscription State Machine); LAYER_5_BUSINESS_MONETIZATION.md (all subscription lifecycle states and transitions); the subscriptions table schema.

**Goal:** Implement the subscription state machine as a typed TypeScript module in `@vesper/shared`. Every transition function validates that the source state allows the destination state, applies any required side effects (canceling Stripe subscription on deletion_scheduled, etc.), and writes the new state to the subscriptions table atomically. Unit tests cover every legitimate transition and verify that illegitimate transitions throw.

**Output:**
- `packages/shared/src/subscriptionState.ts` — exports the state machine with types `SubscriptionState = 'trial' | 'active' | 'past_due' | 'read_only' | 'archived' | 'deletion_scheduled' | 'deleted'` and transition functions like `transitionToActive(userId, paymentEvent)`, `transitionToPastDue(userId, failedInvoice)`, `transitionToReadOnly(userId, reason)`; `transitionToActive` is responsible for minting a unique 6-character referral code on the `users.referral_code` column if the user does not yet have one (this logic moves from chat 095 to this chat so it lives next to the state transition that triggers it; chat 095 consumes the existing column rather than minting)
- Unit tests in `packages/shared/src/__tests__/subscriptionState.test.ts` covering every transition and every illegitimate transition, plus tests specifically for the referral-code mint path: first-time `transitionToActive` populates the column; subsequent transitions are idempotent and do not change the existing code
- `docs/SUBSCRIPTION_STATE_MACHINE.md` — a Mermaid state diagram showing all states and transitions plus the prose explanation of each transition's side effects

**Implementation notes:** State machine errors are among the highest-impact bugs because they translate to revenue loss (a paying user incorrectly transitioned to read_only) or fraud exposure (a non-paying user incorrectly transitioned to active). Every transition is implemented as a discrete function rather than a generic `transition(from, to)` so that the type system enforces correct usage. Each transition checks the current state in the database, validates the transition is allowed, applies side effects (e.g., transition to deletion_scheduled calls the Stripe cancellation API), and writes the new state. The transitions are atomic within Postgres transactions; each transition begins with `SELECT * FROM subscriptions WHERE user_id = $1 FOR UPDATE` inside the transaction, which row-locks the subscription against concurrent updates. This is essential because Stripe and Apple webhooks can fire concurrent transitions for the same user (a Stripe `customer.subscription.updated` and an Apple `DID_RENEW` arriving within milliseconds of each other); without the row lock, both transitions read the same pre-state and one overwrites the other. A transition that fails midway rolls back.

**Dependencies:** Chat 030 (subscription scaffold exists), chat 005 (subscriptions table exists).

**End-of-session checks:** Unit tests pass for every transition. The state diagram in the runbook is accurate. A test transition from trial to active correctly updates the database row. The audit trigger on the subscriptions table is verified — a test transition from trial to active produces a corresponding row in `security_audit_log` with the correct user_id, old_values, new_values, and operation type.

### Chat 082 — Read-Only Mode Enforcement (Cross-Cutting)

*Block 11 | 🔵 🟢 | ⚠️*

**Load at session start:** LAYER_5_BUSINESS_MONETIZATION.md (read-only mode definition); chat 081 (state machine); every mutation API route from Block 4; every UI mutation surface from Block 6.

**Goal:** Implement the cross-cutting enforcement of read-only mode. When a user's subscription_status is in {read_only, archived, deletion_scheduled}, all mutation API routes return 403 Forbidden with the READ_ONLY_MODE error code; all UI surfaces that allow mutation display a banner explaining the state and disable mutation affordances; settings, cancellation, restore, and resubscribe surfaces remain accessible.

**Output:**
- `packages/shared/src/api/readOnlyGate.ts` — a middleware that wraps mutation endpoints and rejects requests when the user's subscription_status is in the restricted set
- Every mutation route in Block 4 and beyond updated to use the readOnlyGate. The full enumeration of mutation routes the gate must cover: PATCH /blocks, POST /blocks, POST /plans/:date/reorder (batch reorder from chat 029), POST /ai/command, PUT /weekly-priorities, POST /tasks, PATCH /tasks/:id, DELETE /tasks/:id, PUT /profile, PATCH /profile/modules/:moduleId, POST /energy, POST /plans/generate, POST /medications, PATCH /medications/:id, DELETE /medications/:id, POST /bills, PATCH /bills/:id, DELETE /bills/:id, POST /recurring-errands, PATCH /recurring-errands/:id, DELETE /recurring-errands/:id, POST /integrations/google-calendar/connect, DELETE /integrations/:provider, POST /calendar-events, PATCH /calendar-events/:id, DELETE /calendar-events/:id, POST /hydration
- `apps/web/components/ReadOnlyBanner.tsx` and `apps/mobile/components/ReadOnlyBanner.tsx` — the persistent banner shown on the plan view, tasks view, and module views when in restricted state
- Plan view, tasks view, and module views updated to disable mutation buttons and surface the banner

**Implementation notes:** Read-only mode is the difference between a graceful payment failure UX and an abrupt one. A user whose payment fails should see "Your payment didn't go through. I'll keep things running." rather than seeing the app suddenly stop working. The banner is voice-gated copy that explains the state and offers a CTA to resolve it (resubscribe or update payment method via the portal). The mutation gates return the same response shape regardless of the route, so the client UI can handle 403 READ_ONLY_MODE uniformly. Each gate reads `subscription_status` inside the mutation's database transaction with `SELECT subscription_status FROM subscriptions WHERE user_id = $1 FOR SHARE` so a concurrent webhook-driven transition cannot allow the mutation to commit between the read and the write; the `FOR SHARE` lock blocks any state-changing transition until the mutation transaction completes, which is the correct semantic given mutations are short-lived and webhook transitions are infrequent.

**Dependencies:** Chat 081, all Block 4 chats.

**End-of-session checks:** A user manually transitioned to read_only cannot make any mutation through any API. The banner displays correctly on all relevant UI surfaces. Settings and resubscribe remain accessible.

### Chat 083 — Stripe Checkout and Customer Portal Completion plus Cutover Runbook

*Block 11 | 🔵*

**Load at session start:** TECHNICAL_SPEC.md §8 (Stripe Checkout and Customer Portal); chat 030 (the route scaffolds); the Stripe SDK documentation; LAYER_5_BUSINESS_MONETIZATION.md (pricing tier configuration).

**Goal:** Complete the Stripe Checkout and Customer Portal integration. The Checkout session is created with the correct line items, success URL, cancel URL, customer email, and metadata (vesper_user_id) for webhook attribution. The Portal session is created with the correct customer ID and configuration options. Author the production-cutover runbook for swapping test keys to production keys.

**Output:**
- `apps/web/app/api/v1/subscription/checkout/route.ts` updated from chat 030 stub to full implementation
- `apps/web/app/api/v1/subscription/portal/route.ts` updated similarly
- `docs/RUNBOOKS/STRIPE_CUTOVER.md` — the runbook covering the test-to-production key swap procedure, the webhook endpoint reconfiguration, and the verification steps

**Implementation notes:** The Checkout session is the first paid touchpoint for web users. The configuration includes: `mode: 'subscription'`, `line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]`, `success_url` and `cancel_url` pointing to vesper.day routes, `customer_email` from the authenticated user, `metadata: { vesper_user_id: user.id }`, and `automatic_tax: { enabled: true }` for US sales tax. The `automatic_tax: { enabled: true }` setting requires Stripe Tax onboarding to be complete in the Stripe dashboard before the first paid Checkout session — onboarding includes registration in each US state with tax nexus and acceptance of Stripe Tax terms. The STRIPE_CUTOVER.md runbook documents this as a prerequisite to the test-to-live key swap. The Portal session is simpler: just `customer: stripeCustomerId` plus a return URL. The Cutover runbook is critical because the test-to-production swap is a multi-step process that, if done out of order, results in production users hitting test infrastructure (or vice versa).

**Dependencies:** Chats 030, 081.

**End-of-session checks:** A Checkout session creates correctly in test mode and the redirect URL works. The Portal session opens the Stripe-hosted page correctly. The runbook is complete.

### Chat 084 — Stripe Webhook Handler (Cloudflare Worker)

*Block 11 | 🟣 | ⚠️*

**Load at session start:** TECHNICAL_SPEC.md §8 (Stripe webhook handler); chat 081 (state machine); the Stripe webhook event types documentation.

**Goal:** Implement the Stripe webhook handler as a Cloudflare Worker. The handler verifies the webhook signature using the raw request body (not parsed JSON) with the signature-verification `tolerance` parameter set to a year (effectively disabling timestamp replay-window enforcement) so that Stripe's days-long retry behavior on failed deliveries does not result in lost events. Idempotency is enforced solely via the (provider, event_id) unique constraint on subscription_events. Each event type is dispatched to the appropriate state machine transition, and the full event payload is written to subscription_events for audit.

**Output:**
- `workers/stripe-webhook/index.ts` — the worker
- `wrangler.toml` entry
- Event handlers for: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.trial_will_end`. The `trial_will_end` handler does not transition state; it writes the event to subscription_events and sets a `pending_trial_reminder` flag on the subscriptions row which the chat 072 trial-reminder module reads as a redundancy signal alongside its own date-based scheduling.
- Idempotency check via INSERT INTO subscription_events ... ON CONFLICT DO NOTHING; if conflict, return 200 immediately (already processed)
- Per-subscription monotonic ordering check: before any state transition, the handler reads `subscriptions.last_event_at`; if the inbound event's timestamp is older than `last_event_at - interval '24 hours'` (a 24-hour grace window to tolerate clock skew and Stripe's own retry semantics), the handler logs the event to subscription_events for the audit trail but skips the transition and returns 200. This prevents regression transitions when delayed deliveries arrive after a more-recent event has already advanced the canonical state.
- A 5-minute delayed reconciliation trigger for the affected user via an INSERT into the `delayed_jobs` table from chat 005 (`job_type='reconcile_subscription'`, `payload={ userId }`, `scheduled_for = now() + interval '5 minutes'`); this replaces the prior Upstash QStash delay queue

**Implementation notes:** Stripe webhook signature verification must use the raw request body because the signature is computed against the byte stream Stripe sent; any modification (including JSON parse and re-stringify) breaks the signature. The Cloudflare Worker pattern is `const raw = await request.text(); const event = stripe.webhooks.constructEvent(raw, signature, secret, tolerance)` with `tolerance: 31536000` (one year in seconds). The default tolerance of 300 seconds (5 minutes) would silently reject Stripe retries that arrive hours or days after the original event, causing lost state transitions; the long tolerance plus the unique-constraint idempotency plus the per-subscription monotonic ordering check is the correct combination because Stripe guarantees delivery within their multi-day retry window but does not guarantee in-order delivery. The event handler dispatches via a switch on event.type; each handler invokes the appropriate state machine transition from chat 081 inside its own database transaction with row-level locking on the subscriptions row.

**Dependencies:** Chats 081, 083.

**End-of-session checks:** A test webhook delivery via Stripe CLI is correctly processed. A deliberate signature mismatch returns 400. A replayed webhook returns 200 without re-processing. The subscription state transitions correctly for each event type.

### Chat 085 — Apple StoreKit 2 Integration (Mobile)

*Block 11 | 🟢 | 🚧*

**Load at session start:** TECHNICAL_SPEC.md §8 (Apple StoreKit 2); Apple's StoreKit 2 documentation; chat 030 (subscription API scaffold).

**Goal:** Implement the StoreKit 2 in-app purchase flow on iOS. The app fetches the subscription product from the App Store, presents the purchase UI to the user, and on successful purchase, sends the signed JWS transaction to the `/subscription/apple-verify` API endpoint. Also wire the `showManageSubscriptions()` API for the settings surface so users can manage their Apple subscription from within the app.

**Output:**
- `apps/mobile/lib/storeKit.ts` — TypeScript wrapper around the StoreKit 2 APIs via the appropriate Expo or React Native bridge
- `apps/mobile/lib/storeKit.config.ts` — the product identifier `com.vesper.standard.monthly` configured
- `apps/mobile/screens/SubscriptionUpgrade.tsx` — the upgrade UI invoked when a trial-end user wants to subscribe via Apple
- `apps/mobile/lib/storeKit.testConfig.ts` — a StoreKit Configuration File reference for local Xcode testing without real App Store products

**Implementation notes:** StoreKit 2 is the modern Apple in-app purchase framework (versus the legacy StoreKit 1 with receipt validation against verifyReceipt). Purchases return a `signedTransaction.jws` string that contains the full transaction data signed by Apple; this is the payload sent to the apple-verify endpoint. The StoreKit Configuration File is a JSON file that lets Xcode simulate purchases against fake products during development, removing the need for a real App Store Connect product configuration during early development. Real product configuration happens at Cutover step C-11.

**Dependencies:** Chats 030, 013.

**End-of-session checks:** A test purchase via the StoreKit Configuration File succeeds in the simulator. The signed JWS transaction is captured and sent to the verify endpoint. The showManageSubscriptions surface opens correctly.

### Chat 086 — Apple Receipt Verification API

*Block 11 | 🔵 | ⚠️ 🚧*

**Load at session start:** TECHNICAL_SPEC.md §8 (Apple receipt verification, JWS public key handling); Apple's App Store Server API documentation; chat 081 (state machine); chat 030 (apple-verify stub).

**Goal:** Implement the `/subscription/apple-verify` endpoint that takes a signed JWS transaction from StoreKit, verifies the signature against Apple's public keys (fetched from Apple's JWKS endpoint with a 1-hour cache), and on successful verification, transitions the user's subscription state to active and writes the transaction to subscription_events.

**Output:**
- `apps/web/app/api/v1/subscription/apple-verify/route.ts` updated from chat 030 stub to full implementation
- `apps/web/lib/apple/jws.ts` — the JWS verification logic that extracts the certificate chain from the JWS `x5c` header and validates against pinned Apple Root CA G3
- `apps/web/lib/apple/keyCache.ts` — the 1-hour cache for Apple's intermediate certificates
- `docs/RUNBOOKS/APPLE_ROOT_CA_ROTATION.md` — authored in this chat; documents how to discover Apple's next published root, add it to the pinned set alongside the current root, verify a sample of production transactions against the new root in shadow, and finally retire the old root once Apple deprecates it

**Implementation notes:** Apple's JWS verification is non-trivial. The signed transaction is a JWS string with three dot-separated parts: header (which contains the `x5c` certificate chain), payload, and signature. The verifier extracts the certificate chain from the JWS `x5c` header, validates that the root certificate matches one of the pinned Apple Root CA certificates (currently Apple Root CA G3), and verifies the signature with the leaf certificate's public key. To eliminate ambiguity: Apple StoreKit 2 JWS transactions use this `x5c`-header-driven certificate-chain verification rooted in the pinned Apple Root CA G3 — they do NOT use a JWKS endpoint. The endpoint `https://appleid.apple.com/auth/keys` is the JWKS endpoint for Sign In with Apple identity tokens (a separate flow used by the Apple OAuth sign-in path in chats 010/011), not by this StoreKit verifier. Conflating the two paths produces verification failures that look like Apple key problems but are actually wrong-endpoint problems; this chat documents the distinction inline. The pinning approach is forward-rotation-aware: the implementation pins both the current Apple Root CA G3 and the announced next root, with the runbook authored here documenting how to discover and add a new pinned root when Apple publishes one. The chat 086a worker auto-monitors expiry dates and Sentry-alerts at the 6-months-before-expiry mark. The implementation uses the `jose` library for the JWS verification primitives. The 1-hour cache on Apple's intermediate certificates is critical because Apple rotates intermediates; without caching, every transaction verification makes a network call to Apple, which adds latency. With caching, repeated verifications use the cached certs until the cache expires.

**Dependencies:** Chats 085, 081.

**End-of-session checks:** A test JWS transaction (using a development-signed transaction from StoreKit Configuration File) verifies correctly. A deliberately tampered JWS rejects with the expected error. The cache TTL works as expected.

### Chat 086a — Apple PKI Monitor Worker

*Block 11 | 🟣*

**Load at session start:** Chat 086 (JWS verification with pinned root certificates); Apple's PKI bundle documentation.

**Goal:** Build a Cloudflare Worker that runs weekly and verifies the pinned Apple Root CA certificates from chat 086 are still within their valid date range with sufficient runway. The worker fetches Apple's published PKI bundle, compares against the pinned roots in the application, and Sentry-alerts when any pinned root is within six months of expiry. This is the operational early-warning system that prevents the silent-breakage failure mode where all Apple receipt verifications start failing simultaneously when a root cert expires unnoticed.

**Output:**
- `workers/apple-pki-monitor/index.ts` — the worker
- `wrangler.toml` entry with cron `0 12 * * 1` (every Monday at noon UTC)
- The worker fetches Apple's published PKI bundle URL, parses the certificate chain, compares the leaf and intermediate expiry dates against the pinned constants in chat 086's verifier
- Sentry alert (high severity) when any pinned root's expiry is within 180 days
- `docs/RUNBOOKS/APPLE_PKI_MONITOR.md` — alert-handler runbook describing what to do when the apple-pki-monitor Sentry alert fires

**Implementation notes:** Apple publishes upcoming root certificate rotations well in advance via the Apple Developer documentation; the worker's purpose is to surface that information into the team's normal monitoring channel rather than relying on a calendar reminder set months ago. Six months of runway is enough to update the pinned roots in a routine deploy.

**Dependencies:** Chat 086.

**End-of-session checks:** The worker runs locally and successfully fetches Apple's PKI bundle. A simulated near-expiry condition correctly fires the Sentry alert.

### Chat 087 — Apple Server Notifications V2 Worker, Part 1

*Block 11 | 🟣 | ⚠️ 🚧*

**Load at session start:** TECHNICAL_SPEC.md §8 (Apple Server Notifications V2); Apple's ASSN V2 documentation; chat 086 (JWS verification logic to share); chat 081 (state machine).

**Goal:** Implement the first half of the Apple Server Notifications V2 webhook handler. ASSN V2 is the push-based notification system Apple uses to inform the server of subscription lifecycle events (renewals, cancellations, refunds, etc.). The handler verifies the signed payload using the same JWS infrastructure as chat 086, then dispatches the five most common notification types to the appropriate state machine transitions.

**Output:**
- `workers/apple-assn/index.ts` — the worker
- `wrangler.toml` entry
- Handlers for: SUBSCRIBED, DID_RENEW, EXPIRED, REVOKE, REFUND
- Each handler verifies the payload, writes to subscription_events with idempotency, and invokes the state machine transition

**Implementation notes:** ASSN V2 payloads are signed JWS with the same verification mechanism as StoreKit transactions, so the JWS infrastructure from chat 086 is reused, including the same pinned root certificate approach. Signature verification uses an effectively unbounded timestamp tolerance because Apple, like Stripe, retries failed webhook deliveries over multiple days; the idempotency guard on subscription_events' (provider, event_id) unique constraint is the sole replay protection. The notification type is in the JWS payload's `notificationType` field. SUBSCRIBED indicates a new subscription (transition to active or activate from trial). DID_RENEW indicates a successful renewal (no state change typically, but extend the period_end). EXPIRED indicates a subscription has expired without renewal (transition to read_only). REVOKE indicates Apple has refunded and revoked access (transition to archived). REFUND is similar but for cases where the user keeps access for a period (record the event but no immediate state change). Each handler triggers the chat 074 reconciliation worker via an INSERT into the `delayed_jobs` table from chat 005 (`job_type='reconcile_subscription'`, `payload={ userId }`, `scheduled_for = now() + interval '5 minutes'`); this replaces the prior Upstash QStash delayed-trigger dependency.

**Dependencies:** Chats 086, 081.

**End-of-session checks:** Test notifications for each of the five types are correctly processed. The subscription_events table is updated. State transitions occur correctly.

### Chat 088 — Apple Server Notifications V2 Worker, Part 2

*Block 11 | 🟣 | ⚠️ 🚧*

**Load at session start:** Chat 087; the remaining ten ASSN V2 notification types from Apple's documentation.

**Goal:** Implement the second half of the ASSN V2 handler, covering the remaining ten notification types. These are less common but each requires correct handling to avoid edge-case bugs in payment state.

**Output:**
- The `workers/apple-assn/index.ts` worker extended with handlers for: DID_CHANGE_RENEWAL_PREF, DID_CHANGE_RENEWAL_STATUS, DID_FAIL_TO_RENEW, GRACE_PERIOD_EXPIRED, OFFER_REDEEMED, PRICE_INCREASE, REFUND_DECLINED, REFUND_REVERSED, RENEWAL_EXTENDED, TEST
- TEST handler simply logs the event and returns 200 (used to verify the webhook endpoint configuration in App Store Connect)
- Each handler follows the same pattern: verify, write to events, transition state if applicable

**Implementation notes:** DID_FAIL_TO_RENEW indicates a failed renewal attempt, similar to Stripe's invoice.payment_failed; transition to past_due. GRACE_PERIOD_EXPIRED indicates the grace period after a failed renewal has elapsed without resolution; transition to read_only. PRICE_INCREASE indicates Apple is about to raise the price for a user; record the event but no immediate state change (Apple handles the user consent flow). The TEST notification type is used by App Store Connect to verify the webhook URL is reachable; the handler must respond 200 within a short window or App Store Connect rejects the URL configuration. Like chat 087's handlers, each transition in this chat enqueues a 5-minute delayed reconciliation via an INSERT into the `delayed_jobs` table rather than via Upstash QStash.

**Dependencies:** Chat 087.

**End-of-session checks:** Test notifications for each of the remaining ten types are correctly processed. The TEST notification correctly responds 200 from a simulated App Store Connect verification request.

### Chat 089 — Subscription Lifecycle UI

*Block 11 | 🔵 🟢 🎩*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (subscription lifecycle copy library); LAYER_5_BUSINESS_MONETIZATION.md (each state's UX); PRD §3.4 (subscription touchpoints); chat 081 (state machine); chats 083, 086 (Stripe and Apple flows).

**Goal:** Build the user-facing UI surfaces for every subscription lifecycle state: the trial-end screen with Continue and End options, the day-6 soft prompt with one-tap pay, the past-due banner, the read-only banner, the archived welcome-back state on resubscribe, and the settings billing section with portal link (web) or showManageSubscriptions (mobile).

**Output:**
- `apps/web/components/subscription/TrialEndScreen.tsx` and the mobile equivalent — the trial-end screen with two CTAs ("Continue with Vesper" → checkout; "End trial" → goes to read_only without payment)
- `apps/web/components/subscription/MidTrialPaymentMethodCapture.tsx` and the mobile equivalent — the day-5 mid-trial payment-method capture surface; OPTIONAL and OPT-IN; voice-gated copy explaining that capturing a payment method now enables one-tap upgrade tomorrow with no surprise charges; on web, saves the card via a Stripe Setup Intent (no charge); on iOS, captures an Apple Pay token via the StoreKit configuration. The captured payment method is stored against the user's record so the day-6 surface can read it.
- `apps/web/components/subscription/TrialDay6Prompt.tsx` and the mobile equivalent — a day-6 soft prompt surface (one day before trial end). Branching: if the user captured a payment method on day 5, the prompt offers one-tap conversion to paid (Apple Pay biometric or Stripe Link single-tap charge against the captured token, no card re-entry); if the user did NOT capture, the prompt is informational with a CTA to the regular trial-end Checkout (web) or StoreKit (iOS) flow. The prompt fires both in-app (banner on the day view) on the morning of trial day 6 and via push notification (mobile) / email (web) with deep link. If push permission is denied on mobile, the day-6 push falls back to email plus an in-app banner that surfaces on the user's next open — the user is never silently skipped past the conversion moment because of a permission denial.
- `apps/web/components/subscription/PastDueBanner.tsx` and the mobile equivalent — the persistent banner displayed when subscription_status is past_due
- `apps/web/components/subscription/ReadOnlyBanner.tsx` and the mobile equivalent — already built in chat 082; this chat polishes the copy
- `apps/web/components/subscription/ArchivedWelcomeBack.tsx` and the mobile equivalent — the surface shown on resubscribe from archived state ("Welcome back. Everything is as you left it.")
- `apps/web/app/(app)/settings/billing/page.tsx` and the mobile equivalent — the settings billing section with the portal/manage link

**Implementation notes:** Every copy string in these surfaces passes through the voice gate. The trial-end screen is the highest-conversion surface in the application; the copy is intentionally calm and not pushy ("Your week is up." rather than "Don't lose access!"). The day-5 mid-trial payment-method capture is opt-in and frames the value plainly: "Save a card and pay with one tap tomorrow, if you stay." No charges occur from the capture; on web it is a Stripe Setup Intent and on iOS it is an Apple Pay token saved against the user record. The day-6 soft prompt is the conversion-rate enhancement that captures committed users at low friction without the brand damage of a card-required-upfront flow: industry benchmarks suggest 25-30% conversion versus 15% for plain no-card trials, with no negative brand impact because no surprise charges occur. The day-6 prompt branches on whether a payment method was captured on day 5: captured users get one-tap pay; non-capturing users see the regular trial-end Checkout/StoreKit flow with no surprise. The day-6 timing (24 hours before trial end) gives the user a meaningful action window without the prompt feeling premature. Every primary CTA button that invokes Stripe Checkout or StoreKit (trial-end Continue button, day-6 one-tap pay button, past-due banner update-payment button) must disable on click before invoking the purchase flow, and remain disabled until either (a) the purchase flow completes and the UI navigates away, or (b) the purchase flow returns an error and the button is reset with a user-visible error toast. Without disable-on-click, a fast double-tap can initiate two parallel purchase flows, leading to duplicate Customer / duplicate Checkout Session / duplicate StoreKit transaction. Standard form-button pattern; one-line implementation per button. Push delivery on mobile falls back to email + in-app banner when permission is denied. The past-due banner offers a CTA to update payment via the portal. The read-only banner offers a CTA to resubscribe. The archived welcome-back appears the first time the user opens the app after resubscribing from archived; subsequent opens skip it.

**Dependencies:** Chats 082, 083, 086.

**End-of-session checks:** Each state's UI renders correctly with the right voice-gated copy. The trial-end CTAs route correctly. The portal and manage-subscription links work.

### Chat 090 — Cancellation Flow, Reason Capture, and Account Deletion UI

*Block 11 | 🔵 🟢 🎩*

**Load at session start:** LAYER_5_BUSINESS_MONETIZATION.md (cancellation reason list); PRD §3.4 (cancellation touchpoints); chat 030 (account delete API); chat 089 (lifecycle UI).

**Goal:** Build the cancellation flow with the six-option reason dropdown plus an optional free-text field, the post-cancel 48-hour survey email queued for delivery via a worker, and the account deletion UI with the confirmation modal, 30-day grace banner, and restore link.

**Output:**
- `apps/web/components/subscription/CancellationFlow.tsx` and the mobile equivalent — the cancellation surface with the reasons (Price too high, Not using it enough, Found an alternative, Life change, Technical issues, Other), free-text input, and confirmation step
- The cancellation reason is captured in PostHog as the `subscription_canceled` event with properties including the reason, the free text, the user's subscription duration, and the user's archetype; in addition, a row is inserted into the `cancellation_events` table from chat 005 with the same reason, free_text, archetype, subscription_duration_days, and canceled_at so the data is queryable in the application database without round-tripping PostHog
- `apps/web/components/account/DeletionFlow.tsx` and the mobile equivalent — the deletion confirmation modal with the explicit message that data will be removed in 30 days; for iOS users whose subscription is Apple-managed, the flow displays a clear instruction directing them to also cancel via iOS Settings → Apple ID → Subscriptions before the 30-day grace elapses (server cannot cancel on their behalf), with an `itms-apps://` deeplink to that surface; for Stripe-managed subscribers, the server cancels synchronously per chat 030 and no extra action is required from the user
- `apps/web/components/account/DeletionGraceBanner.tsx` and the mobile equivalent — the banner displayed on every screen during the 30-day grace period with the restore link
- The post-cancel survey email is queued for delivery 48 hours after cancellation by inserting a row into the `email_queue` table from chat 005 with `template_name='post_cancel_survey'`, `scheduled_for = now() + interval '48 hours'`, and a payload carrying any context the template needs; the daily-cron worker (or a dedicated tick path) reads due rows and dispatches via Resend, marking `sent_at` on success

**Implementation notes:** Cancellation must be one tap from the settings billing section (no "click here, click there, click here" friction trail). The reason capture is a single dropdown plus an optional free text; submission is immediate. The PostHog event is essential for understanding why users cancel; the data informs future product decisions. The account deletion flow is separate from cancellation; users can cancel without deleting their account (their data remains accessible in read_only mode during the grace period and they can restore by resubscribing). Account deletion is the irrevocable path; the 30-day grace period is the safety net. The grace banner shows on every screen so users cannot accidentally lose their account by forgetting they requested deletion.

**Dependencies:** Chats 030, 089, 081.

**End-of-session checks:** A test cancellation flow completes correctly and emits the PostHog event with the right properties. The account deletion flow correctly sets deletion_requested_at. The grace banner displays on every screen during the grace period. The restore link correctly transitions the user back to read_only.

### Chat 090a — Data Export Endpoint and Worker (DEFERRED TO V1.5)

**Status:** Removed from the Phase 4 build flow. Full chat spec relocated to the "Deferred to V1.5" section at the end of this document. The Cloudflare R2 dependency is removed from V1 entirely; no R2 bucket is provisioned at Cutover.

### Chat 090b — Biometric Lock Setting

*Block 11 | 🟢*

**Load at session start:** PRD §6 (Medications and Finance modules); chat 011 (mobile auth with expo-secure-store); the `users.biometric_lock_enabled` column from chat 004.

**Goal:** Add an optional biometric lock setting (Face ID or Touch ID) that, when enabled, requires biometric authentication on every app cold start and on every foreground from background after more than 60 seconds. The setting is OFF by default; users who want extra privacy on the medications and finance surfaces enable it from Settings → Privacy.

**Output:**
- `apps/mobile/app/(tabs)/settings/privacy.tsx` — settings panel with the biometric lock toggle and a brief explanation of what it does
- `apps/mobile/lib/biometric.ts` — wrapper around `expo-local-authentication` that handles enrollment, prompts, and the failure-fallback flow (after three failed attempts, fall back to sign-out + re-sign-in via email magic link)
- `apps/mobile/components/BiometricGate.tsx` — the lock screen component shown on cold start and qualifying foreground transitions when the setting is enabled
- `apps/mobile/hooks/useBiometricLock.ts` — hook that integrates with the app lifecycle hook from chat 013 and enforces the lock at the correct moments
- The setting toggle calls PUT /profile to persist `biometric_lock_enabled` (the column already exists from chat 004's schema)

**Implementation notes:** Off-by-default respects users who do not want extra friction; on-as-option gives privacy-conscious users the choice. The 60-second background threshold is the standard pattern from banking apps: brief context-switches (answering a text, checking a notification) don't trigger re-auth, but longer absences do. The fallback after three failures avoids permanent lockout from a borked Face ID enrollment; the user can always sign out and back in to clear the local biometric state. Web has no equivalent because the OS-level lock screen is the appropriate surface for browser sessions.

**Dependencies:** Chat 011, chat 024 (PUT /profile).

**End-of-session checks:** Toggling the biometric lock on and cold-starting the app prompts Face ID. Three failed Face ID attempts triggers the sign-out fallback. Backgrounding for less than 60 seconds and returning does not prompt; backgrounding for more than 60 seconds does.

---

## Block 12 — Waitlist and Launch Surfaces

Block 12 builds the public-facing surfaces of the application: the Resend email templates (split across two chats because each template is a voice-gated React Email component), the Three.js cinematic waitlist landing page, the SEO and Open Graph metadata, the referral landing page with attribution flow, and the analytics infrastructure that captures every PostHog event and Sentry breadcrumb. The waitlist landing page is the brand-defining surface; performance on mobile devices is non-negotiable.

### Chat 091 — Resend Email Templates Part 1: Auth and Trial Reminders

*Block 12 | 🟡 🎩*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (email copy library); LAYER_3_TECHNICAL_ARCHITECTURE.md (Resend integration); chat 017 (voice gate); the React Email documentation.

**Goal:** Author the five auth-related and trial-reminder React Email components: the welcome email sent after onboarding completion, the magic link email used for passwordless sign-in (already partially built in chat 010 but finalized here), and the three trial-reminder emails (two days before trial end, one day before, day of). Each email is a React Email component with voice-gated copy that renders correctly across Gmail, Outlook, Apple Mail, and the major mobile clients.

**Output:**
- `packages/shared/emails/WelcomeEmail.tsx` — sent on successful onboarding; voice-gated body explaining what to expect from the daily plan
- `packages/shared/emails/MagicLinkEmail.tsx` — finalized from chat 010 with voice gate verification
- `packages/shared/emails/Trial2DayEmail.tsx` — the two-days-before-trial-end reminder (sent on trial day 5)
- `packages/shared/emails/Trial1DayEmail.tsx` — the one-day-before reminder (sent on trial day 6, paired with the day-6 soft-prompt push)
- `packages/shared/emails/Trial0DayEmail.tsx` — the day-of reminder (sent on trial day 7)
- Each email exports a `subject` constant and a default-export React Email component
- Test rendering script `packages/shared/emails/__tests__/renderAll.ts` that renders each email to HTML and writes the output to `packages/shared/emails/output/` for visual review

**Implementation notes:** React Email components are JSX that renders to email-compatible HTML. The components use the React Email primitives (`<Container>`, `<Section>`, `<Heading>`, `<Text>`, `<Button>`) which handle the cross-client compatibility quirks. The cream-on-espresso brand palette translates to inline style attributes because email clients do not consistently support CSS classes. The voice gate is invoked on every text string during authoring; the components do not contain any string that has not passed the gate. The trial reminder copy escalates in directness across the three checkpoints: the two-day email is purely informational ("Your trial ends in two days"), the one-day is gently nudging ("Tomorrow your trial ends") and pairs with chat 089's day-6 in-app and push surface as a cross-channel matched pair (the email and the push fire on the same trial day, carry the same CTA, and link to the same one-tap-pay or fallback Checkout/StoreKit destination depending on whether the user captured a payment method on day 5), the day-of is action-oriented ("Today your trial ends. Continue or end?"). All copy avoids exclamation marks and em-dashes per voice rules. The render-to-HTML test script enables visual review without requiring real email sends during authoring.

**Dependencies:** Chat 017, chat 015.

**End-of-session checks:** All five emails render to valid HTML. Visual review shows correct branding and copy. Subject lines are voice-gated. Test render produces output files for each template.

### Chat 092 — Resend Email Templates Part 2: Waitlist, Post-Cancel, Referral

*Block 12 | 🟡 🎩*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (email copy library, waitlist nurture sequence, post-cancel survey); LAYER_6_LAUNCH_GROWTH.md (waitlist conversion strategy); chat 017 (voice gate); chat 091 (email rendering pattern established).

**Goal:** Author the remaining three React Email templates: the waitlist nurture email sent at signup ("Building."), the waitlist launch-day email split into iOS and Android variants for the appropriate platform-specific CTAs, and the post-cancel 48-hour survey email that asks one open-ended question about what would have made Vesper work.

**Output:**
- `packages/shared/emails/WaitlistNurture.tsx` — the immediate-after-waitlist-signup email
- `packages/shared/emails/WaitlistLaunchIos.tsx` — the launch-day email for iOS waitlist signups with App Store link
- `packages/shared/emails/WaitlistLaunchAndroid.tsx` — the launch-day email for Android waitlist signups; the copy notes that Android is still in development and offers iOS access if relevant
- `packages/shared/emails/PostCancelSurvey.tsx` — sent 48 hours after subscription cancellation with one open question
- Each follows the same component pattern as chat 091

**Implementation notes:** Every marketing-class email template (WaitlistNurture, WaitlistLaunchIos, WaitlistLaunchAndroid, PostCancelSurvey) must include in its rendered output:
1. A functional one-click unsubscribe mechanism — both a `List-Unsubscribe` header (RFC 8058) emitted via the Resend send-request and a visible unsubscribe link in the email footer. The unsubscribe link routes to `https://vesper.day/unsubscribe?token={token}` and toggles the user's marketing-email preference; the unsubscribe MUST be one-click (no confirmation step, no sign-in required) per CAN-SPAM 2024 enforcement.
2. The founder's registered physical mailing address (PO box or virtual mailbox service such as iPostal1 or Anytime Mailbox; procurement is a founder pre-action handled before the first marketing send) in the footer, exactly as registered.
3. An honest, non-deceptive subject line (covered by the butler voice gate at Chat 098 end-to-end sweep).

These requirements do NOT apply to the transactional templates from Chat 091 (auth, trial reminders, dunning); transactional emails are CAN-SPAM-exempt. Additionally, the marketing-class emails must be sent from the marketing subdomain `noreply@mail.vesper.day` (Cutover C-22a per H-4 decision), separate from the transactional `noreply@vesper.day` sender.

End-of-session gate: NO marketing email send is enabled until (a) the physical mailing address is registered and pasted into the email template footer constant, (b) the unsubscribe endpoint is live and the one-click flow is tested end-to-end, and (c) the marketing subdomain DNS records (Cutover C-22a) are verified. The Chat 092 end-of-session checks block this work until all three gates pass.

The waitlist nurture is intentionally short and resists the temptation to over-deliver before launch. The post-cancel survey is unusual in that it does not try to win the user back; the goal is data, not retention. The Android variant of the launch email acknowledges the Android user's situation honestly (Android is V1.5) rather than pretending the launch applies to them; this preserves trust with the Android waitlist segment.

**Dependencies:** Chat 091.

**End-of-session checks:** All four emails render correctly. The two waitlist launch variants are distinct and platform-appropriate. The post-cancel survey copy is gentle and not pushy.

### Chat 093 — Waitlist Landing Page with Three.js Cinematic

*Block 12 | 🔵 🎩 | ⚠️*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (Marketing Visual Language, landing page composition); LAYER_6_LAUNCH_GROWTH.md (landing page conversion strategy); OPEN_SOURCE_INVENTORY.md (Three.js, R3F); chat 031 (waitlist API); chat 014 (CSP configuration that allows `'unsafe-eval'` for Three.js).

**Goal:** Build the public waitlist landing page at `apps/web/app/(marketing)/page.tsx` with five sections in the Layer 4 composition: hero with the Three.js cinematic scroll experience, "What Vesper does" section, modules section, "How it works" section, and pricing plus signup section. The page is fully responsive; performance on mobile devices is the constraint that drives every implementation decision because the target audience checks the link from their phone.

**Output:**
- `apps/web/app/(marketing)/page.tsx` — the landing page
- `apps/web/components/marketing/HeroThreeScene.tsx` — the Three.js scene rendered with React Three Fiber, with scroll-driven camera and object animations
- `apps/web/components/marketing/WhatVesperDoes.tsx` — the second section explaining the product in one paragraph plus a visual
- `apps/web/components/marketing/ModulesSection.tsx` — the third section showcasing the seven modules in a grid
- `apps/web/components/marketing/HowItWorks.tsx` — the fourth section walking through the daily journey
- `apps/web/components/marketing/PricingAndSignup.tsx` — the fifth section with the $19.99 monthly subscription price and the waitlist signup form (email plus iOS/Android segmented control plus "Begin" button); the segmented control is accompanied by a prominent voice-gated disclosure positioned adjacent to it: "iOS first. Android coming later." (so Android-segment selectors understand the wait before they submit, not after)
- All copy is voice-gated
- The Three.js scene is performance-tuned: model assets compressed, lighting baked, draw calls minimized, dynamic LOD for low-end devices

**Implementation notes:** This is the highest-stakes web chat in Phase 4 because the landing page is the application's first impression. Three.js performance on mobile is the technical risk: an unoptimized scene takes seconds to load on a mid-range Android phone, which destroys conversion. Optimization tactics include using compressed glTF models with Draco compression, baking lighting into textures rather than computing in real time, using instanced meshes for repeated geometry, and progressively loading scene complexity based on the device's detected capability. Shaders are precompiled at build time via `vite-plugin-glsl` and loaded as static assets so the production CSP can omit `'unsafe-eval'` (cross-reference Decision 13 from chat 001 — the CSP omission and the precompiled-shader strategy are the same architectural decision viewed from two angles). A fallback non-Three.js version is rendered for devices that fail the WebGL capability detection and for users with `prefers-reduced-motion: reduce` set; the reduced-motion fallback is a static gradient hero (cream-to-espresso vertical gradient with the wordmark centered) that matches the cinematic hero's composition without any animation, per WCAG 2.3.3. The signup form on the pricing section submits to POST /waitlist from chat 031; on success, the user sees a voice-gated confirmation message and the form is replaced with the confirmation state.

**Dependencies:** Chats 031, 014, 015.

**End-of-session checks:** The page renders correctly on desktop, tablet, and mobile. Lighthouse mobile performance score is 90 or higher. The Three.js scene runs at 60fps on an iPhone 12 (mid-range target). The waitlist signup successfully submits to the API.

### Chat 094 — Landing Page SEO, Open Graph, and Sitemap

*Block 12 | 🔵*

**Load at session start:** Chat 093 (landing page exists); Next.js Metadata API documentation; the Open Graph protocol specification.

**Goal:** Configure the SEO and Open Graph metadata for the marketing route group so that link previews on social media platforms render correctly with the Vesper brand. Generate the sitemap.xml and robots.txt files. Configure the favicon and the multi-size app icons referenced in the marketing pages.

**Output:**
- `apps/web/app/(marketing)/layout.tsx` updated with the Next.js `metadata` export including title, description, openGraph, twitter, robots, and viewport
- An OG image at `apps/web/public/og-image.png` (1200x630px, branded with the espresso/cream/bronze palette)
- A Twitter card image at `apps/web/public/twitter-card.png`
- `apps/web/app/sitemap.ts` — Next.js sitemap generator covering all public routes
- `apps/web/app/robots.ts` — Next.js robots.txt generator
- JSON-LD structured data embedded in the page head for SoftwareApplication schema
- Favicon and Apple Touch Icon assets in `apps/web/public/`

**Implementation notes:** SEO metadata for a marketing-first application is largely standard. The OG image is the visual that appears when someone shares the landing page link on Twitter, LinkedIn, iMessage, or Slack; the design uses the brand palette and includes a short tagline. The JSON-LD structured data helps search engines understand that Vesper is a SoftwareApplication with a subscription pricing model; this affects rich snippets in search results. The sitemap covers the public routes (/, /privacy, /terms, /r/[code] is excluded because referral codes are per-user) and submits to Google Search Console after Cutover.

**Dependencies:** Chat 093.

**End-of-session checks:** A link preview test (e.g., via opengraph.xyz or LinkedIn Post Inspector) shows the correct OG image and metadata. The sitemap.xml renders correctly. The robots.txt is appropriately permissive.

### Chat 095 — Referral Landing Page and Attribution Flow

*Block 12 | 🔵 🟢 🎩*

**Load at session start:** LAYER_6_LAUNCH_GROWTH.md (referral program); TECHNICAL_SPEC.md §3.17 (referral_credits table); chat 031 (referral track API); the users table referral_code column verification (from chat 006 schema audit).

**Goal:** Build the referral landing page at `/r/[code]`, the attribution cookie mechanism, the referral code generation on paid conversion, and the referral settings panel on web and mobile. The referral code is minted automatically when a user transitions to active for the first time; subsequent visits via a referral link credit the referring user when the referee converts.

**Output:**
- `apps/web/app/r/[code]/page.tsx` — the referral landing page that validates the code, sets the attribution cookie via the API, and redirects to the main landing page with a personalized greeting; for invalid codes, renders a soft brand-voiced page ("This invitation doesn't look right. Try the link again, or visit vesper.day.") with a 2-second auto-redirect to the main landing page and HTTP status 200 (search-engine-indexable as page-exists rather than 404)
- `apps/web/lib/referral/codeGenerator.ts` — generates a unique 6-character alphanumeric referral code; verifies uniqueness against users.referral_code (this utility is consumed by chat 081's `transitionToActive`, which owns the mint trigger; this chat does NOT modify the state machine — the prior mint-on-active logic now lives entirely in chat 081, and this chat consumes the existing `users.referral_code` column rather than minting)
- `apps/web/app/(app)/settings/referral/page.tsx` and `apps/mobile/app/(tabs)/settings/referral.tsx` — the referral settings panel showing the user's code, their referral link, and only the count of applied credits earned. Pending-status credits (where the referee has signed up but not yet converted to paid) are not surfaced to the referrer; this aligns with the butler-voice anti-gamification posture and avoids the disappointment surface when a pending credit voids without converting.
- The referral counts query joins users (the referrer) with referral_credits filtered to `status='applied'`

**Implementation notes:** The referral code is a stable 6-character identifier that the user can share in voice ("Try Vesper. Use my code, 4F7K2A.") or as a link. The attribution cookie is set when someone visits /r/[code]; if that visitor signs up within 30 days, the referrer is credited via the referral_credits row. The credit amount and structure follows the Layer 6 specification. The settings panel includes voice-gated copy ("Pass this along, if you like.") and the link with a copy button.

**Dependencies:** Chats 031, 081 (state machine for the mint-on-active transition), chat 006 (referral_code column verification).

**End-of-session checks:** A referral link correctly redirects with the cookie set. A new signup via a referral link correctly creates a referral_credits row. The settings panel displays the correct code and counts.

### Chat 096 — PostHog Event Taxonomy and 3 Funnels

*Block 12 | 🔵 🟢 🟣*

**Load at session start:** TECHNICAL_SPEC.md §11 (PostHog event taxonomy, full list of 18 events); LAYER_6_LAUNCH_GROWTH.md (3 primary funnels: signup-to-activation, activation-to-paid, trial-to-D30); `docs/ARCHITECTURE_DECISIONS.md` (PostHog autocapture OFF decision).

**Goal:** Wire every PostHog event from the Tech Spec §11 taxonomy across all surfaces (web, mobile, and Cloudflare Workers where applicable). Configure the three primary funnels in the PostHog dashboard. Verify that `posthog.identify(userId)` is called consistently on auth state change. Verify that no PII is captured in event properties.

**Output:**
- `packages/shared/analytics/events.ts` — the event taxonomy as TypeScript types so each event has a strict shape; this is the source of truth for what each event captures
- `packages/shared/analytics/posthog.ts` — the PostHog client wrappers for `track(event, properties)` and `identify(userId)`
- Every product chat's relevant surfaces updated to emit the appropriate events
- The PostHog dashboard configured with the three funnels (manual configuration in PostHog's UI, screenshots saved to `docs/POSTHOG_FUNNELS.md`)
- Autocapture is set to OFF in the PostHog client configuration

**Implementation notes:** The eighteen events from Tech Spec §11 are the explicit taxonomy; this is the only set of events captured. Autocapture is OFF because the explicit taxonomy is sufficient and autocapture would generate noise. The identify call is made on every auth state change (sign-in, sign-out resets the identity); the only property attached to identify is the user_id, never the email or any other PII. Event properties similarly avoid PII; for example, the `plan_generated` event records the user_id, the plan_date, the cache_hit boolean, and the duration_ms, but not the contents of the plan. The `user_id` property attached to events is itself treated as PII for the purposes of the App Store privacy questionnaire (chat 102 declares the four data categories as `data_linked: true` precisely because PostHog's `identify(userId)` connects events to identity); this consistency between the PostHog taxonomy and the App Privacy declarations is documented here so the questionnaire answers do not drift from the actual data flows. The three funnels measure the core conversion paths: signup-to-activation (signup_complete → first_plan_generated), activation-to-paid (first_plan_generated → subscription_started), and trial-to-D30 (subscription_started → still_active_at_day_30).

The PostHog event-name taxonomy is the source of truth for every event name emitted by any chat in the build. As of the post-audit specification, the taxonomy must include all of the following events (each introduced by a corresponding Tier 3 observability fix in the audit; the responsible chat for emission is named in parentheses): `realtime_connection_state_changed` (Chat 037); `offline_queue_flush_started`, `offline_queue_flush_completed` (Chat 038); `nl_command_submitted`, `nl_command_parsed`, `nl_command_applied` (Chat 045); `alarm_scheduled`, `alarm_fired`, `alarm_dismissed` (Chat 059b); `medication_notification_schedule_failed` (Chat 060); `calendar_conflict_detected`, `calendar_conflict_resolved` (Chat 067); `push_token_registered` (Chat 076); `live_activity_started`, `live_activity_ended`, `live_activity_update_failed` (Chat 079); `rate_limit_tripped` (Chat 009, per I-009-b); plus the existing taxonomy events shipped by Chat 096 itself for sign-up, sign-in, subscription lifecycle, plan generation, and block completion. If Chat 096 ships before any of the chats above, the taxonomy must still include the event names from the start so the wrapper compiles correctly when the upstream chat lands. The Claude Code session executing Chat 096 reads this Implementation note as authoritative for the initial taxonomy enumeration.

**Dependencies:** All product chats from Blocks 4 through 11.

**End-of-session checks:** Every event fires correctly from a manual test pass through the app. The identify calls happen at the right moments. PostHog dashboard funnels render with test data. No PII appears in PostHog inspector.

### Chat 097 — Sentry Coverage, Vercel Analytics, Open-Metrics Dashboard

*Block 12 | 🔵 🟢 🟣*

**Load at session start:** TECHNICAL_SPEC.md §11 (Sentry coverage, Vercel Analytics, public open-metrics dashboard); LAYER_6_LAUNCH_GROWTH.md (open metrics commitment); chat 096 (PostHog dashboard exists).

**Goal:** Complete the observability infrastructure. Verify Sentry source maps upload correctly for web, mobile, and Cloudflare Workers. Add user_id tagging to every Sentry event. Add prompt_version tagging to every AI-related Sentry event. Enable Vercel Analytics on the web application. Configure the public-share link for the PostHog open-metrics dashboard.

**Output:**
- Sentry source map upload verified for all three runtimes (web, mobile, workers); for each Cloudflare Worker, `upload_source_maps = true` is set in the worker's `wrangler.toml` so Sentry receives symbolicated stack traces from worker invocations (without this flag, worker errors arrive as obfuscated minified-bundle traces and are effectively undebuggable)
- `packages/shared/observability/sentryTags.ts` — exports `tagSentryUser(userId)` and `tagSentryPromptVersion(promptName, version)` for use throughout the application
- Every authenticated API route updated to call `tagSentryUser` early in the handler
- Every AI operation in `@vesper/ai` updated to call `tagSentryPromptVersion` before any potential error site
- Vercel Analytics enabled in `apps/web/app/layout.tsx` via the `@vercel/analytics/react` package
- The PostHog open-metrics dashboard share link configured; the URL captured in `docs/PUBLIC_METRICS.md`
- Stripe shared dashboard URL also captured in the same document

**Implementation notes:** Sentry source maps are uploaded by the CI workflow from chat 002 on every main-branch deploy. The user_id tag on every event is critical for incident response; without it, a Sentry error is anonymous and uncorrelatable with the affected user. The prompt_version tag enables analysis of which prompt version produced a given failure, which is essential when iterating on prompts. The Sentry sampling scale-down trigger from Chat 001 Decision 7 is implemented as a Sentry monthly-volume alert at 4,000 errors (80% of the 5,000-error Developer-tier monthly cap); when this alert fires, the founder manually reduces the production sampling rate from 100% via the Sentry project settings (documented in `docs/RUNBOOKS/ALERTING.md`). At Vesper's expected early-launch scale, manual intervention at the 4K threshold is appropriate; automation (a daily-cron worker that adjusts sampling via the Sentry config API) is deferred to V1.5 as a tool to consider if scale-down events become frequent. The public open-metrics dashboard is the open transparency commitment from Layer 6; the PostHog public-share URL is added to the marketing page and the README.

**Dependencies:** Chat 096, all product chats.

**End-of-session checks:** Sentry stack traces are symbolicated correctly in production. User and prompt_version tags appear on relevant events. Vercel Analytics records page views. The open-metrics dashboard share link works and is publicly accessible.

### Chat 097a — Operational Alerting and Spend Monitoring

*Block 12 | 🟣*

**Load at session start:** Chat 097 (observability infrastructure); chat 003 (incident response runbook); the Sentry, PostHog, and Anthropic dashboards.

**Goal:** Configure proactive alerting on operational thresholds so that runaway costs, error spikes, and capacity ceilings surface in the founder's inbox before they become incidents. Without this, Sentry catches errors but does not catch business-level signals like "Anthropic spend doubled overnight" or "Realtime connection count hit 75% of the free tier."

**Output:**
- Sentry alert rules: error rate above 50 per hour on any environment, any 5xx error on the live-activity-pusher worker, any error on the stripe-webhook or apple-assn workers
- PostHog cohort alerts: signup-rate-of-the-day drops more than 50% from the previous day; free-tier Realtime connection count crosses the upgrade threshold at 75 dual-device users (≈150 concurrent channels, 75% of the 200 ceiling per chat 003's SCALING_THRESHOLDS)
- Anthropic spend monitor: a module under the consolidated `daily-cron` worker at the 8am UTC tick (per Chat 001 Decision 20) — `workers/daily-cron/modules/spend-monitor.ts` — that queries the Anthropic billing API for yesterday's spend, compares against the daily budget computed by the formula `max($5/day floor, $1.20/user/month × (active+trial users) / 30)` — coefficient matches the operative AI cost per LAYER_5; alert at 100% of allocation indicates real cost overrun, not early warning. Early warning is handled by the $5/day floor at low user counts. The 80%/100%/200% alert tiers represent: 80% = approaching expected spend (informational), 100% = at expected spend (verification trigger), 200% = panic (real overrun, immediate investigation). The formula Sentry-alerts at 80% (warning), 100% (action — investigate immediately), and 200% (panic alert — paging severity). The formula's $5/day floor handles the early-user period where the per-user term would otherwise underestimate fixed-cost noise; the per-user term scales naturally as the user base grows. The Layer 3 cost projection assumed cache pre-warm covered all active users; actual chat 071 coverage is iOS-sleep-alarm only, so the formula accounts for the lower blended cache-hit rate (cold-path cost ~$0.06 versus warm-path ~$0.020 per first plan).
- - Stripe revenue dip alert: implemented as a daily-cron module (`workers/daily-cron/modules/revenue-monitor.ts`) at the 9am UTC tick that queries the Stripe Charges API for the prior 24-hour gross_amount and compares against the trailing 7-day average; alert fires if prior 24h is below 50% of the 7-day average (excluding the seed period where there are fewer than 7 days of data; suppress the alert during this window). Sigma is paid-tier (starts at $0.02/query) and not used; the cron-module approach uses the free Charges API. The revenue dip threshold is tuned during the first month based on actual signal-to-noise.
- All alerts route to the founder's email; Slack DM routing depends on Sentry plan tier (Sentry's direct-DM integration may require the paid plan, in which case alerts route via email-to-Slack relay through a Slack incoming-webhook channel that mirrors the email content; this is documented in the alerting runbook)
- A new `docs/RUNBOOKS/ALERTING.md` summarizing every alert's source, threshold, and expected response

**Implementation notes:** The alerting goal is "no surprise crises" rather than "monitor everything"; alerts that fire frequently get ignored. The thresholds in this chat are starting points and are tuned during the first month of production based on actual signal-to-noise. The spend monitor is the highest-value alert because Anthropic spend is the largest non-fixed cost; a runaway prompt change or a misbehaving worker could 10x daily spend overnight without any user-facing error. The 80% / 100% / 200% threshold ladder allows graduated response: 80% is "watch this", 100% is "do something today", 200% is "page now."

**Dependencies:** Chat 097.

**End-of-session checks:** A simulated error storm correctly fires the Sentry alert. A simulated Anthropic spend spike correctly fires the spend-monitor alert. The alerting runbook is complete.

---

## Block 13 — Polish and App Store Submission

Block 13 is the final block before submission. It is intentionally not feature work. The voice gate end-to-end sweep audits every user-facing surface. The error states sweep handles the unhappy paths. The accessibility and performance audit catches WCAG and Lighthouse issues. App Store metadata is authored. Screenshots are designed. Privacy policy and Terms of Service are written. The TestFlight build is submitted. The App Store submission is made.

### Chat 098 — Butler Voice Gate End-to-End Sweep

*Block 13 | 🎩 | ⚠️*

**Load at session start:** PRD §5 (full Butler Voice Specification); LAYER_4_EXPERIENCE_IDENTITY.md (full voice rules and copy library); chat 017 (voice gate); every product chat from Blocks 4 through 12.

**Goal:** Audit every user-facing string across web, mobile, emails, and the marketing surface for voice compliance. The regex layer of the voice gate is run programmatically against every literal string in the codebase. The Haiku review layer is run against every AI-generated string with a known sample. Copy library reconciliation verifies that every line shipped to the user matches the Layer 4 specification.

**Output:**
- `packages/shared/scripts/voiceGateSweep.ts` — a script that walks the codebase, extracts every string literal in TSX and JSX files, filters to user-facing strings (heuristics based on usage context), and runs the regex layer against each
- A report file at `packages/shared/output/voice-gate-sweep-{timestamp}.md` listing every violation found
- Every violation fixed; the script re-run to confirm clean
- The Haiku review layer manually invoked on a sample of AI-generated outputs from the eval harness (chat 020) with the results reviewed
- A copy library reconciliation document confirming that every hardcoded line in the application matches the Layer 4 line library

**Implementation notes:** This is a manual-plus-automated audit chat. The script catches the easy cases (em-dashes, exclamation marks, prohibited strings) but cannot catch tone violations (overly chipper copy, validation-seeking phrases). The Haiku review layer is the second pass; running it on a sample of AI outputs from real plan generations surfaces drift between the prompt's stated behavior and the actual output. The copy library reconciliation is the most manual part: each hardcoded line is checked against the Layer 4 specification.

**Dependencies:** All prior chats.

**End-of-session checks:** The voice gate sweep script reports zero violations. A manual sample of AI outputs passes the Haiku review. The copy library reconciliation is complete.

### Chat 099 — Error States Part 1: AI Fallback, Offline, Integration Errors

*Block 13 | 🔵 🟢 🎩*

**Load at session start:** PRD edge cases section; LAYER_2_PRODUCT_SCOPE.md (locked edge case behaviors); chat 022 (synthesizePlan fallback); chat 038 (offline mutation queue); chat 064 (GCal sync).

**Goal:** Build and verify the unhappy-path UI surfaces for the AI fallback chain, offline state, and broken-integration errors. The AI fallback surface displays the apology line from chat 022 when the fallback chain produces a hardcoded plan. The offline state surface displays the cached plan with a sync-on-reconnect toast. The broken-integration banner surfaces on the integrations settings page and on the day view when an integration sync has failed.

**Output:**
- `apps/web/components/plan/AIFallbackBanner.tsx` and the mobile equivalent — the banner shown when the current plan was produced by the fallback chain; voice-gated copy
- `apps/web/components/plan/OfflineState.tsx` and the mobile equivalent — the indicator shown when the device is offline; the cached plan is still visible
- `apps/web/components/integrations/BrokenIntegrationBanner.tsx` and the mobile equivalent — the banner shown when `integrations.status='error'` (the field is the authoritative trigger; transient last_error values from successfully-recovered syncs do not flicker the banner). This is the same component as chat 063's settings-page reconnect banner; it is mounted in two places (settings → integrations page from chat 063, and the day view from this chat) so a user who never visits the settings still sees the integration breakage and can act on it. Same component, two mount points.
- `apps/web/components/plan/DegradedModeBanner.tsx` and the mobile equivalent — the banner shown when this user's per-user synthesizePlan circuit breaker from chat 022 has opened due to three Anthropic failures within five minutes for this user; the banner reads "Working slower than usual. Plans will resume shortly." and remains until the breaker auto-closes. The banner reads the breaker state via a lightweight HTTP endpoint `GET /api/v1/health/circuit-breaker` that returns `{ open: boolean, opensAt?: string, closesAt?: string }` for the authenticated user; the React component polls every 30 seconds while mounted (and unsubscribes on unmount). The app stays read-functional and new plan-generation requests serve the last-known plan with a refresh CTA.
- All copy voice-gated

**Implementation notes:** Error states are where the application's voice is tested most rigorously because the user is frustrated and the copy must be calming rather than apologetic-to-the-point-of-self-flagellation. The AI fallback banner says "Working from your usual routine today" rather than "AI failed, sorry, please try again." The offline state shows the cached plan with a quiet indicator rather than a modal blocking interaction. The broken integration banner offers a one-tap reconnect CTA rather than asking the user to figure out what to do.

**Dependencies:** Chats 022, 038, 064, 098 (voice gate sweep).

**End-of-session checks:** Each error state renders correctly in test scenarios. The copy passes the voice gate. The reconnect CTA on the integration banner works.

### Chat 100 — Error States Part 2: Regen Prompt, Absence, 404, Auth Expired, Module Mini-Onboarding

*Block 13 | 🔵 🟢 🤖 🎩*

**Load at session start:** PRD edge cases section; chat 023 (generateRegenerationPrompt); the auth flow; chat 035 (onboarding preferences).

**Goal:** Build the remaining error and edge case UI surfaces. The 3-regen empathetic prompt fires after the user has regenerated their plan three times in a single day; the prompt is generated by the Sonnet call from chat 023. The 3+ day absence welcome-back surface displays when the user opens the app after more than three days away. The 404 and 500 pages are designed with the brand voice. The auth session expired flow handles the case where a stale session triggers a re-sign-in. The module mini-onboarding is a one-to-two-screen sub-flow that fires when a user toggles a module ON mid-trial.

**Output:**
- `apps/web/components/plan/RegenerationPromptModal.tsx` and the mobile equivalent — surfaces after the third regeneration of the day; uses the Sonnet-generated empathetic prompt from chat 023
- `apps/web/components/plan/WelcomeBackBanner.tsx` and the mobile equivalent — surfaces on the first app open after 3+ days away
- `apps/web/app/not-found.tsx` and `apps/web/app/error.tsx` — 404 and 500 pages with brand voice
- `apps/mobile/app/+not-found.tsx` — mobile 404
- `apps/web/app/(auth)/session-expired/page.tsx` and the mobile equivalent — the surface shown when an API call returns 401 due to expired session
- `apps/web/components/modules/ModuleMiniOnboarding.tsx` and the mobile equivalent — the 1-2 screen sub-flow when a module is toggled ON; collects the same preferences as the original onboarding for that module

**Implementation notes:** The 3-regen empathetic prompt is the application asking the user honestly what is not working with the plans; it surfaces only after three regenerations in a single local day, counted via a completion_log query: `SELECT COUNT(*) FROM completion_log WHERE user_id = $1 AND event_type IN ('plan_generated', 'plan_regenerated') AND created_at >= start_of_local_day($2)` where `$2` is the user's timezone-aware day boundary. Counting via completion_log (rather than reading a per-plan regeneration_count column) correctly handles the case where the user generates today's plan plus tomorrow's plan in one session; the threshold is per-day-of-activity, not per-plan-row. The Sonnet call generates the question dynamically based on context. The 3+ day absence welcome-back is a soft re-entry; the application acknowledges the gap without nagging. The 404 page uses the brand palette and a voice-gated line. The session expired flow re-routes to sign-in with a return-to URL so the user can resume where they were. The module mini-onboarding skips itself entirely when the user already has stored preferences for the module being toggled ON — toggling a module OFF does not delete its preferences, so toggling it back ON restores the prior state without forcing the user through the sub-flow a second time. The skip check reads the relevant slice of `user_profiles.modules_enabled` JSONB and renders the sub-flow only if the slice is missing or empty.

**Dependencies:** Chats 023, 022, 035, 098.

**End-of-session checks:** Each surface renders correctly in test scenarios. The Sonnet regen prompt produces context-appropriate questions. The module mini-onboarding correctly persists preferences.

### Chat 101 — Accessibility and Performance Audit

*Block 13*

**Load at session start:** WCAG 2.1 AA standard; Apple Accessibility Guidelines; the full web and mobile applications.

**Goal:** Run the accessibility and performance audits and fix critical issues. On web, run axe-core against every page and resolve violations. On mobile, run VoiceOver through the primary user flows and fix navigation issues. On the marketing landing page, run Lighthouse mobile audit and resolve performance violations to achieve a score of 90 or higher.

**Output:**
- `apps/web/playwright.config.ts` updated to include axe-core integration tests
- A list of accessibility issues found and resolved in `docs/A11Y_AUDIT.md`
- Performance budgets documented in `docs/PERFORMANCE_BUDGETS.md` covering the marketing page (mobile Lighthouse 90+), the app shell first paint (under 2 seconds on a mid-range device), and the plan view interaction latency (under 100ms for block actions)
- VoiceOver audit pass with critical issues fixed

**Implementation notes:** Accessibility is a real concern for some users and is also a soft requirement for App Store approval (Apple rejects apps that are clearly inaccessible). The axe-core integration covers programmatic issues like missing alt text, incorrect ARIA labels, and color contrast violations. VoiceOver testing catches focus order issues that automation does not surface. The Lighthouse mobile audit on the landing page is the most demanding performance check; if the Three.js scene drops below 90, the chat 093 optimizations need revisiting (e.g., further model compression, more aggressive LOD).

**Dependencies:** All prior product chats.

**End-of-session checks:** axe-core integration tests pass on all major pages. VoiceOver navigates the app correctly. Lighthouse mobile score is 90 or higher on the landing page.

### Chat 101a — Load Test and Chaos Drill Checklist

*Block 13*

**Load at session start:** All chats from Block 4 through Block 11; the Anthropic and Supabase free-tier rate limits and connection caps.

**Goal:** Run a lightweight synthetic load test and a manual chaos drill against the staging environment to surface integration failures that single-user testing cannot reveal. The intent is to discover pool exhaustion, rate-limit collisions, and degraded-mode behavior before production users do.

**Output:**
- `scripts/load-test/synthesizePlan.ts` — a k6 or autocannon script that fires 50 concurrent POST /plans/generate requests against staging and reports p50/p95/p99 latency, error rates, and connection-pool utilization
- `docs/CHAOS_DRILL_CHECKLIST.md` — a manual chaos-test checklist with scenarios: (a) Anthropic API slowed to 30s response (simulated via a request interceptor); verify the circuit breaker opens and the degraded-mode banner shows; (b) Supabase paused for 5 minutes; verify graceful UI behavior; (c) Stripe webhook delivery delayed by 1 hour; verify reconciliation worker catches up; (d) Cloudflare Worker CPU limit hit; verify Sentry alert fires and worker retries
- Test results documented in `docs/LOAD_TEST_RESULTS.md` with the date, configuration, and findings
- Any critical issues surfaced by the test are filed as fix-before-launch items

**Implementation notes:** This is intentionally lightweight; full load testing infrastructure is out of scope for V1. The 50-concurrent number is chosen because the Supavisor free tier has a 15-connection cap on transaction mode; 50 concurrent plan generates will provably exhaust this and surface the degraded behavior. The chaos drill is manual rather than automated because the goal is to verify the team's response runbooks, not to maintain a continuous chaos harness.

**Dependencies:** All product chats; the staging environment running against the production-equivalent infrastructure.

**End-of-session checks:** Load test runs and produces a results document. Each chaos scenario is executed and the observed behavior is documented. Critical issues are filed.

### Chat 102 — App Store Metadata and Privacy Manifest

*Block 13 | 🎩 🚧*

**Load at session start:** LAYER_3_TECHNICAL_ARCHITECTURE.md (App Privacy questionnaire); Apple's App Store Connect documentation; Apple's Privacy Manifest documentation; chat 098 (voice gate sweep).

**Goal:** Author the complete App Store Connect metadata for submission: the app description (4000 character limit), subtitle (30 characters), keywords (100 characters), promotional text (170 characters), age rating questionnaire answers, App Privacy questionnaire answers covering all seven data categories from Tech Spec, the Apple Privacy Manifest file (PrivacyInfo.xcprivacy), and the localization metadata (English/US only at V1).

**Output:**
- `docs/APP_STORE_METADATA.md` containing every metadata field with its final voice-gated copy
- `apps/mobile/ios/Vesper/PrivacyInfo.xcprivacy` — the Privacy Manifest declaring every Required Reason API used in the production iOS build; the manifest is generated by running Apple's Required Reason API audit tool against the actual build output rather than from memory, then populating the manifest with the discovered API usages and their declared reason codes
- App Privacy questionnaire answers in `docs/APP_PRIVACY_QUESTIONNAIRE.md` covering each data category collected (Contact Info: email; Identifiers: user ID; Usage Data: PostHog events; Diagnostics: Sentry crash data) with all four categories declared as `data_linked: true` because PostHog's `identify(userId)` connects events to identity; Tracking is declared `false` (no third-party tracking, no IDFA, no cross-app data sharing); the questionnaire also discloses every subprocessor used at runtime (matching the chat 104 subprocessor list — Supabase, Anthropic, PostHog, Sentry, Stripe, Apple StoreKit/ASSN, Resend, Cloudflare Workers, Upstash Redis, Google OAuth + Calendar API) so the App Privacy questionnaire and the public privacy policy are consistent
- Age rating questionnaire set to 4+ with no objectionable content categories
- App Store Connect Support URL: `https://vesper.day/support` (the `/support` route is added in Chat 094 per J-4; route must be live by C-23 hosting)
- App Store Connect Marketing URL: `https://vesper.day` (the marketing landing page from Chat 093)
- App Store Connect Privacy Policy URL: `https://vesper.day/privacy` (the page from Chat 104)
- App Store Connect Terms of Service / EULA URL: `https://vesper.day/terms` (the page from Chat 104)
- Family Sharing OFF on the subscription product (configured in App Store Connect at Cutover; this chat documents the requirement)

**Implementation notes:** App Store metadata is content work, not code work. The description is the primary marketing surface on the App Store; the first three lines are what users see before tapping More. The keywords field is critical for App Store search ranking; 100 characters means roughly 15-20 high-intent keywords separated by commas. The Privacy Manifest is required for iOS 17.4 and later; Apple rejects apps that lack it or that fail to declare specific Required Reason API usage. The manifest authored in this chat is a DRAFT generated from a current development build; the FINAL committed manifest is regenerated in chat 105 against the production TestFlight build because the Expo Modules and other native dependencies present in the dev build may differ from the production build, and only the production build's Required Reason API audit reflects what Apple will actually scan. Generating the manifest from a build scan rather than from a guess avoids the under-declaration failure mode where a manifest looks plausible but misses APIs that the actual binary uses (Expo modules in particular use a number of file-timestamp and UserDefaults APIs that are not obvious from JavaScript code). The App Privacy questionnaire's `data_linked: true` declaration on all four collected categories is the accurate posture given how PostHog operates; declaring `false` would be a misrepresentation that surfaces in App Store review and results in rejection. Tracking is declared `false` because Vesper does not engage in cross-app tracking, does not use IDFA, and does not share data with third parties for advertising. **Forward-looking constraint:** any future addition of an analytics, attribution, or marketing provider (e.g., AppsFlyer, Adjust, Branch, Segment with marketing destinations enabled, Meta SDK, TikTok SDK, Facebook Audience Network) re-triggers an ATT evaluation. The next chat that adds any such provider must update the App Privacy questionnaire, possibly adopt the ATT prompt, and re-submit the metadata. This constraint is documented here so the no-ATT posture cannot be silently broken.

**Dependencies:** Cutover for App Store Connect access, chat 098.

**End-of-session checks:** All metadata fields drafted and voice-gated. The Privacy Manifest is valid (validates via Apple's tooling). App Privacy answers match the actual data collection patterns.

### Chat 103 — App Store Screenshots and Marketing Assets

*Block 13 | 🎩 🚧*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (brand specification); App Store screenshot requirements (6.9", 6.7"); chat 102 (metadata exists).

**Goal:** Design and produce the App Store screenshots covering the required device sizes: 6.9" (iPhone 16 Pro Max) and 6.7" only. The 6.5" iPhone 11 Pro Max size is dropped (Apple no longer requires it for new submissions when 6.9" and 6.7" are supplied). Author the marketing icon (1024x1024) and any app preview video. Voice-gated copy on each screenshot's caption.

**Output:**
- Six screenshots per device size (6.9" and 6.7") showing: the day view with a populated plan, the natural-language input in action, the Dynamic Island Live Activity (compact and expanded states), the weekly planning surface, the module library, and a subscription confirmation
- Each screenshot includes a caption banner with voice-gated copy (e.g., "Your day, planned for you" on the day view screenshot)
- The 1024x1024 marketing icon in the brand palette
- An optional 15-30 second app preview video (deferred to V1.5 if time-constrained)
- All assets stored in `apps/mobile/AppStoreAssets/`

**Implementation notes:** Screenshots are the primary visual sales pitch on the App Store. Each screenshot is a polished composition: a real-looking populated app surface with the caption banner positioned for the device's safe area. The captions guide the user through the value proposition in screenshot order: the first screenshot shows the day view with the headline value ("Your day, planned for you"), the second shows the natural-language input ("Just say what you need"), and so on through the six. The marketing icon uses the espresso background with the bronze monogram, scaled to 1024x1024 with appropriate padding for App Store rounded-corner rendering. The app preview video is optional but increases conversion 15-25% per Apple's published data; if time permits, it shows a 20-second walkthrough of the daily flow.

**Dependencies:** Chat 102.

**End-of-session checks:** All six screenshots at both required device sizes are produced and look professional. The marketing icon is 1024x1024 and brand-compliant. Captions are voice-gated.

### Chat 104 — Privacy Policy and Terms of Service Live Pages

*Block 13 | 🔵 🎩 🚧*

**Load at session start:** LAYER_3_TECHNICAL_ARCHITECTURE.md (data handling, encryption, retention); the GDPR-equivalent requirements for US-based users (CCPA, state-level laws); Apple's required disclosures.

**Goal:** Author the privacy policy and terms of service as live pages on the production domain. Both documents are required for App Store submission. The privacy policy discloses every category of data collected, the retention periods, the full subprocessor list (Supabase, Anthropic, PostHog, Sentry, Stripe, Apple (StoreKit and App Store Server Notifications), Resend, Cloudflare (Workers), Upstash (Redis), Google (OAuth and Calendar API)), and the deletion process. The terms of service govern the user's relationship with Vesper including the subscription terms and cancellation rights.

**Output:**
- `apps/web/app/(marketing)/privacy/page.tsx` — the privacy policy page with the full text
- `apps/web/app/(marketing)/terms/page.tsx` — the terms of service page with the full text
- Both pages render under the marketing layout (no auth gate) and use the brand styling
- Cookie disclosure section in the privacy policy covering Supabase auth cookies, PostHog cookies, Stripe cookies, and the referral attribution cookie
- Data deletion process disclosed (the 30-day grace period, the hard-delete worker, the SHA-256 email hash retention)
- Voice-gated where the legal-document voice allows; legal language remains where required

**Implementation notes:** Privacy policy and terms are legal documents; their voice is appropriately formal rather than butler-tone, but the language is plain and not jargon-heavy. The policies cover every data category in the App Privacy questionnaire from chat 102. The cookie disclosure is required by some US states (and is best practice everywhere). The deletion process disclosure is required by Apple's privacy guidelines. The hosted location on the production domain (Cutover-blocked) is what App Store submission requires; without these pages live, App Store review rejects.

**Dependencies:** Cutover for hosting on production domain, chats 102, 098.

**End-of-session checks:** Both pages render correctly at the production URL. The content covers every required disclosure. The voice is consistent with the brand.

### Chat 105a — App Store Review Demo Account Provisioning

*Block 13 | 🟢 🚧 | ⚠️*

**Load at session start:** Chat 035 (onboarding flow), chat 048 (seed migrations), chat 081 (subscription state machine).

**Goal:** Provision TWO fully-seeded demo accounts that Apple App Store reviewers can use to evaluate the application without needing real Google credentials, real medications, or real billing data. Without these, the reviewer hits the sign-in screen, cannot proceed past Google OAuth (which requires a real Gmail), and rejects the submission for being unreviewable. Two accounts are provisioned because the iOS purchase flow and the web purchase flow exercise different paid-state surfaces; documenting both gives reviewers a path for whichever surface they choose to evaluate.

**Output:**
- Demo account ONE — iOS: `vesper.review.ios@anthropic-vesper.test` created via the Supabase Auth admin API with a known password; an Apple StoreKit sandbox subscription provisioned via App Store Connect's sandbox tester flow; this is the primary account documented for the App Review reviewer flow
- Demo account TWO — web: `vesper.review.web@anthropic-vesper.test` created via the Supabase Auth admin API with a known password; a Stripe test-mode subscription provisioned via the Stripe Customer Portal in test mode; documented as a backup for any web-flow review path
- Both accounts walked through onboarding by the same idempotent script to populate `user_profiles` with a mixed-archetype configuration that exercises all seven modules
- Seed data on both accounts: a stubbed Google Calendar integration with a static event set (work events, a recurring weekly class, two upcoming appointments), three medications with realistic times, two bills with future due dates, two recurring errands, three pending tasks with mixed priority, and a prior week of completed plans showing completion history
- The paid-state UI surfaces are source-aware: on the iOS demo account, the billing section shows a "Manage via Apple Settings" CTA reflecting the Apple-managed source; on the web demo account, the billing section shows a "Manage via Customer Portal" CTA reflecting the Stripe-managed source. The UI surface follows the actual purchase source on each account so reviewers see authentic flows.
- Both sets of credentials documented in the App Store Connect "App Review" notes field along with a 30-second walkthrough video showing the primary user flow
- `docs/APP_REVIEW_DEMO_ACCOUNT.md` capturing both sets of credentials, the seed data, and the refresh procedure (both accounts should be re-seeded before every submission via the same script)

**Implementation notes:** The demo accounts are critical because Apple reviewers cannot complete real OAuth flows; without credentialed accounts they have no way past the sign-in screen, and the rejection reason will be "unable to evaluate." The seed walkthrough script is idempotent so it can be re-run before every submission to reset both accounts to a known good state. The subscriptions are sandbox (Apple) and test-mode (Stripe); both are appropriate for App Review and do not consume real funds.

**Dependencies:** Chats 035, 048, 081.

**End-of-session checks:** Both demo accounts' credentials work for sign-in. Each account renders a populated day view with all seven modules visible. The paid-state UI on each account reflects the correct subscription source (Apple CTA on iOS, Stripe CTA on web). The walkthrough video is recorded and stored.

### Chat 105 — TestFlight Build, Live Activity End-to-End Verification, App Store Submission

*Block 13 | 🟢 🚧 | ⚠️*

**Load at session start:** Chats 077-080 (Live Activity widget, bridge, worker); chat 102 (metadata); chat 103 (screenshots); chat 104 (privacy/terms); all Cutover steps completed.

**Goal:** Produce the production TestFlight build via `eas build --platform ios --profile production`, submit it to TestFlight via `eas submit`, add the founder to the internal testing group, and perform the full Live Activity end-to-end verification on a physical iPhone. After verification passes, submit the build to App Store Review with all metadata, screenshots, and privacy materials attached.

**Output:**
- A production TestFlight build available via `eas build`
- The build submitted to TestFlight via `eas submit`
- The founder added to the internal testing group in App Store Connect
- Privacy Manifest regenerated against the production TestFlight build (`apps/mobile/ios/Vesper/PrivacyInfo.xcprivacy`) — this supersedes the draft manifest authored in chat 102; the regeneration is non-negotiable because the production build may include native modules the dev build did not (Expo Modules' Required Reason API surface differs between dev and prod targets)
- Live Activity end-to-end verification on physical iPhone 14 Pro or newer: block start → Dynamic Island populates correctly in compact and expanded states → Mark Complete tap → PATCH /blocks fires → Dynamic Island ends → next block's Live Activity chains correctly → fallback APNs push works on a non-Dynamic-Island device (iPhone 14 or earlier)
- Multi-device Realtime sync verification added to the end-of-session checks: two physical devices signed into the same account observe each other's block mutations and plan regenerations within one second; self-mutation filter drops echoes on the originating device; foregrounding the second device after a background period triggers the explicit refetch from chat 037 and picks up any broadcasts missed during background
- App Store submission with all metadata, screenshots, and privacy materials attached
- A submission tracking document at `docs/APP_STORE_SUBMISSION.md` capturing the submission date, the build version, and the review status

**Hardware requirements (verified in chat 001):** an iPhone 14 Pro or newer (Dynamic Island host) AND an iPhone 14 or earlier (non-Dynamic-Island fallback APNs push verification target). Both are listed on the chat 001 hardware checklist; both must be available before this chat begins.

**Implementation notes:** This is the final chat of Phase 4. The physical-device Live Activity verification is the highest-stakes test because the entire Block 10 work is unverifiable without it. If verification fails, the chat does not submit to App Store Review; instead, the issues are diagnosed and fixed in subsequent chats before resubmission. Common failure modes include: the widget extension's entitlements being mis-configured (results in the Live Activity failing to start), the APNs payload structure being wrong (results in the Dynamic Island not updating), the action intent's deep link being malformed (results in Mark Complete not registering). Each failure mode has a known fix path. The App Store submission, once made, enters Apple Review; review typically takes 24-72 hours. The chat ends when the submission is accepted into review (not when it is approved); approval and the public launch are Phase 5 work.

**Dependencies:** All Cutover steps, chats 077-080, 102, 103, 104, 105a.

**End-of-session checks:** TestFlight build is live and installable. The founder has the build on a physical device. Live Activity verification passes all sub-tests. App Store Review status changes from "Prepare for Submission" to "Waiting for Review."

### Chat 105b — App Store Review Rejection Response (Conditional)

*Block 13 | 🟢 🚧*

**Load at session start:** Chat 105 (initial submission); the specific rejection feedback from Apple if rejection occurs.

**Goal:** This chat runs only if Apple rejects the initial submission. Read Apple's specific rejection feedback, diagnose the issue, fix the root cause, and resubmit. Apple commonly rejects first submissions for sign-in flow issues, screenshot mismatches, metadata text concerns, or missing demo account documentation; the response process for each of these is well-trodden but cannot be predicted in advance.

**Output:**
- The rejection reason documented in `docs/APP_STORE_SUBMISSION.md`
- The fix implemented (code change, metadata edit, or screenshot replacement as appropriate)
- A response message to App Review explaining the fix, sent through App Store Connect
- A resubmitted build if the fix required a code change; metadata-only fixes do not require a new build
- The new submission status tracked in the same document

**Implementation notes:** Common rejection categories and their responses: guideline 4.8 sign-in compliance (handled by chats 010, 011 enabling Apple Sign In; should not recur but if it does, the fix is verifying the Apple Sign In button is functional and prominent); guideline 5.1.1 privacy (handled by chats 102, 041 PostHog masking; if it recurs, the response audits the App Privacy questionnaire against the actual data flows); guideline 2.1 information needed (handled by chat 105a demo account; if it recurs, the response provides additional walkthrough material). The typical resolution cycle is 1-3 days per round; budget two rounds before approval. This chat may not be needed if the initial submission is accepted directly.

**Dependencies:** Chat 105 (initial submission), conditional on rejection.

**End-of-session checks:** The rejection feedback is fully addressed. The resubmission moves back to "Waiting for Review."

---

## Cutover Block

The Cutover Block is the sequence of thirty-one manual founder actions (twenty-nine integer-numbered steps C-01 through C-29 plus two letter-suffix steps C-22a and C-27a) that must complete before the chats marked 🚧 can ship. It is not a Claude Code session; the founder performs each step. Some of these steps were submitted in Chat 001 (Apple Developer enrollment, Stripe identity verification) and reach activation here; others are net new at this point.

The steps are sequential and order-dependent. Each step has dependencies on prior steps; skipping or reordering produces hard-to-diagnose production issues.

### C-01: Purchase the production domain

Register `vesper.day` (or one of the documented alternatives if `vesper.day` is unavailable: `vesper.studio`, `vesper.house`). Use Cloudflare Registrar if possible (no markup over wholesale; native integration with the rest of the Cloudflare stack). The cost is approximately $11 per year. After purchase, confirm DNS hosting is set to Cloudflare's nameservers.

### C-02: Configure Vercel custom domain

In the Vercel dashboard for the production project, add `vesper.day` as a custom domain plus the `www.vesper.day` redirect. Vercel produces the required DNS records (one A record for the apex pointing at Vercel's IP, one CNAME for the www subdomain). Add these records in Cloudflare DNS. DNS propagation takes from minutes to hours; verify with `dig vesper.day` before proceeding.

### C-03: Bind Cloudflare Workers to vesper.day subdomains

For each Cloudflare Worker deployed, configure a custom route under the production domain (e.g., `stripe-webhook.vesper.day`, `apple-assn.vesper.day`, `live-activity-pusher.vesper.day`). The `wrangler.toml` for each worker is updated with the route. The DNS records required (CNAME pointing at the worker subdomain) are added in Cloudflare DNS.

### C-04: Apple Developer Program enrollment activates

The enrollment submitted in Chat 001 should be active by this point. Confirm in the Apple Developer dashboard that the account shows "Active" status and the membership renewal date is approximately one year out. If the enrollment has not activated, contact Apple Developer Support; the typical activation time is 24-48 hours, though some enrollments take a full week.

### C-05: Create Apple App ID with all required capabilities

In the Apple Developer Portal, create an App ID with the bundle identifier `com.vesper.app`. Enable the following capabilities: Push Notifications, Sign In with Apple, App Groups, and Live Activities. Each capability is a checkbox that requires the App ID to be re-saved. As a sub-step of enabling App Groups, register the App Group identifier `group.com.vesper.app` and select it on the App ID; this identifier is required by chat 077's widget extension and by the keychain-sharing configuration in chats 011 and 013, and both targets (main app and widget extension) reference the same identifier. Note that Live Activities is a relatively new capability; verify it appears in the list.

### C-06: Generate provisioning profile with Live Activities enabled

In the Apple Developer Portal, create a provisioning profile for the App ID with Live Activities capability enabled. Download the profile and provide it to EAS via `eas credentials`. Without this, the production build will not include the Live Activity entitlement and the widget extension will not function on real devices.

### C-07: Generate APNs authentication key

In the Apple Developer Portal under Keys, generate a new APNs Authentication Key. Download the `.p8` file. Capture the Key ID (displayed on the key detail page) and the Team ID (in the membership details). Both values are required for the live-activity-pusher worker to sign JWTs.

### C-08: Populate APNs secrets in Cloudflare Workers

For each Cloudflare Worker that signs APNs JWTs (live-activity-pusher and apns-token-cleanup primarily), set the following secrets via `wrangler secret put`: `APNS_PRIVATE_KEY` (the contents of the `.p8` file), `APNS_KEY_ID` (the captured Key ID), `APNS_TEAM_ID` (the captured Team ID). Verify the secrets are set by listing them via `wrangler secret list`.

### C-09: Configure Apple Sign In

In the Apple Developer Portal, create a Services ID with Sign In with Apple enabled. Configure the redirect URI as `https://vesper.day/auth/callback`. Generate a Sign In with Apple authentication key. Populate the environment variables `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` in Vercel for the web application's production environment.

### C-10: Create App Store Connect app record

In App Store Connect, create a new app record with the bundle identifier `com.vesper.app` (which must match the Apple Developer Portal entry from C-05). Set the primary locale to English (US). Set the app's name to "Vesper" (or the chosen final brand name if "Vesper" is taken on the App Store).

### C-11: Create subscription product in App Store Connect

In App Store Connect, navigate to the app's In-App Purchases section and create a subscription product with the identifier `com.vesper.standard.monthly`. Set the price to $19.99 USD via App Store Connect's current pricing UI (Apple deprecated numbered price tiers in 2023; the current UI accepts a direct price selection from the supported price-point list — choose $19.99 USD from the price-point dropdown for the Monthly auto-renewable subscription). Set the subscription duration to 1 month. Set the family sharing option to OFF (Vesper is single-user). Configure the localized display name and description for the App Store presentation.

### C-12: Enroll in Apple Small Business Program

In App Store Connect, navigate to Agreements, Tax, and Banking and enroll in the Small Business Program. This reduces Apple's commission from 30% to 15% as long as the developer's calendar-year App Store proceeds remain under $1M USD; the reduction applies indefinitely under the cap, not just for the first year. Developers who exceed $1M in a calendar year exit the program for the remainder of that year plus the following year, then can re-enter when proceeds fall back below the cap. New developers qualify automatically (Vesper qualifies on this basis), but enrollment is NOT automatic — Apple reviews each enrollment, and the 15% rate begins 15 days after the end of the fiscal month in which Apple approves the enrollment (so the gap between submission and 15% can be 0–~45 days depending on timing). Enroll as early as possible after C-10 to ensure approval lands before C-21 (Stripe production keys) opens the door to paying transactions; any iOS transactions during the gap are billed at 30%. Verify approval status in App Store Connect before proceeding to C-21.

### C-13: Configure App Store Server Notifications V2 webhook URL

In App Store Connect, navigate to App Information and configure the production URL for App Store Server Notifications V2 (the URL of the apple-assn worker from chats 087 and 088, which is `https://apple-assn.vesper.day` after step C-03). Save the configuration. App Store Connect sends a test notification immediately to verify the URL; the worker must respond 200 to confirm.

### C-14: Family Sharing OFF verification

Verify that the Family Sharing setting on the subscription product is set to OFF (from step C-11). This is a separate verification because if it is mis-configured, multiple users can share one subscription, which is not the intended monetization model for Vesper.

### C-15: Production environment URL

In Vercel's production environment, set `NEXT_PUBLIC_APP_URL` to `https://vesper.day`. This is referenced throughout the application code (in OAuth callback URLs, Stripe Checkout success URLs, email link generation, and elsewhere). The application's behavior in production depends on this value being set correctly before deploy.

### C-16: Google OAuth production redirect URI

In Google Cloud Console for the Vesper OAuth client, add `https://vesper.day/auth/callback` as an authorized redirect URI. Without this, Google OAuth in production rejects callback requests with an "unauthorized redirect URI" error. The development redirect URI (`http://localhost:3000/auth/callback`) can remain alongside the production URI.

### C-17: Google Site Verification

In Google Search Console, add `vesper.day` as a property and verify ownership via the DNS TXT record method. Add the verification TXT record in Cloudflare DNS. This is required for Google Calendar push webhook channel registration (chat 065); without site verification, Google rejects watch requests for the domain.

### C-18: Supabase Auth site URL configuration

In the Supabase project dashboard, navigate to Authentication > URL Configuration and set the site URL to `https://vesper.day`. Add the same URL to the redirect allow-list. Also add `https://vesper.day/auth/callback` and `vesper://auth/callback` (the mobile deep link) to the allow-list. Without these, Supabase Auth rejects callbacks from production.

### C-19: Stripe identity verification activates

The Stripe identity verification submitted in Chat 001 should be active by this point. Confirm in the Stripe dashboard that the account shows "Verified" status and that payouts are enabled. If verification is still pending, contact Stripe support; the typical resolution time is 1-3 business days, though some accounts take longer.

### C-20: Configure Stripe production webhook endpoint

In the Stripe dashboard, navigate to Developers > Webhooks and add a new endpoint for the production environment pointing at the stripe-webhook worker URL (`https://stripe-webhook.vesper.day` after C-03). Subscribe to the events from chat 084: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.trial_will_end. Capture the new `STRIPE_WEBHOOK_SECRET` (this is different from the test mode secret). Set this secret in the stripe-webhook worker via `wrangler secret put`.

### C-21: Swap Stripe test keys to production keys

In Vercel's production environment and in the Cloudflare Workers' secrets, swap the Stripe test publishable key (`pk_test_*`) with the production publishable key (`pk_live_*`) and the test secret key (`sk_test_*`) with the production secret key (`sk_live_*`). Verify by initiating a test Checkout in production and confirming the Stripe-hosted page shows live mode. Do not check this in any environment that mixes test and live data; one or the other.

### C-22: Resend domain authentication

In the Resend dashboard, add `vesper.day` as a sending domain. Resend produces the required DNS records (SPF TXT record, DKIM TXT record, and a DMARC TXT record). All three records — SPF, DKIM, and DMARC — are REQUIRED at Cutover (DMARC is no longer optional). Add all records in Cloudflare DNS. Verify the domain in Resend; verification takes from minutes to hours depending on DNS propagation. Without these records, emails sent from `noreply@vesper.day` will be flagged as spam by most major email providers, and without DMARC specifically, Gmail and Yahoo enforcement policies reject bulk sends from the domain outright.

### C-22a: Marketing subdomain DNS provisioning

In Resend, add the marketing subdomain `mail.vesper.day` as a separate sending domain (Resend supports multiple verified domains per account). In the DNS provider (the same registrar used for `vesper.day`), add the SPF, DKIM, and DMARC records that Resend emits for `mail.vesper.day`. Wait for verification (typically 5-30 minutes; can be up to 24 hours for some registrars). The transactional sender `noreply@vesper.day` continues to send auth emails, trial reminders, dunning notices, and account notifications. The marketing sender `noreply@mail.vesper.day` sends waitlist nurture, launch-day announcements, and post-cancel surveys. This subdomain isolation protects transactional email deliverability — if marketing emails ever get flagged for spam, the damage is contained to the marketing subdomain's reputation and the auth/transactional sending continues to work.

Verification: send a test email from `noreply@mail.vesper.day` to a personal Gmail address; confirm it arrives, confirm SPF/DKIM/DMARC pass (visible in the Gmail "Show original" panel), confirm the rDNS resolves correctly.

Prerequisite: C-22 (transactional `vesper.day` domain authenticated). No subsequent integer-numbered step depends on C-22a directly; Chat 092 (marketing email templates) consumes this sender at build time (see H-2 below).

### C-23: Host apple-app-site-association file

Place the `apple-app-site-association` file (prepared in chat 011 as a template) at the production URL `https://vesper.day/.well-known/apple-app-site-association`. The file is JSON and must be served with the `application/json` content type (Vercel handles this automatically for files in the `public/.well-known/` directory). Replace the placeholders in the template with the production Team ID and bundle identifier `com.vesper.app`. Verify by curling the URL; the response should be the JSON content with the correct headers. Additionally, run `curl https://vesper.day/.well-known/apple-app-site-association | jq '.applinks.details[0].appID'` and assert the output exactly matches `<production-team-id>.com.vesper.app`; a mismatch (typically caused by the dev build being signed with a different Team ID than the production cert) silently breaks Universal Links and cannot be detected after the fact except by user reports.

### C-24: Production smoke test

Execute the end-to-end smoke test against production: create a new user via Google OAuth on vesper.day, complete onboarding through the trial confirmation, observe the first plan being generated, mark a block complete via the day view, initiate a subscription Checkout flow, and verify the subscription_status transitions to active. The smoke test no longer requires a real card refund: use a Stripe test card if Stripe production is still in verification (C-20 not yet active), document the result, and re-run the test with a real card after Stripe verification completes — the post-verification re-run is the canonical smoke test, the pre-verification run is a structural-only check. If any step fails, do not proceed to App Store submission until resolved.

### C-25: Upstash Redis production provisioning

In the Upstash dashboard, create a production Redis database in the region nearest the primary Vercel deployment region. Capture `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Set both as environment variables in the Vercel production environment (rate limiting and idempotency lock from chats 009 and 025 read them) and as Cloudflare Worker secrets in every worker that uses Upstash for rate limiting, idempotency, or the per-user circuit breaker — set via `wrangler secret put UPSTASH_REDIS_REST_URL` and `wrangler secret put UPSTASH_REDIS_REST_TOKEN` in each worker's directory. Verify connectivity from a test request before proceeding.

### C-26: PostHog production project setup

In PostHog, create a production project. Capture the project API key (used by the client SDK in web and mobile) and the personal API key (used for source map upload and dashboard sharing). Set the project API key as `NEXT_PUBLIC_POSTHOG_KEY` in Vercel production environment and in the mobile app config (`app.config.js` extra). Set the personal API key as `POSTHOG_PERSONAL_API_KEY` in Vercel (Sentry-PostHog integration and source map uploader read it). Verify by emitting a test event from each surface.

### C-27: Sentry production project setup for web, mobile, and workers

In Sentry, create three production projects: `vesper-web`, `vesper-mobile`, and `vesper-workers`. Capture each project's DSN and the source map upload token. Set the DSNs as `SENTRY_DSN` in Vercel production environment (web), the mobile app config (mobile), and as Cloudffrom chat 002). ### C-27a: Daily-cron consolidated worker deploy and schedule verificationlare Worker secrets in each worker (workers). Set the source map upload tokens as `SENTRY_AUTH_TOKEN` in the CI environment for the relevant CI workflows (`.github/workflows/sentry-release.yml` from chat 002). Verify by triggering a deliberate test error in each runtime and confirming Sentry captures it with symbolicated stack trace.

### C-27a: Daily-cron consolidated worker deploy and schedule verification

Deploy `workers/daily-cron` to Cloudflare Workers Paid with the `wrangler deploy` command from the worker's directory. The `wrangler.toml` for this worker contains the consolidated cron schedule covering all modules: hour-of-UTC ticks for the per-user-local dispatch modules (trial-reminder at 8am UTC reading per-user local-time filter; bill-reminder at every-hour-of-UTC reading per-user local-9am filter; dunning-check at 8am UTC), fixed-UTC ticks for the system-time modules (hard-delete at 2am UTC, reconciliation at 3am UTC, apns-token-cleanup co-scheduled with bill-reminder, spend-monitor at 8am UTC), the 5am UTC tick for gcal-channel-renewal, and any module-specific health-check sub-schedules. Verification: from the Cloudflare Workers dashboard, confirm the worker shows as deployed at the expected version; open the cron-triggers panel and confirm the schedule list matches the wrangler.toml declaration; manually trigger a dry-run of each module via the worker's `/dispatch?module=NAME&dryrun=true` endpoint (the daily-cron worker exposes this for operational verification) and confirm each module's dry-run returns 200 OK with the expected log lines in the Cloudflare logs. Prerequisite: all secrets the worker reads (Anthropic API key, Resend API key, Supabase service role key, Stripe secret key, APNS_PRIVATE_KEY, APNS_KEY_ID, APNS_TEAM_ID, LIVE_ACTIVITY_TRIGGER_SECRET) are set via `wrangler secret put` before this step. No subsequent integer-numbered Cutover step depends on C-27a directly, but the daily-cron worker must be live before App Store submission (C-23 onwards) so users created during alpha/beta have their trial-reminder and bill-reminder modules dispatching correctly.

### C-28: Deploy apple-pki-monitor worker

Deploy the `apple-pki-monitor` Cloudflare Worker authored in chat 086a. Verify the first scheduled cron run executes successfully and (in the no-impending-expiry case) emits no alert; if any alert fires on the first run, investigate the pinned root certificate state before submitting to App Store Review. This worker is the early-warning system for Apple Root CA expiry, and it MUST be active before App Store submission — without it, the team has no operational signal for the silent-breakage failure mode where Apple receipt verifications start failing on a long-tail expiry date.

### C-29: Stripe Apple Pay domain verification

Stripe Apple Pay on the web is enabled at V1; this step provisions the domain verification file Apple requires. Download the verification file from the Stripe dashboard (Settings → Payments → Apple Pay → Add new domain) and host it at `https://vesper.day/.well-known/apple-developer-merchantid-domain-association` (place the file under `apps/web/public/.well-known/` and deploy). In the Stripe dashboard, add `vesper.day` as a registered domain and trigger the verification check; Stripe pings the well-known URL and marks the domain verified on success. Confirm Apple Pay surfaces correctly in a test Stripe Checkout session on a real Safari + iCloud-signed-in iPhone — the Apple Pay button must appear in the Checkout payment-method picker. Without this step, web users see Stripe Checkout without an Apple Pay option, and the day-6 one-tap pay flow from chat 089 cannot use Apple Pay on web.

---

## Risk Map

The following chats carry elevated risk and require plan mode, the Opus model, and additional iterations if needed. Each is flagged with ⚠️ in its full description above; this map provides the prose explanation of why each chat is risky. The list below is regenerated from the chat headers in this document as the source of truth.

Risk-flagged chats by number: 004, 005, 006, 014, 017, 019, 022, 025, 027, 037, 038, 043, 049, 051, 052, 053, 058, 059b, 060, 063, 067, 071, 073, 074, 077, 078, 080, 081, 082, 084, 086, 086a, 087, 088, 093, 097a, 098, 101, 105, 105a.

**Chat 004 — Migrations Part 1.** The first migrations establish the foundation tables. Errors here cascade through every subsequent chat because every API route depends on the Drizzle types generated from the schema. The risk is missing a column that a Tech Spec §9 API contract references; this is mitigated by the column audit in chat 006.

**Chat 005 — Migrations Part 2.** Same risk profile as chat 004 plus the additional risk of the security_audit_log trigger functions being mis-configured (specifically, missing SECURITY DEFINER or the wrong search_path). Mis-configured audit triggers either fail silently (no audit trail) or leak data via search-path injection.

**Chat 006 — First supabase db push plus Drizzle sync plus Zod plus RLS audit.** The most consequential chat in Block 1 because the database deployment is the point of no return for the schema. Errors discovered here are easier to fix than errors discovered after dozens of subsequent chats have been built against the schema.

**Chat 014 — Security headers and CSP for web.** The CSP is uniquely risky because it can be either too restrictive (breaking features in subtle ways) or too permissive (defeating its security purpose). The risk is compounded by the fact that CSP violations may not surface until specific third-party integrations are tested.

**Chat 017 — Butler voice gate.** The voice gate is the gate every subsequent user-facing copy chat must pass through. Bugs here mean either false positives (rejecting valid copy) or false negatives (allowing prohibited copy through), both of which degrade quality.

**Chat 019 — Layer 1 system prompt and DailyPlan JSON schema.** The highest-impact single chat in Phase 4. Plan quality is largely determined by this prompt. Iterations are essential; the eval harness from chat 020 should be re-run against any meaningful change.

**Chat 022 — synthesizePlan and fallback chain.** The fallback chain is non-trivial; bugs result in either the application silently failing without fallback (a blank plan view) or the fallback running when the primary call would have succeeded (degraded plan quality with no user notification).

**Chat 025 — Plan generation API with streaming and idempotency.** The streaming behavior plus the idempotency lock plus the atomic write make this one of the most architecturally complex API routes. Errors include the lock not being released on failure (preventing future generations) or the atomic write being non-atomic (resulting in orphan blocks).

**Chat 027 — Block APIs with optimistic concurrency.** The optimistic concurrency check is the resolution to Open Question 2 from Tech Spec §14. Bugs result in silent data corruption: two devices' edits being applied in the wrong order with no toast notification.

**Chat 037 — Supabase Realtime client setup.** Realtime is genuinely hard to get right; reconnection logic, self-mutation filtering, and lifecycle management are all subtle. Bugs result in the user seeing stale data or seeing their own edits echo back.

**Chat 038 — TanStack Query offline mutation queue.** Similar risk profile to chat 037 plus the additional complexity of persistence on mobile and conflict resolution on reconnect.

**Chat 043 — Block drag-and-drop reorder.** The hardest UI interaction in the application; combines drag-and-drop with optimistic concurrency with accessibility (keyboard reorder for screen readers).

**Chat 049 — Fitness module: selection, adaptation, UI.** The Sonnet contextual adaptation prompt is one of the harder secondary AI prompts; it must produce structurally-correct output while modifying a template's parameters meaningfully.

**Chat 051 — Meal planning and grocery list.** The weekly Sonnet meal synthesis must produce a coherent week's worth of meals, not just seven independent days. Coherence is hard to achieve via prompting alone.

**Chat 052 — Built-in calendar library evaluation and web implementation.** Library choice is hard to reverse. FullCalendar versus react-big-calendar is a real decision that affects every calendar surface forward.

**Chat 053 — Built-in calendar mobile implementation.** RRULE recurrence on react-native-calendars is the open question; if the library does not support it natively, the in-app expansion pattern adds complexity.

**Chat 058 — Weekly planning steps 4 and 5.** The Sonnet weekly template generation is the most complex AI call in the application; it produces seven days of plans simultaneously with priority threading.

**Chat 059b — iOS alarm screen.** Native iOS work via Notification Service Extension is unfamiliar territory for most Expo developers and requires Xcode debugging.

**Chat 060 — Medications module.** Medication data is the most sensitive in the application; RLS errors here are breach-class incidents.

**Chat 063 — Google Calendar OAuth, pgsodium encryption, key rotation runbook.** Token encryption is security-critical. The runbook is non-negotiable; rotating the encryption key without a runbook is improvising under pressure.

**Chat 067 — Google Calendar conflict resolution.** The silent-removal-plus-prompt model is subtle; bugs result in either over-aggressive removal (the user loses blocks they wanted to keep) or under-aggressive (conflicts go unresolved).

**Chat 071 — Cache pre-warm worker.** Timezone-aware queries plus tight CPU limits make this worker harder to write correctly than it appears.

**Chat 073 — Hard-delete worker.** Irreversible operations always require additional care. The cascade verification script is the safety net.

**Chat 074 — Reconciliation worker.** Cross-provider state precedence rules are subtle. Bugs result in users with the wrong subscription_status, which manifests either as locked-out paying users or unlocked non-paying users.

**Chat 077 — SwiftUI Live Activity widget extension setup.** Manual Xcode work outside Expo's automation. Configuration errors result in build failures or runtime failures that are hard to diagnose.

**Chat 078 — SwiftUI Live Activity widget UI.** SwiftUI itself is a learning curve for developers used to React Native. The widget's three view variants must each render correctly and respect the design tokens.

**Chat 080 — Live Activity pusher worker with immediate-trigger path.** APNs JWT signing is non-trivial. The chain-to-next-block logic is subtle.

**Chat 081 — Subscription state machine module.** Wrong state transitions translate to revenue loss or locked-out paying users.

**Chat 082 — Read-only mode enforcement.** Cross-cutting changes that touch every mutation API and every UI surface. Easy to miss a route.

**Chat 084 — Stripe webhook handler.** Signature verification using raw body plus idempotency plus state transitions. Errors result in lost webhook events (and thus lost or duplicated state transitions).

**Chat 086 — Apple receipt verification.** JWS verification against rotating Apple keys. Errors result in accepting invalid purchases or rejecting valid ones.

**Chat 086a — Apple PKI monitor worker.** Early-warning system for Apple Root CA expiry. Cron-deploy timing matters because the worker must be active before App Store submission (per Cutover C-28). The pinned Apple root cert in the worker source must be updated whenever Apple rotates its PKI.

**Chat 087 — Apple Server Notifications V2 worker part 1.** Five distinct notification types with state machine integration.

**Chat 088 — Apple Server Notifications V2 worker part 2.** Ten more notification types. Coverage of all fifteen is required for correct subscription state.

**Chat 093 — Waitlist landing page with Three.js cinematic.** Performance-sensitive brand-defining surface. Slow rendering on mobile devices destroys conversion.

**Chat 097a — Operational alerting and spend monitoring.** Cross-cuts Anthropic spend, Sentry error volume, Cloudflare worker health, Supabase realtime, Stripe webhook delivery, Apple ASSN. A miss here means the founder is blind to a production issue until users report it.

**Chat 098 — Butler voice gate end-to-end sweep.** A miss here results in brand contamination at launch (prohibited copy reaching users).

**Chat 101 — Accessibility and performance audit.** Accessibility failures can result in App Store rejection. Performance failures degrade conversion.

**Chat 105 — TestFlight build and Live Activity end-to-end verification and App Store submission.** The final gate before launch. Failed verification means resubmission after fixes.

**Chat 105a — Demo account provisioning.** Apple reviewers require credentialed accounts to evaluate the app behind sign-in. Without working demo credentials, the rejection reason is "unable to evaluate" and the resubmission cycle costs 1-3 days. The chat ships a seed walkthrough script that re-runs idempotently before every submission; the script must be tested before C-21 so the seed data is known-good for the App Store Review pass.

---

## Parallelization Map

The chats below can run concurrently on separate Claude Code terminals. The arrows indicate parallelization opportunities; chats that share a parallelization arrow can run in any order or simultaneously.

**Block 0:** Sequential. Chat 001 must complete first; chats 002 and 003 follow in order.

**Block 1:** Mostly sequential. Chat 004 must complete before chat 005, which must complete before chat 006. Chat 007 follows 006.

**Block 2:** 010 and 011 (web and mobile auth) parallel. 012 and 013 (web and mobile shell) parallel. 014 follows 012. 015 (build gate) follows all of the above.

**Block 3:** 016 first. 017 follows 016. 018 and 019 can run in parallel (with 018 stubbing types from 019 until 019 lands). 020 follows 019. 021 follows 019. 022 follows all of 017, 020, 021. 023 follows 017.

**Block 4:** 024 and 025 parallel. 026 follows 025. 027 follows 026. 028 parallel with 027. 029 follows 028. 030 and 031 parallel after 024.

**Block 5:** Sequential by screen order (032 → 033 → 034 → 035 → 036).

**Block 6:** 037 first. 038 follows 037. 039 and 040 parallel (web and mobile day view). 041 follows both. 042 follows 041. 043 follows 042. 044 follows 039 and 040. 045 follows 044. 046 follows 042.

**Block 7:** 047 first. 048 follows 047. 049 and 050 parallel after 048. 051 follows 050. 052 first for calendar, 053 follows 052. 054 follows 028. 055 follows 054. 056 follows 055. 057 first for weekly planning, 058 follows 057. 059a and 059b parallel after 035. 060, 061, 062 parallel after 028.

**Block 8:** 063 first (chronologically; pgsodium runbook gate). 064 follows 063. 065 follows 064. 066 follows 065. 067 follows 064. (Chats 068, 069, 070 have been intentionally deleted per the local intelligence removal; Block 8 now runs 063 through 067 only.)

**Block 9:** Worker count is reduced by the Chat 001 Decision 20 consolidation: 071 (cache-prewarm, HTTP-triggered) stays separate; 072 (trial-reminder + dunning-check), 073 (hard-delete), 074 (reconciliation), 075 (bill-reminder + apns-token-cleanup), 066 (gcal-channel-renewal), and 097a (spend-monitor) all ship as modules under one `daily-cron` worker dispatched by hour-of-UTC; 080 (live-activity-pusher) stays separate because of its tight CPU budget and 5-minute cron cadence; 086a (apple-pki-monitor) stays separate because its weekly schedule does not compose cleanly with daily-cron's hourly dispatch model. Chat work itself still parallelizes — multiple Claude Code terminals can run different chats from this block at the same time — but deployment converges on three workers (daily-cron, live-activity-pusher, apple-pki-monitor). 074 specifically requires 084, 087, 088 from Block 11 to land first; its module can be scaffolded in Block 9 but the logic completes after Block 11. 073 specifically requires 080 from Block 10 for its end-active-Live-Activities-before-cascade step; the worker module can be scaffolded in Block 9 but the LA-end integration completes after Block 10. 075's APNs cleanup module requires 080 from Block 10 to land first; the cleanup logic reads 410 Gone responses logged by 080's worker, so the module can be scaffolded in Block 9 but the 410-reading code path completes after Block 10. The `weekly-cron` worker reference in the prior text is removed because Chat 069 was deleted with the local-intelligence feature removal.

**Block 10:** 076 first. 077 follows 076. 078 follows 077. 079 follows 078. 080 follows 079.

**Block 11:** 081 first. 082 follows 081. 083 follows 081. 084 follows 083. 085 follows 081. 086 follows 085. 087 follows 086. 088 follows 087. 089 follows 084 and 086. 090 follows 089.

**Block 12:** 091 and 092 are SEQUENTIAL (not parallel): 092 establishes its component pattern from 091, so 091 must complete first. 091 itself ships BEFORE chat 072 in Block 9 because the trial-reminder module from 072 imports template components from 091 directly and TypeScript compile fails without them (cross-block dependency: 091 → 072). 093 follows 031 and 014. 094 follows 093. 095 follows 081 and 031. 096 follows all product chats. 097 follows 096.

**Block 13:** 098 follows everything. 099 and 100 parallel after 098. 101 follows 098. 102 and 103 parallel after Cutover. 104 follows Cutover. 105 follows everything plus Cutover.

The practical effect of parallelization is that Block 2 can run on two terminals (web track, mobile track), Block 6 can run on two terminals after the shared Realtime and offline foundation, and many of the Block 7 module chats can run on three or four terminals simultaneously. The Cutover Block itself is sequential because each step depends on prior steps.

---

## Skill Invocation Map

Each chat that invokes a specific Claude Code skill is enumerated below. Skills are added to the Claude Code session at the start of the chat that needs them.

The lists below are reconciled against the chat headers in this document as the source of truth: a chat appears in a given list if and only if its header carries the corresponding skill flag.

**drizzle-best-practices (🗄️):** Chats 004, 005, 006, 048. Every migration-touching chat. The skill encodes correct patterns for foreign keys, RLS policies, check constraints, and the BEGIN/COMMIT wrap convention.

**AI prompt versioning (🤖):** Chats 016, 017, 018, 019, 020, 021, 022, 023, 029, 049, 050, 051, 055, 058, 064, 071, 100. Every chat that authors or modifies a prompt requires the version constant to be bumped atomically with the prompt change.

**Butler voice gate (🎩, caveman + stop-slop):** Chats 010, 017, 018, 019, 023, 029, 032, 035, 036, 042, 044, 045, 046, 051, 056, 058, 059a, 061, 062, 067, 072, 075, 089, 090, 091, 092, 093, 095, 098, 099, 100, 102, 103, 104. Every chat with user-facing copy.

**superpowers (TDD-focused):** Chats 002, 019, 022, 027, 037, 038, 080, 081, 084, 086, 087, 088. The chats where test-driven development pays the most dividends because the surface is high-stakes and error-prone.

**stop-slop:** Implicitly active on every chat with user-facing copy; explicitly noted in the chat description where copy is the primary output.

**context-engineering-kit + caveman:** Always on; the project's baseline.

---

## Critical Path

The critical path is the sequence of chats that must complete in order with no possible parallelization. These chats determine the minimum number of sequential Claude Code sessions required, regardless of how many terminals are run in parallel.

The critical path through Phase 4: 001 → 002 → 004 → 005 → 006 → 007 → 008 → 017 → 019 → 020 → 022 → 025 → 026 → 037 → 038 → 039 → 041 → 042 → 044 → 045 → 063 → 064 → 081 → 082 → 084 → 086 → 091 → 098 → 105a → 105.

Chat 063 (pgsodium encryption and Google Calendar OAuth) moves earlier on the critical path than its prior Block 8 position because chat 034 (onboarding screens 5A and 5B) now hard-depends on the full integration flow rather than a stub. Chat 064 (GCal sync logic, token refresh, classification) joins the critical path because chat 034's calendar branch requires the full sync behavior rather than just OAuth connection; the 063 → 064 → 034 ordering is now load-bearing. Chat 091 (Resend email templates Part 1) moves onto the critical path because chat 072 (trial reminder module) hard-depends on it. Chat 105a (demo account provisioning) lands just before chat 105 (App Store submission) because reviewers cannot evaluate the app without seeded credentials.

That is thirty sequential chats. Every other chat in Phase 4 parallelizes around this spine. With three to four Claude Code terminals running concurrently, the total Phase 4 calendar time is approximately equal to the critical path length divided by the daily session throughput. The additional chats (086a, 090b, 097a, 101a, 105b) add roughly five non-critical-path sessions; 090a is now deferred to V1.5 and is not part of Phase 4; 105b only runs if Apple rejects the initial submission.

The Cutover Block sits between Blocks 11 and 12 on the critical path; specifically, Cutover must complete before chats 085, 086, 086a, 087, 088, 093 (production deploy), 102, 103, 104, 105a, and 105.

---

## External Items Started Day 1

These items were submitted or acquired in Chat 001 because they have multi-day approval windows that would otherwise delay the Cutover Block.

**Apple Developer Program enrollment.** Submitted Day 1. Review window is typically 24-48 hours but can extend to a full week. Activation is required by Cutover step C-04.

**Stripe identity verification.** Submitted Day 1. Review window is typically 1-3 business days. Verification is required by Cutover step C-20.

**Domain registration.** Performed Day 1 if a domain choice has been made (recommended: register early to lock the chosen domain even if production deploy is weeks away). The cost is approximately $11 per year through Cloudflare Registrar. The DNS propagation after registration takes minutes to hours.

**Resend domain authentication.** Started Day 1 once the domain is registered. The DNS records (SPF, DKIM, DMARC) take time to propagate; starting early ensures verification is complete before Cutover step C-22.

**Google Cloud Console OAuth consent screen.** If the application uses sensitive OAuth scopes (Vesper does not at V1; the Google Calendar scopes are non-sensitive), the consent screen requires Google review which can take weeks. At V1 this is not on the critical path; document the consideration for V1.5 if additional scopes are added.

**Expo account and EAS project initialization.** Performed Day 1. The Expo account is free; EAS project initialization is instant. Required for any mobile development thereafter.

**RapidAPI account creation for ExerciseDB.** Performed Day 1. The account is free; the API key is generated immediately. Required for chat 047 (seed sourcing).

**iPhone 14 Pro or newer hardware confirmation.** Confirmed Day 1. Live Activity testing in chat 105 requires a device with Dynamic Island, which is iPhone 14 Pro and newer.

---

## Closing Notes

This document is the canonical reference for Phase 4 Vesper V1 build. Each numbered chat is one Claude Code session. Sessions are scoped to one coherent unit of work per Tech Spec §13. The voice gate from chat 017 must be active for every user-facing copy chat that follows. The pgsodium runbook from chat 063 must exist before any production OAuth token is encrypted. The Cutover Block is sequential and order-dependent.

The build comprises 105 primary chats plus six additional chats authored during the Phase 4 review (086a Apple PKI monitor, 090a data export — now renumbered in scope as deferred to V1.5 but counted toward the original review-set total, 090b biometric lock, 097a operational alerting, 101a load test and chaos drill, 105a demo account provisioning) and one conditional chat (105b App Store review rejection response) for a total of 112 build sessions when 105b is needed and 111 when the initial submission is accepted. Of those, 090a is relocated to the "Deferred to V1.5" section at the end of this document and does not run during Phase 4. The Cutover Block now contains thirty-one manual founder actions (twenty-nine integer-numbered steps C-01 through C-29 plus two letter-suffix steps C-22a and C-27a). The five Cutover additions for V1 infrastructure are positioned at the tail of the integer range: Upstash Redis (C-25), PostHog (C-26), Sentry (C-27), apple-pki-monitor deploy (C-28), and Stripe Apple Pay domain verification (C-29). The two letter-suffix additions are C-22a (marketing subdomain `mail.vesper.day` per H-4 decision, inserted between C-22 and C-23) and C-27a (daily-cron consolidated worker deploy per I-Cutover-DailyCron, inserted between C-27 and C-28). No integer cascade is applied; the letter-suffix pattern preserves all cross-references to integer step numbers established before this manifest.

After all chats and the Cutover steps complete, the application is submitted to App Store Review and the waitlist landing page is live on the production domain. Phase 5 covers launch coordination, App Store approval response, and the first month of operation.

---

## Deferred to V1.5

Work originally scoped for V1 that has been moved out of Phase 4 lives here with rationale and a pointer back to the original chat spec.

### Chat 090a — Data Export Endpoint and Worker (V1.5)

**Rationale for deferral:** The CCPA-driven user-data export feature is non-blocking for App Store submission (Apple does not require an in-app export at V1; the data deletion path satisfies the App Privacy posture). The Cloudflare R2 dependency the original spec assumed adds a paid-tier provider relationship and a signed-URL infrastructure that we are not willing to take on for V1 given the low expected request volume during the first months. Deferring keeps the V1 surface narrower and the V1 infrastructure smaller.

**V1.5 scope (original chat spec retained for reference):**

*Block 11 | 🔵 🟣 🎩*

**Load at session start:** TECHNICAL_SPEC.md §4 (Account section); LAYER_5_BUSINESS_MONETIZATION.md (data portability); chat 091 (email templates pattern).

**Goal:** Build the data-export feature required by CCPA. The user requests an export via the settings panel; the request enqueues a background worker that gathers all user data into a JSON archive and emails the user a one-time download link via Resend.

**Output (V1.5):**
- `apps/web/app/api/v1/account/export/route.ts` — POST handler that creates an export-request row and enqueues the worker; rate-limited to one export per 24 hours per user
- `workers/data-export/index.ts` — Cloudflare Worker triggered on the export-request queue; gathers user_profiles, daily_plans, blocks, tasks, weekly_priorities, medications, recurring_errands, bills, integrations metadata (not tokens), subscription summary, completion_log, hydration_log, cancellation_events, calendar_events into a single JSON document; uploads to Cloudflare R2 (V1.5 R2 dependency introduced here) with a signed URL valid for 24 hours; emails the user the download link
- `apps/web/app/(app)/settings/account/page.tsx` updated to include a "Download Your Data" button with explanatory copy
- `packages/shared/emails/DataExportReady.tsx` — the email template with the download link and the 24-hour expiry note
- A new export_requests table

**Notes:** The integrations row data excludes encrypted OAuth tokens. The 24-hour expiry on the download link plus the rate limit on requests prevents abuse. R2 provisioning happens during V1.5 launch prep; it is NOT part of Phase 4 Cutover.

End of Phase 4 Build Plan.