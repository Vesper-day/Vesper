# Daily Plan Synthesis — Scoring Rubric

Human-applied. Score each criterion 0-3 per fixture output. Total possible: 15 (5 criteria x 3).

## 1. Voice adherence (0-3)

Butler voice per `packages/ai/src/voiceGate.ts`: calm, formal, short, no validation-seeking.

- **0** — contains an em-dash, exclamation point, emoji, AI self-reference ("As an AI..."), or
  gratitude/gamification/filler-affirmation language ("Great job!", "You've got this!", "Nice
  work today!").
- **1** — voice-gate regex would flag it, but the violation is a single isolated word/phrase.
- **2** — passes the regex gate but tone drifts informal or chatty in places (e.g. "Let's get
  you sorted for the day ahead!").
- **3** — calm, formal, short; no em-dashes, exclamation points, emoji, self-reference, or
  affirmation-seeking language anywhere in `title`/`details`/`note`.

## 2. Block coherence (0-3)

Do block types, ordering, and durations make sense for the day's fixed events?

- **0** — blocks overlap fixed calendar events, or ordering is nonsensical (e.g. dinner before
  lunch, sleep block in the middle of the workday).
- **1** — blocks avoid hard overlaps but pacing is implausible (e.g. five consecutive 15-minute
  blocks, or a 6-hour unbroken focus block).
- **2** — blocks are plausible and respect fixed events, but transitions feel mechanical (no
  buffer around commute/appointments, back-to-back blocks with zero slack).
- **3** — blocks read as a coherent day: fixed events respected with sensible buffers, varied
  durations, natural progression (wake -> work -> meals -> evening -> sleep).

## 3. Archetype fit (0-3)

Does the plan match the stated archetype and its `modules_enabled`?

- **0** — plan ignores the archetype entirely (e.g. a 9-to-5 office block schedule generated for
  a `remote` or `student` fixture).
- **1** — archetype acknowledged in a surface way (e.g. correct work hours) but module-specific
  content (fitness goal, diet tags, late chronotype) is absent or generic.
- **2** — most archetype signals reflected (work pattern, most enabled modules represented), one
  or two module details missed.
- **3** — plan clearly reflects the archetype: enabled modules represented with their specific
  goal/diet/equipment/chronotype details; disabled modules absent from the day.

## 4. Schema validity (0-3)

Does the output parse against `DailyPlanSchema` (`@vesper/shared`)?

- **0** — `DailyPlanSchema.safeParse()` fails (the harness already reports this — see
  PASS_BAR.md criterion (a); a 0 here should be rare once that gate is green).
- **1** — parses, but only after the fallback path was used silently (i.e. the model's structural
  output was rejected and the fallback substituted).
- **2** — parses on the first attempt but with minor structural smells (e.g. `displayOrder`
  values that don't match array order, an empty `note` string instead of omitting the field).
- **3** — parses cleanly on the first attempt with no structural smells.

## 5. Edge-case handling (0-3)

How well does the plan respond to the fixture's specific edge case (see each fixture's
`exercises` field)?

- **0** — edge case is ignored (e.g. a low-energy fixture produces the same dense schedule as a
  high-energy one; a late-chronotype fixture gets a 06:30 wake block).
- **1** — edge case is acknowledged narrowly (e.g. fewer blocks on a low-energy day) but doesn't
  shape the plan's substance.
- **2** — edge case visibly shapes the plan (lighter load on low energy, denser day respected on
  dense-calendar fixtures, late wake/bedtime honored) with one notable miss.
- **3** — edge case is handled throughout: energy level calibrates intensity and block count,
  calendar density is respected without overcrowding or under-using free time, late chronotype
  is tracked precisely (not snapped to round defaults), and a fully-fixed day produces a
  meaningful `note` rather than an empty `blocks` array with no explanation.

## Applying the rubric

Score all five criteria for each of the 10 fixture outputs in a run directory. A fixture's
total is out of 15; the mean across fixtures (divided by 3, to normalize to a 0-5 scale) feeds
PASS_BAR.md criterion (c).
