# Migration Number Allocation

This document is the single source of truth for migration number assignment. Every chat that writes a migration must consult this document and pick the next available number from the appropriate block before writing any SQL.

---

## Naming Format

```
YYYYMMDD000NNN_description.sql
YYYYMMDD000NNN.down.sql
```

- Date prefix: the calendar date the migration is authored (`YYYYMMDD`).
- Numeric suffix: the allocated number from the table below, zero-padded to three digits in the filename (e.g. suffix `5` → `20260601000005_templates.sql`).
- Letter suffix: permitted for small helper migrations between integer slots (e.g. suffix `4a` → `20260601000004a_add_index.sql`). Letter suffixes sort between their integer neighbors when migrations are applied in filename order.
- Description: lowercase, underscores, no spaces.

**Example:**

| Suffix | Filename |
|---|---|
| 1 | `20260601000001_users.sql` |
| 4a | `20260601000004a_add_rls_policy.sql` |
| 5 | `20260601000005_templates.sql` |

---

## Block Allocation

### Block 1 — Foundation (Chats 004–005)

Suffixes 1–13. Letter suffixes permitted within this range.

| Suffix | Reserved For | Chat |
|---|---|---|
| 1–13 | Core schema — users, auth, daily planning, templates, modules, integrations, subscriptions, audit | Chats 004–005 |

Chat 004 picks the first available suffix starting at 1. Chat 005 picks the next available suffix after Chat 004 completes.

### Blocks 4–7 — Incremental Additions

Suffixes 14–30. Letter suffixes permitted.

| Suffix range | Reserved For |
|---|---|
| 14–30 | Schema additions across Blocks 4–7 (fitness, nutrition, sleep, medication, finance, errands, calendar) |

### Blocks 8–11 — Further Additions

Suffixes 31–50. Letter suffixes permitted.

| Suffix range | Reserved For |
|---|---|
| 31–50 | Schema additions across Blocks 8–11 (notifications, analytics tables, delayed jobs, hydration log, etc.) |

### Seed Migrations — Chat 048

Suffixes 100001–199999. These are data-only migrations that insert seed records (workout templates, meal templates, etc.). They never modify schema.

| Suffix range | Reserved For | Chat |
|---|---|---|
| 100001–199999 | Seed data insertions | Chat 048 |

### Post-Launch Migrations

Suffixes 200001+. These are migrations authored after V1 ships to the App Store.

| Suffix range | Reserved For |
|---|---|
| 200001+ | All post-launch schema changes; must follow add-nullable-then-backfill pattern per `docs/MIGRATION_DISCIPLINE.md` |

---

## How to Pick a Number

1. Open this document.
2. Identify which block your migration belongs to (foundation, incremental, seed, post-launch).
3. Look at the existing files in `packages/db/migrations/` and find the highest suffix currently used in your block.
4. Take the next integer (or use a letter suffix if inserting between two existing integers).
5. Write the filename using the format above with today's date.
6. Add a note in your chat's PR description citing this document and the suffix chosen.

**Never reuse a suffix.** If a migration file is deleted or rolled back in development, its suffix is retired. The next migration uses a fresh suffix.

---

## Retired Suffixes

These suffixes were allocated, then their migration files were removed in development. Per the never-reuse rule above, they are **retired** — do not pick them for a new migration.

| Suffix | Retired | Reason |
|---|---|---|
| 22 | 2026-06-18 | `20260618000022_daily_plans_approved_at` was a **duplicate** add of `daily_plans.approved_at`. Migration **0020** (`20260601000020_chat111_schema_checkpoint`, F1) had already added that column (and `daily_plans.status`); 0020 sorts before 0022, so `setup-test-db` failed with `ERROR: column "approved_at" ... already exists (SQLSTATE 42701)`. The 0022 files (canonical `.sql` + `.down.sql` and the up-only supabase mirror) were deleted. **Ownership of `daily_plans.approved_at` is migration 0020.** See `docs/CHAT_025_HOTFIX_approved_at_dedup.md`. |
