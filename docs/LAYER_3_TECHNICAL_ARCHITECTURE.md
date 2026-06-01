# Layer 3: Technical Architecture

## Layer Purpose

Layer 3 translates the product specification locked in Layer 2 into a concrete technical architecture. Where Layer 2 defined what the product does, Layer 3 defines how it is built: the technology stack with reasoning for every choice, the database schema that backs every feature, the AI architecture that drives the daily plan engine, the integration list with implementation priorities, the infrastructure for the Dynamic Island integration, the realtime and offline strategy, the privacy and compliance posture, and the cost analysis that connects technical choices to monthly burn.

The intent of this layer is to make every technical decision the founder would otherwise face during the build phase. Architecture-level choices are the hardest to change once code is written: a wrong database schema costs weeks to migrate, a wrong AI architecture costs the entire cost model to rebuild. By front-loading these decisions now, the build phase becomes pure execution against this document.

This layer assumes the decisions locked in Layer 1 (positioning, audience, voice, geographic scope, platform strategy, ambition track) and Layer 2 (V1 pillar list, template-customization architecture, hybrid reshuffle behavior, in-app proactive cues, calendar dual surface, mobile-and-web parity, server-driven Live Activity Push Starts). Where Layer 3 expands on or refines those decisions, the change is documented explicitly.

## Working Direction From Prior Layers

The product is a Life OS for young professionals with a butler-tone voice and warm-dark aesthetic. It ships as a Next.js web application alongside an Expo iOS mobile application at V1, with Android via Expo arriving as a friend-assisted fast-follow post-V1 (no committed delivery date). Seven pillars ship at V1: the AI plan engine, the seven modules (work, fitness, nutrition, sleep, errands, medication, finance), the calendar dual surface (Google Calendar plus built-in), the mobile-and-web platform parity, the natural-language input surface, the adaptive onboarding flow, and the Dynamic Island integration. The architecture is template-customization: approximately 150 workout templates and approximately 300 recipe templates ship with the product, the AI selects an appropriate template daily based on user context (goal, energy, equipment, dietary needs, time available), and the AI modifies the selected template for personalization. The business model is a one-week free trial converting to paid, with a realistic AI cost of approximately $1.00 to $1.50 per active paying user per month (planning midpoint $1.20, derived from Sonnet 4.6 and Haiku 4.5 token pricing against a blended cold/warm cache pattern at 15 to 20 active days per month), a US-only V1 launch, and an anonymous founder.

## Technology Stack

### Frontend

**Web: Next.js 15 with App Router.** Server components are used for static or low-interactivity surfaces (the landing page, settings, profile). Client components are used for the plan view, the weekly planner, and any drag-and-drop surface. TypeScript is used throughout. Tailwind CSS handles styling, with the warm-dark design tokens applied via the Tailwind config (token-level specifics are locked in Layer 4).

**Mobile: Expo with React Native, Prebuild workflow.** Expo's managed APIs handle the bulk of the app, while prebuild generates native iOS and Android projects when custom native code is needed. Live Activities are the primary case for native code access. The Prebuild workflow gives the iteration speed of Expo Managed plus the native-code access of Bare workflow, with EAS Build handling app signing and submission. NativeWind provides Tailwind classes in React Native, sharing the design token config with the web surface.

iOS is the only mobile platform at V1. Android arrives at V1.5 once the iOS Dynamic Island experience is proven. The same React Native codebase serves both platforms, with Android-specific persistent ongoing notifications replacing the Dynamic Island treatment at V1.5.

### Repository Structure

The codebase is organized as a single **Turborepo monorepo**, containing both the web and mobile applications along with shared packages for code reused across surfaces. The layout follows this structure:

```
/
├── apps/
│   ├── web/           # Next.js 15 web app
│   └── mobile/        # Expo React Native app
├── packages/
│   ├── shared/        # TypeScript types, Zod schemas, business logic
│   ├── ui/            # Shared design tokens and Tailwind config
│   ├── ai/            # Prompt templates, AI client wrappers
│   └── db/            # Drizzle schema and migration utilities
├── turbo.json
└── package.json
```

The `shared` package is the keystone of the monorepo. It holds every Zod schema for the application's data model (user profile, daily plan, block, task, template, subscription) along with the TypeScript types derived from those schemas. Both apps import from the shared package to validate data going to the API and to type-check data received from the API. This eliminates the most common bug source in cross-surface applications: types drifting between web and mobile.

The `ai` package centralizes prompt construction and Anthropic API client wrapping. Both applications call into this package for any AI request, ensuring identical prompt structure across surfaces.

The `db` package holds Drizzle schema definitions and database migration tooling. The web app's API routes import from this package; the mobile app does not, since mobile calls the API rather than the database directly.

### Backend

The backend is split across two platforms, each playing to its strengths and remaining within free tier limits at V1 user counts.

**Next.js 15 API routes on Vercel** handle all request and response logic for both the web and mobile applications. The mobile app authenticates via Supabase Auth (which Next.js validates against) and hits the same endpoints the web app uses. This single-source-of-truth architecture eliminates the need for a separate mobile backend and keeps the API surface minimal. API routes handle daily plan generation (calling the Anthropic API server-side), plan edits (drag-and-reorder, mark complete, reschedule), template library queries, integration sync (Google Calendar pulls), subscription state management (Stripe webhooks), and user profile reads and writes.

**Cloudflare Workers with Cron Triggers** handle scheduled jobs. Block-boundary Live Activity Push Starts, weekly digest prompts, dunning checks for failed payments, and template library cache refreshes all run as Cloudflare Workers. The free tier covers 100,000 requests per day. Cron cadence is five minutes rather than minute-level; the slack is acceptable for Live Activity block-boundary transitions, which are not user-perceptible at sub-five-minute granularity. The five-minute cadence keeps the cron worker comfortably within the Cloudflare free tier.

The split is deliberate: Next.js handles user-initiated requests on Vercel's serverless infrastructure, while Cloudflare handles autonomous timed actions. Each platform's strengths are used; each platform's costs stay within the free tier at V1 user counts.

Supabase Edge Functions are not used at V1. If a database-adjacent trigger emerges (for example, a database event that needs immediate downstream action), an Edge Function can be added without disrupting the rest of the architecture.

