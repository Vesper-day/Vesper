# @vesper/ai

Anthropic SDK wrapper, prompt constants, and the butler voice gate for Vesper.
All AI calls in the monorepo route through this package — apps never call the
Anthropic SDK or the Vercel AI SDK directly.

Authoritative reference: `docs/TECHNICAL_SPEC.md` §5.

## Models

Defined in `src/client.ts` (do not duplicate elsewhere):

| Constant        | Model id             | Use                                            |
| --------------- | -------------------- | ---------------------------------------------- |
| `MODELS.HAIKU`  | `claude-haiku-4-5`   | classification, template selection, NL parsing |
| `MODELS.SONNET` | `claude-sonnet-4-6`  | plan synthesis, weekly review, freeform copy    |

`claude-opus-*` is never called at runtime.

## Entrypoint convention (§5)

Three thin wrappers over the Vercel AI SDK. Each applies the call-type cache
control, records cost via the cost tracker, and carries a voice-gate seam.

| Wrapper          | Default model | Purpose                          |
| ---------------- | ------------- | -------------------------------- |
| `streamText`     | Sonnet        | streaming daily-plan synthesis   |
| `generateObject` | Haiku         | structured (schema'd) output     |
| `generateText`   | Sonnet        | freeform copy                    |

Each accepts an optional `model` and `callType`; defaults follow the table above.
Import `MODELS` from the package to override the model explicitly.

## Prompt-versioning pattern

Every prompt ships as two sibling constants — the prompt body and a version string
in the compact format **`v{N}-{YYYYMMDD}`** (e.g. `v1-20260601`). This compact form
supersedes the build plan's `v{N}-{YYYY}-{MM}-{DD}`. The shapes are typed in
`src/prompts/types.ts` (`PromptVersion`, `VersionedPrompt`); the prompt files under
`src/prompts/*.ts` already follow the convention.

## Cache configuration

`src/cacheConfig.ts` centralizes the cache-TTL strategy for the wrappers. Per §5,
**both** Sonnet daily-plan synthesis **and** all Haiku operations use the Anthropic
default **5-minute ephemeral** cache (`cache_control: { type: 'ephemeral' }`). The
1-hour TTL is rejected. Every call-type therefore resolves to the same 5-minute
default; the keyed map exists so future per-call-type divergence has one home.
(`src/gate.ts` applies the same ephemeral default inline and is left unchanged.)

## Cost tracking

`src/cost/tracker.ts` exposes `trackCost(model, inputTokens, outputTokens, cachedTokens?)`.
It computes `cost_usd` inline (rates from §5), emits one structured console line, and
returns the breakdown. `cachedTokens` is treated as cache-READ tokens; cache-WRITE
cost is not separately tracked.

**Deferred DB write:** durable per-call logging to `completion_log` is **blocked**.
`completion_log.event_type` is `completion_event_enum NOT NULL` (TECHNICAL_SPEC.md §18)
and `'ai_call'` is not a member of that enum, so the INSERT cannot be made. No row is
written until a future migration adds `'ai_call'` to `completion_event_enum`. This
package has no `@vesper/db` dependency.

## Voice-gate seam

Each wrapper contains a clearly-marked voice-gate seam: a no-op pass-through where the
future voice-gate chat will plug in. The wrappers deliberately do **not** import
`runVoiceGate` — the real gate gains a `source` parameter in a later chat, and wiring
it now would lock a signature that is going to change.
