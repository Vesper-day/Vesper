# Migration Discipline

This document explains why migrations are forward-only in production, why `.down.sql` files exist only for local development, and why post-launch schema changes follow the add-nullable-then-backfill pattern.

---

## Why Migrations Are Forward-Only in Production

A database migration in production is an irreversible act. The moment a migration runs against a live database, rows may have been inserted under the new schema, dependent triggers may have fired, and RLS policies may have evaluated against the new column structure. Running a `.down.sql` against a production database in this state does not restore the prior state — it destroys data.

The forward-only discipline exists because it encodes this reality directly into the project's workflow. There is no "undo" command for production. There is only "write a new migration that moves forward toward the desired state."

Every committed migration in `packages/db/migrations/` is treated as a permanent artifact of the database's history. If a migration was wrong, the correction is a new migration. This keeps the migration directory as an accurate, auditable log of every structural change that has ever been applied to the database, in the order they were applied.

**Deviation consequence:** Editing a committed migration and reapplying it in production produces undefined behavior. If the migration has already run, Supabase's migration tracking will mark it as applied and skip it on the next `supabase db push`. If the history is manually altered to re-run it, any data written under the original schema will be in an inconsistent state relative to the edited migration. The outcome is either silently ignored changes or data corruption.

---

## Why `.down.sql` Files Exist for Local Resets Only

Each migration has a corresponding `.down.sql` file. These files exist for one purpose: to allow `supabase db reset` to tear down and rebuild the local Supabase instance during development.

During active development on a feature that requires a schema change, a developer may want to iterate on the migration itself before committing it. `supabase db reset` applies all migrations in order, tearing down the local stack first. The `.down.sql` files make this teardown deterministic.

`.down.sql` files are never run in staging or production. They are not part of the deployment pipeline. The CI/CD pipeline (`pr-check.yml`) does not invoke `.down.sql` files at any point.

If a `.down.sql` file is out of sync with its corresponding `.up.sql` (the primary migration file), this is a local-dev inconvenience, not a production risk.

---

## Why Post-Launch Schema Changes Use Add-Nullable-Then-Backfill

Once Vesper has live users, any schema change that would cause the application to fail for even a moment is unacceptable. The add-nullable-then-backfill pattern prevents this.

The pattern has three steps:

**Step 1 — Add nullable column (zero downtime):**
Write a migration that adds the new column as `NULL` with no default. Postgres can add a nullable column to any table without a table lock. The existing application code continues to run against the table as if the column does not exist.

**Step 2 — Backfill (zero downtime):**
Write a migration (or a manual query in a separate session) that populates the new column for all existing rows. Do this in batches if the table is large to avoid a single long-running transaction that holds a lock. Example:

```sql
UPDATE my_table SET new_column = computed_value WHERE new_column IS NULL LIMIT 10000;
```

Run until no rows remain with `NULL` in the new column.

**Step 3 — Add constraint (low-risk):**
Once backfill is complete, write a migration that adds the `NOT NULL` constraint or any other constraint. Postgres validates this with a table scan but does not lock for writes on Postgres 12+.

**Why not just add the column with a default value in one migration?**

On large tables, adding a column with a non-null default in a single migration requires Postgres to rewrite the entire table to apply the default to existing rows. For a table with millions of rows, this table rewrite can take minutes during which writes are blocked. The add-nullable-then-backfill pattern avoids this entirely.

**Deviation consequence:** A migration that adds a `NOT NULL` column with a default to a table with millions of rows will block writes for the duration of the table rewrite. In production, this looks like a complete API outage for that table's routes.

---

## Number Allocation

See `docs/MIGRATION_NUMBER_ALLOCATION.md` for the authoritative list of which migration numbers are reserved for which chats. Every chat that writes a migration must consult that document before choosing a number.