### Database, Authentication, Realtime, and Storage

**Supabase** provides four services: Postgres for application data (accessed via Drizzle ORM), Auth for Google OAuth and Apple Sign In and email magic link, Realtime for live plan-view sync across devices, and Storage for user-uploaded content (avatars at V1, possibly receipt or food photos at V2).

A single Supabase project is used at V1, on the free tier (500MB database, 1GB storage, 2GB egress per month, 50,000 monthly active users). Upgrade to the Pro tier ($25 per month) is triggered at approximately 500 active users or when the free tier limits begin to bite.

Supabase Realtime on the free tier caps concurrent connections at 200. The Pro upgrade trigger therefore fires earlier in the Realtime dimension than in the database or MAU dimensions: a PostHog cohort alert is configured to fire at 150 concurrent connections (seventy-five percent of the free-tier ceiling) so the Pro upgrade is in flight before the ceiling is reached and connection-rejection errors surface to users. This alert is provisioned during build chat 097a alongside the rest of the operational alerting suite.

### AI

**The Anthropic API is the sole AI provider at V1.** No multi-provider abstraction is used. Two models are deployed in a tiered fashion:

**Claude Haiku 4.5** handles cheap, fast operations: template selection (which workout template fits this user's context), natural-language command parsing (translating "move gym to 7pm" into a structured edit), simple classification tasks (assigning block types to ambiguous calendar events), and brief check-in question generation. Haiku is roughly one-twelfth the cost of Sonnet per token. These tasks involve short prompts and short outputs, where Sonnet's added reasoning provides minimal benefit.

**Claude Sonnet 4.6** handles high-quality reasoning: daily plan synthesis (the core morning plan generation), weekly review reasoning (the Sunday planning session), contextual template adaptation when a template's standard parameters do not fit the user's situation, and the "what's not working" prompt that fires after three failed regeneration attempts. These tasks involve longer prompts, complex reasoning, and benefit materially from Sonnet's quality.

The model split runs against an aggressive optimization stack rather than as a naive call pattern. Haiku prompts use the default five-minute cache TTL. A one-hour TTL was considered and rejected: the write cost rises from 1.25× input rate to 2× input rate (a sixty percent write penalty), and Haiku calls are too sporadic across the day (one or two per user per day for check-in questions and natural-language parsing) to amortize the heavier write cost. The five-minute TTL captures the realistic clustering window (rapid successive edits during morning plan review) without paying the longer-TTL premium. Sonnet daily-plan synthesis retains the default five-minute TTL because the cache pre-warm worker (specified later in this document) populates that window at 5:30 AM in the user's local timezone, thirty minutes ahead of the typical morning brief. The production system prompts apply caveman-style compression to butler-voice specification fidelity, reducing token count without altering the voice specification itself. The butler voice gate runs full review on every freeform AI-generated string and samples constraint-heavy outputs (daily plan synthesis is constraint-heavy because the JSON schema and butler voice already act as guardrails on the model) at roughly twenty percent rather than one hundred percent, holding gate cost proportional to the genuine voice-drift risk. A circuit breaker wraps the synthesize-plan call path: three failures within five minutes opens the breaker, new requests route directly to the cached or hardcoded fallback rather than retrying through the upstream Anthropic API, and the degraded-mode banner specified in Layer 4 surfaces while the breaker is open. The breaker auto-closes after five minutes without a new failure.

Claude Opus never runs at user-request time. It is reserved for prompt design and engine logic development during Claude Code conversations.

**The Vercel AI SDK** wraps the Anthropic SDK and handles streaming, structured outputs via Zod schemas, and provider abstraction. The abstraction layer keeps a future move to a multi-provider strategy cheap.

### Payments

**Stripe** provides three hosted features used at V1: Stripe Checkout for subscription signup, Customer Portal for self-service plan management, and Pricing Tables embeddable in the landing page. All three are free to use; the only cost is the standard transaction fee (2.9% plus 30 cents in the United States). Webhook handlers in Next.js API routes update subscription state in Supabase whenever Stripe sends events (subscription created, payment failed, subscription canceled, and so on).

The iOS application implements Apple In-App Purchase via StoreKit 2 for iOS subscribers, in parallel with Stripe for web subscribers. App Store Server Notifications V2 are received via a dedicated Cloudflare Worker endpoint that verifies the signed JWS payload using Apple's public keys, parses the event type, and updates the user row's `subscription_status` field accordingly. The product enrolls in Apple's Small Business Program upon meeting the under-$1M-revenue eligibility criterion, reducing the Apple commission from thirty percent to fifteen percent. Enrollment is not automatic: Apple reviews each application, and the reduced rate takes effect fifteen days after the end of the fiscal month in which Apple approves the enrollment, so the founder enrolls early (during App Store submission prep) to ensure the 15% rate is active before the first live transaction. Subscription state from Apple and Stripe is reconciled on the user row, with the most recent active subscription treated as the source of truth where duplicates exist.

### Email

**Resend** handles transactional email. The free tier covers 3,000 sends per month with a 100/day cap; the daily cap can bind earlier than the monthly during traffic bursts, so the operational upgrade trigger (per the build plan's SCALING_THRESHOLDS) is 2,500/month sustained or any single day exceeding 80 sends. Comfortable for V1 user counts. React Email is used for template authoring (emails are written as JSX components, sharing the design language with the rest of the application for visual consistency).

The transactional emails sent at V1 are: welcome (after signup), magic link sign-in code, trial ending in two days, trial ending in one day, trial ended (subscribe or cancel), payment failed (handled by Stripe with a confirmation note from Resend), subscription canceled, account deletion grace period started, and account deletion finalized.

### Analytics and Observability

**PostHog** captures product analytics. The free tier covers 1 million events per month. PostHog is used for funnel analysis (signup through onboarding completion through first plan generated through day-seven retention through conversion to paid), feature usage tracking, and session recordings useful during the closed beta phase for diagnosing user friction.

**Sentry** captures errors from the web application, the mobile application, and the Cloudflare Workers. The free tier covers 5,000 errors per month, sufficient at V1 user counts.

**Supabase logs and Vercel logs** handle infrastructure-level debugging. Both are free with their respective platforms. Centralized log aggregation (Logflare, Better Stack, Axiom) is not adopted at V1; the platform-native log surfaces are sufficient. Centralized aggregation is reconsidered at V2 if multi-platform correlation becomes a frequent debugging need.

## Database Schema

The schema is designed around the architectural decisions locked in Layer 2: the template-customization architecture, the base profile model that updates slowly with daily diffs that update fast, and the hybrid storage approach with normalized blocks but JSONB for block details. The product never stores plan history beyond the current state, per founder direction in Layer 3 brainstorming.

### Core Tables

**users**
- `id` (uuid, primary key, references Supabase auth.users)
- `email` (text, unique)
- `created_at` (timestamp)
- `archetype` (enum: nine_to_five, remote, student, athlete, founder, mixed)
- `timezone` (text, IANA timezone identifier)
- `location_lat` (numeric, nullable; user's primary location)
- `location_lng` (numeric, nullable)
- `subscription_status` (enum: trial, active, past_due, canceled, archived)
- `trial_started_at` (timestamp, nullable)
- `trial_ends_at` (timestamp, nullable)
- `deletion_requested_at` (timestamp, nullable; populated when user requests deletion, 30-day grace period before hard delete)
- `tier` (enum: standard, optimizer; default 'standard'; the optimizer value is unused at V1 and activates at V1.5)
- `payment_source` (enum: stripe, apple; nullable; populated when subscription is active, indicates which billing provider is the source of truth for this user)

**user_profiles**
- `user_id` (uuid, primary key, references users.id)
- `base_profile` (jsonb; the slow-updating user model containing work schedule pattern, sleep targets, fitness goals, dietary preferences, recurring commitments, location-bound events)
- `base_profile_version` (integer; incremented on every base profile update, useful for prompt caching invalidation)
- `modules_enabled` (jsonb; per-module enable state and configuration for the seven modules)
- `updated_at` (timestamp)

**daily_plans**
- `id` (uuid, primary key)
- `user_id` (uuid, references users.id)
- `plan_date` (date)
- `generated_at` (timestamp)
- `energy_score` (integer 1 through 10, nullable; from morning check-in)
- `regeneration_count` (integer, default 0; tracks rejection cycles, triggers "what's not working" prompt at three)
- `metadata` (jsonb; any plan-level metadata such as weather conditions or special context)
- Unique constraint on (user_id, plan_date) so that one plan exists per user per day

**blocks**
- `id` (uuid, primary key)
- `daily_plan_id` (uuid, references daily_plans.id)
- `start_time` (timestamp)
- `end_time` (timestamp)
- `block_type` (enum: work, fitness, nutrition, sleep, errands, medication, finance, focus, commute, custom)
- `title` (text)
- `status` (enum: scheduled, in_progress, completed, skipped, rescheduled)
- `details` (jsonb; block-specific content such as workout details for fitness blocks, recipe steps for nutrition blocks, task list for focus blocks, route information for errands blocks)
- `source` (enum: ai_generated, user_added, google_calendar, recurring)
- `display_order` (integer; tiebreaker for blocks sharing the same start time)

**tasks**
- `id` (uuid, primary key)
- `user_id` (uuid, references users.id)
- `title` (text)
- `estimated_minutes` (integer)
- `deadline` (timestamp, nullable)
- `priority` (enum: low, medium, high)
- `status` (enum: pending, in_progress, completed)
- `created_at` (timestamp)
- `completed_at` (timestamp, nullable)

The plan engine pulls pending tasks at generation time and the AI places them into focus blocks across days, respecting deadlines and the user's available focus windows.

### Template Tables

**workout_templates**
- `id` (uuid, primary key)
- `name` (text)
- `goal_tags` (text array: strength, cardio, fat_loss, maintenance, mobility)
- `equipment_tags` (text array: gym, home, bodyweight, dumbbells, barbell, kettlebell, bands)
- `duration_minutes` (integer: 15, 30, 45, 60)
- `level` (enum: beginner, intermediate, advanced)
- `intensity_score` (integer 1 through 10; for energy-aware selection)
- `content` (jsonb; the structured workout including exercises, sets, reps, rest periods)
- `source` (text; the data origin such as "ExerciseDB import" or "manual curation")

**recipe_templates**
- `id` (uuid, primary key)
- `name` (text)
- `cuisine_tags` (text array: italian, asian, mexican, american, mediterranean)
- `diet_tags` (text array: vegetarian, vegan, gluten_free, dairy_free, keto, paleo)
- `prep_minutes` (integer)
- `cook_minutes` (integer)
- `total_minutes` (integer)
- `difficulty` (enum: easy, medium, hard)
- `macros` (jsonb; calories, protein in grams, carbs in grams, fat in grams per serving)
- `servings` (integer)
- `ingredients` (jsonb array; each entry containing name, quantity, unit)
- `instructions` (jsonb array of step strings)
- `image_url` (text, nullable)
- `source` (text; "TheMealDB", "Edamam", "manual curation")

Templates are queryable for AI selection. The AI runs a small selection prompt with the filtered candidate set, picks one, and optionally modifies parameters (substituting proteins, scaling portions, swapping ingredients for dietary restrictions). The candidate set is pre-filtered by the application before the AI sees it, so the AI is choosing among ten to twenty pre-relevant templates rather than parsing the full library each call.

### Integration Tables

**integrations**
- `id` (uuid, primary key)
- `user_id` (uuid, references users.id)
- `provider` (enum: google_calendar, apple_calendar, google_fit, apple_health)
- `status` (enum: connected, disconnected, error)
- `access_token` (text, encrypted via pgsodium)
- `refresh_token` (text, encrypted via pgsodium)
- `expires_at` (timestamp)
- `last_synced_at` (timestamp, nullable)

**push_tokens**
- `id` (uuid, primary key)
- `user_id` (uuid, references users.id)
- `platform` (enum: ios, android, web)
- `token` (text; the APNs or FCM device token)
- `live_activity_token` (text, nullable; the Live Activity push token for iOS, separate from the device token)
- `device_id` (text)
- `created_at` (timestamp)
- `last_used_at` (timestamp)

Push tokens drive the APNs and FCM notifications. iOS Live Activity tokens are stored when the device subscribes to a Live Activity.

### Module-Specific Tables

**medications**
- `id` (uuid, primary key)
- `user_id` (uuid, references users.id)
- `name` (text)
- `dose` (text; for example "10mg" or "1 tablet")
- `frequency` (enum: daily, twice_daily, weekly, custom)
- `times` (time array; the specific times of day for reminders)
- `start_date` (date)
- `end_date` (date, nullable)
- `notes` (text, nullable)

Medications are user-entered reminders. They drive push notifications at user-specified times. They are not shared with any third party, not reported to insurance, and not synced to health platforms even when Apple Health integration arrives at V2.

**recurring_errands**
- `id` (uuid, primary key)
- `user_id` (uuid, references users.id)
- `title` (text)
- `frequency` (enum: weekly, biweekly, monthly)
- `day_of_week` (integer 0 through 6, nullable for non-weekly schedules)
- `estimated_minutes` (integer)

**bills**
- `id` (uuid, primary key)
- `user_id` (uuid, references users.id)
- `name` (text)
- `amount` (numeric, nullable; user-entered)
- `due_day_of_month` (integer 1 through 31, nullable)
- `frequency` (enum: monthly, quarterly, annually, one_time)
- `category` (text, nullable; rent, utilities, subscriptions, and so on)

### Completion and Audit Logging

**completion_log**
- `id` (uuid, primary key)
- `user_id` (uuid, references users.id)
- `block_id` (uuid, references blocks.id, nullable)
- `event_type` (enum: block_completed, block_skipped, block_rescheduled, energy_logged)
- `value` (jsonb; event-specific data)
- `logged_at` (timestamp)

The completion log drives the paid-tier quantified-self dashboards arriving at V1.5. Storage cost is low since each event is small, and the log is invaluable for analyzing user behavior patterns.

### What Is Intentionally Not in the Schema

Per Layer 2's killed-features list and founder direction in Layer 3 brainstorming, the schema deliberately excludes several tables that competing products might include:

There is no `streaks` or `badges` table, since gamification was rejected. There is no `friends` or `shared_plans` table, since social features were rejected. There is no `chat_messages` table, since the natural-language input surface is single-turn with no conversation state persisted. There is no plan version history table, since only the current state is stored. There are no bank account or financial transaction tables, since the finance module is reminder-based only and never connects to financial institutions.

## AI Architecture

The AI architecture executes the template-customization model with aggressive prompt caching and tiered model selection to hit the cost target of approximately $1.20 per active paying user per month (planning midpoint; $1.00 to $1.50 range, per §AI Cost Analysis below).

### Model Tiering

Claude Haiku 4.5 handles template selection from a pre-filtered candidate set (the input is the user's goal, energy, and equipment; the output is the chosen template identifier). It also handles natural-language command parsing (translating user statements like "move gym to 7pm" into structured plan edits), simple classifications (assigning block types to ambiguous calendar events imported from Google Calendar), and daily check-in question generation (producing one or two short questions based on morning context).

Claude Sonnet 4.6 handles daily plan synthesis, which is the core morning plan generation operation. It also handles weekly review reasoning during the Sunday planning session, contextual template adaptation when a template's standard parameters do not fit the user's situation, and the "what's not working" empathetic prompt that fires after three failed regeneration attempts.

Claude Opus is never used at runtime. Opus is reserved for development-time prompt design via Claude Code conversations.

### Prompt Caching Strategy

Anthropic's prompt caching feature allows marking portions of a prompt as cached. Cached portions cost ten percent of normal price on subsequent calls within the cache window of approximately five minutes. The architecture uses this aggressively.

Every plan-related AI call has the following structure. The first cache layer is large and stable: the system prompt establishing the butler voice, structural instructions, and output format rules. The second cache layer is medium-sized and stable per user: the user's base profile, archetype, and module configuration. The third cache layer is medium-sized and slowly changing: the relevant subset of the template library. The uncached portion is small: today's specific input including the energy slider value, calendar events for today, and pending tasks.

The uncached portion is typically a few hundred tokens (approximately 500 for today's specifics). The cached portion is several thousand tokens (approximately 7,500 across the system prompt, base profile, and filtered template subset). Output tokens dominate the per-call cost regardless of cache state because cache only discounts input. A warm-cache daily plan generation call costs approximately $0.034 (cache read 7,500 × $0.30/M = $0.0023 + uncached input 500 × $3/M = $0.0015 + output 2,000 × $15/M = $0.030). A cold-cache call costs approximately $0.060 (cache write 7,500 × $3.75/M = $0.028 + uncached input $0.0015 + output $0.030).

A Cloudflare Worker pre-warms the cache for users who have the sleep module enabled and an active alarm set, firing thirty minutes before the alarm time. This ensures the morning brief hits a warm cache for that cohort — lower cost and faster response. Users without the sleep module enabled (web users, iOS users who have disabled sleep, and all Android users at V1.5) receive cold-cache first-plan generation at approximately $0.060 per call rather than the warm-cache $0.034. The cache discount on warm calls saves approximately $0.026 per plan synthesis. The spend-monitor budget formula accounts for this blended hit rate.

### Streaming Strategy

Streaming responses are used for operations with long outputs where perceived latency wins are large. This includes daily plan synthesis (the user is actively watching the morning brief render) and the weekly review (the user is watching the review unfold during Sunday planning).

Batch responses are used for operations with short outputs where streaming overhead is not worth it. This includes quick edits like "move gym to 7pm," template selection (single identifier returned), and classification tasks.

The Vercel AI SDK handles both patterns transparently with a consistent API surface.

### Context Construction

The system prompt for plan synthesis is structured to maximize cache hits and minimize token usage. A high-level shape:

```
You are a calm, butler-tone life planner. [voice rules]
Output format: [structured plan JSON schema]
User context: [base profile from cache layer 2]
Available templates: [filtered template subset from cache layer 3]
Today's specifics: [calendar events, energy, tasks - uncached]
Generate today's plan.
```

The template subset is computed by the application before the AI call. Workouts are filtered to match the user's equipment and goal, recipes to match dietary restrictions and time tolerance, errands to those within geographic radius. This pre-filtering keeps the AI focused on a small, relevant candidate set rather than the entire library, which reduces tokens needed and improves output quality.

### Prompt Versioning

Prompts are stored as TypeScript constants in the @vesper/ai package, version-controlled in git. Each prompt has a version constant alongside it:

```typescript
export const DAILY_PLAN_SYNTHESIS_PROMPT = `...`;
export const DAILY_PLAN_SYNTHESIS_VERSION = 'v3-2025-11-20';
```

The version is logged with each AI call so retrospective analysis can correlate prompt versions to plan quality. Changes to prompts deploy with the rest of the code, which means tweaking a prompt requires a deploy but also means every change is tracked in git history.

All user-facing AI-generated copy passes through a butler voice gate before display. The gate has two layers. The first layer is a regex validation that strips em-dashes, exclamation points, emoji unicode ranges, and the strings "AI," "AI-powered," and any first-person reference Vesper makes to being artificial. The second layer is a lightweight Claude Haiku prompt that reviews any AI-generated string longer than 30 words against the butler voice spec (formal but human, short sentences, no gratitude language, no manufactured urgency, no gamification, no archaic phrasing). The gate runs in roughly 100ms and costs negligible additional API spend due to prompt caching on the voice spec itself. Strings that fail the second layer are regenerated with a corrective prompt appended. The voice gate is enforced in the @vesper/ai package and applies to every AI-generated string before it reaches the user.

### Fallback Handling

When an AI call fails (timeout, API error, or malformed response despite structured output requirements), the architecture executes a graceful degradation sequence. First, it retries with the same prompt after a 1.5 second delay. Second, if that retry fails, it retries with a simplified prompt (reduced context, larger model fallback if quality degrades) after a 3 second delay. Third, if both retries fail, the application serves the previous week's same-day template with a butler-tone apology line ("Working from your usual routine today — I'll have something fresh tomorrow"). No error code is ever exposed to the user. The completion log captures the fallback events so retrospective review can surface patterns.

### Cost Projection

Per-user-per-day economics at steady state with prompt caching active. Morning plan generation using Sonnet 4.6 with cached context costs approximately $0.034 per call for prewarmed users and $0.060 for cold-cache users (output tokens dominate; cache only discounts input). The prewarmed cohort is iOS sleep-alarm users only; all other users hit cold cache on first plan. Two to three mid-day Haiku edits at approximately $0.002 each total approximately $0.006. The evening check-in question via Haiku costs approximately $0.001. The weekly Sonnet 4.6 review on Sunday costs approximately $0.047, amortized to $0.007 per day. The daily total for a fully active prewarmed user is approximately $0.048; for a cold-cache user, approximately $0.074.

Realistic blended cost accounts for the mixed cohort. The honest planning figure is approximately $1.00 to $1.50 per active paying user per month, with $1.20 as the midpoint. This assumes 15 to 20 active days per month at a blended cold/warm daily cost. The earlier $0.35 to $0.50 monthly figure implied 5 to 7 active days per month, which describes a user already churning rather than an engaged user of a daily-use Life OS. An aspirational reduction to approximately $1.00 per month is plausible once prewarm coverage and output token discipline stabilize in production. The $0.30 figure that appeared in earlier drafts was derived from an understated output-token assumption and is not retained.

The free trial cost is a meaningful consideration. Trial users are essentially 100% cold-cache because the sleep-alarm prewarming pathway requires module configuration that does not happen in week one. The realistic daily cost during trial is approximately $0.074 (cold-cache plan generation plus Haiku edits and check-in). A fully engaged seven-day non-converter costs approximately $0.52 in AI spend; a partially engaged non-converter active on four or five of the seven days costs approximately $0.30 to $0.37. The planning midpoint is approximately $0.45 per non-converter. At a realistic six percent trial-to-paid conversion (five percent baseline plus an estimated one to two percentage points from the day-six soft prompt; B2C indie consumer subscription benchmarks from ChartMogul 2026 place opt-in trials at 8.9 percent average, with indie B2C below that), every paying customer is paired with approximately 15.7 non-converters. Trial AI cost across non-converters is approximately $7 per paying customer acquired through organic top-of-funnel. The subscriber becomes net positive on operational margin within the first billing cycle. The operational spend monitor uses the formula: max($5/day floor, $1.50 per active-plus-trial user per month divided by 30), with alerts at 80 percent (warning), 100 percent (action), and 200 percent (runaway bug panic).

## Authentication

Authentication uses Supabase Auth with three sign-in methods and no password requirement. Google OAuth supports web (standard browser flow) and mobile (via expo-auth-session). Apple Sign In is supported on both web and mobile, and is required by Apple's App Store rules when other social logins are offered on an iOS app. Email magic link is the third option, with Resend handling the delivery of the magic link email.

Session strategy uses Supabase's default JWT plus refresh token approach. The web application stores the JWT in HTTP-only cookies. The mobile application stores the JWT in expo-secure-store (which maps to the iOS Keychain and Android Keystore equivalents).

Two-factor authentication is not implemented at V1. The added friction is high and the security benefit is modest for a personal planning application without sensitive financial data or social attack surface. Two-factor authentication is reconsidered at V2 if user demand surfaces or if the threat model shifts.

## Integrations

### V1 Integrations

Google Calendar (read-only) is the calendar integration at V1. The OAuth scope is `calendar.readonly`. The plan engine reads the user's calendar to detect fixed meetings and events, then schedules around them. Writing back to the user's calendar is deferred to V1.5 to keep V1 safer and simpler. Token refresh is handled in the background; when refresh fails, a persistent banner prompts the user to reconnect while the plan continues to generate from cached calendar data.

### V1.5 Integrations

Google Calendar write access is added, so AI-placed blocks (gym, focus time, errands) appear in the user's Google Calendar. Apple Calendar gains both read and write support. Voice input is added via Whisper API for high-quality online recognition plus react-native-voice for an offline fallback that runs on-device.

### V2 Integrations

Apple Health (sleep data, workout history, heart rate variability) and Google Fit (Android equivalent) arrive at V2 as the paid-tier dashboards mature. Fitbit, Oura, and Whoop integrations follow. Outlook Calendar joins the calendar provider list. Instacart deep links are added (the shopping list can be opened in Instacart with items pre-filled), contingent on Instacart's deep link schema being available and functional.

### Integration Architecture

Each integration is implemented as a module in the `@vesper/shared/integrations/` namespace. Modules expose a uniform interface (`connect`, `disconnect`, `sync`, `getStatus`) regardless of the underlying provider. This makes adding new providers incremental and keeps the plan engine agnostic to integration details. OAuth tokens are stored encrypted at rest using Supabase's pgsodium extension and rotated according to provider expiry rules.

Stripe and Apple App Store Server Notifications webhooks both configure their signature timestamp tolerance to an effectively unbounded one-year window rather than the providers' default short tolerances. Both providers retry failed deliveries over multi-day windows (Stripe up to seventy-two hours, Apple up to several days for some notification types), and a tight timestamp tolerance would cause legitimate late-delivery retries to be rejected as expired. Replay protection is enforced exclusively through the `(provider, event_id)` unique constraint on the `subscription_events` table, which guarantees exactly-once processing regardless of how many duplicate deliveries arrive. The timestamp check on these webhooks is therefore non-load-bearing and is deliberately relaxed; replay-attack defense is the idempotency constraint, not the timestamp tolerance.

Apple Root CA certificates required to verify App Store Server Notification JWS payloads are pinned in code with both the current root and the upcoming root present in the pin set; this allows the application to continue verifying notifications across an Apple PKI rotation without an emergency deploy. The chat 086a Apple PKI Monitor worker checks the published Apple root certificate set on a weekly cadence and alerts the founder at the six-month-before-expiry threshold so that an updated pin set can be deployed well ahead of the rotation.

## Live Activity Infrastructure

The Dynamic Island integration is one of V1's most technically involved features. The lifecycle is server-driven via the iOS 17.2+ Live Activity Push Start mechanism.

### Token Storage

When a user enables notifications during onboarding, their device registers with Apple Push Notification service (APNs). Two tokens result. The standard APNs device token is used for regular push notifications. A separate Live Activity push token is issued when the device subscribes to a Live Activity. Both tokens are stored in the `push_tokens` table, encrypted at rest. Tokens are refreshed automatically whenever the user reinstalls the application or updates iOS.

### APNs Authentication

Authentication uses token-based APNs auth with a `.p8` key issued by Apple. The key is stored as an environment variable in Cloudflare Workers (encrypted at rest by Cloudflare's environment variable system). Token-based authentication is the modern standard and is simpler to operate than certificate-based authentication, which requires periodic certificate renewal.

### Server-Side Push Lifecycle

Live Activity transitions are device-handled wherever possible. ActivityKit's `staleDate` parameter on the Live Activity payload lets the iOS widget extension transition between blocks at the block boundary without requiring a server push for the cosmetic transition itself; the device knows when the current block ends from the `staleDate` and renders the next-block state from a payload the server already provided. Push is reserved for genuine state-change events: user actions (mark complete, reschedule), plan regeneration that changes upcoming block order, and the next-block hand-off when the gap between blocks is short enough that the previous activity's `staleDate` does not naturally hand off to the next.

A Cloudflare Worker handles the state-change cases on a five-minute cron cadence rather than every minute. The worker sweeps for blocks whose `start_time` falls within the next five minutes and which require a server-initiated next-block start (because the prior block has ended via user action ahead of schedule, or because the next-block payload was not pre-armed). For each such block it looks up the user's APNs Live Activity token, builds the Live Activity payload (block title, end time, next block preview), and sends the payload to APNs at `https://api.push.apple.com/3/device/<token>`. The minute-level cron of the prior design is no longer required because the device-side `staleDate` handles the per-minute countdown rendering and the cosmetic boundary transitions without server involvement.

Apple's Live Activity active duration cap is approximately eight hours, with another four hours in a dismissed-but-recoverable state. A single Live Activity cannot reasonably persist across a full waking day. The architecture handles this by managing one Live Activity per block lifecycle: an Activity starts when the block begins, ends when the block completes (manually or by time), and immediately starts the next block's Activity if the next block is within an appropriate window. This sidesteps the eight-hour cap by chaining short-lived activities rather than maintaining one long-running activity per day.

### Mobile-Side Implementation

The mobile application uses `expo-live-activities` for the iOS-side ActivityKit integration. When the application launches, it ensures the device has registered for Live Activity push tokens and reports them to the server. The Activity's user interface is implemented in SwiftUI (Apple requires this; Live Activities cannot be rendered from React Native), with the design tokens shared via constants exposed to the native module.

A small Swift codebase lives in the mobile application's prebuild-generated iOS project: the Live Activity widget extension, with three views (compact leading, compact trailing, expanded). All three views render the same block data with different layouts appropriate to each Dynamic Island state.

### Android Equivalent

Android has no Dynamic Island. The V1.5 equivalent is a persistent ongoing notification using `expo-notifications` with the `notificationCategoryAsync` API. The same server-side trigger logic applies; only the mobile-side rendering changes. A foreground service is required for true persistence on Android and is investigated at V1.5 build time.

## Realtime and Offline

### Realtime Sync

Supabase Realtime subscriptions are used for the plan view specifically. When a user edits their plan on the web application, the change writes to Postgres, and Supabase Realtime broadcasts the change to any subscribed clients. The mobile application, if open, receives the update within approximately one second.

Self-mutation filtering uses a `client_mutation_id` column on the blocks table to distinguish a device's own writes from genuine cross-device updates. Every block mutation API writes a UUID into the column at write time, the Realtime broadcast carries the column unchanged, and the originating device drops any broadcast whose `client_mutation_id` is present in the device's recent-mutation set (a thirty-second sliding window held in memory). Without this filter the originating device would re-render its own optimistic update from the broadcast, producing a brief visual flicker as the local optimistic state and the round-tripped server state stutter through one another. The filter is implemented in build chat 037.

The subscribed surfaces are the plan view (on any device the user is currently using) and the weekly planner when it is the active surface. Non-subscribed surfaces (which use simple refetch-on-focus) include settings, profile, module configuration, and billing.

Realtime sync adds minor battery cost on mobile due to maintaining a websocket connection. The plan view's "magical sync" benefit is worth this tradeoff for the core surface. Other surfaces do not need the level of immediacy that Realtime provides, and refetch-on-focus is a simpler implementation.

### Offline Behavior

Per Layer 2's locked behavior, the offline experience is: read-only cached plan when offline, queued edits with last-write-wins conflict resolution on reconnect.

TanStack Query handles the cache layer transparently. When the application starts, the plan view loads from cache instantly while a background refetch updates with server data. If the user is offline, the cached plan remains visible without error.

Mutations (edits) that happen offline queue in a custom mutation queue (TanStack Query's `mutationCache` with custom retry logic). On reconnect, the queue flushes in order. Conflict resolution is server-timestamp-wins: if the server has a newer version of the same field, the offline edit is rejected and the user sees a toast indicating the conflict ("Your other device edited this — refreshed").

PowerSync was considered as a more robust offline-first solution but rejected for V1. The additional complexity is not warranted given the relatively simple edit patterns (move blocks, mark complete, add items). TanStack Query plus a custom mutation queue is sufficient.

## Hosting and Infrastructure

### Vercel

The web application is deployed on Vercel Pro ($20 per month), active from the start of the build phase. The Hobby tier prohibits commercial use under Vercel's Terms of Service; Pro is required from day one of any commercial project. The Pro tier covers 1TB bandwidth per month, 1 million serverless function invocations per day, and unlimited deployments, with significant headroom through realistic V1 volumes.

### Supabase

Supabase provides the database, authentication, realtime sync, and storage. The free tier includes 500MB of database storage, 1GB of object storage, 2GB of egress per month, and support for up to 50,000 monthly active users. The free tier pauses projects after 7 days of inactivity, which is not relevant once the application is in production use.

Upgrade to the Pro tier ($25 per month) is triggered at approximately 500 active users or when the database approaches the 500MB limit (the template library plus accumulated user data combined). The Pro tier includes daily backups, point-in-time recovery (7 days), and significantly higher resource limits.

### Cloudflare Workers

The free tier includes 100,000 requests per day and 10ms of CPU time per request. The cron worker firing every five minutes consumes 288 requests per day. Push notification dispatch consumes additional requests proportional to active users. The free tier is comfortable through realistic V1 user volumes.

### Apple Developer Program

$99 per year. Required for App Store distribution of the iOS application. No free tier alternative exists.

### Domain

Approximately $15 per year, paid annually. The specific TLD selection per the warm-dark mood and the "thematically-appropriate alternative TLD" direction from Layer 1 happens during Layer 4 work or pre-launch.

### Operating Cost Posture

The operative measure is per-paying-subscriber margin, not annual cost ceilings or growth-tied projections. Infrastructure costs remain modest through realistic V1 volumes: Supabase, Cloudflare, Sentry, PostHog, and Resend remain on free tiers. Vercel is $20 per month (Pro tier, required from launch). Apple Developer Program is $99 per year. Domain registration is approximately $15 per year. Termly templating runs $120 to $360 per year depending on tier. AI cost scales linearly with active paying users at approximately $1.20 per user per month, recovered well within the first billing cycle through Apple SBP or Stripe net contribution. Projected scaling thresholds tied to specific user counts are not modeled because they do not drive any decision: if per-subscriber margin is positive and conversion clears approximately five percent, scale is self-funding.

## Privacy and Compliance

### Regulatory Posture

The application is CCPA-compliant from launch. California represents a meaningful portion of the US user base, and CCPA defines the floor of acceptable privacy practice. Users have the right to know what data is collected (the privacy policy lists categories explicitly), the right to delete their data (via the in-application account deletion flow, with hard delete occurring after a 30-day grace period), the right to export their data (a JSON dump is available on request), and the right to opt out of the sale of their data (the application does not sell data, so this right is automatically satisfied).

GDPR is not strictly required given the US-only V1 launch, but the architecture supports GDPR-equivalent rights from day one. This eases eventual UK and EU expansion at V3 or beyond.

The privacy policy and terms of service are generated using Termly at the Pro tier (~$20-$30 per month), customized for the product's specifics, and reviewed by counsel (~$500-$1,500 one-time) before public launch. Termly subscription activates approximately four weeks before launch, not during the build phase.

### Data Encryption

Data at rest is encrypted by Supabase using AES-256 across all database and object storage. Data in transit uses TLS 1.3 with no exceptions.

Application-level encryption is layered on top for OAuth tokens specifically (Google Calendar refresh tokens, eventual Apple Calendar tokens). The pgsodium extension stores tokens as encrypted columns, with the decryption key held by the server.

Medications and finance data are stored with standard Supabase encryption (no additional application-level encryption layer). Row-level security ensures only the user's own authenticated session can read their own data. This is sufficient at V1; application-level encryption for these data types is reconsidered at V2 if the threat model evolves.

### Data Deletion

The user-initiated deletion flow follows a deliberate sequence. The user clicks "delete account" in settings. A confirmation modal appears with three options: delete immediately, cancel and keep, or export then delete. On deletion confirmation, the `deletion_requested_at` field is set on the user row, the account enters an archived state, and all application surfaces show a banner indicating "your account is scheduled for deletion in 30 days." During the 30-day grace period, the user can recover by signing in and clicking "cancel deletion." After 30 days, a Cloudflare Worker hard-deletes the user row and cascades to all related tables: profiles, plans, blocks, tasks, integrations, push tokens, medications, completion logs, recurring errands, and bills.

Anonymized aggregate analytics (PostHog events with user_id stripped) are retained for product analysis. This retention is disclosed explicitly in the privacy policy.

### AI Training Data

The Anthropic API does not use API calls for model training by default. This is explicitly stated in Anthropic's commercial terms. The privacy policy includes a clear statement: "We send your plan-related data to Anthropic's Claude API to generate your daily plans. Anthropic does not use this data to train their models."

### Medication Privacy

Per founder direction, medications are user-entered reminders that stay on the user's account exclusively. They drive push notifications at the user-specified times. They are not shared with any third party, not reported to insurance, not synced to health platforms even at V2 when Apple Health integration arrives. Medication data is treated as the most sensitive data in the application, with row-level security strictly enforcing that only the user's own session can read or modify medication records.

### App Privacy Disclosures

Apple's App Store requires accurate App Privacy "nutrition labels." The application discloses the following categories of data collection: identifiers (email, user ID); health and fitness data (workout records and fitness data when the fitness module is enabled); sensitive information (dietary information from the nutrition module and medical information from the medication module); diagnostics (crash data and performance data via Sentry); and usage data (product interaction events via PostHog). All disclosures are accurate and kept current as the application evolves.

## Observability and Operations

### Error Tracking

Sentry captures errors from three sources. The Next.js web application and API routes report via `@sentry/nextjs`. The Expo mobile application reports via `sentry-expo`. The Cloudflare Workers report via the Sentry Cloudflare Worker SDK.

Errors are tagged with the user_id (where the user is authenticated), the operation that failed, the prompt version (for AI calls), and the platform. The free tier covers 5,000 errors per month, which is sufficient at V1 user counts.

### Product Analytics

The events tracked at V1 include: signed up, onboarding step completed (one event per step), onboarding completed, first plan generated, plan viewed, block completed, block skipped, plan regenerated, module enabled, module disabled, trial reminder shown, subscription started, subscription canceled, cancellation reason captured, referral attribution (fired at signup when a referral URL parameter is present), and referral conversion (fired at paid conversion for users with a referral attribution on their row).

Funnel analysis runs across these events to surface trial-to-paid conversion rate and monthly paid churn, which are the operative post-launch measures. Specific signup or paying-subscriber count targets are not used as planning anchors because they are not within direct founder control and do not drive technical decisions.

Layer 6 specifies three primary PostHog funnels built on or before launch day: signup-to-activation (signed_up → onboarding_completed → first_plan_generated → block_completed within 24 hours), activation-to-trial-to-paid (signed_up → block_completed → trial_reminder_shown → subscription_started within 7 days), and trial-to-paid-to-D30-retention (subscription_started → plan_viewed on day 7 → plan_viewed on day 30 → subscription_status='active' on day 30).

### Performance Monitoring

Vercel Analytics (included with the Vercel Pro tier) captures Core Web Vitals and page-level performance for the web application. PostHog session replays are available during the closed beta phase for diagnosing friction in specific user sessions.

### Logs

Supabase logs capture database queries, authentication events, and Realtime activity. Vercel logs capture API route requests and serverless function executions. Cloudflare Workers logs capture cron worker activity. All three log sources are free with their respective platforms.

Centralized log aggregation services (Logflare, Better Stack, Axiom) are not adopted at V1; the platform-native log surfaces are sufficient. Centralized aggregation is reconsidered at V2 if multi-platform correlation becomes a frequent debugging need.

## Open Items From Layer 3

The following items are intentionally deferred or flagged for resolution outside Layer 3.

The specific TLD for domain registration is deferred to Layer 4, where the name itself is resolved. Domain purchase happens during Phase 3 (Environment Setup).

The choice between Termly and alternative privacy policy tooling is a tactical decision deferred to Phase 3. Termly is the working assumption; if a cheaper or free templated generator covers the same regulatory ground, it is substitutable.

The exact pricing tier feature splits (which dashboards are paid versus free, which level of AI customization is paid versus free) are deferred to Layer 5 (Business and Monetization).

The Live Activity SwiftUI widget visual design is deferred to Layer 4. The data model and lifecycle are locked here; the visual rendering inherits the warm-dark design tokens specified in Layer 4.

## What Was Considered and Rejected

The following alternatives were considered during Layer 3 and rejected, recorded so they are not revisited.

Multi-provider AI abstraction at V1 was rejected. Anthropic-only at V1 keeps the architecture simple. The Vercel AI SDK provides enough abstraction to make a future swap to multi-provider cheap if needed.

OpenAI as the primary AI provider was rejected. The product's voice and tone alignment is stronger with Claude, and the prompt caching feature on Anthropic's side delivers material cost savings.

PowerSync for offline-first sync was rejected for V1. TanStack Query plus a custom mutation queue is sufficient for the relatively simple edit patterns. PowerSync is reconsidered if cross-device conflict patterns become more complex post-launch.

Two Supabase projects (separate staging and production) was rejected for V1. One project with Vercel preview branches against the same database (with schema-namespaced isolation) is the V1 norm. A separate staging environment can be added pre-launch if confidence requires it.

Bare workflow for React Native was rejected. Expo Prebuild provides equivalent native access with significantly faster iteration. Live Activity needs are met by the prebuild approach.

Self-hosted Supabase was rejected. The hosted Supabase free tier is operationally simpler and is adequate at V1 scale.

Certificate-based APNs authentication was rejected in favor of token-based authentication using a `.p8` key. Token-based authentication is the modern standard and is simpler to operate (no periodic certificate renewal required).

Full offline-first CRDT sync using Y.js or Automerge was rejected as overkill for the V1 edit patterns.

Centralized log aggregation services (Logflare, Better Stack, Axiom) were rejected for V1. Platform-native logs are sufficient.

Storing AI prompts in a database table for live editing was rejected. Code-stored prompts with version constants are easier to track, easier to roll back, and better suited to a solo-founder workflow where the same person edits both code and prompts.

Multi-region Supabase deployment was rejected. The US-only V1 launch means single-region (US East) deployment is appropriate. Multi-region deployment is reconsidered at international expansion in V3.

Local on-device AI (Llama, Phi-3, Gemma running on the user's phone) was rejected. Quality is materially lower than Claude for the complex reasoning required for plan synthesis, and on-device inference imposes significant battery drain. The Anthropic API with aggressive prompt caching and model tiering is the chosen cost-containment strategy.

## What's Next

**Layer 4: Experience and Identity.** This layer translates the warm-dark mood direction locked in Layer 1 into concrete design system tokens. Specific deliverables include color hex codes executing against the espresso, cream, and bronze direction; typography selections (families, weights, sizes); the spacing scale, border radii, and motion principles; iconography style; logo concept and variations (primary, secondary, monochrome, favicon); marketing voice and tone with do/don't examples; visual language for marketing materials (web hero patterns, social post templates, screenshot framing); the onboarding flow designed screen by screen with copy in the butler voice; notification strategy with timing windows and quiet hours and restrained defaults; empty states and error states designed for every major surface; accessibility baseline (WCAG target, contrast minimums, screen reader support, motion-reduction support, keyboard navigation); and the Live Activity SwiftUI widget visual design that renders against the data model locked in Layer 3.

Layer 4 mixes Opus for design direction and philosophy with Sonnet for token-level execution. Begin the next chat by pasting the Brainstorm Master document along with the Layer 1, Layer 2, and Layer 3 documents for full context.
