# Chat 048 — Seed Migrations & First Seed Deploy — Resolution Record

Date: 2026-06-18
Branch: `chat-048-seed-migrations`

This record captures the decisions that were ambiguous in the build plan and resolved at
build time, so a future reader does not have to re-derive them.

## 1. Seed mechanism: validated-JSON → generated-SQL

The build plan literally said "INSERT VALUES". `TECHNICAL_SPEC.md` §Seed Data describes the
seed as reference data loaded from curated source JSON. We **defer to TECHNICAL_SPEC over the
build plan's literal phrasing**: the seed SQL is *generated*, not hand-authored.

`packages/db/seed/scripts/emitSeedSql.ts` is the single source of truth for the emitted SQL:

1. Reads the curated source JSON (`workout_templates.json`, `recipe_templates.json`).
2. Validates **every** row against the Zod row schemas in
   `packages/db/seed/scripts/templateRowSchemas.ts`. A row that fails validation aborts the
   emit — invalid seed data can never reach a migration.
3. Emits, per table, a `BEGIN; TRUNCATE TABLE <t>; INSERT INTO <t> (...) VALUES ...; COMMIT;`
   — one single multi-row `INSERT … VALUES`.

The generated files carry a `DO NOT EDIT BY HAND — re-run the generator` header.

### Escaping / casting (the failure mode to watch)
The generator handles the SQL-literal hazards explicitly:
- Single quotes / apostrophes inside `text` and `jsonb` values are doubled (`''`) — verified
  58 such escapes across the emitted files.
- `jsonb` columns are cast `::jsonb`; `text[]` tag columns are emitted as `ARRAY[...]::text[]`.

### Determinism
The emitted SQL is stable: running the generator twice produces byte-identical files (md5 of
all 6 outputs unchanged across re-run). Row ordering is fixed by source-JSON order, so there
is no nondeterministic set iteration. This is what makes the generated files safe to commit.

## 2. Dual-write of migration files

Two directories hold migrations and there is **no `migration_path` override in
`config.toml`**, so the Supabase CLI applies from `supabase/migrations/`. Per the chat
108/111 convention we write to both:

- **Canonical** pair in `packages/db/migrations/` — up **and** matching `.down.sql`
  (`…_seed_workout_templates.sql` + `.down.sql`, `…_seed_recipe_templates.sql` + `.down.sql`).
  The down reverts the truncate-then-replace seed to empty (`TRUNCATE TABLE <t>;`).
- **Up-only mirror** in `supabase/migrations/` — the dir the CLI actually applies.

Both up files in each dir are byte-identical (same generator output).

## 3. Migration numbers

`20260601100001_seed_workout_templates` and `20260601100002_seed_recipe_templates`.

Both numbers were verified **free in BOTH directories** before use. The maximum prior
migration in each dir is `…000021_notebook_inferences`; the `…1000xx` band is unused, leaving
clear headroom above the schema migrations for the seed band.

## 4. Local-vs-remote deploy

- **Local**: applied via `supabase db reset` / `supabase migration up` — the human ran the
  deploy and confirmed a clean apply. Because each table is one fixed-size multi-row INSERT, a
  clean apply means the row counts are exactly as emitted (see §6).
- **Remote**: deferred to **Cutover**. No remote Supabase project was touched in this chat.

## 5. `templateSubset` predicates + limits (build-time decisions)

`packages/ai/src/context/templateSubset.ts` replaced the chat-021 empty-array stub with
`buildTemplateSubset(modulesEnabled, db?)` plus the pure, unit-tested helpers `filterWorkouts`
and `filterRecipes`. The candidate rows are fetched once and filtered in memory (reference set
is tiny: 143 + 300 rows), which keeps the exact predicate direction testable without a live
Postgres.

> **Note on direction**: the pre-existing stub test was a pure placeholder and did **not**
> encode predicate *direction*. The directions below were therefore a **build-time decision**,
> now pinned by the rewritten test `templateSubset.test.ts`.

### Workouts — gated on `fitness.enabled`, limit **10**
- `template.goalTags` **CONTAINS** the user's scalar `fitness.goal`. *(skipped if goal undefined)*
- `template.equipmentTags` **⊆** user `fitness.equipment` (feasibility — keep only workouts
  whose required equipment the user owns). `equipment` is always present (default `[]`); an
  empty list therefore keeps **only no-equipment workouts**. *(never skipped)*
- `template.level` **<=** user `fitness.level`, ranked `beginner < intermediate < advanced`.
  *(skipped if level undefined)*

### Recipes — gated on `nutrition.enabled`, limit **15**
- `template.dietTags` **CONTAINS every** tag in user `nutrition.dietTags` (an empty user list
  is a no-op — `every()` over `[]` is true).
- `template.totalMinutes` **<=** user `nutrition.cookingTimeMaxMinutes`. *(skipped if undefined)*

If both modules are disabled, no query is issued and an empty subset is returned.

## 6. Actual seed row counts

- **workout_templates: 143 rows**
- **recipe_templates: 300 rows**

The spec's nominal figure was "~150"; the curated source yielded the counts above. The
generator prints these counts on each run (`validated workout_templates rows: 143`,
`validated recipe_templates rows: 300`).

## Offline verification performed (this session)

1. `pnpm -F @vesper/ai exec vitest run src/context/__tests__/templateSubset.test.ts` → **12/12 pass**.
2. `pnpm -F @vesper/ai type-check` → clean. Confirmed `@vesper/db` exports `createDrizzleClient`
   and the `Database` type that `templateSubset.ts` imports (per `packages/db/src/index.ts`).
3. `pnpm -F @vesper/db type-check` → clean.
4. Determinism: re-ran the generator; md5 of all 6 emitted files unchanged.

All offline; no Docker, Supabase, or network invoked by the agent.
