# Chat 111 — Resolution Record

> **Authoritative source.** THIS document — not §3.2 of TECHNICAL_SPEC.md, not the
> pre-111 transcription — is the authoritative shape source for the post-111
> `BaseProfile`, `ModulesEnabled`, and notification-preferences contracts, and for
> the F1/F2/F3 migration verdicts. Downstream chats **021, 024, 025, 031, 046-W,
> 060, 095-W** read the exact paths recorded here.

All shapes below were verified by reading the real `.ts` / `.sql` files, not from
memory or summaries.

---

## 1. POST-111 Zod shapes (exact)

File: `packages/db/src/schema/jsonb/base-profile.ts`

```ts
// LocationSchema — coordinate pair, canonical home location.
const LocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const NotificationPreferencesSchema = z.object({
  morningKnockEnabled: z.boolean(),
  alarmEnabled: z.boolean(),
});

export const BaseProfileSchema = z.object({
  workSchedulePattern: z
    .object({
      days: z.array(z.string()),
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  recurringCommitments: z.array(RecurringCommitmentSchema).default([]),
  locationBoundEvents: z.array(LocationBoundEventSchema).default([]),
  goals: z.array(GoalSchema).default([]),
  wakeTarget: z.string(),                              // §5.1 — required, canonical (HH:MM)
  bedtimeTarget: z.string(),                           // §5.1 — required, canonical (HH:MM)
  location: LocationSchema,                            // §5.1 — required { lat, lng }
  notificationPreferences: NotificationPreferencesSchema, // §5.2 / §5.3
});

// §5.3 — cache-prewarm key CONVENTION (shape only; chat 021 wires the path).
export const CACHE_PREWARM_KEY_PREFIX = 'plan-prewarm';
export function cachePrewarmKey(userId: string, wakeTarget: string): string {
  return `${CACHE_PREWARM_KEY_PREFIX}:${userId}:${wakeTarget}`;
}
```

File: `packages/db/src/schema/jsonb/modules-enabled.ts` — the `sleep` module now
keeps `enabled` only (wake/bed removed):

```ts
sleep: z.object({ enabled: z.boolean() }).default({ enabled: false }),
```

`work`, `fitness`, `nutrition`, `errands`, `medication`, `finance` are unchanged.

### Exact downstream paths

| Concept | Canonical path (post-111) | Notes |
|---|---|---|
| Wake time | `baseProfile.wakeTarget` | required string (HH:MM). ONE source of truth. |
| Bedtime | `baseProfile.bedtimeTarget` | required string (HH:MM). |
| Location | `baseProfile.location.{lat,lng}` | required numbers. |
| Morning-knock toggle | `baseProfile.notificationPreferences.morningKnockEnabled` | boolean. |
| Alarm opt-in | `baseProfile.notificationPreferences.alarmEnabled` | boolean. §5.2. |
| Cache-prewarm key | `cachePrewarmKey(userId, baseProfile.wakeTarget)` | keyed to wake time, not alarm. |
| Sleep module | `modulesEnabled.sleep.enabled` | wake/bed NO LONGER here. |

---

## 2. F1 / F2 / F3 verdicts

### F1 — `…0004_daily_planning.sql` — daily_plans draft→approved lifecycle

(a) DDL read (the entire `daily_plans` create — no state/approval columns existed):

```sql
CREATE TABLE public.daily_plans (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_date          date NOT NULL,
  generated_at       timestamptz NOT NULL DEFAULT now(),
  energy_score       integer CHECK (energy_score BETWEEN 1 AND 10),
  regeneration_count integer NOT NULL DEFAULT 0,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date)
);
```

(b) **Verdict: FIXED-FORWARD.** No state column and no approval timestamp existed;
the draft→approved lifecycle could not be modelled.

(c) Added in migration 20:
- `CREATE TYPE daily_plan_status_enum AS ENUM ('draft', 'approved');`
- `daily_plans.status daily_plan_status_enum NOT NULL DEFAULT 'draft'`
- `daily_plans.approved_at timestamptz` (nullable)
- `CREATE INDEX idx_daily_plans_status ON public.daily_plans (user_id, status);`

Consumed by chats **025** & **046-W**.

### F2 — `…0006_modules.sql` — medications fire-on-time default + shift opt-in

(a) DDL read (the entire `medications` create — no quiet-hours column at all):

