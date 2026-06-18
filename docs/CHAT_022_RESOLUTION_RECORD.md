# Chat 022 Resolution Record — synthesizePlan + three-step fallback chain

Scope: `packages/ai` (daily-plan synthesis) plus ONE web API route
(`GET /api/v1/health/circuit-breaker`). Backend / AI-layer only. The model that
the CODE calls at runtime is `claude-sonnet-4-6` (literal string via
`MODELS.SONNET`).

## What shipped

- `synthesizePlan(userId, planDate, energyScore, options?)` — async generator
  streaming `DailyPlanChunk` (= `DeepPartial<DailyPlan>`) and running the §5
  three-step fallback chain. Reads breaker state once, reads pending tasks for
  real Layer-4 context, assembles full context, delegates to the chain.
- `runFallbackChain` — initial → Step 1 → Step 2 → Step 3 (fallback).
- `buildSimplifiedPlanContext` — Step-2 trimmed context.
- Per-user circuit breaker (Upstash sorted set).
- `emitPlanCompletion` + `PlanCompletionLogValueSchema` — observability sink.
- `generatePlanFromContext` — single-attempt seam for the eval harness.
- `GET /api/v1/health/circuit-breaker` — per-user, authed, read-only.

## Locked decisions, as built

1. **Delays (§5 wins).** Initial canonical call (no delay) → Step 1 identical
   retry after **1.5s** → Step 2 simplified retry after **3s** → Step 3 fallback.
   `fallback_step` numbering: omitted = initial call succeeded; `1` = succeeded on
   the 1.5s retry; `2` = succeeded on the 3s simplified retry; `3` = served fallback.
2. **Circuit breaker is PER-USER** (Upstash), superseding §5's "process-level"
   wording. Keyed by `user_id`, 5-minute sliding window (`WINDOW_MS=300_000`),
   opens at `THRESHOLD=3` failures in the window, auto-closes once the newest
   failure ages out (no new failure needed). Open ⇒ skip Steps 1–2, go straight
   to Step 3 for that user only, with `error_code='breaker_open'` and NO Anthropic
   call. Rationale: one user's Anthropic trouble must never trip synthesis for
   everyone; a global breaker would do exactly that.
3. **Observability sink — no Zod value union existed.** completion_log has no
   pre-existing Zod value union (the cache observer and cost tracker both report
   this and INSERT nothing). So Decision 3 is realized as a **standalone
   `PlanCompletionLogValueSchema`** in `@vesper/ai`: validate the value object,
   then raw parameterized INSERT into `completion_log` (mirroring
   `apps/web/.../energy/logEnergy.ts`), `event_type` taken from the EXISTING
   `completion_event_enum`. **No new table, no migration.**
4. **Generate-only boundary.** READS are fine (breaker, pending tasks, user
   context, daily_plans EXISTS). WRITES are forbidden here — no plan row, no
   blocks, no partial state, no idempotency lock, no chat-025 import. The
   route/chat-025 persists.
5. **Step 3 stays hardcoded.** `getFallbackPlan(archetype)` from
   `buildUserContext`. Prior-plan substitution is deferred to the route/chat-025
   (see Deferrals).
6. **Apology constant** (gate-clean, no em-dash):
   `APOLOGY_LINE = "Working from your usual routine today. I'll have something fresh tomorrow."`
   Prepended into the fallback plan's `note`. Verified idempotent through the
   voiceGate Layer-1 regex floor.

## Found defect (recorded, not fixed here)

`packages/db/src/schema/analytics.ts` completionLog ORM model is **STALE** vs the
applied table: the model declares `event_name` / `occurred_at` and omits
`event_type`; the real `completion_log` columns are
`(user_id, event_type completion_event_enum, value jsonb, logged_at, …)`. We did
NOT touch the model (out of scope; same constraint logEnergy.ts documents). The
durable fix is chat-006 `drizzle-kit pull` regenerating it. Until then we INSERT
via raw parameterized SQL against the migration-defined columns, exactly as
`logEnergy.ts` does.

## Deviations / precedents

- **Breaker uses a LOCAL `Redis.fromEnv()` lazy singleton** (not a shared infra
  client). This follows the `apps/web/middleware.ts` precedent: lazy `fromEnv()`
  so module eval never touches Redis, and the client is injectable for offline
  tests (`__setBreakerRedisForTests`).
- **`streamObject`, not the spec's `streamText` + `toDataStreamResponse`.** The
  spec's `streamText` is the ROUTE's HTTP concern (chat 025). `streamObject` is
  the correct primitive for a structured, Zod-validated `DailyPlan` generator:
  it gives `partialObjectStream` for live chunks and `.object` for the validated
  result. The route layer will own the HTTP streaming response.

## Deferrals (flagged)

- **Calendar:** no calendar read path is built this chat. `synthesizePlan` passes
  `calendarEvents=[]` to `buildPlanContext`. A real calendar read is a later chat.
- **Prior-plan substitution for Step 3:** deferred to the route/chat-025. Step 3
  remains the hardcoded archetype-default plan. Reconstructing a prior plan would
  balloon DB surface inside a generate-only module.

## Event-name contract (for chat-096 analytics)

`completion_log.event_type` emitted by this chat (all members of the existing
`completion_event_enum`):

- `plan_generated` — first plan of the day for `(user_id, plan_date)`.
- `plan_regenerated` — a `daily_plans` row already exists for `(user_id, plan_date)`.
- `plan_fallback_served` — the fallback plan was served (Step 3).

`value` payload (`PlanCompletionLogValueSchema`):
`{ plan_date, model, cache_hit, input_token_count, output_token_count, latency_ms,
fallback_step?(1–3), error_code?, failure_reason? }`. `model` is always
`"claude-sonnet-4-6"`; `cache_hit` derives from
`classifyCacheOutcome(extractCachedTokens(providerMetadata))`.

## 020-harness re-point

`eval/runPlanEval.ts` now drives the real `generatePlanFromContext` (single-attempt
seam) with a message array built inline from each fixture's `profile` /
`runtimeInputs` (the `_context` seam preserved; no live DB). `stubSynthesizePlan.ts`
is left in place. The harness is NOT run live here — it needs real Sonnet + an
`ANTHROPIC_API_KEY`, which is a separate hand-run.

## Eval result

DEFERRED — the eval is a live-Sonnet hand-run (requires `ANTHROPIC_API_KEY`), to be
executed separately. Not run in this session.
