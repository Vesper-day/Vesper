# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vesper — AI-powered daily planner. Butler-tone AI, block-based scheduling, iOS-first.
Authoritative technical reference: `docs/TECHNICAL_SPEC.md`.

## Commands

```bash
# Install dependencies (run from repo root)
pnpm install

# Dev servers (all apps in parallel)
pnpm dev

# Type-check all packages
pnpm type-check

# Lint all packages
pnpm lint

# Build all packages in dependency order
pnpm build

# DB: apply migrations to Supabase (uses SUPABASE_DIRECT_URL)
pnpm --filter @vesper/db db:migrate

# Web dev only
pnpm --filter @vesper/web dev

# Mobile dev only
pnpm --filter @vesper/mobile dev
```

## Architecture

Turborepo monorepo, pnpm workspaces.

```
apps/web       → @vesper/web    Next.js 15, App Router, TypeScript strict, React 19
apps/mobile    → @vesper/mobile Expo SDK 52, React Native, NativeWind, iOS 17.2+
packages/ai    → @vesper/ai     Anthropic SDK wrapper, prompt constants, voice gate
packages/db    → @vesper/db     Drizzle ORM schema, RLS-aware client, migrations
packages/shared → @vesper/shared Zod schemas, constants, utils — zero deps beyond zod + date-fns
packages/ui    → @vesper/ui     Design tokens + Tailwind preset only (no components)
```

### Key patterns

- All AI calls route through `@vesper/ai` — never call Anthropic SDK directly from apps.
- All DB access from web API routes via `@vesper/db` — never from mobile.
- Mobile communicates only through `/api/v1/` routes.
- Shared types: define in `@vesper/shared/src/schemas/`, import everywhere else.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never expose to client bundle.
- Butler voice gate (`packages/ai/src/gate.ts`) runs on every user-visible AI string.

### AI models (runtime only)
- `claude-haiku-4-5` — classification, template selection, NL parsing, check-in questions
- `claude-sonnet-4-6` — plan synthesis, weekly review, empathy regeneration

### Database
- Postgres 15 via Supabase. Drizzle ORM. RLS on every table.
- Schema files: `packages/db/src/schema/` (one file per domain group).
- Migrations: hand-written SQL in `packages/db/migrations/`, each with a matching `.down.sql`. Authored by hand — do NOT use `drizzle-kit generate` (ARCHITECTURE_DECISIONS Decision 01).
- Migrations applied via Supabase CLI (`supabase db push`); Drizzle TS types are produced by introspecting the applied schema (`drizzle-kit pull`), never generated from TS schema into SQL.
- `drizzle.config.ts` uses `SUPABASE_DIRECT_URL` (direct connection, not pooler).
- API routes use `SUPABASE_DB_URL` (transaction pooler) with `prepare: false`.

## Always-loaded rules
@.claude/memory.md