```sql
CREATE TABLE public.medications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  dose       text NOT NULL,
  frequency  medication_frequency_enum NOT NULL,
  times      time[] NOT NULL DEFAULT '{}',
  start_date date NOT NULL,
  end_date   date CHECK (end_date IS NULL OR end_date >= start_date),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

(b) **Verdict: FIXED-FORWARD.** The dangerous anti-pattern (`respect_quiet_hours`
default-TRUE that would silently delay doses) was **absent** — good, fire-on-time
was the de-facto default. But the explicit per-medication shift-out-of-quiet-hours
**opt-in** flag was also absent, so the posture was implicit, not enforced.

(c) Added in migration 20:
- `medications.shift_out_of_quiet_hours boolean NOT NULL DEFAULT false`
  — `false` = fire at the exact scheduled time (never silently delayed); `true`
  is the explicit opt-in to shift this medication's dose out of quiet hours.

Consumed by chat **060**.

### F3 — `…0009_waitlist_and_referrals.sql` + `…0002_users.sql` — two-sided credits + attribution

(a) DDL read — attribution column on users (PRESENT):

```sql
-- public.users
  referred_by_user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
```

DDL read — referral_credits (referrer-only model; `referral_event_enum` has a
single value, see migration 1):

```sql
CREATE TABLE public.referral_credits (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_user_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  triggering_event      referral_event_enum NOT NULL,
  discount_percent      smallint NOT NULL DEFAULT 50 CHECK (discount_percent BETWEEN 1 AND 100),
  status                referral_credit_status_enum NOT NULL DEFAULT 'pending',
  ...
);
-- migration 1:
CREATE TYPE referral_event_enum AS ENUM ('referee_converted');
-- migration 9 comment: "Referrer-only discount model. ... recipient = the referrer".
```

(b) **Verdict: SPLIT.**
- **Attribution column on users: CONFIRMED-AS-IS.** `users.referred_by_user_id`
  exists, FK to users, `ON DELETE SET NULL`, set at signup. No change.
- **Two-sided credits: FIXED-FORWARD.** The model was explicitly referrer-only;
  a referee credit was not representable distinctly from a referrer credit.

(c) Added in migration 20:
- `CREATE TYPE referral_beneficiary_role_enum AS ENUM ('referrer', 'referee');`
- `referral_credits.beneficiary_role referral_beneficiary_role_enum NOT NULL DEFAULT 'referrer'`
  — a referee-role row is issued alongside the referrer row at conversion time and
  inherits the existing `discount_percent` default of `50` → referee gets 50% off
  the first paid month. Default `'referrer'` keeps existing rows valid.
  A role column was chosen over `ALTER TYPE referral_event_enum ADD VALUE` because
  the latter cannot run inside a transaction and is not cleanly reversible.

Consumed by chats **031** & **095-W**.

---

## 3. New migration

| Item | Value |
|---|---|
| Suffix | `20` |
| Canonical pair | `packages/db/migrations/20260601000020_chat111_schema_checkpoint.sql` + `.down.sql` |
| Supabase mirror (up-only) | `supabase/migrations/20260601000020_chat111_schema_checkpoint.sql` |

Number rationale: highest **integer** suffix in `packages/db/migrations/` was `18`
(`4a` is a letter slot); `supabase/migrations/` already uses `19`
(`start_of_local_day` — which `packages/db` carries as `4a`). `19` collides in the
supabase dir, so `20` is the next suffix free in **both** directories.

**Local apply/reverse against docker Supabase is NOT yet verified — the human runs
that.** Offline checks (tests, type-check, lint) all pass.

---

## 4. Placement decisions (FLAGGED — human decides)

1. **`wakeTarget` / `bedtimeTarget` → top-level `BaseProfile`, required, no default.**
   De-duped from the old `preferences.*` AND `modules.sleep.*` (both optional).
   base-profile is the single source of truth. Backing DB store is
   `users.sleep_target_bedtime` / `users.sleep_target_wake` (`time` columns,
   migration 2), which remain as-is.

2. **`location` → top-level `BaseProfile`, required, `{ lat:number, lng:number }`.**
   Mirrors `users.location_lat` / `users.location_lng` (numeric, migration 2). Those
   DB columns **stay nullable** (web manual-coordinate fallback) — a DB-layer
   concession; the Zod contract is strict regardless, per the chat brief.

3. **`preferences` sub-object → REMOVED entirely.** It only ever held wake/bed.
   Nothing in app code read it (verified by grep — only `dist/` artifacts and a
   type-only re-export referenced these fields). Re-add a fresh `preferences` shape
   later if a genuinely new preference appears.

4. **`alarmEnabled` (§5.2) → inside `notificationPreferences`**, NOT a base-profile
   top-level scalar and NOT under `sleep`. Grouped with the other notification flags.

5. **`notificationPreferences` (§5.3) → top-level `BaseProfile` field, required.**
   It lives in the `user_profiles.base_profile` JSONB column.
   ⚠️ **Side-effect to confirm:** `base_profile` changes bump `base_profile_version`,
   which drives prompt-cache invalidation (migration 3 comment). A user toggling a
   notification preference would therefore invalidate their prompt cache. If that is
   undesirable, notification prefs should move to a separate column/table in a future
   chat. 111 only sets the shape.

6. **§5.3 "a chosen wake time" → interpreted as the canonical `baseProfile.wakeTarget`.**
   A second wake-time field was deliberately **NOT** added to
   `notificationPreferences`, because doing so would re-introduce the exact
   wake-time duplication §5.1 was tasked with eliminating. The cache-prewarm key
   (`cachePrewarmKey`) is built from `wakeTarget`. If product needs a notification
   delivery time distinct from the sleep/wake target, add it explicitly later.

7. **`modules.sleep` → keeps `enabled` only.** Removal broke no consumer (grep
   confirmed). No leftover duplicate retained.

8. **Single migration `0020` for F1+F2+F3** (not three files). One atomic checkpoint,
   one number allocation, one `.down.sql`. The three flags touch three different
   tables but were authored together as the chat-111 fix.

9. **Migration directory: canonical pair written to `packages/db/migrations/`**
   (the dir the allocation doc points at, and the only one carrying `.down.sql`),
   **mirrored up-only to `supabase/migrations/`** (what `supabase db push` applies).
   ⚠️ **Human must confirm** this dual-write before merge — the two dirs already
   diverge (`4a` vs `19` for `start_of_local_day`), so the mirroring convention is
   not self-evidently correct.

---

## 5. Open items / things NOT done (flagged)

- **AUDIT-SCHEMA assertion: NOT FOUND — STOPPED per brief.** The chat-006
  `audit-schema.ts` (and `test-rls.ts`) referenced by `PHASE_4_BUILD_PLAN.md` do
  **not exist anywhere** in the repo. `packages/db/scripts/` contains only
  `check-client.ts` and `setup-test-db.ts`; the only db test is
  `withUserFilter.test.ts`. `factories.ts:1` confirms chat 006 (which would run
  `drizzle-kit pull` and create these artifacts) has **not run yet**. Per the brief,
  no audit-schema file was fabricated. When chat 006 lands, its `audit-schema.ts`
  must assert: `daily_plans.status` (+ default `'draft'`), `daily_plans.approved_at`,
  `medications.shift_out_of_quiet_hours` (+ default `false`),
  `referral_credits.beneficiary_role` (+ default `'referrer'`), and the two new
  enum types.

- **Drizzle TS schema is a divergent hand-stub — NOT edited.** `packages/db/src/schema/`
  TS tables do **not** match the committed SQL migrations (e.g. `modules.ts`
  `medications` has `dosage`/`scheduleTime`; SQL has `dose`/`frequency`/`times`/
  `start_date`/`end_date`. `waitlist.ts` & `referral_credits` in TS are entirely
  different from the SQL). `factories.ts:1` documents these as placeholders pending
  `drizzle-kit pull` in chat 006. The new columns from migration 20 were therefore
  **not** hand-added to the TS stub (hand-editing pull-generated schema is a locked
  decision, and patching an already-wrong stub would mislead). After applying
  migration 20, the human must run `drizzle-kit pull` (pinned `0.29.1` /
  `drizzle-orm 0.38.4` — do not bump) to regenerate canonical types.

- **Behavioral contract change:** `BaseProfileSchema` now **rejects** the default
  `'{}'` `base_profile` JSONB that `handle_new_user()` inserts (wake/bed/location/
  notificationPreferences are required). Consumers on the pre-onboarding read path
  must either parse only post-onboarding rows or use `BaseProfileSchema.partial()`.
  This is the intended effect of making the fields non-optional.

---

## 6. Offline verification (this chat)

| Check | Result |
|---|---|
| `pnpm --filter @vesper/db test` | ✅ 3 passed |
| `pnpm --filter @vesper/shared test` | ✅ 29 passed |
| `pnpm type-check` (all 10 tasks) | ✅ exit 0 |
| `pnpm lint` (all 6 tasks) | ✅ no warnings or errors |
| Local docker Supabase apply/reverse of migration 20 | ⏳ human runs |
