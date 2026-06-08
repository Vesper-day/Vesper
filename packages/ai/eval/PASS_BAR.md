# Daily Plan Synthesis — Pass Bar

A prompt version ships only if it meets **all four** criteria below. Failing any one means the
version is not shipped.

## (a) Structural validity — 100%

Every one of the 10 fixtures in `fixtures/` must produce a `DailyPlan` that parses against
`DailyPlanSchema` (`@vesper/shared`) on the first attempt. Measured by `pnpm eval:plan`, which
prints `N/10 fixtures parsed against DailyPlanSchema`. N must equal 10.

## (b) Voice-gate violations — zero

Every `title`, `details` string field, and `note` across all 10 outputs must pass
`packages/ai/src/voiceGate.regex.ts` with zero matches. No em-dashes, exclamation points,
emoji, AI self-reference, or gratitude/gamification/filler-affirmation language.

## (c) Mean rubric score — >= 4.0 / 5.0

Across a manual 20-sample review (using `SCORING_RUBRIC.md`), the mean of (criteria total / 3,
normalizing the 0-15 rubric total to a 0-5 scale) must be >= 4.0.

## (d) p95 plan-generation latency — < 12 seconds end-to-end

Measured from request dispatch to a fully validated `DailyPlan`, across the same 20-sample
review, the 95th-percentile latency must be under 12 seconds.

---

## Status of this chat (Chat 020)

This chat establishes criteria (a) and (b) — both are mechanically measurable today, against
the stub (`stubSynthesizePlan.ts`, which delegates to `getFallbackPlan`). The stub never
exercises the real synthesis prompt, so:

- Criterion (c) is **not yet measurable**: scoring the stub's hardcoded fallback plans would
  evaluate Chat 018's archetype defaults, not a prompt's output. The rubric and the 20-sample
  review process are established here so Chat 022 can apply them immediately once the real
  `synthesizePlan` lands.
- Criterion (d) is **not yet measurable**: the stub resolves synchronously with no network
  latency. The harness's output-directory and timing-capture structure is in place; Chat 022
  wires in the real timing measurement.

Chat 022 re-runs `pnpm eval:plan` against the real `synthesizePlan` and applies (c) and (d)
for the first time.
