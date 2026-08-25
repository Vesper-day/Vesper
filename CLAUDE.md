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

## Verification gate (run from repo root before any commit)

```bash
pnpm test         # all packages (turbo) — the only check that catches cross-file/cross-package breakage
pnpm type-check   # all packages
pnpm lint         # all packages
pnpm build        # all packages — judged as "no NEW errors vs main"; the pre-existing @types/react
                  # 18-vs-19 skew in apps/web is known and must not be chased
```

Run the test suite covering every file you TOUCH, not only files you create — a one-line edit to a
shared module can break another package's tests. DB integration tests stay skipped unless
`VESPER_DB_TESTS=1` and a local Supabase are set (intentional, not missing coverage). Mobile vitest:
any module importing react-native (directly or transitively) must be mocked, or vite's SSR transform
fails parsing React Native's Flow source.

## Architecture

Turborepo monorepo, pnpm workspaces.

```
apps/web       → @vesper/web    Next.js 15, App Router, TypeScript strict, React 19
apps/mobile    → @vesper/mobile Expo SDK 54, React Native, NativeWind, iOS 17.2+
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

## Standing notes (Phase 4 addenda)

### Module surfaces / tab bar / module wiring — read the ADDENDUM corrective chats FIRST
Any chat that touches a **module surface, the mobile tab bar, or module backend wiring** MUST first read the **ADDENDUM — LATER-ADDED CORRECTIVE CHATS** at the end of `docs/PHASE_4_BUILD_PLAN.md` (chats **ADD-A** nav refactor, **ADD-B** nutrition scaffold, **ADD-C** fitness scaffold). ADD-A is the **source of truth for current module surface locations + the mount pattern**. The mobile tab bar is **plan / Modules / tasks / calendar** (Modules second-from-left); the Modules tab is a scrollable rounded-card list where **every card routes to its own full page**, and settings live in a **bottom "Settings" card**, not a tab. The original chats (013 shell, 060 medications, 061 bills, 062 errands) are **partially stale on surface locations** — **do not default to the paths they name.** Modules ship at V1 as **method-B functional-breadth scaffolds**; deep engines (nutrition micronutrient/RDA/calorie; fitness strength-rank/percentile) are **explicitly deferred** — do not build them at V1.

### Design-track `-V` chats run on the SINGLE BUILD MODEL — RICH / animated / immersive posture (Fable carve-out RETIRED)
The design-track visual `-V` halves **run on the single build model** — the earlier Fable / ~$100-budget carve-out is **retired** (the design track no longer runs on a separate model or budget). The posture is **rich / animated / immersive** built from **code libraries**, not restrained-clean: **Lenis** (smooth-scroll), **GSAP** (timeline/scroll motion), **Vanta + Three.js** (WebGL backgrounds), **react-bits** (animated React components), plus **Playwright** for visual/interaction checks. The build model **authors the styled component code directly** (no Figma, no image pipeline). **Reduced-motion → instant fallback is mandatory on every motion surface.** The **AI-image/video GENERATION pipeline stays retired** — richness comes from code libraries, not generated stills. Apply the **priority order** (ADD-D shipped design system + plan/day → onboarding → plan/day detail → Modules tab + top module pages → landing/referral → subscription/rest) so high-visibility surfaces land first. **Already-shipped design surfaces** (the 107/107a primitives + plan/day/week/settings) are lifted to the rich bar by **ADD-D**. **Loosened token-freeze contract:** NEW motion/immersive tokens are **allowed** (rich motion is back), and the `cinematic` band/easing token is **KEPT** (do not delete it). Discipline preserved: a new value enters **only as a new token NAME** in `packages/ui/src/tokens.ts` (+ its `tailwind.ts` / `DesignTokens.swift` mirrors) — **never** by inlining a hex/px/ms in a component; existing token **names** stay stable so shipped consumers (BlockCard, BlockTimeline, subscription UI, calendar chrome) don't silently break. Full authority + the KEEP/DEPRECATE split + loosened token-freeze: `docs/PHASE_4_BUILD_PLAN.md` → Addendum ("Design-Track Re-Overhaul" + chat ADD-D) and the rich-posture banner in `docs/DESIGN_STRATEGY.md`. `VISUAL_DIRECTION_BANK_v2.md` motion/immersive-staging direction is **active again** (its AI-generated-imagery parts stay retired); `ASSET_MANIFEST_KICKOFF.md` and `docs/REEL_REFERENCE_SHEETS/` stay **deprecated-superseded** (AI-image GENERATION not resurrected).

## Always-loaded rules
@.claude/memory.md