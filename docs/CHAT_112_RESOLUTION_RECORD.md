# Chat 112 Resolution Record

**Scope:** §5.8 AI fallback re-scope + §5.9 / CD-flag F4 chat-019 prompt audit (read-checkpoint, consumed by chat 022). Build-track, offline.

**Branch:** `chat-112-fallback-rescope-prompt-audit` (off `origin/main` @ `f1d804e`).

---

## Objection-first (stated before concluding)

1. **Fallback JSON path.** PHASE_4_BUILD_PLAN's literal text could send a reader to `packages/ai/src/fallback/*.json`. Verified against the live tree first: `git ls-files | grep fallback` confirms the six JSONs live at `packages/ai/src/fallback/plans/`. No files were created at the wrong path; the files were NOT missing.
2. **F4 vs pre-111 staleness.** F4 ("does the prompt condition on modulesEnabled") and Task C ("does the prompt reference 111-removed paths") are two distinct questions answered against the SAME single read of `dailyPlanSynthesis.ts`, recorded as two separate verdicts below — not conflated.

### Path-string disagreement (FLAGGED)

The prompt's authoritative-sources list named `CHAT_111_RESOLUTION_RECORD.md`, `PRD.md`, `LAYER_2_PRODUCT_SCOPE.md`, `LAYER_4_EXPERIENCE_IDENTITY.md` as if at repo root. They actually live under `docs/`. Real paths used; this record is written to `docs/` to match `docs/CHAT_111_RESOLUTION_RECORD.md`.

---

## 1. §5.8 — Fallback re-scope

### Approach chosen: (a) CONTENT FIX

Revised the six JSON files to a minimal day = **Work + Tasks + Calendar skeleton + exactly ONE representative lifestyle module + a structural sleep close.**

**Why (a), not (b):** `getFallbackPlan(archetype, planDate)` (and its only current caller, the chat-020 eval stub `synthesizePlan`) receives **no `modulesEnabled`**. Module-aware composition (b) would require changing the function signature to accept the caller's enabled-module set, building a block-composition engine, and updating callers — runtime-synthesis behaviour that is chat-022's domain, and a cross-boundary change that violates the one-coherent-unit-of-work rule. The fallback is architecturally an **archetype-keyed static default** served in degraded mode (LAYER_4 §"Degraded Mode Banner"); keying on archetype is the existing, intended design. (a) is contained, matches that design, and is clearly not worse. (b) rejected.

### Per-archetype representative-module table (all six — judgment calls for human review)

| Archetype | Representative lifestyle module | Rationale |
|---|---|---|
| `nine_to_five` | **fitness** | After-work strength training is the prototypical lifestyle layer for a desk-bound office professional. |
| `remote` | **nutrition** | Home kitchen access makes structured meal planning the natural remote-work lifestyle domain. |
| `student` | **nutrition** | A budget meal routine (breakfast/lunch/dinner) is a defining day-to-day student concern. |
| `athlete` | **fitness** | Training is the archetype's defining domain (the one obvious choice). |
| `founder` | **fitness** | Deliberate training is the canonical counterweight habit to a high-intensity founder schedule. |
| `mixed` | **errands** | The errands/home catch-all best represents a non-specialized, varied life. |

