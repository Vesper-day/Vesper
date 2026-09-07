# Vesper — Technical Specification

**Version:** 1.0
**Phase:** 2 (PRD + Technical Specification consolidation)
**Status:** Complete. Open questions Q1 and Q5 resolved in v1.0; four remaining open questions are deferred implementation triggers, not blocking decisions. Referral mechanic specification expanded across Sections 3, 8, and 9.

This document specifies the implementation surface of Vesper as locked through Layers 1–6 and consolidated in Phase 2. It is the authoritative technical reference for Claude Code during the build phase. Decisions described here are not re-derived; they are the implementation expression of choices made during brainstorming. Sections 6, 8, 9, 11, and 14 incorporate resolutions confirmed during v1.0 finalization.

---

## Table of Contents

1. [Stack Summary](#1-stack-summary)
2. [Repo Structure](#2-repo-structure)
3. [Database Schema](#3-database-schema)
4. [Auth Architecture](#4-auth-architecture)
5. [AI Architecture](#5-ai-architecture)
6. [Integration Specs](#6-integration-specs)
7. [Live Activity and Dynamic Island](#7-live-activity-and-dynamic-island)
8. [Payments](#8-payments)
9. [API Contracts](#9-api-contracts)
10. [Hosting and Infrastructure](#10-hosting-and-infrastructure)
11. [Observability](#11-observability)
12. [Security and Privacy](#12-security-and-privacy)
13. [Dev Workflow](#13-dev-workflow)
14. [Open Technical Questions](#14-open-technical-questions)

---

## 1. Stack Summary

### Web

The web application is built on **Next.js 15** with the App Router. TypeScript is used throughout with strict mode enabled (`"strict": true` in `tsconfig.json`). Server Components are the default for static and low-interactivity surfaces: the landing page, settings screens, and profile views. Client Components are used wherever interactivity demands it: the plan view, the weekly planner, drag-and-drop block reordering, and the natural-language input surface. The Vercel AI SDK handles streaming AI responses in the plan view. The application targets Node.js 20 LTS as its runtime.

Key web dependencies and their locked versions at project initialization:

| Package | Version | Purpose |
|---|---|---|
| next | 15.x | Framework |
| react | 19.x | UI |
| react-dom | 19.x | UI |
| typescript | 5.x | Language |
| @ai-sdk/react | latest | Streaming AI responses |
| @tanstack/react-query | 5.x | Server state and caching |
| zustand | 5.x | Client state |
| zod | 3.x | Schema validation |
| drizzle-orm | 0.x | Database queries |
| @supabase/supabase-js | 2.x | Auth and Realtime client |
| date-fns | 3.x | Date math |
| @hello-pangea/dnd | latest | Drag-and-drop block reorder |

### Mobile

The mobile application is built on **Expo SDK 54** with **React Native** and TypeScript. iOS is the only target at V1. Android support is added at V1.5 using the same Expo codebase. The minimum iOS deployment target is **iOS 17.2**, raised from the earlier 16.1 floor so that Live Activity Push Start is guaranteed on every install with no version-based degraded-fallback code path (per the Phase 4 build-plan H-10 decision). 17.2+ covers the large majority of active iOS devices at launch, which is sufficient coverage for an indie V1. Dynamic Island support is a separate hardware axis, not a version axis: all supported installs run 17.2+, but devices without Dynamic Island hardware (iPhone 14 and earlier non-Pro models) fall back to persistent banner notifications as specified in Section 7. There is no longer an iOS-version-based fallback band (the former 16.1–17.1 banner case is eliminated by the raised target); the only fallback is hardware-based.

Key mobile dependencies:

| Package | Version | Purpose |
|---|---|---|
| expo | ~54.0 | Framework |
| react-native | 0.81.x | UI |
| expo-router | 6.x | Navigation |
| expo-secure-store | latest | JWT storage (iOS Keychain) |
| expo-auth-session | latest | OAuth flows |
| expo-live-activities | latest | ActivityKit / Dynamic Island |
| expo-notifications | latest | APNs push tokens and fallback |
| @tanstack/react-query | 5.x | Server state and caching |
| zustand | 5.x | Client state |
| zod | 3.x | Schema validation |
| @supabase/supabase-js | 2.x | Auth client |
| date-fns | 3.x | Date math |
| react-native-reanimated | 4.x | Animations |
| react-native-worklets | 0.5.x | Reanimated 4 worklets runtime |
| react-native-gesture-handler | 2.x | Gesture recognition |
| react-native-draggable-flatlist | latest | Block reordering |

### Backend

The backend is split across two platforms that serve distinct purposes and remain within free-tier limits at V1 user counts.

**Next.js 15 API Routes on Vercel** handle all request-response logic for both the web and mobile clients. The mobile application authenticates via Supabase Auth, and the API routes validate the session token against Supabase before processing any request. This single-source architecture means the mobile app and web app share identical endpoints with no divergence.

**Cloudflare Workers with Cron Triggers** handle all scheduled and autonomous jobs. Cloudflare is used rather than Vercel because Vercel's free cron tier supports only daily cadence, while several of these workers require five-minute cadence (cache pre-warm, Live Activity pusher, and delayed-jobs tick in particular). Cloudflare's free cron supports arbitrary cadences including the five-minute schedule used here. All eight recurring workers — cache pre-warm, Live Activity pusher, delayed-jobs tick, email queue, trial reminder, dunning check, nightly reconciliation, and daily hard-delete — run on Cloudflare.

Cloudflare Workers also receive the Stripe and Apple webhook payloads. Routing webhooks to Cloudflare rather than Vercel keeps cold-start latency lower and isolates the payment processing surface from the main API.

### Database

**Postgres 15** managed by Supabase. Accessed exclusively via **Drizzle ORM** from the `@vesper/db` package. Row Level Security is enabled on every table. The Drizzle client is initialized once per API route handler using the `SUPABASE_SERVICE_ROLE_KEY` for service-role operations, and the anon key is never used server-side. All Zod schema validation for JSONB columns is defined in `@vesper/shared/types`.

### Authentication

**Supabase Auth** with three sign-in methods: Google OAuth, Apple Sign In, and email magic link. Apple Sign In is required on iOS by App Store guidelines when any other social login is offered. Email delivery for magic links is handled by Resend.

### Payments

**Stripe** handles web subscription billing through Stripe Checkout and the Stripe Customer Portal. **Apple In-App Purchase via StoreKit 2** handles iOS subscription billing. Both systems write to a single subscription state per user. Webhook events from both providers are received by Cloudflare Workers at dedicated endpoints.

### AI

**The Anthropic API** is the sole AI provider. Two models are used at runtime: `claude-haiku-4-5` for lightweight classification and gate tasks, and `claude-sonnet-4-6` for plan synthesis and complex reasoning. The Vercel AI SDK wraps the Anthropic SDK and provides the streaming interface for the web client. The `@ai-sdk/anthropic` package is the Anthropic provider for the Vercel AI SDK.

### Hosting

| Service | Platform | Initial Tier | Key constraints |
|---|---|---|---|
| Web app | Vercel | Pro ($20/seat/mo) — active from Phase 4 build start | Hobby TOS prohibits commercial use; Pro required from day one of any commercial project |
| Database + Auth | Supabase | Free | 500 MB DB, 5 GB DB egress + 5 GB cached egress, 50K MAU; projects auto-pause after 7 days of inactivity |
| Scheduled workers + webhooks | Cloudflare Workers | Free | 100K requests/day per worker, 10ms CPU per invocation |
| Email | Resend | Free (3K/month) | Hard cap of 100 emails per day on free tier; launch-week sends may approach this |
| Error monitoring | Sentry | Free (5K errors/month) | 1-user limit on Developer tier; second dashboard user requires Team ($26/mo) |
| Product analytics | PostHog | Free (1M events/month) | 1-project limit, 1-year data retention on free |

---

## 2. Repo Structure

The project uses a **Turborepo monorepo** with pnpm workspaces. All packages live under `packages/`. All applications live under `apps/`. The root `turbo.json` defines the build, lint, and test pipelines.

```
vesper/
├── apps/
│   ├── web/                        # @vesper/web — Next.js 15 application
│   └── mobile/                     # @vesper/mobile — Expo application
├── packages/
│   ├── ai/                         # @vesper/ai — Anthropic client, prompts, voice gate
│   ├── db/                         # @vesper/db — Drizzle schema, migrations, seeds
│   └── shared/                     # @vesper/shared — Types, Zod schemas, constants
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                    # Root — dev tooling only (eslint, prettier, typescript)
└── .env.example                    # Documents all required environment variables
```

### Package Boundaries

**`@vesper/shared`** is the dependency that every other package and application imports. It contains: TypeScript type definitions exported from Zod schemas (so the inferred types are always consistent with runtime validation), shared constants (timezone list, archetype display names, block type abbreviations, module display order, subscription state labels), and utility functions that have no platform-specific dependencies (date formatting, energy score helpers, block duration calculators). This package has zero external dependencies beyond Zod and date-fns. It is the only package imported by both `@vesper/web`, `@vesper/mobile`, `@vesper/ai`, and `@vesper/db`.

**`@vesper/db`** contains the Drizzle schema definitions, the migration files, and the seed data files. It exports a `db` client factory and the table schema objects used for type-safe queries. The `@vesper/web` API routes import from this package. `@vesper/mobile` does not import from `@vesper/db`; the mobile app communicates exclusively through the API.

```
packages/db/
├── src/
│   ├── schema/                     # One file per table group
│   │   ├── users.ts
│   │   ├── daily-planning.ts
│   │   ├── templates.ts
│   │   ├── modules.ts
│   │   ├── integrations.ts
│   │   ├── subscriptions.ts
│   │   ├── waitlist.ts
│   │   └── analytics.ts
│   ├── client.ts                   # Drizzle client factory
│   └── index.ts                    # Barrel export
├── migrations/                     # SQL migration files (Supabase CLI format)
│   └── YYYYMMDDHHMMSS_description.sql
└── seed/
    ├── workout_templates.json
    └── recipe_templates.json
```

**`@vesper/ai`** contains prompt constants with version strings, the Anthropic API client wrapper, the voice gate implementation, and the context construction logic that assembles the per-user AI call payload. Neither `@vesper/web` nor `@vesper/mobile` call the Anthropic API directly; all AI calls route through this package. The mobile app calls the `/api/v1/ai/` endpoints which invoke `@vesper/ai` server-side.

```
packages/ai/
├── src/
│   ├── prompts/                    # Prompt constants
│   │   ├── daily-plan.ts           # DAILY_PLAN_SYNTHESIS_PROMPT + _VERSION
│   │   ├── weekly-review.ts
│   │   ├── template-selection.ts
│   │   ├── nl-command.ts
│   │   ├── calendar-classify.ts
│   │   ├── checkin-question.ts
│   │   ├── voice-gate.ts
│   │   └── empathy-regeneration.ts
│   ├── context.ts                  # User context construction
│   ├── gate.ts                     # Butler voice gate (regex + Haiku layers)
│   ├── client.ts                   # Anthropic SDK wrapper
│   └── index.ts
```

**`@vesper/web`** is the Next.js application. Its internal structure follows Next.js App Router conventions.

```
apps/web/
├── app/
│   ├── (marketing)/                # Landing page, waitlist — no auth required
│   ├── (auth)/                     # Sign-in, magic link confirmation
│   ├── (app)/                      # Auth-required app shell
│   │   ├── plan/                   # Daily plan view
│   │   ├── week/                   # Weekly planner
│   │   ├── tasks/                  # Task pool
│   │   ├── settings/               # Profile, modules, integrations, billing
│   │   └── layout.tsx              # App shell with subscription gate
│   └── api/
│       └── v1/                     # All API routes
├── components/
├── hooks/
├── lib/
│   ├── supabase.ts                 # Supabase browser client
│   └── api.ts                      # Typed fetch wrappers for API routes
└── public/
```

**`@vesper/mobile`** is the Expo application. Expo Router is used for file-based navigation.

```
apps/mobile/
├── app/
│   ├── (auth)/
│   ├── (app)/
│   │   ├── index.tsx               # Daily plan (default tab)
│   │   ├── week.tsx
│   │   ├── tasks.tsx
│   │   └── settings/
│   └── _layout.tsx
├── components/
├── hooks/
├── lib/
│   ├── supabase.ts                 # Supabase native client
│   └── api.ts                      # Typed fetch wrappers
├── ios/                            # Prebuild-generated iOS project
│   └── VesperLiveActivity/         # Swift Live Activity widget extension
└── android/                        # Placeholder; active at V1.5
```

### Naming Conventions

File names use kebab-case throughout (`daily-plan.ts`, `use-plan-query.ts`). React components use PascalCase file names (`PlanBlock.tsx`). API route files follow Next.js convention (`route.ts` inside the segment directory). Database migration files use the Supabase CLI timestamp format (`20260601000001_enums_and_extensions.sql`). Environment variable names are `SCREAMING_SNAKE_CASE`. TypeScript types exported from `@vesper/shared` use PascalCase. Zod schemas are named with a `Schema` suffix (`DailyPlanSchema`, `BlockDetailsSchema`).

### Shared Types

All TypeScript types that cross the boundary between packages or between server and client are defined as Zod schemas in `@vesper/shared/src/schemas/` and exported as both the Zod schema object (for runtime validation) and the inferred TypeScript type (for static typing). Callers import from `@vesper/shared` and never define duplicate types locally. The JSONB column shapes documented in the Database Schema section are all implemented as Zod schemas in `@vesper/shared/src/schemas/jsonb/`.

---
## 3. Database Schema

This section specifies the complete V1 database schema implementable directly via Supabase migrations. The schema runs on Postgres 15 (Supabase managed), is accessed from the Next.js API routes via Drizzle ORM, and uses Row Level Security as the authorization floor on every table that holds user data.

## Conventions

Table names are snake_case and plural. Column names are snake_case. Primary keys are always named `id`. Foreign key columns are always named `<referenced_table_singular>_id`. All timestamp columns use `timestamptz` (timestamp with time zone) and store values in UTC at the database; conversion to the user's local timezone happens at the application layer using the `users.timezone` field. Every table that represents mutable user data has both `created_at` and `updated_at` columns with `DEFAULT now()`; `updated_at` is maintained by a generic Postgres trigger function `set_updated_at()` applied to each such table. JSONB columns are validated at the API boundary by Zod schemas defined in the `@vesper/types` package, providing TypeScript type safety end-to-end without enforcing structure at the database level.

UUIDs are used for all primary keys except `security_audit_log`, which uses a bigint identity column because of its expected high write volume and the fact that the row identity is opaque to user code. Enums are declared as Postgres native ENUM types rather than string columns with CHECK constraints, since enums are introspectable by Drizzle and produce typed TypeScript unions automatically.

Row Level Security is enabled on every table without exception. The default posture is deny-all; tables grant specific policies as documented per table below. Tables intended for service-role-only access (subscription_events, security_audit_log, deleted_user_email_hashes) have no public policies and are therefore unreachable except via the Supabase service role key held by the Vercel and Cloudflare Worker runtimes.

The standard own-row RLS pattern referenced repeatedly below is the four-policy set: SELECT `USING (auth.uid() = user_id)`, INSERT `WITH CHECK (auth.uid() = user_id)`, UPDATE `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`, DELETE `USING (auth.uid() = user_id)`. Tables marked as using this pattern receive all four policies unless explicitly noted otherwise.

## Schema Overview

The V1 schema contains 20 tables grouped into nine domains. Listed in foreign-key dependency order:

**Users and Auth (3):** `users`, `user_profiles`, `deleted_user_email_hashes`
**Daily Planning (4):** `daily_plans`, `blocks`, `tasks`, `weekly_priorities`
**Templates (2, seeded):** `workout_templates`, `recipe_templates`
**Modules (3):** `medications`, `recurring_errands`, `bills` — plus two **method-B scaffold** tables (`food_log_entries`, `lift_log_entries`) defined under "Method-B Module Scaffold Tables" below; each is a thin V1 scaffold with deep columns deferred.
**Integrations and Devices (2):** `integrations`, `push_tokens`
**Subscriptions and Billing (2):** `subscriptions`, `subscription_events`
**Waitlist and Referrals (2):** `waitlist`, `referral_credits`
**Audit and Analytics (2):** `completion_log`, `security_audit_log`

---

## Table Specifications

### 1. `users`

The core application identity row. Each row shares its primary key with the corresponding `auth.users` row managed by Supabase Auth, with a foreign key reference and cascading delete. Holds subscription status as a denormalized pointer (the authoritative billing state lives in `subscriptions`), the user's IANA timezone used by every cron worker that schedules per-user actions, archetype assignment from onboarding, the deletion grace timestamp that gates the hard-delete worker, and the referral attribution captured at signup.

Columns:
- `id` uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
- `email` text NOT NULL UNIQUE
- `archetype` archetype_enum NOT NULL — values: nine_to_five, remote, student, athlete, founder, mixed
- `timezone` text NOT NULL DEFAULT 'America/Los_Angeles'
- `location_lat` numeric(10,7) NULL
- `location_lng` numeric(10,7) NULL
- `honorific` honorific_enum NOT NULL DEFAULT 'none' — values: sir, madam, none
- `subscription_status` subscription_status_enum NOT NULL DEFAULT 'trial' — values: trial, active, past_due, read_only, archived, deletion_scheduled
- `trial_started_at` timestamptz NULL
- `trial_ends_at` timestamptz NULL
- `deletion_requested_at` timestamptz NULL
- `tier` tier_enum NOT NULL DEFAULT 'standard' — values: standard, optimizer
- `payment_source` payment_source_enum NULL — values: stripe, apple
- `referred_by_user_id` uuid NULL REFERENCES users(id) ON DELETE SET NULL
- `referral_code` text UNIQUE NULL — six-character base62 slug; populated by the Stripe `checkout.session.completed` and Apple `SUBSCRIBED.INITIAL_BUY` webhook handlers when the user first transitions from `trial` to `active`. NULL while the user is on trial or in any other pre-paid state. Used as the path component in `vesper.[tld]/r/{code}` referral URLs. Generation logic lives in the webhook handler rather than in a Postgres trigger so that the slug-collision retry loop (regenerate on UNIQUE violation, up to 5 attempts) runs in application code where retry control is straightforward.
- `onboarding_completed_at` timestamptz NULL
- `last_warmed_at` timestamptz NULL — updated by the cache pre-warm Cloudflare Worker on each successful warm call; serves as the dedup guard against double-warming a user in the alarm-snooze loop case (user wakes 5:30, snoozes, wakes again 5:40 — both invocations otherwise issue a warm call)
- `biometric_lock_enabled` boolean NOT NULL DEFAULT false — powers the optional iOS biometric lock setting specified in Layer 4; iOS-only at V1, with web relying on the operating-system lock screen as the equivalent layer
- `sleep_target_bedtime` time NULL — local time-of-day (HH:MM, no date); stored as Postgres `time` rather than `timestamptz` so that DST transitions do not silently shift the user's stored target. The absolute timestamp for any given day is computed at read time using this column plus `users.timezone`.
- `sleep_target_wake` time NULL — same semantics as `sleep_target_bedtime`
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_users_subscription_status` on (subscription_status) — cron workers scan by status (trial-end sweeps, dunning checks)
- `idx_users_trial_ends_at` on (trial_ends_at) WHERE subscription_status = 'trial' — partial index for the daily trial reminder worker
- `idx_users_deletion_requested_at` on (deletion_requested_at) WHERE deletion_requested_at IS NOT NULL — partial index for the daily hard-delete worker
- `idx_users_referred_by_user_id` on (referred_by_user_id) WHERE referred_by_user_id IS NOT NULL — partial index for referral credit issuance on referee conversion

RLS policies:
- SELECT: USING (auth.uid() = id) — users read only their own identity row
- UPDATE: USING (auth.uid() = id) WITH CHECK (auth.uid() = id) — users update only their own row; sensitive columns (subscription_status, trial_ends_at, payment_source, deletion_requested_at) are mutated only by server-side service-role calls and the application layer rejects client writes to these columns
- No INSERT policy — rows are created exclusively by the `handle_new_user()` trigger that fires on `auth.users` INSERT
- No DELETE policy — deletion proceeds only via the cron worker using the service role

A Postgres trigger function `handle_new_user()` with SECURITY DEFINER fires AFTER INSERT on `auth.users` and creates the matching `public.users` row plus the corresponding `user_profiles` row in a single transaction.

---

### 2. `user_profiles`

The slow-changing per-user profile data and module configuration. Separated from `users` because it changes on a different cadence (the base profile updates weekly during the Sunday planning session, while user identity is effectively immutable post-signup) and to allow the version counter to drive prompt cache invalidation without touching the identity row.

Columns:
- `user_id` uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
- `base_profile` jsonb NOT NULL DEFAULT '{}'::jsonb
- `base_profile_version` integer NOT NULL DEFAULT 1
- `modules_enabled` jsonb NOT NULL DEFAULT '{}'::jsonb
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

`base_profile` Zod shape (enforced in `@vesper/types`):
```
{
  work_schedule_pattern: { days: string[], start: string, end: string },
  recurring_commitments: Array<{ title, frequency, time, day_of_week? }>,
  location_bound_events: Array<{ title, location, time, day_of_week? }>,
  goals: Array<{ category, description }>,
  preferences: { wake_target?, bedtime_target?, ... }
}
```

`modules_enabled` Zod shape:
```
{
  work: { enabled: boolean },
  fitness: { enabled: boolean, goal: 'strength'|'cardio'|'fat_loss'|'maintenance'|'mobility', equipment: string[], level: 'beginner'|'intermediate'|'advanced' },
  nutrition: { enabled: boolean, diet_tags: string[], cooking_time_max_minutes: number, dislikes: string[], macro_targets?: { calories, protein_g, carbs_g, fat_g } },
  sleep: { enabled: boolean, bedtime_target: 'HH:MM', wake_target: 'HH:MM' },
  errands: { enabled: boolean },
  medication: { enabled: boolean },
  finance: { enabled: boolean }
}
```

A `base_profile_version` increment must accompany every mutation to `base_profile`. The application layer enforces this; a Postgres trigger could enforce it but adds cost for a logically simple invariant.

Indexes: primary key on `user_id` is sufficient; all reads are scoped to a single user.

RLS policies: standard own-row pattern (SELECT, INSERT, UPDATE, DELETE all keyed on `auth.uid() = user_id`).

---

### 3. `daily_plans`

One row per (user_id, plan_date). Holds plan-level metadata: the energy score captured at the morning check-in, the regeneration counter that triggers the "what's not working" prompt at three rejections, and a metadata JSONB for free-form context (weather, special-day flags). Per Layer 3 founder direction, plan history beyond the current state is not retained; if a plan is regenerated for the same date, the row updates in place and the existing blocks are deleted before new blocks are inserted.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `plan_date` date NOT NULL
- `generated_at` timestamptz NOT NULL DEFAULT now()
- `energy_score` integer NULL CHECK (energy_score BETWEEN 1 AND 10)
- `regeneration_count` integer NOT NULL DEFAULT 0
- `metadata` jsonb NOT NULL DEFAULT '{}'::jsonb
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()
- UNIQUE (user_id, plan_date)

Indexes:
- The unique constraint on (user_id, plan_date) creates a btree index that also serves user-scoped queries
- `idx_daily_plans_plan_date` on (plan_date) — for the morning cache pre-warm Cloudflare Worker that scans all plans for today across all users

RLS policies: standard own-row pattern.

---

### 4. `blocks`

Individual time blocks within a daily plan. Header columns are normalized for indexing and querying (start_time, block_type, status), while block-type-specific content lives in the `details` JSONB. The `user_id` column is denormalized from `daily_plans` to allow RLS checks to operate on the row itself without joining the parent table, a standard Supabase performance pattern.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `daily_plan_id` uuid NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `start_time` timestamptz NOT NULL
- `end_time` timestamptz NOT NULL CHECK (end_time > start_time)
- `block_type` block_type_enum NOT NULL — values: work, fitness, nutrition, sleep, errands, medication, finance, focus, commute, custom
- `title` text NOT NULL
- `status` block_status_enum NOT NULL DEFAULT 'scheduled' — values: scheduled, in_progress, completed, skipped, rescheduled
- `details` jsonb NOT NULL DEFAULT '{}'::jsonb
- `source` block_source_enum NOT NULL — values: ai_generated, user_added, google_calendar, recurring
- `display_order` integer NOT NULL DEFAULT 0
- `client_mutation_id` uuid NULL — written by every block mutation API; carried in Realtime broadcasts; used by the device self-mutation filter to drop a device's own writes from its own Realtime stream within a 30-second sliding window
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

The `details` JSONB shape varies by `block_type` and is validated by a discriminated union Zod schema at the API layer. Fitness blocks contain the customized workout template; nutrition blocks contain the recipe steps and ingredients; focus blocks contain the assigned task list; errands blocks contain the route and stop sequence.

Indexes:
- `idx_blocks_daily_plan_id` on (daily_plan_id) — for the "load all blocks for today" query
- `idx_blocks_user_id_start_time` on (user_id, start_time) — for the "what's next" Dynamic Island query and the cron worker that fires Live Activity Push Starts at block boundaries
- `idx_blocks_user_id_status` on (user_id, status) — for the "currently in-progress" lookup
- `idx_blocks_client_mutation_id` on (client_mutation_id) WHERE client_mutation_id IS NOT NULL — partial index supporting the device-side self-mutation filter and post-hoc analytics on mutation round-trip latency

Constraints:
- `UNIQUE (user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL` — server-side idempotency on block mutations; prevents double-apply if client retries

Realtime configuration: `ALTER TABLE blocks REPLICA IDENTITY FULL;` must be applied after table creation so that Supabase Realtime broadcasts carry the full updated row including `client_mutation_id`. Without this, the default replica identity sends only changed columns plus the primary key, and the self-mutation filter on the client cannot match the mutation ID.

RLS policies: standard own-row pattern, with policies checking the denormalized `user_id` directly rather than joining `daily_plans`.

---

### 5. `tasks`

The user's task pool. Tasks are created by the user (or by AI from natural-language input), persist independently of daily plans, and are pulled into focus blocks by the engine during plan generation. The status field tracks whether the task is still active; completed tasks are not deleted but remain in the table for retrospective queries.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `title` text NOT NULL
- `estimated_minutes` integer NOT NULL CHECK (estimated_minutes > 0)
- `deadline` timestamptz NULL
- `priority` priority_enum NOT NULL DEFAULT 'medium' — values: low, medium, high
- `status` task_status_enum NOT NULL DEFAULT 'pending' — values: pending, in_progress, completed
- `completed_at` timestamptz NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_tasks_user_id_status` on (user_id, status) — for the engine's "get pending tasks" query during plan generation
- `idx_tasks_user_id_deadline` on (user_id, deadline) WHERE deadline IS NOT NULL AND status != 'completed' — partial index for deadline-prioritized scheduling

RLS policies: standard own-row pattern.

---

### 6. `weekly_priorities`

The three to five priorities entered during the Sunday weekly planning session. Keyed by (user_id, week_start_date), where week_start_date is always the Monday of the week. Unlike `daily_plans`, weekly_priorities are retained across weeks so the weekly review on a subsequent Sunday can reference the prior week's stated priorities.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `week_start_date` date NOT NULL
- `priorities` jsonb NOT NULL DEFAULT '[]'::jsonb
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()
- UNIQUE (user_id, week_start_date)

`priorities` Zod shape: an array of objects, each with `text` (the priority statement), `source` ('user' or 'ai_suggested'), and optional `completed_at` (set if the user marks the priority done during the week). The application enforces array length between 3 and 5 at write time.

Indexes: unique constraint on (user_id, week_start_date) is sufficient for all access patterns.

RLS policies: standard own-row pattern.

---

### 7. `workout_templates`

The seeded library of approximately 150 workout templates. Reference data, not user-owned. Queryable by all authenticated users; mutations are service-role-only and occur via seed migrations.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `name` text NOT NULL
- `goal_tags` text[] NOT NULL DEFAULT '{}' — subset of: strength, cardio, fat_loss, maintenance, mobility
- `equipment_tags` text[] NOT NULL DEFAULT '{}' — subset of: gym, home, bodyweight, dumbbells, barbell, kettlebell, bands
- `duration_minutes` integer NOT NULL CHECK (duration_minutes IN (15, 30, 45, 60))
- `level` workout_level_enum NOT NULL — values: beginner, intermediate, advanced
- `intensity_score` integer NOT NULL CHECK (intensity_score BETWEEN 1 AND 10)
- `content` jsonb NOT NULL
- `source` text NOT NULL
- `created_at` timestamptz NOT NULL DEFAULT now()

`content` Zod shape: an object with `exercises` (array of {name, sets, reps, rest_seconds, notes?}) and optional `warmup` and `cooldown` arrays.

Indexes:
- `idx_workout_templates_goal_tags` GIN on (goal_tags) — for array containment queries during template filtering
- `idx_workout_templates_equipment_tags` GIN on (equipment_tags) — same purpose
- `idx_workout_templates_duration_level` on (duration_minutes, level) — for compound time-and-difficulty filters
- `idx_workout_templates_intensity_score` on (intensity_score) — for energy-aware selection (low energy → low intensity)

RLS policies:
- SELECT: USING (true) — all authenticated users can read templates
- No INSERT, UPDATE, or DELETE policies — service-role-only

---

### 8. `recipe_templates`

The seeded library of approximately 300 recipe templates. Same pattern as workout_templates.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `name` text NOT NULL
- `cuisine_tags` text[] NOT NULL DEFAULT '{}' — values include: italian, asian, mexican, american, mediterranean
- `diet_tags` text[] NOT NULL DEFAULT '{}' — values include: vegetarian, vegan, gluten_free, dairy_free, keto, paleo
- `prep_minutes` integer NOT NULL CHECK (prep_minutes >= 0)
- `cook_minutes` integer NOT NULL CHECK (cook_minutes >= 0)
- `total_minutes` integer NOT NULL CHECK (total_minutes >= 0)
- `difficulty` recipe_difficulty_enum NOT NULL — values: easy, medium, hard
- `macros` jsonb NOT NULL
- `servings` integer NOT NULL CHECK (servings > 0)
- `ingredients` jsonb NOT NULL
- `instructions` jsonb NOT NULL
- `image_url` text NULL
- `source` text NOT NULL
- `created_at` timestamptz NOT NULL DEFAULT now()

`macros` shape: `{ calories: number, protein_g: number, carbs_g: number, fat_g: number }` (per serving).
`ingredients` shape: array of `{ name: string, quantity: number, unit: string }`.
`instructions` shape: array of step strings.

`total_minutes` is stored explicitly rather than computed from prep+cook because some recipes include resting/marinating time that belongs in total but not in active prep or cook.

Indexes:
- `idx_recipe_templates_cuisine_tags` GIN on (cuisine_tags)
- `idx_recipe_templates_diet_tags` GIN on (diet_tags)
- `idx_recipe_templates_total_minutes` on (total_minutes) — for time-tolerance filtering
- `idx_recipe_templates_difficulty` on (difficulty)

RLS policies: same as workout_templates (public SELECT, service-role-only writes).

---

### 9. `medications`

User-entered medication reminders. Per Layer 3 founder direction, this is the most sensitive table in the schema; medications are never shared with third parties and never synced to health platforms. A Postgres trigger writes every INSERT, UPDATE, and DELETE to `security_audit_log` for forensic reconstruction.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `name` text NOT NULL
- `dose` text NOT NULL
- `frequency` medication_frequency_enum NOT NULL — values: daily, twice_daily, weekly, custom
- `times` time[] NOT NULL DEFAULT '{}'
- `start_date` date NOT NULL
- `end_date` date NULL CHECK (end_date IS NULL OR end_date >= start_date)
- `notes` text NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_medications_user_id` on (user_id) — for the "all active medications for user" query during reminder scheduling

RLS policies: standard own-row pattern, with the understanding that this table's RLS is the strictest enforced; no service-role queries to medications data occur outside the per-user reminder dispatcher.

Trigger: `audit_medications_changes` fires AFTER INSERT OR UPDATE OR DELETE on `medications` and writes a row to `security_audit_log`.

---

### 10. `recurring_errands`

User-entered recurring errand reminders.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `title` text NOT NULL
- `frequency` errand_frequency_enum NOT NULL — values: weekly, biweekly, monthly
- `day_of_week` integer NULL CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6)
- `estimated_minutes` integer NOT NULL CHECK (estimated_minutes > 0)
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_recurring_errands_user_id` on (user_id)

RLS policies: standard own-row pattern.

---

### 11. `bills`

User-entered bill reminders. The finance module is reminder-based only and never connects to financial institutions.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `name` text NOT NULL
- `amount` numeric(10,2) NULL
- `due_day_of_month` integer NULL CHECK (due_day_of_month IS NULL OR due_day_of_month BETWEEN 1 AND 31)
- `frequency` bill_frequency_enum NOT NULL — values: monthly, quarterly, annually, one_time
- `category` text NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_bills_user_id` on (user_id)
- `idx_bills_user_id_due_day` on (user_id, due_day_of_month) — for the monthly bill-due-tomorrow reminder worker

RLS policies: standard own-row pattern.

---

### 12. `integrations`

OAuth connections to third-party providers. At V1 only Google Calendar is wired, but the schema supports the V1.5 and V2 additions (Apple Calendar, Google Fit, Apple Health). Tokens are stored encrypted using the pgsodium extension with a server-held encryption key. A Postgres trigger writes mutations to `security_audit_log` so that integration breakage can be diagnosed by reconstructing the sequence of CRUD events.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `provider` integration_provider_enum NOT NULL — values: google_calendar, apple_calendar, google_fit, apple_health
- `status` integration_status_enum NOT NULL DEFAULT 'connected' — values: connected, disconnected, error
- `access_token_encrypted` bytea NOT NULL
- `refresh_token_encrypted` bytea NULL
- `expires_at` timestamptz NULL
- `last_synced_at` timestamptz NULL
- `last_error` text NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()
- UNIQUE (user_id, provider)

Indexes:
- The unique constraint on (user_id, provider) creates the primary access btree
- `idx_integrations_provider_status` on (provider, status) — for diagnostic queries like "all Google Calendar integrations in error state"

RLS policies: standard own-row pattern. Application code calling external APIs decrypts tokens via service-role queries; clients never see encrypted token bytes.

Trigger: `audit_integrations_changes` fires AFTER INSERT OR UPDATE OR DELETE on `integrations` and writes a row to `security_audit_log`.

---

### 13. `push_tokens`

APNs and FCM device tokens, plus iOS Live Activity push tokens. A single user may have multiple rows (one per device) and a single device may rotate tokens, which is why the unique constraint is on (user_id, device_id) rather than on token itself.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `platform` push_platform_enum NOT NULL — values: ios, android, web
- `token` text NOT NULL
- `live_activity_token` text NULL
- `device_id` text NOT NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `last_used_at` timestamptz NOT NULL DEFAULT now()
- UNIQUE (user_id, device_id)

Indexes:
- The unique constraint on (user_id, device_id) covers user-scoped lookups
- `idx_push_tokens_live_activity_token` on (live_activity_token) WHERE live_activity_token IS NOT NULL — partial index for the Live Activity Push Start cron worker

RLS policies: standard own-row pattern.

---

### 14. `subscriptions`

The authoritative subscription state row per user. Maintained in 1:1 relationship with users via a unique constraint on user_id. Holds the provider-specific identifiers needed to reconcile webhook events from Stripe and Apple, the current billing window, and the cancellation context. The `subscription_status` on `users` is a denormalized cache of `subscriptions.status` for fast access from RLS-bound queries; the source of truth is this table.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
- `provider` payment_source_enum NOT NULL — values: stripe, apple
- `status` subscription_status_enum NOT NULL
- `stripe_customer_id` text NULL
- `stripe_subscription_id` text NULL
- `stripe_price_id` text NULL
- `apple_original_transaction_id` text NULL
- `apple_product_id` text NULL
- `current_period_start` timestamptz NULL
- `current_period_end` timestamptz NULL
- `cancel_at_period_end` boolean NOT NULL DEFAULT false
- `canceled_at` timestamptz NULL
- `cancellation_reason` cancellation_reason_enum NULL — values: price_too_high, not_using_enough, found_alternative, life_change, technical_issues, other
- `cancellation_reason_text` text NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

CHECK constraint enforcing provider/identifier consistency:
```
(provider = 'stripe' AND stripe_customer_id IS NOT NULL AND apple_original_transaction_id IS NULL)
OR
(provider = 'apple' AND apple_original_transaction_id IS NOT NULL AND stripe_customer_id IS NULL)
```

If a user switches providers (cancels iOS, resubscribes on web), the row updates in place rather than spawning a duplicate.

Indexes:
- The unique constraint on user_id is the primary access path from user-context queries
- `idx_subscriptions_stripe_customer_id` on (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL — partial index for Stripe webhook handler lookup
- `idx_subscriptions_stripe_subscription_id` on (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL — partial index for Stripe event lookup
- `idx_subscriptions_apple_original_transaction_id` on (apple_original_transaction_id) WHERE apple_original_transaction_id IS NOT NULL — partial index for App Store Server Notifications handler
- `idx_subscriptions_current_period_end` on (current_period_end) WHERE status IN ('active', 'past_due') — partial index for renewal-window cron sweeps

RLS policies:
- SELECT: USING (auth.uid() = user_id) — users see their own subscription state in account settings
- No INSERT, UPDATE, or DELETE policies — service-role-only (only webhook handlers write)

---

### 15. `subscription_events`

The idempotency log for webhook events from Stripe and Apple. Both providers retry webhook deliveries on receipt failure, which means the same event can arrive multiple times. The unique constraint on (provider, event_id) guarantees that each event processes exactly once.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `provider` payment_source_enum NOT NULL
- `event_id` text NOT NULL
- `event_type` text NOT NULL
- `user_id` uuid NULL REFERENCES users(id) ON DELETE SET NULL
- `payload` jsonb NOT NULL
- `processed_at` timestamptz NULL
- `processing_error` text NULL
- `received_at` timestamptz NOT NULL DEFAULT now()
- UNIQUE (provider, event_id)

The `user_id` column is nullable because some webhook events arrive before the user can be resolved (early lifecycle events from Apple may include only the original_transaction_id, which the handler must look up in `subscriptions`).

Indexes:
- Unique constraint on (provider, event_id) is the idempotency key and primary lookup
- `idx_subscription_events_user_id` on (user_id) WHERE user_id IS NOT NULL — partial index for per-user webhook history
- `idx_subscription_events_processed_at` on (processed_at) WHERE processed_at IS NULL — partial index for the retry-unprocessed cron sweep

RLS policies:
- No public policies whatsoever — service-role-only on every operation

---

### 16. `waitlist`

Pre-launch email capture. Separate from `users` because waitlist signups are unauthenticated and the schema requirements differ. The `converted_to_user_id` column populates on launch day when a waitlist email matches a new trial signup.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `email` text NOT NULL UNIQUE
- `platform_preference` platform_preference_enum NOT NULL — values: ios, android
- `referral_source` text NULL
- `converted_to_user_id` uuid NULL REFERENCES users(id) ON DELETE SET NULL
- `created_at` timestamptz NOT NULL DEFAULT now()

The `converted_to_user_id` uses ON DELETE SET NULL so that historical attribution survives user account deletion. The waitlist row itself is never deleted as part of the user-deletion cascade since it represents a separate pre-signup intent.

Indexes:
- Unique constraint on email
- `idx_waitlist_converted_to_user_id` on (converted_to_user_id) WHERE converted_to_user_id IS NULL — partial index for the "unconverted waitlist users" nurture-email query
- `idx_waitlist_platform_preference` on (platform_preference) — for the launch-day segmented email send (iOS vs Android variants)

RLS policies:
- INSERT: WITH CHECK (true) — anonymous users can sign up to the waitlist; the public Next.js API route is rate-limited at the application layer and Cloudflare-protected against bots
- No SELECT, UPDATE, or DELETE policies — service-role-only for reads (admin queries from Resend cron worker)

---

### 17. `referral_credits`

Tracks the issuance and application of referral discount credits. The referral mechanic at V1 awards the referrer only — not the referee — with one billing cycle at fifty percent off when a referee they introduced converts from trial to paid. The referee receives no discount; the referrer-only model preserves the trial as the primary value driver for new users and incentivizes existing paying subscribers to evangelize.

Credits stack without cap. A referrer who brings in three paid converters earns three months at fifty percent off, applied to the next three billing cycles consecutively. A credit issued to a referrer whose own subscription status is no longer `active` at the time of application is voided rather than applied, so a former subscriber who churns before their credits can be used does not receive a discount on a future re-subscription.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `recipient_user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `source_user_id` uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL
- `triggering_event` referral_event_enum NOT NULL — values: referee_converted
- `discount_percent` smallint NOT NULL DEFAULT 50 CHECK (discount_percent BETWEEN 1 AND 100)
- `status` referral_credit_status_enum NOT NULL DEFAULT 'pending' — values: pending, applied, voided
- `applied_to_provider` payment_source_enum NULL
- `applied_to_invoice_id` text NULL
- `provider_discount_id` text NULL — stores the Stripe coupon ID or Apple promotional offer ID applied to the invoice
- `void_reason` text NULL — set when status transitions to voided (referrer no longer active, manual revocation, etc.)
- `issued_at` timestamptz NOT NULL DEFAULT now()
- `applied_at` timestamptz NULL
- `voided_at` timestamptz NULL

The `source_user_id` (the referee — the user whose conversion triggered the credit) uses ON DELETE SET NULL so the recipient keeps audit context for credits already applied. The `recipient_user_id` (the referrer who receives the discount) uses ON DELETE CASCADE so credits die with the user who holds them. Note that the previous "both parties get credit" model is removed; only one row is written per successful conversion, with `recipient_user_id` always set to the referrer.

Indexes:
- `idx_referral_credits_recipient_status` on (recipient_user_id, status) — for the "find my unapplied credits" query at billing time
- `idx_referral_credits_source_user_id` on (source_user_id) WHERE source_user_id IS NOT NULL — partial index for the "how many successful referrals has user X driven" query

RLS policies:
- SELECT: USING (auth.uid() = recipient_user_id) — users see only credits issued to them
- No INSERT, UPDATE, or DELETE policies — service-role-only (issuance, application, and voiding all happen in webhook handlers and reconciliation workers)

---

### 18. `completion_log`

Event log of plan interactions. Drives the V1.5 quantified-self dashboards and powers the funnel-quality analysis post-launch. The `value` JSONB column denormalizes the block context at write time (block_type, title, start_time, end_time, plan_date) so that completion log entries survive subsequent plan regeneration and block deletion. The `block_id` foreign key is intentionally ON DELETE SET NULL so that referential integrity holds while the block exists but the log entry persists after deletion.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `block_id` uuid NULL REFERENCES blocks(id) ON DELETE SET NULL
- `event_type` completion_event_enum NOT NULL — values: block_completed, block_skipped, block_rescheduled, energy_logged, plan_generated, plan_regenerated, plan_fallback_served
- `value` jsonb NOT NULL
- `logged_at` timestamptz NOT NULL DEFAULT now()

`value` Zod shape varies by event_type via discriminated union. For block_completed/block_skipped/block_rescheduled: `{ block_type, title, start_time, end_time, plan_date, completion_metadata? }`. For energy_logged: `{ energy_score, plan_date }`. For plan_generated/plan_regenerated: `{ plan_date, block_count, generation_duration_ms, prompt_version }`. For plan_fallback_served: `{ plan_date, failure_reason, fallback_source }`.

Indexes:
- `idx_completion_log_user_id_logged_at` on (user_id, logged_at DESC) — for time-windowed queries (D7 retention checks, "blocks completed this week")
- `idx_completion_log_user_id_event_type` on (user_id, event_type) — for event-type filtered queries
- `idx_completion_log_block_id` on (block_id) WHERE block_id IS NOT NULL — partial index for "show me what happened with this block"

RLS policies:
- SELECT: USING (auth.uid() = user_id)
- INSERT: WITH CHECK (auth.uid() = user_id) — in practice writes happen via service-role API routes, but the policy is permissive in case a future surface writes directly
- No UPDATE or DELETE policies — log entries are immutable; deletion only happens via user-cascade

---

### 19. `security_audit_log`

Trigger-written audit log scoped to medications and integrations. Every INSERT, UPDATE, and DELETE on those two tables produces a row here via Postgres triggers with SECURITY DEFINER. The application never writes to this table directly.

Columns:
- `id` bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY
- `table_name` text NOT NULL
- `row_id` uuid NOT NULL
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `operation` audit_operation_enum NOT NULL — values: INSERT, UPDATE, DELETE
- `old_values` jsonb NULL
- `new_values` jsonb NULL
- `changed_at` timestamptz NOT NULL DEFAULT now()

The `user_id` column uses ON DELETE CASCADE because audit log entries for a hard-deleted user constitute PII tied to that user and must be purged on deletion per Layer 5's data deletion policy. Forensic capture, if needed, must occur before the hard-delete worker runs.

Indexes:
- `idx_security_audit_log_user_id_changed_at` on (user_id, changed_at DESC) — for per-user audit queries
- `idx_security_audit_log_table_row` on (table_name, row_id) — for "show all changes to medication X" queries

RLS policies:
- SELECT: USING (auth.uid() = user_id) — users can read their own audit trail
- No INSERT, UPDATE, or DELETE policies — only the SECURITY DEFINER trigger functions write here, and rows are never modified or deleted except via user-cascade

Trigger functions: `audit_medications_changes()` and `audit_integrations_changes()`, each declared as `SECURITY DEFINER` and `STABLE`, writing the appropriate row to `security_audit_log`. Audit coverage is intentionally scoped to medications (the most sensitive table per Layer 3) and integrations (OAuth token rows whose mutation history is needed for diagnosing integration breakage). The `subscriptions` table's mutation history is already captured by the `subscription_events` table covering every webhook event; `bills` and `push_tokens` are operational data without strong forensic need.

---

### 20. `deleted_user_email_hashes`

Stores SHA-256 hashes of emails for users who have hard-deleted their accounts. Used by the signup flow to detect repeat trial signups from the same email address (a Layer 5 trial-abuse prevention measure). Contains no reversible PII; the hash cannot be reversed to recover the email.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `email_hash` text NOT NULL UNIQUE
- `deleted_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- Unique constraint on email_hash is the only access path (signup checks for existence)

RLS policies:
- No public policies — service-role-only (signup-flow lookup and hard-delete-worker writes both use service role)

---

### 21. `hydration_log`

Event log of hydration taps from the nutrition module. One row per tap. The daily hydration counter is derived by query rather than stored, so daily resets are implicit in the query time window and do not require a scheduled job or mutation. This table does not affect `base_profile_version`.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `logged_at` timestamptz NOT NULL DEFAULT now()
- `count` integer NOT NULL DEFAULT 1 CHECK (count > 0)

Indexes:
- `idx_hydration_log_user_id_logged_at` on (user_id, logged_at DESC) — for the daily counter query `SELECT COUNT(*) WHERE user_id = $1 AND logged_at >= start_of_local_day($2)`

RLS policies:
- SELECT: USING (auth.uid() = user_id)
- INSERT: WITH CHECK (auth.uid() = user_id)
- No UPDATE or DELETE — entries are immutable; deletion only via user-cascade

---

### 22. `email_queue`

Deferred email sends. A row is inserted when an email should be delivered at a future time (post-cancel win-back survey at +48h, and similar deferred sends). The daily-cron worker selects rows where `scheduled_for <= now()` and `sent_at IS NULL`, delivers via Resend, and marks `sent_at`. Idempotent: a second pickup finds `sent_at` populated and skips.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `template_name` text NOT NULL
- `scheduled_for` timestamptz NOT NULL
- `sent_at` timestamptz NULL
- `payload` jsonb NOT NULL DEFAULT '{}'::jsonb
- `created_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_email_queue_pending` on (scheduled_for) WHERE sent_at IS NULL — for the cron worker pickup query

RLS policies:
- No public policies — service-role only

---

### 23. `delayed_jobs`

Deferred job queue replacing any need for a third-party queue (Upstash QStash is not used). A row is inserted when a job should execute at a future time (subscription reconciliation 5 minutes after a Stripe or Apple webhook, and similar). The tick worker selects rows where `scheduled_for <= now()` and `processed_at IS NULL`, dispatches to the handler for `job_type`, and marks `processed_at`. Idempotent: a second pickup finds `processed_at` populated and skips.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `job_type` text NOT NULL — values: 'reconcile_subscription', 'sync_google_calendar'
- `payload` jsonb NOT NULL DEFAULT '{}'::jsonb
- `scheduled_for` timestamptz NOT NULL
- `processed_at` timestamptz NULL
- `attempts` integer NOT NULL DEFAULT 0
- `last_error` text NULL
- `created_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_delayed_jobs_pending` on (scheduled_for) WHERE processed_at IS NULL — for the tick worker pickup query

RLS policies:
- No public policies — service-role only

---

### 24. `cancellation_events`

One row per cancellation, capturing the user's stated reason and subscription context. Supplements the PostHog `subscription_canceled` event with server-side persistence for long-term churn analysis. Written by the cancellation API route at cancellation time.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `free_text` text NULL — optional written response captured at cancellation time. The structured cancellation reason is stored on `subscriptions.cancellation_reason` (enum) and is the single source of truth for reason categorization; this table stores the free-text response and the cancellation context (archetype snapshot, subscription duration) for cohort analysis.
- `archetype` archetype_enum NULL — snapshot of archetype at cancellation
- `subscription_duration_days` integer NULL — days from trial_started_at to cancellation_events.canceled_at
- `canceled_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_cancellation_events_user_id` on (user_id)
- `idx_cancellation_events_canceled_at` on (canceled_at DESC) — for cohort analysis

RLS policies:
- SELECT: USING (auth.uid() = user_id) — users can read their own record
- No INSERT from client — service-role only at cancellation time
- No UPDATE or DELETE — immutable

---

### 25. `calendar_events`

User-created calendar events entered directly in Vesper's built-in calendar (as distinct from events synced from Google Calendar via integration). Participates in conflict detection and plan synthesis alongside integration events. Google Calendar events are fetched at synthesis time from the integration and are not stored in this table.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `title` text NOT NULL
- `start_time` timestamptz NOT NULL
- `end_time` timestamptz NOT NULL CHECK (end_time > start_time)
- `rrule` text NULL — iCalendar RRULE string for recurring events; NULL for one-off events
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_calendar_events_user_id_start_time` on (user_id, start_time) — for synthesis-time range queries

RLS policies:
- Standard own-row: SELECT, INSERT, UPDATE, DELETE all gated on auth.uid() = user_id

Trigger: `set_updated_at` attached in migration 13.

---

## Migration Strategy

### Naming Convention

Supabase CLI default: `YYYYMMDDHHMMSS_description.sql`. Migrations are committed to the repo under `packages/db/migrations/`. Each migration is wrapped in `BEGIN; ... COMMIT;` so that partial failure does not leave the schema in an inconsistent state. Each migration also has a corresponding `.down.sql` file in the same directory that reverses the operation; while Supabase does not auto-run down migrations in production, the files exist for local development resets and for documented rollback procedures.

### Migration Sequence

Migrations run in foreign-key-dependency order. Tables that reference other tables must come after those referenced tables. The migration numbering allocation is documented in `docs/MIGRATION_NUMBER_ALLOCATION.md` (authored in build chat 003) and reserves contiguous ranges per build block so that mid-block additions land cleanly without rewriting numbers ahead of them.

| Number range | Use |
|---|---|
| 1–13 | Block 1 foundation (initial schema — the migrations enumerated below) |
| 14–30 | Reserved for Blocks 4–7 schema additions during build |
| 31–50 | Reserved for Blocks 8–11 schema additions during build |
| 100001–199999 | Seed migrations (truncate-and-replace template imports) |
| 200001+ | Post-launch additions |

The Block 1 foundation migrations:

1. `20260601000001_enums_and_extensions.sql` — Enable the `pgsodium` and `pgcrypto` extensions. Create all enum types referenced below: archetype_enum, honorific_enum, subscription_status_enum, tier_enum, payment_source_enum, block_type_enum, block_status_enum, block_source_enum, priority_enum, task_status_enum, workout_level_enum, recipe_difficulty_enum, medication_frequency_enum, errand_frequency_enum, bill_frequency_enum, integration_provider_enum, integration_status_enum, push_platform_enum, cancellation_reason_enum, referral_event_enum, referral_credit_status_enum (values: pending, applied, voided — note that the prior `expired` status is replaced with `voided` to reflect the credit voiding semantics at V1), completion_event_enum, audit_operation_enum, platform_preference_enum.
2. `20260601000002_users.sql` — Create `users` table, indexes, RLS, and the `handle_new_user()` trigger function.
3. `20260601000003_user_profiles.sql` — Create `user_profiles` table, indexes, RLS, and extend the `handle_new_user()` trigger to create the matching profile row.
4. `20260601000004_daily_planning.sql` — Create `daily_plans`, `blocks`, `tasks`, and `weekly_priorities` tables with their indexes and RLS policies. Combined since these tables are tightly coupled and unlikely to evolve independently.
5. `20260601000005_templates.sql` — Create `workout_templates` and `recipe_templates` tables with their indexes and RLS policies.
6. `20260601000006_modules.sql` — Create `medications`, `recurring_errands`, and `bills` tables with their indexes and RLS policies.
7. `20260601000007_integrations.sql` — Create `integrations` and `push_tokens` tables with their indexes and RLS policies.
8. `20260601000008_subscriptions.sql` — Create `subscriptions` and `subscription_events` tables with their indexes, RLS policies, and CHECK constraints.
9. `20260601000009_waitlist_and_referrals.sql` — Create `waitlist` and `referral_credits` tables with their indexes and RLS policies.
10. `20260601000010_completion_log.sql` — Create `completion_log` table with indexes and RLS policies.
11. `20260601000011_security_audit_log.sql` — Create `security_audit_log` table. Create trigger functions `audit_medications_changes()` and `audit_integrations_changes()`, each SECURITY DEFINER. Attach both triggers to their respective tables.
12. `20260601000012_deleted_user_email_hashes.sql` — Create `deleted_user_email_hashes` table.
13. `20260601000013_updated_at_triggers.sql` — Create the generic `set_updated_at()` trigger function and attach it to every table with an `updated_at` column. Create the `start_of_local_day(tz text) RETURNS timestamptz` function (LANGUAGE sql STABLE PARALLEL SAFE) that returns `date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz`. Used by the trial-regen cap query and the hydration daily counter query.
14. `20260601000016_new_feature_tables.sql` — Create `hydration_log`, `email_queue`, `delayed_jobs`, `cancellation_events`, and `calendar_events` tables with their indexes and RLS policies. Apply `ALTER TABLE blocks REPLICA IDENTITY FULL`. The timestamp prefix `000016` (not `000014`) reflects the original allocation in the Blocks 4–7 reservation range (14–30); the list position here is sequential, the on-disk timestamp ordering is preserved by the prefix.
15. `20260601100001_seed_workout_templates.sql` — Bulk insert seed data for `workout_templates` (~150 rows from JSON source file).
16. `20260601100002_seed_recipe_templates.sql` — Bulk insert seed data for `recipe_templates` (~300 rows from JSON source file).

### Rollback Considerations

Each migration has a corresponding down migration that reverses its operations in the inverse order. Down migrations exist for documentation and local-development resets, not for production rollback; in production, schema changes that prove incorrect are fixed by a forward migration rather than by reverting.

Several Postgres-specific constraints affect rollback design. Enum types cannot have values removed; renaming or removing an enum value requires the create-new-enum, migrate-data, drop-old-enum workflow, which is a forward-only operation. Non-nullable columns added to populated tables cannot be removed without data loss; for V1 this is moot because the schema deploys pre-launch when all tables are empty, but post-launch migrations must use the backfill pattern (add nullable, populate, set NOT NULL). The trigger functions in `20260601000011` must be dropped before the `security_audit_log` table they depend on can be dropped.

The seed migrations (steps 14 and 15) are intentionally separated from the schema migrations so they can be re-run independently. Each seed migration truncates the target table before inserting, making it idempotent and repeatable across environments.

---

## Seed Data

Two tables receive seed data on first deploy: `workout_templates` (~150 rows) and `recipe_templates` (~300 rows). All other tables start empty and populate via user activity.

### Seed Data Structure

Seed content lives in versioned JSON files under `packages/db/seed/`:
- `packages/db/seed/workout_templates.json` — array of template objects, each matching the `workout_templates` row schema with all required columns populated and `id` omitted (generated by the database on insert)
- `packages/db/seed/recipe_templates.json` — array of template objects, each matching the `recipe_templates` row schema with the same convention

The seed migration scripts read these JSON files at migration time via Drizzle's seed helper, validate each row against the corresponding Zod schema before insert, truncate the target table to ensure idempotency, then bulk-insert via a single `INSERT INTO ... VALUES (...), (...), ...` statement.

### Seed Content Sourcing

Template content sources, per Layer 3: ExerciseDB for workout templates; TheMealDB, Edamam, and manual curation for recipe templates. Sourcing logic is not a schema concern.

### Seed Update Pattern

Updates to seeded templates between releases happen via new seed migrations (for example, `20261015100001_seed_workout_templates_v2.sql`) that truncate-and-replace rather than diff-and-merge. From the user's perspective, templates are append-only reference data with no user-owned customization, so destructive replacement is safe.

### Reference Data Excluded From Seeding

No other reference data requires seeding at V1. Geographic data, ZIP codes, currency tables, and similar reference sets are either fetched at runtime from third-party APIs as needed in future versions or hardcoded as TypeScript constants in the application code (timezone list, archetype display names, module display order). No third-party geographic or venue API is integrated at V1.

---

## Method-B Module Scaffold Tables (V1 scaffold — deep columns deferred)

These two tables back the **method-B module scaffolds** introduced by the Modules-tab addendum chats (see `docs/PHASE_4_BUILD_PLAN.md` → Addendum → ADD-B Nutrition, ADD-C Fitness). Each is a **thin scaffold**: it stores only what the V1 functional-breadth surface needs and **carries no deep-engine columns**. The deferred engines — nutrition micronutrient/RDA/calorie internals and the fitness strength-rank / world-standard percentile mapping — add their columns (or their own tables) in a post-launch phase; they are **not** part of V1. Both follow the house own-row RLS pattern and are user-cascade hard-deleted like every other user-owned table. They extend the **Modules** schema domain (previously medications / recurring_errands / bills).

### 26. `food_log_entries` (V1 scaffold — deep columns deferred)

The daily food-log surface for the nutrition module's method-B scaffold (ADD-B). One row per logged food item per day. **No micronutrient, vitamin, RDA, or calorie columns at V1** — those are the deferred deep engine and are added later, not here. The per-day view is derived at read time from the local-day boundary, mirroring the hydration-counter derivation used by the nutrition module.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `logged_at` timestamptz NOT NULL DEFAULT now()
- `item_name` text NOT NULL — free-text or corpus-sourced food name
- `recipe_template_id` uuid NULL REFERENCES recipe_templates(id) ON DELETE SET NULL — set when the entry was chosen from the food-search corpus; NULL for a free-text entry
- `quantity_note` text NULL — optional free-text portion note (e.g. "1 bowl"); intentionally not a structured quantity at V1
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_food_log_entries_user_id_logged_at` on (user_id, logged_at) — the per-user, per-local-day read pattern

RLS policies: standard own-row pattern (SELECT, INSERT, UPDATE, DELETE all keyed on `auth.uid() = user_id`).

### 27. `lift_log_entries` (V1 scaffold — deep columns deferred)

The lift-logging surface for the fitness module's method-B scaffold (ADD-C). One row per logged set. **No strength-rank, percentile, or world-standard columns at V1** — those are the deferred deep engine and are added later, not here.

Columns:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `logged_at` timestamptz NOT NULL DEFAULT now()
- `exercise_name` text NOT NULL — free-text or template-sourced exercise name
- `workout_template_id` uuid NULL REFERENCES workout_templates(id) ON DELETE SET NULL — set when logging against a scheduled/selected workout; NULL for an ad-hoc lift
- `set_number` integer NOT NULL CHECK (set_number > 0)
- `reps` integer NULL CHECK (reps IS NULL OR reps >= 0)
- `weight` numeric(7,2) NULL CHECK (weight IS NULL OR weight >= 0)
- `weight_unit` text NULL — 'kg' or 'lb'; NULL for bodyweight sets
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Indexes:
- `idx_lift_log_entries_user_id_logged_at` on (user_id, logged_at) — the per-user, per-day / per-exercise read pattern

RLS policies: standard own-row pattern (SELECT, INSERT, UPDATE, DELETE all keyed on `auth.uid() = user_id`).

**Surfaces needing no new table at V1.** The nutrition **food-search** surface reads the existing `recipe_templates` corpus (and `food_log_entries` above) — **no new table.** The **AI recipe-modify** surface reuses the existing AI command infrastructure and persists nothing of its own at V1 — **no new table.** The fitness **workout-schedule list** and **tailored generation** reuse `workout_templates` plus the existing selection/adaptation path — **no new table.**

---

## Schema Invariants and Cross-Table Constraints

### Soft-Delete vs Hard-Delete Pattern

The only entity that participates in a soft-delete pattern is `users`. The flow runs as follows: the user clicks "delete account" in settings; the application sets `users.deletion_requested_at = now()` and transitions the row's `subscription_status` to `deletion_scheduled`; the application enforces read-only access on every surface for that user during the 30-day grace period; a Cloudflare Worker runs daily and executes `DELETE FROM users WHERE deletion_requested_at < now() - interval '30 days'`; the `ON DELETE CASCADE` foreign keys on every child table propagate the deletion automatically. Before the hard delete, the worker computes `SHA-256(lower(email))` and inserts the hash into `deleted_user_email_hashes` so that repeat trial signups from the same address are detectable.

All other tables use hard-delete only. There is no `deleted_at` soft-delete flag on blocks, tasks, daily_plans, medications, or any other user-owned data. Block status transitions reflect plan execution (scheduled, completed, skipped, rescheduled), but the row never logically dies short of plan regeneration deleting it outright or a user-cascade hard-delete propagating from the users row.

### Audit Trail Strategy

Three audit surfaces operate in parallel, each scoped to a different concern. The `security_audit_log` table covers medications and integrations only, via Postgres triggers with SECURITY DEFINER. The `subscription_events` table covers every Stripe and Apple webhook event, including the full payload, with provider/event_id idempotency. The `completion_log` table covers product analytics events: block interactions, energy logging, and plan generation lifecycle. Beyond these three tables, the schema relies on Supabase's native database logs (7-day retention on the free tier, longer on Pro) for general query auditing.

The deliberate gap: there is no application-level audit log on operations like daily_plan creation, task CRUD, or weekly_priorities updates. These operations are recoverable from current state, frequent enough that audit storage would inflate the database materially, and low-sensitivity enough that forensic reconstruction is not required.

### Cross-Table Invariants

A user has exactly one `user_profiles` row, enforced by the primary key constraint on `user_profiles.user_id` and the `handle_new_user()` trigger that creates the row at signup.

A user has at most one `subscriptions` row, enforced by the unique constraint on `subscriptions.user_id`. When a user switches providers (cancels iOS, resubscribes on web, or vice versa), the existing row updates in place via the webhook handler rather than producing a new row.

A user has at most one `daily_plans` row per date, enforced by the unique constraint on `(user_id, plan_date)`. Plan regeneration updates the existing row's `regeneration_count` and `generated_at` columns while deleting the existing blocks via CASCADE and inserting new blocks.

A user has at most one `weekly_priorities` row per Monday-anchored week, enforced by the unique constraint on `(user_id, week_start_date)`.

A user has at most one `integrations` row per provider, enforced by the unique constraint on `(user_id, provider)`.

A user has at most one `push_tokens` row per device, enforced by the unique constraint on `(user_id, device_id)`. Multiple devices per user are expected.

A block's `user_id` always equals the `user_id` on its parent `daily_plans` row. This invariant is enforced at the application layer rather than the database layer; both columns derive from the same source during plan generation, so drift is unlikely. A database-level CHECK or trigger could enforce it at the cost of additional write overhead, which is not justified at V1 scale.

A `subscription_events` row's `provider` and `event_id` are globally unique together. The unique constraint on `(provider, event_id)` provides the idempotency guarantee that prevents double-processing of replayed webhooks.

### Service-Role-Only Mutation Pattern

Several tables are exempt from client-direct mutation. These tables grant no public INSERT, UPDATE, or DELETE policies, so mutations occur exclusively via API routes that use the Supabase service role key: `subscriptions` (webhook handlers only), `subscription_events` (webhook handlers only), `security_audit_log` (trigger functions only), `deleted_user_email_hashes` (hard-delete worker and signup-flow lookup only), `referral_credits` (webhook handlers issue and apply credits only), and `waitlist` reads (the launch-day email send worker only; `waitlist` INSERT is open to the anonymous role to allow public signup).

The tables that do allow client-direct mutation under RLS are: `users` (limited columns), `user_profiles`, `daily_plans`, `blocks`, `tasks`, `weekly_priorities`, `medications`, `recurring_errands`, `bills`, `integrations` (writes via API route for token decryption, but RLS permits client-direct as a defense-in-depth), `push_tokens`, and `completion_log` (RLS-permitted writes in practice executed by service-role API routes).

### Encryption

The `integrations` table stores OAuth tokens encrypted at rest using the `pgsodium` extension. The `access_token_encrypted` and `refresh_token_encrypted` columns hold ciphertext bytes; decryption occurs only inside the API routes that need to call the third-party provider. The encryption key is held by the server (Vercel environment variable) and is rotatable via a key-rotation migration that re-encrypts existing rows with a new key.

All other sensitive columns (medications notes, bills amounts) rely on Supabase's at-rest AES-256 encryption applied transparently to the entire database. Application-level encryption beyond pgsodium for tokens is reconsidered at V2 if the threat model evolves.

### RLS Default Posture

Row Level Security is ENABLED on every table without exception. Tables without explicit policies deny all public access by default. The Supabase service role bypasses RLS entirely and is used only from server-side runtimes (Vercel API routes and Cloudflare Workers); the service role key is never exposed to client code. The anon role and authenticated role both subject every query to RLS evaluation. This posture means no table relies solely on application-layer authorization; RLS is the security floor.

---

## 4. Auth Architecture

### Supabase Auth Configuration

The Supabase project is configured with three authentication providers: Google OAuth, Apple Sign In, and email magic link. Password authentication is disabled. The Supabase Auth configuration is managed in the Supabase Dashboard under Authentication → Providers.

**Google OAuth** requires a Google Cloud Console OAuth 2.0 client. The authorized redirect URIs are `https://[supabase-project-ref].supabase.co/auth/v1/callback` (for Supabase to handle the callback from Google) and `http://localhost:3000/auth/callback` (for local development). On the web client, the sign-in flow calls `supabase.auth.signInWithOAuth({ provider: 'google' })` and redirects through Google's consent screen. On the mobile client, the same call is made but wrapped in `expo-auth-session`'s `makeRedirectUri` to produce a valid deep-link callback URI that Expo Router can handle.

**Apple Sign In** is configured with an Apple Developer Services ID for web and uses the native Sign In with Apple capability on iOS. On web, the flow runs as a standard OAuth redirect. On iOS, `expo-apple-authentication` handles the native prompt and exchanges the credential for a Supabase session via `supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken })`. Apple Sign In is a required provider because the App Store mandates its presence whenever any third-party social login is offered.

**Email magic link** is the third option. When the user enters an email address, `supabase.auth.signInWithOtp({ email })` sends a magic link email through Resend. The SMTP configuration in Supabase points to Resend's SMTP endpoint using the `RESEND_SMTP_USERNAME` and `RESEND_SMTP_PASSWORD` environment variables. The from address is `hello@vesper.[tld]`. The magic link confirmation URL template is configured to redirect to `https://vesper.[tld]/auth/confirm` on web and to the `vesper://auth/confirm` deep link on mobile.

### Session Handling

Supabase Auth issues a JWT access token and a refresh token on successful sign-in. The access token expires after one hour by default (configurable in Supabase Auth settings; leave at default for V1).

**Web session storage:** The `@supabase/ssr` package is used rather than `@supabase/supabase-js` directly. This package stores the session in HTTP-only cookies, making it inaccessible to JavaScript on the client and safe against XSS. The Next.js middleware at `apps/web/middleware.ts` calls `supabase.auth.getSession()` on every request to the `/(app)` route group and redirects unauthenticated requests to `/sign-in`. Server Components read the session via `createServerClient()` from `@supabase/ssr`. Client Components use the `createBrowserClient()` variant.

**Mobile session storage:** The mobile Supabase client is initialized with a custom storage adapter that reads from and writes to `expo-secure-store`. Expo SecureStore maps to the iOS Keychain, which persists across app reinstalls when the iCloud Keychain backup option is enabled, and survives app updates. The storage keys are `supabase.auth.token` (access token) and `supabase.auth.refreshToken`.

### Token Refresh

Both the web `@supabase/ssr` client and the mobile `@supabase/supabase-js` client handle token refresh automatically. When an API request is made with an expired access token, the client detects the 401 response, uses the stored refresh token to obtain a new access token from Supabase Auth, and retries the original request transparently. No application code handles refresh logic manually.

If a refresh token itself is expired or has been revoked (for example, after a user signs out on another device), `supabase.auth.getSession()` returns `null`. On web, the middleware redirects to `/sign-in`. On mobile, the Zustand auth store detects the null session and navigates the user to the sign-in screen.

### New User Trigger

When a new user completes sign-in for the first time, Supabase Auth creates a row in the internal `auth.users` table. A Postgres trigger function `handle_new_user()` with `SECURITY DEFINER` fires `AFTER INSERT ON auth.users` and creates the matching `public.users` row and the corresponding `public.user_profiles` row in a single transaction. This means no application code is responsible for creating these rows; by the time the first API request arrives from a new user, both rows exist.

The `handle_new_user()` function sets initial column values as follows: `users.email` is copied from `auth.users.email`; `users.archetype` defaults to `mixed` and is updated during onboarding; `users.timezone` defaults to `'America/Los_Angeles'` and is updated from the client's resolved timezone during onboarding step 1; `users.subscription_status` defaults to `trial`; `users.trial_started_at` is set to `now()` and `users.trial_ends_at` is set to `now() + interval '7 days'`. The `user_profiles.base_profile` and `user_profiles.modules_enabled` columns are initialized with their default empty structures.

### Account Deletion Flow

The deletion flow involves three phases spread across up to 67 days from read-only entry.

**Phase 1 — Initiation:** The user taps "Delete account" in settings. The web or mobile client calls `POST /api/v1/account/delete`. The API route (using service role) sets `users.deletion_requested_at = now()` and `users.subscription_status = 'deletion_scheduled'`. If a Stripe subscription is active, the route cancels it immediately via the Stripe API so no future charges occur. If an Apple subscription is active, the user is directed to cancel through iOS Settings, since Stripe-style programmatic cancellation is not available for Apple subscriptions. After deletion is initiated, the user is signed out and the session is invalidated.

**Phase 2 — Grace period:** During the 30-day grace period, the user can sign back in and cancel the deletion by calling `POST /api/v1/account/restore`, which clears `deletion_requested_at` and transitions `subscription_status` back to `read_only`, from which they can resubscribe.

**Phase 3 — Hard delete:** A Cloudflare Worker runs daily at 02:00 UTC. It queries `SELECT id, email FROM users WHERE deletion_requested_at < now() - interval '30 days'`. For each user found, it computes `SHA-256(lower(email))` and inserts the hash into `deleted_user_email_hashes`, then deletes the `users` row. The `ON DELETE CASCADE` foreign keys on every child table propagate the deletion automatically. The worker logs each deletion to Sentry as an informational event (not an error) for operational visibility.

---

## 5. AI Architecture

### Model Selection

Two Anthropic models are used at runtime. No other models are used and no fallback to other providers exists.

**`claude-haiku-4-5`** handles tasks where low latency and low cost are more important than extended reasoning: template selection from a pre-filtered candidate set (input is user goal, energy, and equipment; output is a template UUID); natural-language command parsing (translating statements like "move gym to 7pm" into a structured `PlanEditCommand` object); Google Calendar event classification (assigning a `block_type_enum` value to ambiguous calendar events during sync); daily check-in question generation (producing one or two short morning questions based on date context and recent energy scores); and the butler voice gate review pass for AI-generated strings longer than 30 words.

**`claude-sonnet-4-6`** handles tasks requiring multi-step reasoning and high output quality: daily plan synthesis (the primary morning plan generation call); weekly review reasoning during the Sunday planning session; contextual template adaptation when a template's standard parameters do not fit the user's situation (for example, a 60-minute gym template adapted down to 30 minutes because the user has a tight morning); and the empathetic regeneration prompt that fires after the user has rejected three successive plan regenerations for the same date.

`claude-opus-4-6` is never called at runtime.

### Prompt Structure and Caching

Every plan-related AI call is structured in four layers to maximize Anthropic prompt cache hits. Cached layers are marked with `"cache_control": { "type": "ephemeral" }` in the message content. The Anthropic prompt cache window is approximately five minutes; the cache pre-warm Cloudflare Worker (described below) ensures the morning plan call hits a warm cache.

**Layer 1 — System prompt (large, stable across all users):** The full butler voice specification, structural output instructions, and the JSON schema for the `DailyPlan` output object. This is the largest cache layer and changes only on prompt version updates, which require a deploy. It is a single large system prompt string, not assembled at runtime.

**Layer 2 — User base context (medium, stable per user, changes at most weekly):** The user's `archetype`, `timezone`, `location_lat`, `location_lng`, the full `base_profile` JSONB, and the full `modules_enabled` JSONB from `user_profiles`. This layer is fetched from the database once per plan generation call. Because it changes only during the Sunday planning session, it will be cached across every weekday morning plan call.

**Layer 3 — Template subset (medium, stable per user configuration):** The pre-filtered subset of `workout_templates` and `recipe_templates` relevant to this user. The filtering logic runs in application code before the AI call and produces a reduced candidate set: for workouts, templates matching the user's `fitness.goal`, `fitness.equipment`, and `fitness.level` from `modules_enabled`, filtered to at most 10 templates; for recipes, templates matching the user's `nutrition.diet_tags` and within `nutrition.cooking_time_max_minutes`, filtered to at most 15 templates. This pre-filtered set is serialized to a compact JSON string and included as a cached message block.

**Layer 4 — Today's specifics (small, changes daily, uncached):** The current date in the user's timezone, the energy score from the morning check-in (integer 1–10, or null if not yet provided), the list of Google Calendar events for today (if integration is connected), and the list of pending `tasks` with their `priority`, `estimated_minutes`, and `deadline`. This is the only uncached portion and is typically 200–600 tokens.

The assembled message sent to `claude-sonnet-4-6` takes this shape:

```
System: [Layer 1 — butler voice + output schema — CACHED]
User: [Layer 2 — user base context — CACHED]
       [Layer 3 — template subset — CACHED]
       [Layer 4 — today's specifics — NOT CACHED]
       Generate today's plan.
```

For Haiku calls (template selection, NL parsing, classification), only the system prompt (a shorter task-specific prompt) is cached. User context is included uncached in the user message because these calls are short and infrequent enough that the added context overhead is acceptable. Haiku prompts use the Anthropic default five-minute cache TTL. The one-hour TTL was considered and rejected: the cache write cost rises from 1.25× to 2× base input rate (a sixty percent write penalty), and Haiku calls are too sporadic across the day (one or two per user per day in steady state for check-in questions and natural-language parsing) to amortize the heavier write through enough subsequent reads. The five-minute TTL captures the realistic clustering window (rapid successive edits during morning plan review) without paying the longer-TTL premium. Sonnet daily-plan synthesis also uses the default five-minute TTL because the cache pre-warm worker described below populates that window in the user's local timezone ahead of the morning plan call.

AbortController-based cancellation propagates from the client SSE disconnect through the API route handler to the upstream Anthropic streaming call. When the client closes the EventSource (the user navigates away from the plan view during a slow generation, or the mobile app backgrounds mid-stream), the API route's controller fires and the underlying fetch to Anthropic aborts. This prevents the server from continuing to pay for tokens the user will not see and from holding a streaming connection open against a disconnected client.

### Prompt Constants and Versioning

All prompts are TypeScript string constants defined in `packages/ai/src/prompts/`. Each prompt file exports the prompt string and a version constant:

```typescript
export const DAILY_PLAN_SYNTHESIS_PROMPT = `
You are a calm, butler-tone life planner for Vesper...
[full prompt]
`;
export const DAILY_PLAN_SYNTHESIS_VERSION = 'v1-20260601';

export const TEMPLATE_SELECTION_PROMPT = `...`;
export const TEMPLATE_SELECTION_VERSION = 'v1-20260601';
```

The version string is logged alongside every API call in the `completion_log` table's `value.prompt_version` field for `plan_generated` events. This allows retrospective correlation between prompt versions and plan quality metrics in PostHog. Prompt changes are code changes and require a deploy; there is no runtime prompt management system at V1.

### Context Construction

The function `buildPlanContext(userId: string)` in `packages/ai/src/context.ts` assembles the full payload for a plan generation call. It performs the following steps in order:

1. Fetch `users` row for the user (archetype, timezone, location).
2. Fetch `user_profiles` row for the user (base_profile, modules_enabled, base_profile_version).
3. Fetch today's `daily_plans` row for the user if it exists (to populate `regeneration_count`).
4. Fetch pending `tasks` for the user ordered by priority descending, deadline ascending.
5. If `integrations` row for `google_calendar` exists with status `connected`, fetch today's calendar events from the Google Calendar API using the decrypted access token. If the token is expired, attempt refresh. If refresh fails, use an empty events array and set a flag to trigger the reconnect banner.
6. Query `workout_templates` with filters matching the user's fitness module configuration. Return at most 10 rows, ordered by `intensity_score` proximity to the user's energy score.
7. Query `recipe_templates` with filters matching the user's nutrition module configuration. Return at most 15 rows, ordered by `total_minutes` ascending (to prefer faster options when `cooking_time_max_minutes` is tight).
8. Serialize all context into the layered message structure described above.

The function returns a typed `PlanContext` object that the API route passes directly to the AI call wrapper.

### Butler Voice Gate

Every AI-generated string that will be displayed to the user passes through the butler voice gate implemented in `packages/ai/src/gate.ts` before being returned from any API route. The gate is not optional and is not bypassed in development.

**Layer 1 — Regex pass:** The string is checked against a blocklist of patterns. Any match results in the matched substring being removed or replaced. The blocked patterns are: em-dashes (`—`, `–`); exclamation points (`!`); emoji characters (Unicode ranges `\u{1F300}–\u{1F9FF}` and adjacent blocks); the strings `"AI"`, `"A.I."`, `"artificial intelligence"`, `"machine learning"`, `"AI-powered"`, and `"as an AI"` (case-insensitive). After substitution, the string is trimmed and checked for double spaces introduced by removal. The regex pass is synchronous and adds no latency.

**Layer 2 — Haiku review (strings longer than 30 words only):** If the string passes Layer 1 and contains more than 30 words, a `claude-haiku-4-5` call reviews it against the voice specification. The voice gate system prompt is cached (it is large and static). The call returns a binary verdict: `pass` or `fail`, plus an optional corrected string. If the verdict is `fail`, the original AI generation is retried once with a corrective suffix appended to the original generation prompt: `"Rewrite the above. Requirements: no em-dashes, no exclamation points, no AI self-reference, sentences under 15 words, no gratitude language, no urgency language."` The corrected output passes through Layer 1 again before being returned. If the retry also fails the gate, the string is discarded and a hardcoded butler-tone fallback string for that surface is used instead.

The gate adds approximately 100ms to any call that triggers the Haiku review. For plan synthesis, the gate runs on the assembled plan strings after the Sonnet call completes; it does not run during streaming. The user sees the streamed plan first and the gated version replaces it if corrections are made (this is expected to be rare in practice with well-tuned prompts).

### Cache Pre-Warm

A Cloudflare Worker named `cache-prewarm` runs as a cron job scheduled every five minutes (`*/5 * * * *`) and sweeps for users whose local time is between 05:20 and 05:30. For each such user, it makes a lightweight Anthropic API call using the cached layers (Layers 1, 2, and 3 from the plan context, with an empty Layer 4) to populate the Anthropic prompt cache. The five-minute cadence is sufficient because the 05:20–05:30 sweep window itself is ten minutes wide, so a user whose local time crosses 05:20 between two cron firings is still picked up on the next firing well ahead of the typical 06:00 plan generation. This ensures the morning plan generation call hits a warm cache, reducing both latency and cost for the most important daily call.

### Streaming

`claude-sonnet-4-6` calls for daily plan synthesis and weekly review use streaming via the Vercel AI SDK's `streamText()` function. The API route at `POST /api/v1/plans/generate` returns a streaming response using `result.toDataStreamResponse()`. The web client renders the streaming plan using `useChat()` or a custom streaming hook. The mobile client reads the streaming response using the fetch API with `response.body.getReader()`.

All `claude-haiku-4-5` calls use non-streaming `generateText()` or `generateObject()`, since their outputs are short and parsing requires the complete response.

### Structured Output

Template selection and NL command parsing use `generateObject()` with a Zod schema to guarantee typed responses. The Anthropic API's structured output feature is used where available; for models that do not support native structured output, the prompt instructs JSON-only response and the output is parsed with `JSON.parse()` wrapped in a try-catch. Malformed JSON triggers the fallback sequence described below.

### Fallback Handling

When an AI call fails — due to an API timeout, a rate limit error (HTTP 429), an API error (HTTP 5xx), a malformed response, or a structured output parse failure — the application executes a three-step degradation sequence:

**Step 1:** Retry the identical call after a 1.5-second delay. This handles transient network errors and brief API instability.

**Step 2:** If step 1 fails, retry after a 3-second delay with a simplified prompt. "Simplified" means Layer 3 (template subset) is reduced to 5 workouts and 5 recipes, and Layer 4 is reduced to date and energy only (tasks and calendar events dropped). If the simplified call also fails:

**Step 3:** Serve the plan from the most recent prior `daily_plans` row for this user (the last successfully generated plan). If no prior plan exists (the user is in their first week), serve a hardcoded archetype-appropriate template plan as a static fallback. Prepend the butler-tone apology line to the plan: `"Working from your usual routine today — I'll have something fresh tomorrow."` This line passes through the voice gate.

All three failure states are logged to `completion_log` with `event_type = 'plan_fallback_served'` and a `value.failure_reason` field describing which step failed and why.

A circuit breaker wraps the synthesize-plan call path. Three failures within a five-minute rolling window open the breaker. While the breaker is open, new synthesis requests bypass steps 1 and 2 of the degradation sequence entirely and serve the cached or hardcoded fallback plan directly; the upstream Anthropic call is not attempted. The breaker auto-closes after five minutes without a new failure, at which point synthesis requests resume the full three-step degradation sequence. While the breaker is open, the API response includes a flag that the client surfaces as the degraded-mode banner specified in Layer 4 ("Working slower than usual. Plans will resume shortly."); the application remains read-functional throughout. The breaker is a process-level guard against thundering-herd retries against a temporarily-unhealthy upstream and against runaway Anthropic spend during a sustained provider incident.

### Cost Estimate

Per-call costs derived from current Anthropic pricing: Sonnet 4.6 at $3 input / $15 output per million tokens, Haiku 4.5 at $1 / $5 per million, cache read at 0.1× base input, cache write at 1.25× base input for the default five-minute TTL. Token counts assume the four-layer prompt structure specified above: approximately 7,500 cached input tokens (system prompt plus user base context plus filtered template subset), approximately 500 uncached input tokens (today's specifics), and approximately 2,000 output tokens (a structured plan covering eight useful blocks). Haiku call sizes are estimated against typical task scope.

| Operation | Model | Per-call cost (derivation) | Frequency |
|---|---|---|---|
| Morning plan synthesis (warm cache) | Sonnet | ~$0.034 — cache read 7,500 × $0.30/M + uncached 500 × $3/M + output 2,000 × $15/M | Daily if user opens app |
| Morning plan synthesis (cold cache) | Sonnet | ~$0.060 — cache write 7,500 × $3.75/M + uncached 500 × $3/M + output 2,000 × $15/M | First call each day for users outside the pre-warm cohort |
| Mid-day NL edit | Haiku | ~$0.0015 — uncached ~500 × $1/M + output ~200 × $5/M | 2–4×/day active users |
| Voice gate Haiku review | Haiku | ~$0.0005 — small uncached input plus ~10-token verdict output | Per AI-generated string >30 words |
| Evening check-in question | Haiku | ~$0.001 — ~300 uncached input × $1/M + ~100 output × $5/M | Daily |
| Weekly review (Sunday only) | Sonnet | ~$0.058 — warm cache read + larger output (~3,500 tokens) | Weekly (≈$0.008/day amortized) |

**Daily total per active user.** A prewarmed user hitting warm cache on the morning plan: approximately $0.034 + 2×$0.0015 + $0.001 + $0.0005 + $0.008 = approximately **$0.047 per active day**. A cold-cache user (no prewarm pathway active, typically a trial user or a user without the sleep alarm configured): approximately $0.060 + same accessories = approximately **$0.073 per active day**.

**Monthly per active paying user.** Assuming 15–20 active days per month at a blended cold/warm daily cost, monthly AI cost is approximately **$1.00 to $1.50 per active paying user, with $1.20 as the planning midpoint**. Derivation: a paying user with the sleep alarm configured hits the prewarm pathway most mornings, so daily cost trends toward the warm-cache $0.047 figure; at 15 active days that's ~$0.71, at 20 days ~$0.94. A paying user without the sleep alarm, or hitting cold cache on days outside the prewarm window, trends toward $0.073/day; at 15 days that's ~$1.10, at 20 days ~$1.46. Blending at roughly 50/50 prewarm coverage produces ~$0.060/day average; at 15 days that's $0.90, at 20 days $1.20. The $1.00–$1.50 range covers the realistic span of these scenarios. Perfect prewarm coverage would lower the figure toward $1.00, while a population that engages without configuring the sleep alarm would push it toward $1.50.

Earlier drafts targeting $0.15 to $0.30 per active user per month relied on a 5-to-7-active-days-per-month engagement assumption (consistent with a churning user, not an engaged daily-use user) and an understated output token count of approximately 1,000 tokens (incompatible with a structured plan covering eight blocks). The corrected figures above use 15–20 active days and 2,000 output tokens.

**Trial cost per non-converter.** Most trial users are cold-cache because the prewarm pathway requires sleep module configuration that most new users defer past the first week. A non-converting trial user active on 4 to 7 days during the seven-day window incurs roughly $0.073 in daily cold-cache cost (per the daily-total derivation above), plus an amortized share of the weekly Sunday review (~$0.058 spread across 4–7 days, adding ~$0.008–$0.015 per active day). Combined: 4 × ($0.073 + $0.015) ≈ $0.35 (low engagement); 7 × ($0.073 + $0.008) ≈ $0.57 ≈ $0.55 (full engagement). Planning range: **$0.35 to $0.55 per non-converting trial user, $0.45 as the midpoint**.

---

## 6. Integration Specs

### Google Calendar (V1 — Read-Only)

**OAuth configuration:** The Google OAuth 2.0 client is configured in Google Cloud Console. The required scope is `https://www.googleapis.com/auth/calendar.readonly`. No write scope is requested at V1. The consent screen displays the application name, logo, and the single requested permission: "View your Google Calendar events."

**Authorization flow:** The user initiates calendar connection from Settings → Integrations. On web, `supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes: 'https://www.googleapis.com/auth/calendar.readonly' } })` is called with `{ skipBrowserRedirect: false }`. On mobile, `expo-auth-session` manages the browser redirect with the same scope. After authorization, the access token and refresh token are encrypted with pgsodium and stored in the `integrations` table under `provider = 'google_calendar'`. **[SUPERSEDED — V1 connect route uses the manual `{ code, redirectUri }` exchange per the API contract below; `signInWithOAuth` is not used. Token encryption is app-side libsodium keyed from `PGSODIUM_KEY`, not the in-DB pgsodium key store — see §13 and `docs/RUNBOOKS/PGSODIUM_KEY_ROTATION.md`.]**

**Sync behavior:** Calendar sync runs in two contexts. First, at plan generation time, `buildPlanContext()` fetches today's events using the stored access token. The API call is `GET https://www.googleapis.com/calendar/v3/calendars/primary/events` with parameters `timeMin` (start of today in the user's timezone, ISO 8601 format), `timeMax` (end of today), `singleEvents=true`, and `orderBy=startTime`. Second, when the user taps "Refresh calendar" in the integration settings panel, the same call is made and the result is used on the next plan generation.

**Token refresh:** The Google OAuth access token expires after one hour. Before making the calendar API call, the application checks `integrations.expires_at`. If the token is within 5 minutes of expiry or already expired, it calls `POST https://oauth2.googleapis.com/token` with `grant_type=refresh_token` and the stored (decrypted) refresh token. The new access token and updated expiry are re-encrypted and written back to the `integrations` row. If the refresh call fails (for example, the user has revoked access), `integrations.status` is set to `error` and `integrations.last_error` records the failure reason. The plan generation proceeds with an empty calendar events array, and the API response includes a flag that the client uses to display the reconnect banner.

**Conflict resolution:** Google Calendar events are treated as immutable constraints. During plan synthesis, they are passed to the AI as a list of fixed time slots. The AI does not place blocks that overlap with calendar events.

When a new or modified Google Calendar event is detected via the sync webhook and that event overlaps a block placed by a previous plan generation, the conflict resolution behavior is the silent-removal-plus-prompt model. The conflicting block's status transitions to `rescheduled`, the block is removed from the visible plan, and a butler-voice prompt surfaces in the ambient line: "Your plan needs another look. Shall I redo the rest of today?" The prompt is dismissible. If the user accepts, the engine runs a fresh plan generation covering the affected day from the current time forward, respecting all existing fixed events including the newly added Google Calendar event. If the user dismisses the prompt, the plan remains in its post-removal state — with a gap where the removed block was — until the user chooses to regenerate manually or until the next scheduled morning generation runs.

This model was chosen over silent auto-regeneration (which burns inference cost on every conflict regardless of whether the user cared about the affected block) and over an inline "Fix this" UI affordance (which would introduce a conflict surface inconsistent with the calm aesthetic). The chosen behavior matches the butler voice posture: the butler notices a change, raises it quietly, and acts only when authorized.

Implementation note: the `daily_plans.regeneration_count` is incremented when the user accepts a prompted regeneration, and a `plan_regenerated` event is written to `completion_log` with the trigger source recorded as `calendar_conflict` to distinguish prompt-driven regenerations from user-initiated ones for analytics.

### TheMealDB and ExerciseDB (Seed-Only)

These APIs are used exclusively during the initial data seeding process. They are not queried at runtime and no API keys are stored in the production environment.

**ExerciseDB** provides the source data for `workout_templates`. The seed script fetches exercises from `https://exercisedb.p.rapidapi.com/exercises` (requires a free RapidAPI key for seeding only) and assembles them into workout template objects matching the `workout_templates` schema. The assembled templates are written to `packages/db/seed/workout_templates.json`. The seed migration reads this JSON file and inserts the rows.

**TheMealDB** provides the source data for `recipe_templates`. The seed script fetches recipes from `https://www.themealdb.com/api/json/v1/1/random.php` (free, no key required) iteratively across categories to build the 300-recipe set. The assembled templates are written to `packages/db/seed/recipe_templates.json`. The seed migration reads this JSON file and inserts the rows.

Both seed JSON files are committed to the repository. If the upstream APIs change, the seed files are manually updated and a new seed migration is written.

### Apple Calendar (V1.5 Placeholder)

No implementation at V1. The `integrations.provider` enum already includes `apple_calendar`, reserving the column value. The settings UI includes a disabled "Connect Apple Calendar" row with an "Coming soon" label. Full read and write support via EventKit / EKEventStore on iOS and the CalDAV protocol on web is implemented at V1.5.

### Apple Health and Google Fit (V2 Placeholder)

No implementation at V1. The `integrations.provider` enum includes `apple_health` and `google_fit`. The settings UI includes disabled rows for both. Implementation at V2 will add sleep data, workout history, and heart rate variability as inputs to plan synthesis.

---

## 7. Live Activity and Dynamic Island

### Overview

Live Activities display the current plan block in the iPhone Dynamic Island without requiring the application to be open. The server drives all state changes; the device receives APNs payloads and renders them using a SwiftUI widget extension bundled with the app. The lifecycle is: Push Start (server initiates a new Live Activity on the device), Update (server sends current block state), End (server closes the activity when the block finishes).

### APNs Authentication

Token-based APNs authentication is used. The `.p8` private key issued by Apple in the Developer Portal is stored as the environment variable `APNS_PRIVATE_KEY` in the Cloudflare Workers environment (encrypted at rest by Cloudflare). The accompanying `APNS_KEY_ID` (10-character key identifier) and `APNS_TEAM_ID` (10-character team identifier) are also stored as environment variables. The Cloudflare Worker generates a JWT signed with the `.p8` key for each APNs request using the `jose` library. The JWT is valid for up to one hour; the worker caches it and regenerates it before expiry.

### Token Storage

When the Expo app launches and the user has granted notification permission, `expo-live-activities` registers for Live Activity push tokens. The token is reported to the server via `POST /api/v1/push-tokens` and stored in the `push_tokens` table with `live_activity_token` populated. Standard APNs push tokens (for regular notifications) are also stored in the same row under `token`. The unique constraint on `(user_id, device_id)` ensures one row per device per user.

### Cloudflare Worker: Live Activity Pusher

Live Activity transitions are device-handled wherever possible. The Live Activity payload includes ActivityKit's `staleDate` parameter set to the block's `end_time`; the SwiftUI widget extension uses this parameter to transition between blocks at the natural boundary without requiring a server push for the cosmetic transition itself. The device renders the per-minute countdown locally using the `endTime` field in the content state and rolls the activity over to a server-provided next-block payload (sent ahead of time) when the `staleDate` passes. Push is reserved for genuine state-change events: user actions (mark complete, reschedule), plan regeneration that re-orders upcoming blocks, and the next-block hand-off in the case where the previous block's payload did not pre-arm the next-block content (typically because the previous block ended via early user action rather than at its scheduled `end_time`).

The `live-activity-pusher` Cloudflare Worker runs every five minutes via cron trigger (`*/5 * * * *`) rather than every minute. Its execution sequence:

1. Query Supabase for all `blocks` rows where `start_time` is between `now()` and `now() + interval '5 minutes'` and which require a server-initiated next-block start (the prior block's pre-armed `staleDate` does not cover this start, or the prior block ended early via user action), filtered to users with status `active` or `trial`.
2. For each block transition found, fetch the user's `push_tokens` row to get `live_activity_token`.
3. Determine event type: `start` if the block is beginning, `end` if the block is finishing as the consequence of an external trigger (plan regeneration, manual reschedule).
4. For `end` events: check whether the next block starts within 30 minutes. If yes, immediately build a `start` event for the next block. If the gap is more than 30 minutes, send only the `end` event.
5. Build the APNs payload (see below).
6. POST to `https://api.push.apple.com/3/device/{live_activity_token}` with appropriate headers.
7. Log failures to Sentry (invalid token → mark `push_tokens.live_activity_token = null`; other errors → log with user_id and block_id for investigation).

User-action transitions (mark complete, reschedule, manual block creation) push immediately from the API route that handles the action rather than waiting for the next worker tick. The worker exists to handle scheduled boundary transitions that the device's `staleDate` does not cover; the API route handles all user-initiated transitions synchronously.

### Required Info.plist Keys

Two Info.plist keys are required for Live Activities to function. Without them the widget extension builds successfully but activities silently fail at runtime, which is a particularly painful failure mode because the build succeeds and the device-side code appears correct. Both are specified in build chat 077.

- `NSSupportsLiveActivities: true` — declares that the app supports Live Activities at all. Required for any Live Activity to start.
- `NSSupportsLiveActivitiesFrequentUpdates: true` — declares that the app uses frequent updates (sub-hourly cadence). Required for the per-minute countdown rendering and for the `staleDate`-driven transitions to fire reliably.

### APNs Payload Structure

**Push Start payload** (initiates a new Live Activity on the device):

```json
{
  "aps": {
    "timestamp": 1748822400,
    "event": "start",
    "content-state": {
      "blockId": "uuid",
      "blockType": "fitness",
      "title": "Morning gym session",
      "abbreviation": "GY",
      "endTime": "2026-06-01T07:30:00Z",
      "minutesRemaining": 45,
      "nextBlockTitle": "Breakfast",
      "nextBlockStart": "2026-06-01T07:30:00Z"
    },
    "attributes-type": "VesperBlockAttributes",
    "attributes": {
      "blockId": "uuid"
    },
    "alert": {
      "title": "Morning gym session",
      "body": "45 minutes · ends at 7:30 AM"
    }
  }
}
```

**Update payload** (refreshes the Live Activity state mid-block):

```json
{
  "aps": {
    "timestamp": 1748822400,
    "event": "update",
    "content-state": {
      "blockId": "uuid",
      "blockType": "fitness",
      "title": "Morning gym session",
      "abbreviation": "GY",
      "endTime": "2026-06-01T07:30:00Z",
      "minutesRemaining": 20,
      "nextBlockTitle": "Breakfast",
      "nextBlockStart": "2026-06-01T07:30:00Z"
    }
  }
}
```

**End payload** (closes the Live Activity):

```json
{
  "aps": {
    "timestamp": 1748822400,
    "event": "end",
    "content-state": {
      "blockId": "uuid",
      "blockType": "fitness",
      "title": "Morning gym session",
      "abbreviation": "GY",
      "endTime": "2026-06-01T07:30:00Z",
      "minutesRemaining": 0,
      "nextBlockTitle": null,
      "nextBlockStart": null
    },
    "dismissal-date": 1748823000
  }
}
```

The `apns-push-type` header is set to `liveactivity`. The `apns-topic` header is `{bundle-id}.push-type.liveactivity`. The `apns-priority` header is `10` (immediate delivery).

### APNs Request Headers

```
apns-push-type: liveactivity
apns-topic: com.vesper.app.push-type.liveactivity
apns-priority: 10
apns-expiration: 0
authorization: bearer {jwt}
content-type: application/json
```

### Update Cadence

The worker fires every five minutes (`*/5 * * * *`, consistent with the cron table in §10) and does not send an update payload every cycle per user. Updates are sent only at block start and block end transitions. The `minutesRemaining` value in the `content-state` is computed by the SwiftUI widget extension on the device using the `endTime` timestamp, not by the server at each update, so the countdown is accurate without server-side updates. This keeps APNs traffic minimal: typically 2 payloads per block (start and end), not one per cycle.

### SwiftUI Widget Extension

A small Swift codebase lives in `apps/mobile/ios/VesperLiveActivity/`. The widget extension declares three views:

- **Compact leading:** Block abbreviation (two characters, e.g., "GY" for gym) plus module icon in bronze, 11pt Inter weight 500, cream.
- **Compact trailing:** Countdown timer in minutes (JetBrains Mono 11pt, weight 500, bronze) or radial progress arc in bronze filling clockwise.
- **Expanded:** Full block title (Fraunces Display, 18pt, weight 500, cream), end time (JetBrains Mono 14pt, bronze), optional description, "Mark complete" button (bronze fill, cream text), "Reschedule" button (outlined, bronze border), and a bottom strip with the next block title and start time (Inter 11pt, tertiary text).

The `ActivityAttributes` struct defines `blockId` as the static attribute. The `ContentState` struct maps to the `content-state` object in the payload.

Tapping "Mark complete" from the expanded state sends a `buttonPressed` ActivityAction which the Expo app handles via `expo-live-activities`' action callback, which calls `PATCH /api/v1/blocks/{blockId}` with `{ status: 'completed' }`.

### Non-Dynamic-Island Fallback (iPhone 14 and Earlier)

Devices without a Dynamic Island (iPhone 14 and earlier non-Pro models) receive a persistent banner notification instead. Because the deployment target is iOS 17.2, every supported install has Live Activity Push Start available at the OS level, so the fallback is triggered purely by hardware (no Dynamic Island), never by iOS version. The same Cloudflare Worker detects that `live_activity_token` is null for these devices and falls back to sending a standard APNs push notification to the device's regular `token`. The notification displays the block title and end time and is not interactive. It is sent once per block start and is not updated mid-block.

### Android (V1.5)

Android has no Dynamic Island. The V1.5 implementation uses `expo-notifications` with a persistent foreground-service-backed notification that updates at block transitions. The same Cloudflare Worker logic applies; only the APNs call is replaced with an FCM call. A foreground service is required for true notification persistence on Android and is investigated at V1.5 build time.

---

## 8. Payments

### Stripe Configuration

**Products and Prices:** One product is created in the Stripe Dashboard: "Vesper Standard Monthly." One price is created under it: $19.99 USD, recurring monthly. The price ID (formatted as `price_XXXXXXXXXXXXXXXXXXXX`) is stored as the environment variable `STRIPE_PRICE_ID`. The price is not hardcoded in application code. Stripe Tax is enabled on the product, configured for the `txcd_10103001` tax code (SaaS / digital services subscription).

**Checkout:** The web conversion flow calls `POST /api/v1/subscription/checkout` which creates a Stripe Checkout Session via the Stripe Node SDK. The session parameters are:
- `mode: 'subscription'`
- `line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }]`
- `customer_email`: the user's email (creates a Stripe Customer if one does not exist)
- `metadata: { vesper_user_id: userId }` — used by the webhook handler to associate the subscription with the Vesper user
- `success_url: https://vesper.[tld]/settings/billing?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url: https://vesper.[tld]/settings/billing`
- `automatic_tax: { enabled: true }`
- `subscription_data: { trial_period_days: 0 }` — no Stripe-managed trial; Vesper manages the trial state internally

The API route returns `{ url: session.url }` and the client redirects the browser to the Stripe-hosted checkout page.

**Customer Portal:** The web cancellation and payment-method-update flow calls `POST /api/v1/subscription/portal` which creates a Stripe Customer Portal session. The session's `return_url` is `https://vesper.[tld]/settings/billing`. The route returns `{ url: session.url }` and the client redirects. This handles all self-serve subscription management for web subscribers without custom UI.

**Webhook Endpoint:** The Stripe webhook receives events at the Cloudflare Worker URL `https://[worker-subdomain].workers.dev/webhooks/stripe`. This URL is registered in the Stripe Dashboard under Developers → Webhooks. The webhook signing secret is stored as `STRIPE_WEBHOOK_SECRET`. The worker verifies the `Stripe-Signature` header using `stripe.webhooks.constructEvent()` before processing.

**Handled Stripe events:**

| Event | Handler action |
|---|---|
| `checkout.session.completed` | Create `subscriptions` row; set `users.subscription_status = 'active'`; set `users.payment_source = 'stripe'` |
| `customer.subscription.updated` | Update `subscriptions` row with new status, period dates, `cancel_at_period_end` |
| `customer.subscription.deleted` | Set `users.subscription_status = 'read_only'`; set `subscriptions.status = 'read_only'`; set `subscriptions.canceled_at` |
| `invoice.payment_succeeded` | Update `subscriptions.current_period_start` and `current_period_end` |
| `invoice.payment_failed` | Set `users.subscription_status = 'past_due'`; set `subscriptions.status = 'past_due'` |

**Idempotency:** Every webhook event is written to `subscription_events` with `provider = 'stripe'` and `event_id = event.id` before any state mutation. The unique constraint on `(provider, event_id)` causes a duplicate insert to fail with a unique violation. The handler catches this error and returns HTTP 200 immediately without re-processing the event, making webhook handling exactly-once.

**Signature timestamp tolerance:** The Stripe webhook handler sets the signature verification `tolerance` parameter to one year (effectively unbounded) rather than Stripe's default 300 seconds. Stripe retries failed deliveries over a 72-hour window, and a tight timestamp tolerance would cause legitimate late-delivery retries to be rejected as expired. Replay protection is enforced exclusively through the `(provider, event_id)` unique constraint above; the timestamp check is therefore non-load-bearing for security and is deliberately relaxed.

**Concurrent transition safety:** Every state-mutating webhook handler begins its transaction with `SELECT * FROM subscriptions WHERE user_id = $1 FOR UPDATE` to row-lock the subscription row against concurrent cross-provider events. Without the row lock, a Stripe `customer.subscription.deleted` arriving simultaneously with an Apple `SUBSCRIBED.INITIAL_BUY` (the user cancels on web while completing an iOS purchase) can produce a race where both handlers compute the new state from the pre-mutation row and the later writer overwrites the earlier writer's transition. The `FOR UPDATE` lock serializes the two handlers and produces the correct converged state regardless of arrival order.

**Stripe SDK version:** `stripe` npm package pinned to `^14.0.0`.

### Apple In-App Purchase Configuration

**Product configuration in App Store Connect:** One auto-renewing subscription group is created: "Vesper." One product is created within it: `com.vesper.standard.monthly`, priced at $19.99 USD (Tier 8 in Apple's pricing matrix). The price is set in App Store Connect and is not hardcoded in the application code; StoreKit fetches current pricing at runtime. The subscription group display name is "Vesper Standard." The promotional offer text and introductory offer are left empty at V1.

**StoreKit 2 implementation on iOS:** The mobile application uses the StoreKit 2 Swift API (available on iOS 15+, well within the iOS 16.1 minimum target). The `expo-iap` package (or a thin native module wrapping StoreKit 2) exposes the purchase flow to React Native. The flow:

1. On the upgrade screen, call `StoreKit.products(for: ["com.vesper.standard.monthly"])` to fetch current product details.
2. Display the product name and price from the fetched `Product` object (never hardcoded).
3. On tap, call `product.purchase()`. Apple presents the native payment sheet.
4. On `Product.PurchaseResult.success(let verification)`, verify the `VerificationResult<Transaction>` and call `POST /api/v1/subscription/apple-verify` with the encoded JWS transaction payload.
5. The API route verifies the JWS using Apple's public keys and creates/updates the `subscriptions` row.

**App Store Server Notifications V2:** The notification URL is configured in App Store Connect under Your App → App Information → App Store Server Notifications. The URL is `https://[worker-subdomain].workers.dev/webhooks/apple`. Both production and sandbox notification URLs are configured (using the same worker with an `environment` field in the payload to distinguish them).

**JWS verification in Cloudflare Worker:** Incoming App Store Server Notifications are signed JWS payloads. The worker extracts the `x5c` certificate chain from the JWS header (a three-element array containing the leaf signing certificate, the intermediate certificate, and the root certificate). The worker validates the chain against the pinned **Apple Root CA — G3** certificate (downloaded from `https://www.apple.com/certificateauthority/AppleRootCA-G3.cer` and shipped with the worker). After chain validation, the public key is extracted from the verified leaf certificate and used to verify the JWS signature. The Apple Root CA — G3 certificate itself is cached indefinitely as a build-time asset; the per-notification cost is only the chain validation, which is local and fast. After signature verification, the worker parses the `signedPayload` to extract the `notificationType`, `subtype`, and the inner signed transaction info. The signed payload's timestamp is verified against a one-year tolerance for the same reason as Stripe: Apple retries notification delivery over multi-day windows, and replay protection lives in the `(provider, event_id)` idempotency constraint rather than in the timestamp check.

**Apple Root CA pinning:** The Apple Root CA certificates used to verify the JWS chain are pinned in code with both the current root and the upcoming root present in the pin set, so the application continues verifying notifications across an Apple PKI rotation without an emergency deploy. The chat 086a Apple PKI Monitor worker checks the published Apple root certificate set weekly and alerts at the six-month-before-expiry threshold.

**Handled Apple notification types:**

| notificationType | subtype | Handler action |
|---|---|---|
| `SUBSCRIBED` | `INITIAL_BUY` | Create `subscriptions` row; set `users.subscription_status = 'active'` |
| `DID_RENEW` | — | Update `subscriptions.current_period_start` and `current_period_end` |
| `DID_FAIL_TO_RENEW` | — | Set `users.subscription_status = 'past_due'` |
| `EXPIRED` | `BILLING_RETRY_PERIOD` | Set `users.subscription_status = 'read_only'` |
| `EXPIRED` | `VOLUNTARY` | Set `users.subscription_status = 'read_only'` |
| `REFUND` | — | Set `users.subscription_status = 'read_only'`; set `subscriptions.canceled_at` |
| `REVOKE` | — | Set `users.subscription_status = 'read_only'` |

Idempotency uses the same `subscription_events` table and `(provider, event_id)` unique constraint, with `provider = 'apple'` and `event_id` set to the `originalTransactionId + '_' + notificationType + '_' + signedDate`.

**Small Business Program:** The Vesper developer account qualifies for Apple's Small Business Program from day one because annual proceeds are under the $1M threshold. Apple's commission under the program is 15% on subscriptions from the first transaction. The non-program "30% year one, 15% year two" structure is the default for developers who do not enroll and does not apply to Vesper. Enrollment is completed in App Store Connect well ahead of any live transactions; the exact activation window per Apple's published Small Business Program terms is short (on the order of weeks following approval) and is verified against Apple's developer documentation at the time of enrollment. Net revenue per iOS subscriber after the 15% commission ($19.99 × 0.85 = $16.9915): approximately **$16.99 per month** on the $19.99 price.

### Day-6 Trial Conversion Prompt

On the user's sixth day of trial (24 hours before trial expiration), the first app open of that day surfaces a full-screen modal: title "Trial ends tomorrow," body "Continue with Vesper for $19.99/month," primary button "Subscribe," secondary button "Maybe later." The modal is shown at most once per user per trial; dismissing it sets `users.trial_soft_prompt_dismissed_at` and prevents re-display. The Subscribe button routes web users to Stripe Checkout and iOS users to the StoreKit purchase flow specified above. Both shown and dismissed states emit PostHog events (`trial_soft_prompt_shown`, `trial_soft_prompt_dismissed`) for analytics. This is the only in-app surface specifically tied to trial-end conversion; the `trial-reminder` Cloudflare Worker continues to handle email reminders at the 3-day, 1-day, and 0-day checkpoints in parallel.

### Subscription State Machine

Seven states govern every user's account access. All state transitions are executed server-side by API routes or Cloudflare Workers using the service role key; client code never writes to `users.subscription_status` directly.

| State | Access level | Trigger in | Trigger out |
|---|---|---|---|
| `trial` | Full | New user signup (handle_new_user trigger) | Trial converts → `active`; trial ends without conversion → `read_only` |
| `active` | Full | Successful payment (Stripe or Apple webhook) | Payment fails → `past_due`; user cancels → `read_only` |
| `past_due` | Full (during dunning window) | Payment failure webhook | Dunning succeeds → `active`; dunning fails → `read_only` |
| `read_only` | Read only | Dunning failure, cancellation, trial non-conversion | Resubscribes → `active`; 7 days elapse → `archived` |
| `archived` | No access | 7 days in `read_only` | Resubscribes → `active`; 30 days elapse → `deletion_scheduled` |
| `deletion_scheduled` | No access | 30 days in `archived`, or explicit delete request | Hard-delete worker runs → row deleted |
| (deleted) | — | 30-day grace period after `deletion_scheduled` | N/A — row is gone |

The transition from `read_only` to `archived` and from `archived` to `deletion_scheduled` is executed by the daily `hard-delete` Cloudflare Worker, which runs at 02:00 UTC and sweeps for users whose transition timestamps have elapsed.

### Dunning Sequence

**Stripe dunning:** Stripe's Smart Retries attempts the failed charge multiple times over approximately seven days. The in-app state is `past_due` for the duration. Stripe is configured to send one email at the first failure and one before the final retry (more restrained than Stripe's default multi-email sequence). If all retries fail, Stripe sends `customer.subscription.deleted`, which the webhook handler uses to transition to `read_only`.

**Apple dunning:** Apple manages billing recovery autonomously for up to approximately 60 days in some cases. The in-app state is `past_due` for this window. Apple sends its own dunning emails to the user; Vesper does not send additional emails during Apple's recovery period. On expiration, Apple sends the `EXPIRED` notification, which transitions to `read_only`.

### Provider Reconciliation

A Cloudflare Worker named `reconciliation` runs nightly at 03:00 UTC. It queries all `subscriptions` rows alongside the associated `users.subscription_status` and verifies consistency. If the denormalized `users.subscription_status` does not match the computed state from `subscriptions.status`, the worker corrects the `users` row and logs the discrepancy to Sentry as a warning with the user ID and both the expected and found values.

If a user has subscriptions with both Stripe and Apple (possible if a user subscribes on web and then on iOS before canceling the original), the worker identifies the duplicate, marks the older subscription as superseded, and surfaces a "You have a duplicate subscription" notice in the user's account settings with a direct link to cancel the older one.

The reconciliation worker also handles referral credit voiding. On each nightly run, the worker queries `referral_credits` rows with `status = 'pending'` and joins to `users` on `recipient_user_id`. Any pending credit whose recipient has a `subscription_status` other than `active` is transitioned to `voided` with `void_reason = 'recipient_not_active_at_application_time'`. This enforces the policy that a referrer who has canceled or fallen out of active status before consuming their earned credits forfeits them.

### Referral Credit Fulfillment

Referral credits are issued by the conversion handler in `/webhooks/stripe` and `/webhooks/apple` when a `subscription_started` event fires for a user with a non-null `referred_by_user_id`. One credit row is written with `recipient_user_id = referred_by_user_id`, `source_user_id = converting_user.id`, `discount_percent = 50`, and `status = 'pending'`.

At the next billing cycle for the recipient, the credit is applied. The application mechanism differs by payment provider because the underlying primitives differ:

**Stripe path (web subscribers).** Before the recipient's next monthly invoice generates, a Stripe coupon with `percent_off = 50` and `duration = 'once'` is created via the Stripe API, then applied to the customer's subscription via `Subscription.update` with the `coupon` parameter. The coupon ID is stored in `referral_credits.provider_discount_id` for audit purposes. On the next invoice, Stripe automatically applies the fifty-percent discount, generating an invoice for approximately $9.99 instead of $19.99. The `referral_credits` row transitions to `applied` with `applied_at` set, `applied_to_provider = 'stripe'`, and `applied_to_invoice_id` set to the Stripe invoice ID. After application, the coupon is single-use and does not persist; the next billing cycle reverts to full price unless another credit is pending.

**Apple path (iOS subscribers).** Apple StoreKit does not support arbitrary programmatic percentage discounts on existing subscriptions the way Stripe coupons do. The implementation path uses Apple's Promotional Offers: a single promotional offer is configured in App Store Connect at the product level with a fifty-percent discount on one billing period. When a referral credit becomes redeemable, the Cloudflare Worker signs the offer using the App Store Connect API and the application surfaces an in-app redemption prompt to the recipient via StoreKit's `Product.purchase(options:)` with the signed offer. The user must tap to accept the offer; it is not auto-applied because Apple's flow requires user confirmation for any subscription modification. The `referral_credits` row transitions to `applied` when the offer is redeemed (signaled by a `DID_CHANGE_RENEWAL_PREF` notification from Apple), with `applied_to_provider = 'apple'` and `provider_discount_id` set to the offer identifier.

**Fallback for Apple complexity.** If the Promotional Offers integration proves prohibitively complex during Phase 4 build, the fallback mechanism is to extend the recipient's subscription by approximately fifteen days (half a billing cycle) using `App Store Server API.extendRenewalDate`, which provides equivalent monetary value to the user. The fallback path is documented but not the primary implementation. The decision between primary and fallback is made during the iOS payments integration work in Build Month 5.

**Voiding logic.** A pending credit is voided rather than applied if the recipient's `subscription_status` is anything other than `active` at the moment of next-invoice processing. The reconciliation worker described above performs this voiding nightly. A voided credit cannot be reinstated; if the user later resubscribes and refers another converter, a new credit row is issued.

**Self-referral guard.** The signup-flow attribution logic compares the cookie-stored referral code against the authenticating user's eventual user_id. If the code resolves to the same user (the user clicked their own referral link before signing up), no `referred_by_user_id` is set on the new user row, and the attribution event is dropped silently. This guard runs in the signup API route, not at the database level, because the attribution cookie is set before user_id is known.

**Existing-user clicks.** When an already-signed-up user clicks a referral link, the landing page sets the attribution cookie but the cookie is consulted only at the signup endpoint, never at login. An existing user logging in is unaffected by any active referral cookie. No backfill of `referred_by_user_id` occurs for accounts that already exist.

---

## 9. API Contracts

### Conventions

All client-facing API routes live under the `/api/v1/` prefix in the Next.js application. Breaking changes require a version bump to `/api/v2/`. All requests must include an `Authorization: Bearer {supabase_access_token}` header; routes return HTTP 401 if the token is absent, expired, or invalid. All request and response bodies are `application/json`.

**Error response shape (all error codes):**
```json
{
  "error": {
    "code": "PLAN_NOT_FOUND",
    "message": "No plan found for the requested date."
  }
}
```

`code` is a SCREAMING_SNAKE_CASE string constant defined in `@vesper/shared/src/errors.ts`. `message` is a human-readable string for development debugging; it is never displayed directly to the user.

**Pagination:** List endpoints that could return large result sets use cursor-based pagination with `limit` and `cursor` query parameters. V1 endpoints that are inherently bounded (tasks, weekly priorities) do not paginate.

**Date format:** All dates are ISO 8601 strings. Timestamps include timezone offset. Plan dates (date-only fields) are `YYYY-MM-DD` strings. All storage is UTC; conversion to local time happens at the client using the user's `timezone` field.

### Endpoint Reference

#### Plans

**`GET /api/v1/plans/today`**
Returns the current day's plan for the authenticated user. If no plan exists for today, returns `404`.

Response `200`:
```json
{
  "plan": {
    "id": "uuid",
    "planDate": "2026-06-01",
    "generatedAt": "2026-06-01T06:02:14Z",
    "energyScore": 7,
    "regenerationCount": 0,
    "blocks": [
      {
        "id": "uuid",
        "startTime": "2026-06-01T06:30:00Z",
        "endTime": "2026-06-01T07:15:00Z",
        "blockType": "fitness",
        "title": "Morning gym session",
        "status": "scheduled",
        "source": "ai_generated",
        "displayOrder": 0,
        "details": { ... }
      }
    ]
  }
}
```

---

**`POST /api/v1/plans/generate`**
Triggers plan generation for the authenticated user for a given date. If a plan already exists for that date, it is regenerated (increments `regeneration_count`; deletes and replaces blocks).

Request body:
```json
{
  "date": "2026-06-01",
  "energyScore": 7
}
```

Response: Streaming response. The `Content-Type` is `text/event-stream`. Each SSE event carries a partial or complete `DailyPlan` object. The client uses the Vercel AI SDK's streaming hook to consume this. On completion, the final complete plan is written to the database and a `plan_generated` or `plan_regenerated` event is written to `completion_log`.

On failure after exhausting fallbacks: returns `200` with a plan object marked `source: 'fallback'` and a `fallbackNotice` field containing the butler-tone apology string.

---

**`GET /api/v1/plans/date/:date`**
Returns the plan for a specific date. Used by the weekly planner to show adjacent days. Returns `404` if no plan exists for that date.

Parameters: `:date` — `YYYY-MM-DD` string.

Response: same shape as `GET /api/v1/plans/today`.

---

#### Blocks

**`PATCH /api/v1/blocks/:blockId`**
Updates a single block's status, time, or display order. Used for mark-complete, reschedule, and reorder operations.

Request body (all fields optional; at least one required):
```json
{
  "status": "completed",
  "startTime": "2026-06-01T07:00:00Z",
  "endTime": "2026-06-01T07:45:00Z",
  "displayOrder": 2
}
```

Response `200`:
```json
{
  "block": { ...updated block object... }
}
```

Writes a `block_completed`, `block_skipped`, or `block_rescheduled` event to `completion_log` depending on the `status` value.

---

**`POST /api/v1/blocks`**
Creates a user-added block on a plan. Requires the plan to exist for the given date.

Request body:
```json
{
  "planDate": "2026-06-01",
  "startTime": "2026-06-01T14:00:00Z",
  "endTime": "2026-06-01T15:00:00Z",
  "blockType": "custom",
  "title": "Call with landlord",
  "source": "user_added"
}
```

Response `201`: created block object.

---

#### AI Commands

**`POST /api/v1/ai/command`**
Parses a natural-language command and returns a structured plan edit operation. The client applies the edit and then calls the appropriate block PATCH or plan generate endpoint.

Request body:
```json
{
  "input": "Move gym to 7pm",
  "planDate": "2026-06-01"
}
```

Response `200`:
```json
{
  "command": {
    "type": "reschedule_block",
    "blockId": "uuid",
    "newStartTime": "2026-06-01T19:00:00Z",
    "newEndTime": "2026-06-01T20:00:00Z"
  },
  "confirmationLine": "Moved to 7 PM."
}
```

Possible `command.type` values: `reschedule_block`, `complete_block`, `skip_block`, `add_block`, `remove_block`, `regenerate_plan`. If the command cannot be parsed into a structured operation, `command.type` is `unknown` and `confirmationLine` contains a butler-tone clarification request.

---

#### Tasks

**`GET /api/v1/tasks`**
Returns all tasks for the authenticated user, ordered by priority descending, deadline ascending. Completed tasks are included (use `?status=pending` to filter).

Query params: `status` (`pending` | `completed` | omit for all).

Response `200`:
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "Review Q2 proposal",
      "estimatedMinutes": 45,
      "deadline": "2026-06-03T17:00:00Z",
      "priority": "high",
      "status": "pending",
      "completedAt": null
    }
  ]
}
```

---

**`POST /api/v1/tasks`**

Request body:
```json
{
  "title": "Review Q2 proposal",
  "estimatedMinutes": 45,
  "deadline": "2026-06-03T17:00:00Z",
  "priority": "high"
}
```

Response `201`: created task object.

---

**`PATCH /api/v1/tasks/:taskId`**

Request body (all optional):
```json
{
  "title": "...",
  "estimatedMinutes": 30,
  "deadline": "...",
  "priority": "medium",
  "status": "completed"
}
```

Response `200`: updated task object.

---

**`DELETE /api/v1/tasks/:taskId`**

Response `204`.

---

#### Profile

**`GET /api/v1/profile`**
Returns the authenticated user's profile, including both `users` and `user_profiles` data.

Response `200`:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "archetype": "nine_to_five",
    "timezone": "America/New_York",
    "honorific": "none",
    "subscriptionStatus": "active",
    "tier": "standard",
    "onboardingCompletedAt": "2026-06-01T08:30:00Z"
  },
  "profile": {
    "baseProfile": { ...base_profile JSONB... },
    "baseProfileVersion": 3,
    "modulesEnabled": { ...modules_enabled JSONB... }
  }
}
```

---

**`PUT /api/v1/profile`**
Updates the user's base profile. Increments `base_profile_version` atomically.

Request body:
```json
{
  "archetype": "nine_to_five",
  "timezone": "America/New_York",
  "honorific": "none",
  "baseProfile": { ...base_profile JSONB... },
  "modulesEnabled": { ...modules_enabled JSONB... }
}
```

All fields optional; only provided fields are updated. If `baseProfile` is provided, `base_profile_version` is incremented. Response `200`: updated profile shape.

---

**`PATCH /api/v1/profile/modules/:moduleId`**
Toggles a single module on or off without requiring the client to send the full `modulesEnabled` JSONB structure. Convenience endpoint for the in-app module toggle UI.

URL parameters: `:moduleId` — one of `work`, `fitness`, `nutrition`, `sleep`, `medication`, `errands`, `finance`.

Request body:
```json
{
  "enabled": true
}
```

Reads the current `modulesEnabled` JSONB from `user_profiles`, mutates the `:moduleId` key's `enabled` field to the request value, and writes the updated structure back atomically. Increments `base_profile_version` on every successful update so downstream plan generation knows to invalidate its cache.

Response `200`:
```json
{
  "moduleId": "fitness",
  "enabled": false,
  "baseProfileVersion": 4
}
```

Returns `400` if `:moduleId` is not a known module name. Returns `404` if the user has no `user_profiles` row (should not occur in practice since profiles are created at signup, but handled defensively).

---

#### Energy

**`POST /api/v1/energy`**
Logs an energy score independent of plan generation. Used during onboarding before the first plan is generated, for mid-day re-checks, and as the analytics primitive for the V1.5 Optimizer tier energy time-series feature.

Request body:
```json
{
  "score": 7,
  "loggedAt": "2026-06-01T08:15:00Z"
}
```

`score` is an integer from 1 to 10 inclusive. `loggedAt` is optional and defaults to the server's `now()` at request time. Writes a row to `completion_log` with `event_type = 'energy_logged'` and `value = { "score": <integer> }`. Does not trigger plan generation. Does not modify any existing plan.

Response `201`:
```json
{
  "logged": {
    "id": "uuid",
    "score": 7,
    "loggedAt": "2026-06-01T08:15:00Z"
  }
}
```

The morning plan generation endpoint (`POST /api/v1/plans/generate`) continues to accept an `energyScore` parameter directly; that parameter and this endpoint are independent paths to the same underlying log event. The plan generation endpoint additionally consumes the score for synthesis, while this endpoint logs without consumption.

---

#### Weekly Priorities

**`GET /api/v1/weekly-priorities`**
Returns weekly priorities for the current week (Monday-anchored). Pass `?weekStart=2026-06-01` for a specific week.

Response `200`:
```json
{
  "weekPriorities": {
    "id": "uuid",
    "weekStartDate": "2026-06-01",
    "priorities": [
      { "text": "Ship the onboarding flow", "source": "user", "completedAt": null }
    ]
  }
}
```

---

**`PUT /api/v1/weekly-priorities`**
Creates or replaces the priorities for a given week.

Request body:
```json
{
  "weekStartDate": "2026-06-01",
  "priorities": [
    { "text": "Ship the onboarding flow", "source": "user" }
  ]
}
```

Validates that the array length is between 3 and 5. Response `200` or `201`.

---

#### Integrations

**`GET /api/v1/integrations`**
Returns all integrations for the user with their current status.

Response `200`:
```json
{
  "integrations": [
    {
      "provider": "google_calendar",
      "status": "connected",
      "lastSyncedAt": "2026-06-01T05:59:00Z",
      "lastError": null
    }
  ]
}
```

---

**`POST /api/v1/integrations/google-calendar/connect`**
Exchanges the OAuth authorization code (from the client-side OAuth flow) for tokens, encrypts them, and creates or updates the `integrations` row.

Request body:
```json
{
  "code": "4/0AY0e...",
  "redirectUri": "https://vesper.[tld]/settings/integrations/callback"
}
```

Response `200`: updated integration status.

---

**`DELETE /api/v1/integrations/:provider`**
Disconnects an integration. Deletes the `integrations` row and revokes the OAuth token with the provider.

Response `204`.

---

#### Subscriptions

**`GET /api/v1/subscription`**
Returns the user's current subscription state.

Response `200`:
```json
{
  "subscription": {
    "status": "active",
    "provider": "stripe",
    "currentPeriodEnd": "2026-07-01T00:00:00Z",
    "cancelAtPeriodEnd": false
  }
}
```

---

**`POST /api/v1/subscription/checkout`**
Creates a Stripe Checkout session. Web-only.

Response `200`:
```json
{
  "url": "https://checkout.stripe.com/pay/cs_..."
}
```

---

**`POST /api/v1/subscription/portal`**
Creates a Stripe Customer Portal session. Web-only.

Response `200`:
```json
{
  "url": "https://billing.stripe.com/session/..."
}
```

---

**`POST /api/v1/subscription/apple-verify`**
Verifies a StoreKit 2 purchase and creates/updates the subscription row. Mobile-only.

Request body:
```json
{
  "jwsTransaction": "eyJ..."
}
```

Response `200`: updated subscription state.

---

#### Account

**`POST /api/v1/account/delete`**
Initiates the account deletion flow. Sets `deletion_requested_at` and transitions to `deletion_scheduled`.

Response `200`:
```json
{
  "deletionScheduledAt": "2026-06-01T12:00:00Z",
  "hardDeleteAt": "2026-07-01T12:00:00Z"
}
```

---

**`POST /api/v1/account/restore`**
Cancels a pending deletion. Clears `deletion_requested_at` and transitions back to `read_only`.

Response `200`.

---

#### Push Tokens

**`POST /api/v1/push-tokens`**
Registers or updates a push token for the authenticated device.

Request body:
```json
{
  "deviceId": "device-uuid-from-expo",
  "platform": "ios",
  "token": "apns-token-string",
  "liveActivityToken": "la-token-string-or-null"
}
```

Response `200` or `201`.

---

**`DELETE /api/v1/push-tokens/:deviceId`**
Removes the push token for a device (called on sign-out).

Response `204`.

---

#### Waitlist

**`POST /api/v1/waitlist`** (unauthenticated)
Accepts a pre-launch waitlist signup.

Request body:
```json
{
  "email": "user@example.com",
  "platformPreference": "ios"
}
```

Rate-limited at the Cloudflare level (100 requests per IP per hour). Response `201` on success; `409` if the email already exists.

---

#### Referral

**`GET /api/v1/referral/code`**
Returns the authenticated user's referral code along with summary statistics for the settings panel surface. Returns `404` with `{ "reason": "not_eligible" }` if the user has never reached `subscription_status = 'active'` (referral codes are generated only at paid conversion).

Response `200`:
```json
{
  "code": "k4nx8q",
  "url": "https://vesper.studio/r/k4nx8q",
  "referralCount": 3,
  "creditsApplied": 2,
  "creditsPending": 1
}
```

`referralCount` is the count of `referral_credits` rows where `recipient_user_id` equals the authenticated user. `creditsApplied` is the subset with `status = 'applied'`. `creditsPending` is the subset with `status = 'pending'`. Voided credits are excluded from all three counts; the surface intentionally does not surface voiding to the user.

---

**`POST /api/v1/referral/track`** (unauthenticated)
Public endpoint hit by the referral landing page when a visitor arrives at `vesper.[tld]/r/{code}`. Validates the code against the `users.referral_code` column, sets an attribution cookie (`vesper_ref`, value `<code>`, max-age 30 days, SameSite=Lax, Secure, HttpOnly=false so the client can read it for UTM enrichment), and redirects to the main marketing landing page.

Request body: none (URL-driven only).

Response `302` redirect to the main landing page on success. Response `404` with no cookie set if the code does not resolve to a user. Rate-limited at the Cloudflare level (200 requests per IP per hour to allow shared-link surges).

The attribution cookie is consulted only at the signup endpoint (`POST /api/v1/auth/signup` and equivalent OAuth callback handlers). On successful new-user creation, if the cookie's value resolves to a valid `users.id` that is not the new user's own ID, `users.referred_by_user_id` is set on the new row. If the cookie is present but the new user is in fact the referrer themselves (self-referral attempt detected by user_id match at signup), the field is left null and the cookie is cleared from the response.

---

### Cloudflare Worker Endpoints (Not Client-Callable)

These endpoints accept inbound webhook payloads from Stripe and Apple. They are not accessible to the web or mobile clients and return `403` for any request without a valid provider signature.

| Method | Path | Handler |
|---|---|---|
| `POST` | `/webhooks/stripe` | Stripe event processor |
| `POST` | `/webhooks/apple` | Apple App Store Server Notification processor |

---

## 10. Hosting and Infrastructure

### Vercel

The web application deploys on **Vercel Pro ($20/seat/month)**, active from the start of Phase 4 build. Vercel's Terms of Service restrict the Hobby plan to personal, non-commercial use; a commercial subscription product requires Pro from day one regardless of launch status.

The Hobby tier (used during build) provides 100 GB bandwidth per month, 100,000 serverless function invocations per day, and unlimited deployments. The Pro tier raises these to 1 TB bandwidth per month and 1 million serverless function invocations per day; the included $20/month covers usage-based costs at V1 volumes with significant headroom. Every push to the `main` branch triggers a production deploy. Every pull request generates a preview deployment at a unique URL (used for reviewing UI changes before merge).

**Environment variables** are configured in the Vercel Dashboard under Project Settings → Environment Variables, with separate values for `preview` and `production` environments. The `preview` environment points to a staging Supabase project (or the same Supabase project with a test schema if branch databases are not yet configured). The complete set of environment variables required by the web application:

| Variable | Context | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key (safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key (never exposed to client) |
| `STRIPE_SECRET_KEY` | Server only | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Server only | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Server only | Stripe price ID for the standard monthly plan |
| `ANTHROPIC_API_KEY` | Server only | Anthropic API key |
| `RESEND_API_KEY` | Server only | Resend API key for transactional email |
| `NEXT_PUBLIC_POSTHOG_KEY` | Public | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | Public | PostHog host URL |
| `SENTRY_DSN` | Public (web) | Sentry DSN for web error reporting |
| `NEXT_PUBLIC_APP_URL` | Public | Production app URL (`https://vesper.[tld]`) |

**Vercel Pro is already active from Phase 4 build start.** No Hobby→Pro cutover is required. Monitor Pro tier usage against the 1 TB bandwidth and 1M function invocation ceilings; at V1 volumes both are unlikely to be approached within the first year.

### Supabase

The database and auth run on a single **Supabase Free tier** project during build. Free tier limits: 500 MB database storage, 1 GB file storage, 50,000 monthly active users for Auth, 5 GB database egress per month, 5 GB cached egress per month, and 7-day log retention. The free tier also auto-pauses projects after seven consecutive days of inactivity, which is a production risk for any window where the app receives no traffic; this is one of the triggers for the Supabase Pro upgrade below.

**Project configuration:**
- Supabase Auth settings: email magic link enabled, Google and Apple OAuth providers enabled, password auth disabled.
- Row Level Security: enabled on all tables (verified during migration).
- pgsodium extension: enabled for OAuth token encryption on the `integrations` table.
- pgcrypto extension: enabled for SHA-256 hashing in the hard-delete worker.

**Environment separation:** At V1 on the free tier, a single Supabase project serves both preview and production. Preview deployments (Vercel PR previews) connect to the same Supabase project but operate on test user data. When Supabase is upgraded to Pro, branch databases become available and each PR preview gets an isolated database branch.

**Upgrade trigger:** Upgrade to Supabase Pro ($25/month) when any of the following are hit: database approaching 400 MB storage, MAU approaching 40,000, database egress approaching 4 GB/month, when branch database isolation is needed for safe PR testing, or before any production window where seven days of low traffic could trigger the free-tier inactivity pause.

### Cloudflare Workers

All Workers are deployed via Wrangler CLI. The `wrangler.toml` at the root of the Cloudflare Workers package defines the worker bindings and cron schedules.

**Workers and their cron schedules:**

> **Build status.** Four workers exist in `workers/` today — `apple-assn`, `apple-pki-monitor`, `daily-cron` (which carries the hourly-dispatch rows below as modules rather than as separate workers) and `stripe-webhook`; `live-activity-pusher` is specified here but not yet built, and is provisioned at Cutover.

| Worker name | Cron | Purpose |
|---|---|---|
| `cache-prewarm` | `*/5 * * * *` | Pre-warm Anthropic prompt cache for users whose local time is 05:20–05:30 |
| `live-activity-pusher` | `*/5 * * * *` | Send APNs Live Activity start/end payloads at block boundaries |
| `delayed-jobs-tick` | `*/5 * * * *` | Pick up `delayed_jobs` rows whose `scheduled_for` has elapsed; dispatch to handler for `job_type` |
| `email-queue` | `*/15 * * * *` | Pick up `email_queue` rows whose `scheduled_for` has elapsed; deliver via Resend; mark `sent_at` |
| `trial-reminder` | `0 8 * * *` | Send trial-ending reminders for users at 3-day, 1-day, and 0-day checkpoints |
| `dunning-check` | `0 4 * * *` | Check for `past_due` users whose dunning window has elapsed; transition to `read_only` |
| `reconciliation` | `0 3 * * *` | Reconcile `subscription_status` across Stripe/Apple state |
| `hard-delete` | `0 2 * * *` | Hard-delete users whose grace periods have elapsed |

**Environment variables in Cloudflare Workers:**

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for RLS-bypass DB access |
| `ANTHROPIC_API_KEY` | Anthropic API key (for cache pre-warm calls) |
| `APNS_PRIVATE_KEY` | `.p8` APNs auth key content |
| `APNS_KEY_ID` | APNs key identifier |
| `APNS_TEAM_ID` | Apple Developer team identifier |
| `STRIPE_SECRET_KEY` | Stripe secret key (for webhook processing) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `SENTRY_DSN` | Sentry DSN for worker error reporting |

**Free tier limits:** 100,000 requests per day, 10ms CPU time per invocation (Workers are fast for these tasks), cron triggers available on the free tier. No upgrade expected at V1 scale.

### DNS Configuration

The domain `vesper.[tld]` (TLD to be finalized during Phase 3 environment setup; candidates are `vesper.day`, `vesper.studio`, `vesper.house` pending availability) is pointed to Vercel by setting the apex domain's A record and `www` CNAME to Vercel's IP addresses as shown in the Vercel Domain Settings panel.

The Cloudflare Workers are accessible at `[worker-name].[account-subdomain].workers.dev` on the default Cloudflare Workers subdomain. Webhook URLs are registered with Stripe and Apple using this subdomain. A custom `workers.vesper.[tld]` subdomain is optionally configured if a cleaner URL is needed.

Domain purchase is deferred from Phase 3 to approximately Project Week 22 per the deferred-spend policy (parental funding gate; see LAYER_6_LAUNCH_GROWTH.md Week 5 calendar entry for context). During Phase 3 and Phase 4, the application runs against localhost for development and Vercel preview URLs (*.vercel.app) for external surfaces. DNS configuration as specified above is applied at the moment of domain purchase in Week 22, not during the initial environment setup. All configs (OAuth redirects, Stripe webhook URLs, Resend sender addresses, Supabase Auth redirect allow-list) are updated at that point. Until then, OAuth flows test against localhost callbacks, Stripe webhooks test via the Stripe CLI tunnel, and Resend operates from the sandbox sender address.

### Environment Separation

Two environments are maintained: `preview` and `production`.

**Production:** `main` branch on Vercel, production Supabase project, production Cloudflare Workers, live Stripe keys, live Apple certificates.

**Preview:** Vercel PR preview deployments connected to preview environment variables. At V1 on the free Supabase tier, preview deployments share the production Supabase project (acceptable at low user counts with test accounts). Stripe preview deployments use Stripe test mode keys (`sk_test_...`). Cloudflare Workers do not have a separate preview deployment at V1; webhook testing uses Stripe's CLI local forwarding and the Apple Sandbox environment.

---

## 11. Observability

### Sentry

Sentry is configured across three surfaces, each with its own DSN. A single Sentry organization with three projects is the recommended setup: `vesper-web`, `vesper-mobile`, and `vesper-workers`.

**Web:** The `@sentry/nextjs` package is installed. `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts` are created in the `apps/web` root per Sentry's Next.js setup guide. The DSN is set from `SENTRY_DSN`. Source maps are uploaded during the Vercel build using the Sentry Vercel integration. Error sampling rate: 100% in production (acceptable at V1 user counts; reduce to 10–20% at scale).

**Mobile:** The `@sentry/react-native` package is installed and integrated with Expo via the Sentry Expo plugin in `app.config.js`. The DSN is embedded in the build. Crashes and unhandled exceptions are captured automatically.

**Cloudflare Workers:** The `@sentry/cloudflare` package is used in each Worker. The Sentry client is initialized with the DSN at the start of each Worker handler.

Free tier covers 5,000 errors per month, adequate for V1. Upgrade to Team tier ($26/month) when errors approach 4,000/month or when release tracking becomes important post-launch.

### PostHog

PostHog is initialized in both the web and mobile applications using the `posthog-js` (web) and `posthog-react-native` (mobile) SDKs. All events are batched and sent to `app.posthog.com` (US region). The PostHog project API key is stored as `NEXT_PUBLIC_POSTHOG_KEY`.

**Event taxonomy (cross-referenced with `completion_log`):** The following events are tracked in PostHog. Events marked (PH only) exist only in PostHog; events marked (DB + PH) are also written to the `completion_log` table.

| Event name | Properties | Storage |
|---|---|---|
| `user_signed_up` | `provider`, `archetype` | PH only |
| `onboarding_step_completed` | `step`, `stepName` | PH only |
| `onboarding_completed` | `durationSeconds`, `archetypeSelected`, `modulesEnabled` | PH only |
| `plan_generated` | `planDate`, `blockCount`, `generationDurationMs`, `promptVersion`, `energyScore` | DB + PH |
| `plan_regenerated` | `planDate`, `regenerationCount`, `promptVersion` | DB + PH |
| `plan_fallback_served` | `planDate`, `failureReason`, `fallbackSource` | DB + PH |
| `block_completed` | `blockType`, `planDate`, `durationMinutes` | DB + PH |
| `block_skipped` | `blockType`, `planDate` | DB + PH |
| `block_rescheduled` | `blockType`, `planDate` | DB + PH |
| `energy_logged` | `energyScore`, `planDate` | DB + PH |
| `nl_command_used` | `commandType`, `parsedSuccessfully` | PH only |
| `integration_connected` | `provider` | PH only |
| `integration_disconnected` | `provider` | PH only |
| `trial_reminder_shown` | `daysRemaining` | PH only |
| `trial_converted` | `provider` | PH only |
| `trial_ended_no_convert` | — | PH only |
| `subscription_canceled` | `provider`, `reason` | PH only |
| `dynamic_island_mark_complete` | `blockType` | PH only |
| `realtime_connection_state_changed` | `state`, `reason`, `plan_date`, `retry_count` | PH only |
| `offline_queue_flush_started` | `queued_mutation_count` | PH only |
| `offline_queue_flush_completed` | `succeeded_count`, `conflict_count`, `network_error_count`, `total_duration_ms` | PH only |
| `nl_command_submitted` | `input_length_chars`, `source` | PH only |
| `nl_command_parsed` | `command_type`, `parse_latency_ms` | PH only |
| `nl_command_applied` | `command_type`, `apply_outcome`, `apply_latency_ms` | PH only |
| `alarm_scheduled` | `wake_target_local`, `scheduled_at`, `snooze_minutes` | PH only |
| `alarm_fired` | `fired_at`, `latency_from_target_ms` | PH only |
| `alarm_dismissed` | `action`, `dismissed_at` | PH only |
| `medication_notification_schedule_failed` | `medication_id`, `scheduled_times_count`, `error_class` | PH only |
| `calendar_conflict_detected` | `conflict_count`, `user_action_pending` | PH only |
| `calendar_conflict_resolved` | `user_action`, `conflict_count` | PH only |
| `push_token_registered` | `platform`, `has_live_activity_token`, `device_id_hash` | PH only |
| `live_activity_started` | `block_id`, `success` | PH only |
| `live_activity_ended` | `block_id`, `success` | PH only |
| `live_activity_update_failed` | `block_id`, `success`, `error_code` | PH only |
| `rate_limit_tripped` | `endpoint`, `limiter_name`, `window_seconds`, `retry_after_seconds` | PH only |

No PII is sent to PostHog. User identity is tracked using the Supabase user UUID (`posthog.identify(userId)`). Email addresses, names, and any other personally identifying fields are never included as event properties.

### `completion_log.value` Constraints for NL Command Events

Natural-language command events written to `completion_log` (event_type `nl_command_used` for the analytics surface, mirrored to PostHog) store only the parsed `PlanEditCommand` structure plus a SHA-256 hash of the raw user input string. The raw user text is never persisted. The hash is used for dedup analytics (counting unique commands across users without storing the commands themselves) and for diagnosing parsing failures by reproducing test inputs against the hash, which the user can re-enter manually if asked to reproduce a bug. This posture aligns with the Layer 5 medication-grade privacy floor: anything the user typed into the butler input surface could in principle include sensitive context, and the safe default is to not store it.

### Realtime Connection Ceiling and Alert

Supabase Realtime on the free tier caps concurrent connections at 200. A PostHog cohort alert is configured to fire when concurrent Realtime connections reach 150 (seventy-five percent of the ceiling), giving operational lead time to upgrade to the Pro tier before users experience connection rejection. The alert is provisioned in chat 097a alongside the rest of the operational alerting suite.

### Operational Alerting Thresholds

Three categories of operational alert fire to the founder's email at launch:

- Sentry: error rate exceeds 10 new errors per minute (any surface); any error in the `live-activity-pusher` or `reconciliation` workers; new error type first seen in production (daily digest).
- Anthropic spend: an Anthropic-side daily-budget alert fires at 80% of the daily budget (warning) and 100% (action required). The budget is set at the V1 expected-spend ceiling plus headroom; the 80% threshold leaves intervention time before the 100% hard ceiling.
- Stripe revenue dip: a Stripe alert fires when daily revenue falls by more than 30% versus the trailing 7-day average. Surfaces churn cliffs, dunning failures spreading across the cohort, or webhook processing breakage masquerading as a revenue cliff.

All three alert sets are provisioned in chat 097a.

### Three Primary Funnels

**Funnel 1 — Signup to Activation:** `user_signed_up` → `onboarding_completed` → `plan_generated`. Activation is defined as a user generating their first plan. The funnel exists as diagnostic instrumentation: when trial-to-paid conversion moves, this funnel shows whether the cause is upstream signup friction, onboarding dropoff, or failure to reach the first-plan moment.

**Funnel 2 — Activation to Paid:** `plan_generated` (first plan) → `trial_converted`. Measured at the 7-day trial window. The planning figure for trial-to-paid conversion is 5 to 8 percent, anchored to ChartMogul's 2026 study of 200 SaaS products showing an 8.9 percent average for opt-in / no-card-required trials, with the indie B2C consumer subset typically below that average. Conversion clearing the 5 percent threshold and monthly paid churn staying under 10 percent together constitute the operative health check for the business.

**Funnel 3 — Paid to Day 30 Retention:** `trial_converted` → (still `active` 30 days later). Measured by checking `subscription_status` for cohorts at D30. This funnel exists as instrumentation for the monthly churn measurement; the operative measure is monthly paid churn staying under approximately 10 percent.

### Public Open-Metrics Dashboard

A public-facing metrics dashboard displays the following metrics without requiring authentication:

- Monthly active users (MAU)
- Week-over-week growth rate
- Trial-to-paid conversion rate (rolling 30-day)
- D30 paid retention (rolling cohort)
- Plans generated (lifetime)

Implementation at V1 uses a PostHog public share link rather than a custom Next.js route at `vesper.[tld]/open`. The PostHog public share link displays a live dashboard at a PostHog-hosted URL, requires zero ongoing maintenance, and ships in under fifteen minutes of configuration. The trade-off is that the dashboard surface cannot be styled to match the warm-dark brand aesthetic; it renders in PostHog's default visual language.

This trade-off is accepted at V1 because the open-metrics dashboard appears in two contexts only: the launch-day Indie Hackers post (where the audience values transparency over visual cohesion) and a single link in the Vesper blog footer. The dashboard is not on the main marketing landing page. The styling cost is therefore limited to two low-traffic surfaces, while the maintenance saving applies indefinitely.

A custom `/open` Next.js route remains available as a V1.5 enhancement if user data volume warrants more prominent treatment. The PostHog dashboard URL is configured before Project Week 22 (waitlist landing page go-live) so it is available for inclusion in launch-day materials.

### Alerting

Sentry email alerts are configured for the following conditions:

- Error rate exceeds 10 new errors per minute (any surface) — immediate email to founder
- Any error in the `live-activity-pusher` or `reconciliation` workers — immediate email
- New error type first seen in production — daily digest email

No PagerDuty, on-call rotation, or SMS alerting at V1. The founder is a single-person team; email is sufficient.

Supabase provides email alerts for approaching storage, MAU, and egress limits in the Dashboard → Advisors panel. These are reviewed monthly.

---

## 12. Security and Privacy

### Encryption in Transit

All communication between clients (web, mobile) and servers (Vercel, Supabase, Cloudflare) uses TLS 1.2 or higher. Vercel, Supabase, and Cloudflare enforce TLS by default and do not accept unencrypted connections. APNs communication uses TLS 1.2. Anthropic API communication uses TLS 1.2+. No unencrypted HTTP connections are used anywhere in the production system.

### Encryption at Rest

Supabase applies AES-256 encryption transparently to all database storage, including all tables and backups. This covers all user data at the database layer without any application-level configuration required.

OAuth access and refresh tokens in the `integrations` table receive a second layer of application-level encryption using the `pgsodium` extension. The raw token bytes are encrypted with a server-held key stored as `PGSODIUM_KEY` in the Vercel environment (never in the database). Token encryption and decryption occur only inside the API routes that need to call the third-party provider. Client code never sees the encrypted bytes; the API route decrypts, uses the token to call the external API, and discards the plaintext. The encryption key is rotatable: key rotation produces a new key, the rotation migration re-encrypts all `access_token_encrypted` and `refresh_token_encrypted` values with the new key, and the old key is discarded.

Push tokens in `push_tokens` are stored with Supabase's standard AES-256 at-rest encryption. No additional application-level encryption is applied to push tokens at V1.

### PII Handling

Personally identifying information in the system is:
- `users.email` — the user's email address
- `waitlist.email` — pre-launch waitlist email addresses
- `users.location_lat` and `users.location_lng` — approximate home location
- `medications.*` — medication names and doses (sensitive health-adjacent data)
- `user_profiles.base_profile` — may contain employer name, schedule details

PII is never included in URL parameters. User-identifying values travel in request bodies or `Authorization` headers only. This rule is enforced at the API contract level; all routes that reference a specific user do so via the JWT identity, not via a user ID in the URL path (exception: internal server-to-server calls that use the service role key and do not expose URLs to clients).

`medications` rows receive additional protection through the Postgres trigger that writes every mutation to `security_audit_log`, providing a forensic record. Medication data is never passed to third-party integrations, never included in analytics events, and never logged to Sentry.

### Deletion Timelines

The full deletion timeline from the user's perspective is:

1. **Day 0:** User clicks "Delete account." `deletion_requested_at` is set. Status transitions to `deletion_scheduled`. User is signed out.
2. **Days 0–30:** 30-day grace period. User can sign back in and cancel deletion. No data is modified.
3. **Day 30+:** Daily hard-delete Cloudflare Worker detects that `deletion_requested_at` is more than 30 days ago. Before deleting: computes `SHA-256(lower(email))` and inserts into `deleted_user_email_hashes`. Then executes `DELETE FROM users WHERE id = ?`. All child table rows cascade-delete.

Note: The path through `read_only` → `archived` → `deletion_scheduled` (without explicit deletion request) adds up to 37 days of data persistence after access is lost (7 days read-only + 30 days archived), then the 30-day grace period, totaling 67 days from the `read_only` transition before hard-delete.

After hard delete, the SHA-256 email hash in `deleted_user_email_hashes` is the only data retained. This hash cannot be reversed to recover the original email address. It is used exclusively to prevent repeat trial sign-ups from the same email.

The `security_audit_log` rows for a hard-deleted user are also cascade-deleted (the `user_id` column uses `ON DELETE CASCADE`). If forensic data from the audit log must be preserved before deletion (for example, in response to a legal request), it must be extracted before the hard-delete worker runs.

### GDPR and CCPA

At V1, Vesper operates only in the United States. The following baseline compliance measures are implemented:

**Right to delete:** Implemented via the account deletion flow. Users can delete their account from settings at any time. The 30-day grace period is disclosed to users before they confirm deletion.

**Right to access:** Users can view all their data within the application. A formal data export endpoint (`GET /api/v1/account/export`) is on the roadmap for V1.5 but not required for the US-only V1 launch.

**No sale of PII:** User data is not sold to third parties. Operational providers (Anthropic, Supabase, Vercel, Sentry, PostHog) receive data as part of service operation and are bound by their respective data processing agreements.

**Privacy policy and terms of service:** Published at `https://vesper.[tld]/privacy` and `https://vesper.[tld]/terms` before any user can sign up. The waitlist signup page links to the privacy policy. The onboarding flow requires acknowledgment before proceeding.

**GDPR notes for future expansion:** When the product expands outside the US, a formal Data Processing Agreement with each operational provider must be in place, cookie consent must be implemented on the marketing pages, and the privacy policy must be updated for GDPR jurisdiction. None of this is implemented at V1.

### No-PII-in-URLs Rule

No URL in the application — path segment, query parameter, or fragment — contains personally identifying information. Specifically:

- User IDs do not appear in client-facing URLs. The user's identity is derived from the JWT in the Authorization header.
- Email addresses are never placed in URL parameters (common mistake in magic link implementations — the Supabase magic link callback URL receives only a token, not the email).
- Block IDs and plan IDs may appear in URLs (for example, a deep link to a specific block) since these UUIDs are not PII.
- Third-party redirect URLs (OAuth callbacks, Stripe redirects) receive only opaque tokens, never email addresses or user identifiers.

### Supabase Service Role Key Handling

The `SUPABASE_SERVICE_ROLE_KEY` is used only from server-side runtimes: Vercel API routes and Cloudflare Workers. It is stored as a server-only environment variable in both platforms and is never exposed to the client bundle. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the only Supabase credential in the client bundle; it is limited to operations permitted by RLS policies.

---

## 13. Dev Workflow

### Local Setup

Prerequisites: Node.js 20 LTS, pnpm 9+, Supabase CLI, Cloudflare Wrangler CLI, Expo CLI, Xcode 15+ (for iOS simulator).

```bash
# Clone and install
git clone https://github.com/[org]/vesper
cd vesper
pnpm install

# Set up environment variables
cp .env.example apps/web/.env.local
# Fill in all values in apps/web/.env.local

# Start local Supabase (Postgres + Auth + Storage)
supabase start

# Run migrations against local Supabase
supabase db push

# Run seeds against local Supabase
pnpm --filter @vesper/db seed

# Start the web app
pnpm --filter @vesper/web dev

# Start the mobile app (requires iOS simulator or device)
pnpm --filter @vesper/mobile start
```

The local Supabase instance runs at `http://localhost:54321` (API) and `http://localhost:54323` (Studio). The web app runs at `http://localhost:3000`.

Cloudflare Workers are tested locally using Wrangler:
```bash
cd workers
wrangler dev --local
```

Wrangler's `--local` flag runs the Worker against a local Miniflare instance. Bindings (KV, environment variables) are set in `wrangler.toml` with local overrides in `.dev.vars`.

### Branch and PR Conventions

- `main` — production branch. Direct pushes are disabled. All changes merge via PR.
- `feature/<slug>` — new feature work. Example: `feature/google-calendar-sync`.
- `fix/<slug>` — bug fixes. Example: `fix/token-refresh-race-condition`.
- `chore/<slug>` — tooling, deps, non-user-facing changes.

PR requirements before merge:
1. `pnpm build` passes with no TypeScript errors.
2. `pnpm lint` passes.
3. All new database migrations are accompanied by corresponding `.down.sql` files.
4. Migration files are committed in the same PR as the application code that requires them.

PR descriptions use the format: **What** (one sentence), **Why** (one sentence), **Test plan** (how you manually verified the change).

### Test Strategy

At V1, testing is scoped to high-value, low-redundancy targets. The following categories are tested:

**Zod schema validation tests** (in `@vesper/shared`): Every Zod schema exported from `@vesper/shared/src/schemas/` has corresponding tests that verify valid inputs pass and invalid inputs produce the expected error shapes. These run with Vitest and take under 5 seconds.

**RLS policy tests** (in `@vesper/db`): Each table's RLS policies are tested using Supabase's pgTAP-based test helper. Tests verify that a user can read their own rows, cannot read another user's rows, and cannot write to service-role-only tables. These run against the local Supabase instance.

**Subscription state machine tests**: The state transition logic (which states can transition to which other states, and under what conditions) is unit-tested as a pure TypeScript function. No database or network required.

**Auth flow integration tests**: Sign-in, token refresh, and sign-out flows are tested using Playwright against the local web application. These cover the most critical user path.

The following are explicitly skipped at V1 to preserve build velocity:

- Unit tests for UI components (visual behavior is validated by looking at the app)
- Snapshot tests (brittle and high-maintenance)
- AI prompt output tests (non-deterministic; validated manually during prompt development)
- End-to-end tests for every user flow (covered by manual QA during beta)

### Deployment Pipeline

**Web deployment:** Any push to `main` triggers an automatic Vercel production deployment. The deployment runs `pnpm build` (which includes TypeScript compilation and Next.js static optimization) and deploys if the build succeeds. Vercel rolls back automatically to the last successful deployment if the new build fails.

**Database migrations:** Migrations do not run automatically during Vercel deployments. The correct migration sequence is:
1. Merge the PR that contains both the migration files and the application code.
2. Verify the Vercel preview deployment is correct.
3. Run `supabase db push --db-url $SUPABASE_DB_URL` to apply the migration to production before the production deployment is promoted. (Supabase CLI is run from the developer's machine or from a GitHub Actions step.)
4. Promote the Vercel deployment to production.

This sequence ensures the database schema is always at least as current as the application code. Application code that depends on a new column must not go live before that column exists in production.

**Cloudflare Workers deployment:** Deployed via `wrangler publish` from the `workers/` directory. This is a manual step during the V1 build phase. A GitHub Actions workflow that runs `wrangler publish` on merge to `main` is optional and can be added if manual deployment becomes error-prone.

**Expo mobile builds:** Production builds are submitted to TestFlight and the App Store via EAS (Expo Application Services). `eas build --platform ios --profile production` triggers a cloud build. `eas submit --platform ios` submits the `.ipa` to App Store Connect. Development builds for simulator testing use `expo run:ios`.

### Claude Code Session Conventions

At the start of every Claude Code build session, load the following context:

1. This document (`TECHNICAL_SPEC.md`) — the full file, or the section(s) relevant to the day's work.
2. The PRD section relevant to the feature being built.
3. The relevant schema section from this document for any session that touches database queries.

Before ending a session:
1. Run `pnpm build` from the repo root to verify no TypeScript errors were introduced.
2. Run `pnpm lint` to verify no lint errors.
3. If any new migration files were created, verify they have corresponding `.down.sql` files.
4. Confirm that any new environment variables are documented in `.env.example`.

Session size guidance: Claude Code sessions work best when scoped to a single coherent unit of work (one API route, one UI component, one Worker). Attempting to build across package boundaries in a single session increases the chance of context loss at the session limit. Prefer multiple focused sessions over one sprawling session.

---

## 14. Open Technical Questions

The following items were flagged during the architecture phase or surfaced during specification consolidation. Two questions originally noted in this section (Google Calendar conflict resolution and the public open-metrics dashboard implementation) were resolved during v1.0 finalization and are reflected in Sections 6 and 11 respectively; they are recorded as resolved at the bottom of this section for traceability. The four items below remain open. None block Phase 2 closure; each is a deferred implementation trigger that resolves at the point in the build where the relevant feature begins.

---

**1. pgsodium key rotation procedure — Resolved**

The rotation procedure is documented as a concrete runbook in `docs/RUNBOOKS/PGSODIUM_KEY_ROTATION.md`, authored in build chat 063. The runbook covers: generating the new key via the pgsodium key-management API, running the re-encryption migration that decrypts each `integrations` row with the old key and re-encrypts with the new key inside a single transaction, atomically swapping the active key reference, and retiring the old key after a verification window. The runbook also specifies the rollback procedure if the re-encryption migration fails partway through. The first OAuth token encryption in production (the first Google Calendar connection) is unblocked by the runbook's existence; the rotation itself is exercised on a regular cadence and is no longer a deferred decision.

---

**2. Optimistic concurrency on block mutations — Resolved**

The resolution expanded scope beyond the original Open Question framing. Rather than guarding only `displayOrder` updates with a plan-level `updated_at` check, the API-layer optimistic concurrency check applies to every block mutation: the client sends the block's `updated_at` value alongside its mutation request, and the API route rejects the mutation with HTTP 409 if the row's current `updated_at` is newer than the value the client sent. The client refetches and re-applies the local intent against the fresh state, or surfaces the conflict to the user when re-application is non-trivial. This pattern lands in build chats 026 and 027 alongside the broader block mutation API surface. The Realtime self-mutation filter (specified in the §3 `blocks.client_mutation_id` column and the Layer 3 Realtime section) prevents the originating device from re-rendering its own optimistic write, which closed the residual flicker case the optimistic concurrency check alone did not cover.

The earlier sketch of a SELECT-trigger-based `in_progress` transition is also obsolete: Postgres has no SELECT trigger and the computation cannot fire on read. The `effective_status` for a block (whether it should render as `in_progress` based on current time relative to `start_time`/`end_time` and the stored `status`) is computed at serializer time in the API route rather than at the database. This computation is implemented in chats 026 and 027 alongside the mutation surface.

---

**3. Apple Developer Account enrollment timing**

The Live Activity Push Start feature requires a provisioning profile with the Live Activities capability enabled in the Apple Developer Portal. Obtaining a provisioning profile requires an active Apple Developer account ($99/year). App Store submission requires the account to be in good standing and any new app must pass App Review, which typically takes 24–72 hours for first submissions.

**Resolution needed before:** Any Live Activity or push notification testing begins, since the device-side registration flow requires a valid provisioning profile. The account should be created and enrolled during Phase 3 (Environment Setup), not during the build phase.

---

**4. Expo prebuild and Swift Live Activity extension maintenance**

The `expo-live-activities` package requires a custom native module and a Swift widget extension that lives in the prebuild-generated iOS directory. If `expo prebuild` is re-run (for example, after adding a new Expo plugin), it regenerates the `ios/` directory and may overwrite manual changes to the `VesperLiveActivity/` extension.

**Resolution needed before:** The Dynamic Island implementation begins. The `ios/` directory should be committed to the repository (standard practice for Expo projects with custom native code) and the `VesperLiveActivity/` subdirectory must be gitignored from prebuild regeneration by adding it to the `expo.ios.prebuildClean` exclusion list, or handled via a post-prebuild script.

**5. Domain purchase and DNS cutover timing.**
The domain TLD selection (vesper.studio, vesper.day, or vesper.care) is made during Phase 3 environment setup, but the actual registration is deferred to approximately Project Week 22 to align with the parental funding gate. This creates a configuration cutover moment at Week 22 when production DNS goes live: OAuth providers' redirect allow-lists must add the new domain, Stripe webhook URLs must switch from CLI tunnel to production endpoints, Resend sender addresses must move from the sandbox to a verified vesper.[tld] domain, and the waitlist landing page must deploy under the production hostname.
Resolution needed before: Project Week 22, when the domain is purchased. A cutover checklist should be added to ENVIRONMENT_SETUP.md during the late-Phase-4 window to ensure no config is missed. The checklist itself is straightforward (each of the above is a one-liner update), but missing any single item produces a hard-to-diagnose production issue. Recommended approach: list all configs that reference the domain by searching the repo for "vercel.app" and any placeholder domain references the moment the production domain is purchased.

---

### Resolved in v1.0 (for traceability)

**Google Calendar conflict resolution for pre-existing AI-placed blocks.** Resolved during v1.0 finalization with the silent-removal-plus-prompt model. When a Google Calendar sync delivers a new or modified event that overlaps an existing AI-placed block, the block is silently set to `rescheduled` status and removed from the visible plan; a butler-voice ambient prompt offers to regenerate the rest of the day, dismissible without action. Implementation specified in Section 6 (Google Calendar Integration → Conflict resolution).

**Public open-metrics dashboard implementation.** Resolved during v1.0 finalization with the PostHog public share link approach. A PostHog-hosted public dashboard surface ships at V1; a custom Next.js route remains available as a V1.5 enhancement. Implementation specified in Section 11 (Public Open-Metrics Dashboard).
