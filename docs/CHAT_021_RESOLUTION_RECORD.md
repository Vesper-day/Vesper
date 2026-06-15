# Chat 021 — Resolution Record

Context Builders + Cache Wiring (`@vesper/ai`). Non-obvious decisions recorded
per the chat brief. All shapes verified against the live `.ts` / `.sql` files
(CHAT_111_RESOLUTION_RECORD.md is authoritative for post-111 shapes).

---

## (a) Disposition of `packages/ai/src/context.ts`

**Deleted.** It was a superseded pre-111 stub: a FLAT `PlanContext` type +
`buildPlanContext(userId)` that threw "not yet implemented".

Importer audit (grep across repo):
- The ONLY re-export was `packages/ai/src/index.ts` lines 3-4
  (`export { buildPlanContext } from './context'` / `export type { PlanContext }`).
- `packages/ai/eval/runPlanEval.ts:54` mentions `buildPlanContext` in a **comment
  only** (no import).
- No app, route, worker, or test imported either symbol.

Action: deleted `context.ts`; repointed `index.ts` to the new `context/`
directory as the single source. New `PlanContext` is an AI-SDK `CoreMessage[]`
(message array), not the old flat object — no collision remains.

## (b) snake_case doc phrasing → real camelCase Zod; location as an object

The build-plan / TECHNICAL_SPEC phrasing (`diet_tags`, `cooking_time_max`,
two scalar lat/lng, a `preferences` sub-object) is **stale**. The live post-111
Zod is camelCase and `location` is an OBJECT:
- `BaseProfile`: `wakeTarget`, `bedtimeTarget`, `location: { lat, lng }`,
  `notificationPreferences: { morningKnockEnabled, alarmEnabled }` — all REQUIRED,
  top-level. No `preferences` sub-object (confirmed absent in the live file).
- `ModulesEnabled.sleep` = `{ enabled }` only; `nutrition.dietTags` /
  `nutrition.cookingTimeMaxMinutes` are camelCase.

`UserContext` uses these real shapes. `buildUserContext` validates the stored
JSONB with the unchanged `BaseProfileSchema` / `ModulesEnabledSchema` from
`@vesper/db` (not edited here) and throws a descriptive error on failure
(post-onboarding rows must satisfy the now-strict contract, 111 §5).

## (c) `timezone` / `archetype` / `location` sourced from the USERS row

`timezone` and `archetype` are `users` columns (not in `base_profile`). The
top-level `UserContext.location` mirrors `users.location_lat` / `location_lng`
(`numeric`, NULLABLE web fallback, 111 §2): both non-null → `{ lat, lng }`
(numeric strings coerced via `Number`, NaN-guarded), else `null`. The strict
always-present pair also lives in the parsed `baseProfile.location`.

## (d) Smoke test = mocked Drizzle (no live Supabase)

All unit tests are offline: a minimal chainable Drizzle stub
(`select().from().innerJoin().where().limit()`) is injected via an optional
trailing `db?: Database` parameter on `buildUserContext` / `buildPlanContext`.
No Docker, Supabase, network, or `ANTHROPIC_API_KEY`. `planContext.test.ts`
asserts `globalThis.fetch` is never called (no AI/network call).

## (e) `completion_log` durable insert is BLOCKED (reported, not invented)

`cacheObservability.recordCacheObservation` logs to **Sentry breadcrumbs + a
structured console line**, but does **NOT** insert into `completion_log`.

Reason: `completion_log.event_type` is `completion_event_enum NOT NULL`
(migration `20260601000001`), whose members are `block_completed`,
`block_skipped`, `block_rescheduled`, `energy_logged`, `plan_generated`,
`plan_regenerated`, `plan_fallback_served`. **There is no cache hit/miss member.**
The columns exist, but no enum value fits a cache observation. This is the same
wall `cost/tracker.ts` hit for `ai_call`; we mirror that decision: do not invent
an enum value/column. When a future migration adds a cache event
(e.g. `plan_cache_observed`), wire the INSERT in `recordCacheObservation`
(keyed by `userId`, observation in `value`).

## (f) New `@vesper/ai` dependencies (flagged)

`@vesper/ai` previously had no DB or Sentry dependency. Added:
- `@vesper/db` (workspace:*) — Drizzle client, `withUser`, tables, Zod schemas.
- `drizzle-orm` (^0.38.0, matches `@vesper/db`) — `eq` for the user-scoped query.
- `@sentry/nextjs` (^8.0.0, matches `@vesper/shared`) — breadcrumb sink.

No new dependency cycle: `@vesper/db` does not depend on `@vesper/ai`
(ai→db→shared is a DAG). ⚠️ **Flag:** `@sentry/nextjs` is Next-coupled; `@vesper/ai`
also targets Cloudflare Workers (the chat-071 prewarm worker consumes
`cacheObservability`). The breadcrumb call is wrapped in `try/catch` and is a safe
no-op while Sentry is uninitialized (per `shared/api/route.ts`), but if the Worker
bundle rejects `@sentry/nextjs`, chat-071 should swap the sink for a Worker-safe
Sentry transport. Out of scope here.

---

## Offline verification (this chat)

| Check | Result |
|---|---|
| `pnpm --filter @vesper/ai test` | ✅ 74 passed, 1 skipped (6 files) |
| `pnpm type-check` (10 tasks) | ✅ exit 0 |
| `pnpm lint` (6 tasks) | ✅ no warnings or errors |
| `@vesper/ai` build (via turbo) | ✅ tsc clean |

No new env vars, no new migration → `.env.example` and migration-pair gates N/A.
The pre-existing `@vesper/web` `@types/react` 18-vs-19 build skew is unrelated to
this DB/AI-only change.