Distribution: fitness ×3, nutrition ×2, errands ×1. Plausibility was prioritized over module coverage; sleep/medication/finance are not represented as the *elective* module in any default (they remain reachable via synthesis, which serves the user's actual module).

### Key judgment call — sleep block vs sleep module (FLAGGED for review)

The lifestyle-module toggle set is `{Fitness, Nutrition, Sleep, Errands, Medication, Finance}` (LAYER_2 line 179), so Sleep is technically gateable. To keep a sane day shape while honouring "exactly ONE elective lifestyle module," this re-scope treats:

- the **`sleep` *block*** (the rest period that bounds the day, e.g. `22:30 → 06:30`) as a **structural day-boundary** present in all six plans — everyone sleeps, and it matches the synthesis prompt's "end with the sleep block"; and
- **sleep-*module* content** (the wind-down routine — LAYER_2 line 193 "The sleep module surfaces the wind-down routine if enabled" — plus sleep targets/tracking) as gated content that appears only when Sleep is the chosen module.

Consequence: all six plans end with a bare `sleep` block and carry **no wind-down block** (wind-down = sleep-module content, and none of the six elect Sleep). The rejected alternative — treating the sleep block itself as gated — would yield plans with no sleep block at all (odd day shape, and contradicts the live prompt). Flagged here so a human reviewer can overrule if Sleep is meant to be fully gated.

### Block inventory after re-scope

| Plan | Block types (in order) | Elective module |
|---|---|---|
| nine_to_five | custom, commute, work, work, **fitness**, sleep | fitness |
| remote | custom, **nutrition**, work, **nutrition**, work, **nutrition**, sleep | nutrition |
| student | custom, **nutrition**, commute, work, **nutrition**, work, **nutrition**, sleep | nutrition |
| athlete | custom, **fitness**, work, **fitness**, sleep | fitness |
| founder | custom, work, work, work, **fitness**, sleep | fitness |
| mixed | custom, work, work, **errands**, sleep | errands |

`custom` (morning routine), `commute` (transit/calendar), and `work` (Work + Tasks) are ungated scaffolding, not lifestyle modules.

### Headline / scorekeeping rule — quoted + pass/fail

> "There are no grades, no scores rendered as headlines, no streak or gamification chrome." — `docs/LAYER_4_EXPERIENCE_IDENTITY.md` (Vesper-hour rendering)
>
> "...never as a headline grade." — same file (demoted energy/completion detail)
>
> "...shows the day's energy and completion as secondary detail rather than a headline grade." — `docs/LAYER_2_PRODUCT_SCOPE.md` Pillar 7 (Vesper hour)

**PASS (all six).** `DailyPlanSchema` exposes only `blocks[]` + optional `note` — there is no headline/grade/score/percentage field to populate, and no block title or `notes` value in any revised plan encodes a grade, score, percentage, or streak.

### Schema discipline

`packages/shared/src/schemas/dailyPlan.ts` was **NOT modified.** Every emitted block satisfies `DailyPlanSchema`: `.strict()` objects; `startTime`/`endTime` `"HH:MM"` 24h; `blockType === details.blockType`; `source === 'ai_generated'`; integer `displayOrder` (0-based, sequential per plan); `endTime > startTime` with sleep blocks wrapping past midnight (`endTime !== startTime`). Confirmed by `pnpm --filter @vesper/ai test` (fallback.test.ts schema contract — 13/13) and `pnpm --filter @vesper/shared test` (dailyPlan.test.ts — 8/8). No array-indexing was added, so the `noUncheckedIndexedAccess` guard requirement did not arise.

### Test impact

`packages/ai/src/__tests__/fallback.test.ts` was **NOT edited.** It asserts only (per archetype) that each JSON `safeParse`s against `DailyPlanSchema`, that `getFallbackPlan` returns a schema-valid plan with `blocks.length > 0`, and clone independence. It is module-agnostic — it makes no assertion about block counts or which modules appear — so the re-scope (which keeps every plan schema-valid and non-empty) needs no test change.

---

## 2. §5.9 / F4 — chat-019 prompt module-conditioning

**Verdict: B — corrected-forward.**

### Live text examined (quoted verbatim, pre-edit, from `packages/ai/src/prompts/dailyPlanSynthesis.ts`)

The Layer-1 prompt contained **no reference to `modulesEnabled`** at all, plus three unconditional mandates that force lifestyle-module blocks regardless of the active set:

> "BUDGET DISCIPLINE: your reply has a hard token ceiling and must cover the entire day, ending with sleep."

> "- Wake time before 09:00: always include a brief breakfast block early in the day."

> "- Always close the day with a brief wind-down block before bedtime_target, ahead of sleep."

The GOOD EXAMPLE also shows a multi-lifestyle-module day (nutrition ×2, fitness, sleep).

### Why B, not A

VERDICT A requires the prompt to "condition strictly on the active `modulesEnabled` set and tolerate a one-lifestyle-module day." It does neither: it is silent on `modulesEnabled`, and "always include a breakfast block" (nutrition) and "must … end with sleep" / "always … wind-down" (sleep-module content) would inject blocks for modules a progressively-onboarded user has not enabled — directly contradicting the Work+Tasks+Calendar+ONE-module contract (LAYER_2 line 41, 179). That is the "modules default ON / fuller day" staleness F4 targets. Left as-is, these unconditional lines would also *contradict* any module-gating instruction chat 022 places in Layer 2.

### What changed

Surgical edits to `dailyPlanSynthesis.ts` (and synced reference, §4):

- **Added a `MODULE SCOPE` section:** work/tasks/calendar always active; emit blocks ONLY for lifestyle modules present in the supplied `modulesEnabled`; a single-lifestyle-module day is correct and complete; never add a block for a module that is off (explicit per-module: nutrition/fitness/errands/medication/finance/sleep); the blockType enum is a shape catalogue, not an include-checklist.
- **BUDGET DISCIPLINE:** "must cover the entire day, ending with sleep" → "must cover the active part of the day, through the closing sleep block **when the sleep module is active**"; "cut off … before sleep" → "cut off mid-block."
- **GOOD EXAMPLE header:** annotated that the example user "has the nutrition, fitness, and sleep modules active" and that "a user with fewer modules on gets correspondingly fewer block types."
- **EDGE CASES:** breakfast now conditioned on "wake before 09:00 AND nutrition module active"; wind-down/sleep close now conditioned on "sleep module active," with an explicit "if sleep is off, end with the last active block; do not invent a sleep or wind-down block."

### Version bump

`DAILY_PLAN_SYNTHESIS_VERSION`: **`v3-20260607` → `v4-20260614`.** Major bump (not just a date bump) because this is a behavioural change to module gating, not a copy tweak — downstream eval baselines and prompt caches should treat it as a new prompt. Format honours the `v{N}-{YYYYMMDD}` convention (`packages/ai/src/prompts/types.ts`). Grep confirmed the constant is consumed only by the source file itself and build `dist/` artifacts (untracked) — no hard-coded equality check elsewhere, so the bump is safe.

### Token-budget check

Locked budget: Layer-1 system prompt ≤ ~5K input tokens (PHASE_4 Chat 019 notes / TECHNICAL_SPEC §5 cost model). Post-edit prompt body = **7,688 characters** → ≈ **1,920 tokens** at 4 chars/token (≈ 2,197 at a conservative 3.5). **PASS** (≤ 5K) with wide margin.

---

## 3. Task C — pre-111 staleness (separate verdict)

**Verdict: NONE FOUND.**

Grepped the same read of `dailyPlanSynthesis.ts` for the paths 111 removed/relocated:

- `modulesEnabled.sleep.bedtimeTarget` / `modulesEnabled.sleep.wakeTarget` — **not referenced.** (Post-111 `modulesEnabled.sleep` keeps `{ enabled }` only — CHAT_111 §1.)
- `baseProfile.preferences.*` — **not referenced.** (Removed in 111; folded into top-level `wakeTarget` / `bedtimeTarget` / `location` / `notificationPreferences`.)

The only adjacent references are the natural-language phrases "the stated bedtime target" and "before bedtime_target." These are **conceptual references, not code paths**, and the concept remains valid post-111 (`baseProfile.bedtimeTarget` is a required top-level field — CHAT_111 §1). No correction was required for staleness. (The Verdict-B edit reworded the surrounding wind-down line for module-gating, but deliberately preserved the still-valid `bedtime_target` concept.)

This is recorded distinctly from the F4 verdict (§2): F4 = module-conditioning correction; Task C = no stale-path finding. Two verdicts, not one.

---

## 4. `.reference.ts` sync status

**Synced.** `dailyPlanSynthesis.reference.ts` received the same four semantic changes in full-English form: a new `MODULE SCOPE` section, the BUDGET DISCIPLINE rewording, the GOOD EXAMPLE header annotation, and the two EDGE-CASE-HANDLING rewordings. The version constant lives only in `dailyPlanSynthesis.ts`, so the reference carries no version. The two files remain section-for-section aligned.

---

## 5. Eval-harness outcome (Verdict B)

**Ran clean.** `pnpm --filter @vesper/ai eval:plan` → **10/10 fixtures parsed against `DailyPlanSchema`.**

- No live Anthropic call fired: the harness uses the chat-020 stub `synthesizePlan`, which delegates to `getFallbackPlan` (pure, offline). Confirmed by reading `eval/stubSynthesizePlan.ts` and `eval/runPlanEval.ts` before running.
- The KNOWN-ISSUE fixture misalignment (runtimeInputs + profile casing vs post-111 shapes) did **not** block: `runPlanEval.ts` builds its `_context` but the stub ignores it entirely, reading only `fixture.profile.archetype` and `fixture.runtimeInputs.planDate`. No minimal fixture fix was needed; the full fixture realignment (chat 022's job) was not attempted.
- Because the stub serves `getFallbackPlan`, this run also re-validates the §5.8 re-scoped plans end-to-end through the harness.
- Run output written under `packages/ai/eval/output/` (gitignored — not committed).

---

## 6. Files touched (verified against repo tree)

| Path | Change |
|---|---|
| `packages/ai/src/fallback/plans/nine_to_five.json` | Re-scoped (→ fitness) |
| `packages/ai/src/fallback/plans/remote.json` | Re-scoped (→ nutrition) |
| `packages/ai/src/fallback/plans/student.json` | Re-scoped (→ nutrition) |
| `packages/ai/src/fallback/plans/athlete.json` | Re-scoped (→ fitness) |
| `packages/ai/src/fallback/plans/founder.json` | Re-scoped (→ fitness) |
| `packages/ai/src/fallback/plans/mixed.json` | Re-scoped (→ errands) |
| `packages/ai/src/prompts/dailyPlanSynthesis.ts` | Verdict B edits + version bump v3→v4 |
| `packages/ai/src/prompts/dailyPlanSynthesis.reference.ts` | Synced to match (§4) |
| `docs/CHAT_112_RESOLUTION_RECORD.md` | This record (new) |
| `repo-files.txt` | Regenerated manifest |

**Not touched:** `packages/shared/src/schemas/dailyPlan.ts` (schema), `packages/ai/src/fallback/index.ts` (`getFallbackPlan`), `packages/ai/src/__tests__/fallback.test.ts` (module-agnostic; still passes).

---

## Offline verification summary

| Command | Result |
|---|---|
| `pnpm --filter @vesper/shared test` | 29 passed |
| `pnpm --filter @vesper/ai test` | 65 passed (1 skipped); fallback.test.ts 13/13 |
| `pnpm --filter @vesper/ai eval:plan` | 10/10 parsed; no API call |
| `pnpm type-check` | 10/10 successful |
| `pnpm lint` | clean (6/6) |
