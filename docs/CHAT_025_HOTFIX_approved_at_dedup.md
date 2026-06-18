# Chat 025 Hotfix — `daily_plans.approved_at` migration dedup

**Date:** 2026-06-18
**Branch:** `chat-027-block-apis-occ`
**Type:** migration-sequence fix (file removal only — no schema change to any applied migration)

---

## 1. The bug

`pnpm --filter @vesper/db setup-test-db` (which runs `supabase db reset --local`
then applies every migration in filename order) failed on the last migration:

```
Applying migration 20260618000022_daily_plans_approved_at.sql...
ERROR: column "approved_at" of relation "daily_plans" already exists (SQLSTATE 42701)
At statement: 1  ALTER TABLE public.daily_plans ADD COLUMN approved_at timestamptz
```

`daily_plans.approved_at` was added by **two** migrations:

- **`20260601000020_chat111_schema_checkpoint.sql`** — the consolidated chat-111
  F1+F2+F3 checkpoint (EO 4). Its F1 section adds the `daily_plans` draft/approve
  model: a `status` column (`daily_plan_status_enum NOT NULL DEFAULT 'draft'`) **and**
  `approved_at timestamptz`.
- **`20260618000022_daily_plans_approved_at.sql`** — a redundant dedicated migration
  authored by chat-025 (EO 34). It read only `20260601000004_daily_planning.sql`, saw
  no `approved_at` there, and missed that migration 0020 already added it.

Filename order sorts `0020` before `0022`, so 0020 adds the column first and 0022
fails as a duplicate. Migration 0022 therefore **never successfully applied** against
any database that already contains 0020.

## 2. Verification findings (read-only, before any change)

| # | Check | Result |
|---|---|---|
| 1 | `20260601000004_daily_planning.sql` | `daily_plans` CREATEd **without** `approved_at` and **without** any `status` column. |
| 2 | `20260601000020_chat111_schema_checkpoint.sql` | ADDs `daily_plans.status` (`daily_plan_status_enum NOT NULL DEFAULT 'draft'`) **and** `daily_plans.approved_at timestamptz` (nullable). Fully additive — also creates `daily_plan_status_enum`, `idx_daily_plans_status`, `referral_beneficiary_role_enum`, and adds `medications.shift_out_of_quiet_hours` + `referral_credits.beneficiary_role`. Not a squash/baseline. |
| 3 | `20260618000022_daily_plans_approved_at.sql` | Sole schema effect = `ALTER TABLE public.daily_plans ADD COLUMN approved_at timestamptz` (nullable, no default) plus a `COMMENT ON COLUMN`. Touches nothing else. `.down.sql` = `DROP COLUMN IF EXISTS approved_at`. |
| 4 | supabase mirror | `supabase/migrations/20260618000022_daily_plans_approved_at.sql` existed (same ALTER + COMMENT); **no `.down.sql`** in the supabase dir (mirror is up-only, as designed). |
| 5 | dir consistency | `packages/db/migrations/` and `supabase/migrations/` are otherwise consistent. The only naming difference is the documented alias `0004a_start_of_local_day` (packages) vs `0019_start_of_local_day` (supabase), noted in migration 0020's own header. |
| 6 | **remote-safety gate** | No remote Supabase project is linked: `supabase/config.toml` carries no project ref (`project_id = "Vesper"` is only the local container name), and `supabase/.temp/` contains only `cli-latest` — there is **no `project-ref` file**, so `supabase link` was never run. Migration `20260618000022` therefore cannot appear in any remote applied history (it errors against any DB containing 0020 anyway). |

All premises in the fix brief held true; the remote gate was clear.

## 3. The fix

Migration **0020 is the legitimate owner** of the `daily_plans` draft/approve model
(`status` + `approved_at`). It applied earlier, is frozen, and the chat-006
audit-schema expects `daily_plans.approved_at` to exist after it. Migration 0022 was a
redundant, never-successfully-applied partial duplicate. The fix is to **delete 0022's
files** and leave 0020 untouched.

Files removed:

- `packages/db/migrations/20260618000022_daily_plans_approved_at.sql`
- `packages/db/migrations/20260618000022_daily_plans_approved_at.down.sql`
- `supabase/migrations/20260618000022_daily_plans_approved_at.sql` (no `.down.sql` existed in this dir)

Not modified: `20260601000020_chat111_schema_checkpoint.sql` and its `.down.sql`.

Docs updated:

- `docs/MIGRATION_NUMBER_ALLOCATION.md` — added a "Retired Suffixes" section recording
  that suffix **22 is retired** (per the never-reuse rule); ownership of
  `daily_plans.approved_at` is migration 0020.
- `docs/CHAT_025_RESOLUTION_RECORD.md` §6 + §7 — appended a dated correction noting the
  migration-22 forward-fix was superseded and removed (history not rewritten).

## 4. Remote-safety reasoning

Deleting a migration file is only safe if that migration is not part of any database's
applied history that we cannot reset. Two facts make this safe here:

1. **No remote is linked** (gate check #6), so there is no remote `schema_migrations`
   history to diverge from.
2. **0022 never succeeds against a DB that has 0020** — it raises SQLSTATE 42701 — so
   it cannot have been recorded as applied anywhere that 0020 is present. Local
   `supabase db reset` rebuilds from the migration files on disk, so removing 0022
   simply means the duplicate ALTER is gone and the reset completes clean.

Had 0022 appeared in a remote applied history, deletion would have been unsafe and the
fix would instead have been a forward-only `ADD COLUMN IF NOT EXISTS` guard. That
branch was **not** taken because the gate was clear.

## 5. Verification handed back

```
pnpm --filter @vesper/db setup-test-db   # expect: all migrations apply, no SQLSTATE 42701, clean reset
pnpm type-check                          # expect: no TypeScript errors
```
