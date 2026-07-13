# Vesper Project Memory

## Always Active Skills

- caveman: compress all output, ~65% token reduction
- stop-slop: apply to all butler-voice content generation
- drizzle-best-practices: apply to all database layer work

## Caveman scope (override of skill Auto-Clarity)

- caveman is DEFAULT for code-writing and all replies — keep it on the whole session.
- Drop to normal speech ONLY within the single message that:
  (a) presents a security warning, OR
  (b) asks me to confirm an irreversible / outward-facing action (force-push, delete, etc.).
- Verification work is NOT a reason to drop: report test / lint / build / type-check
  results, commands, and pass/fail IN caveman.
- Code blocks, commit messages, and PR titles/bodies: always write normal (unchanged).
- Resume caveman in the very next message — and within the same message right after the
  warning / confirmation line.

## Project Identity

- App: Vesper — AI daily planning assistant
- Founder: solo, anonymous
- Domain: vesper.day (purchased Week 22)
- Handle: getvesperday

## Repo

- Root: C:\Users\saket\vesper
- GitHub: github.com/Vesper-day/Vesper (private)
- Package manager: pnpm

## Stack

- Web: Next.js 15, App Router, TypeScript strict
- Mobile: Expo SDK 54 (RN 0.81, React 19.1, New Arch ON — ported from SDK 52 mid-build), iOS only at V1
- DB: Supabase (Postgres 15) + Drizzle ORM
- Auth: Supabase Auth (Google OAuth + email magic link; Apple deferred Week 22)
- AI: Anthropic API (Haiku for gates, Sonnet for plan synthesis)
- Payments: Stripe (web) + StoreKit 2 (iOS, deferred Week 22)
- Workers: Cloudflare Workers
- Email: Resend

## Packages

- @vesper/web, @vesper/mobile, @vesper/ai, @vesper/db, @vesper/shared

## Source of Truth

- TECHNICAL_SPEC.md — implementation reference
- PRD.md — product decisions
- Layer docs at repo root

## Phase 3 Deferrals (Week 22)

- Apple Developer Program + APNs + TestFlight
- Domain purchase + production redirect URLs
- Note: Apple Sign In NO LONGER deferred — live at V1, activates at Cutover C-09

## rtk (Always Active)

- Wrap every noisy shell command via `rtk <verb>` to compress tool-result output before it hits context.
- Verbs rtk handles: cargo, pnpm, npm, npx, git, gh, tsc, next, lint, prettier, format, jest, vitest, playwright, pytest, ruff, mypy, docker, kubectl, aws, psql, prisma, go, pip, gradlew, curl, grep, find, ls, tree, read, log, json, diff, env, deps, wget, wc, test, err.
- Use `rtk err <cmd>` for "run + show only errors/warnings". Use `rtk test <cmd>` for "run + show only failures".
- Use `rtk pipe` for stdin-fed filtering of existing output.
- Never wrap interactive commands (e.g. anything that opens an editor) or commands whose full output is the task itself.
- Token savings dashboard: `rtk gain`. Claude Code spend vs savings: `rtk cc-economics`.

## Verification Rules

### Claim Discipline
- Before stating any file exists, verify it (view/ls). If a file referenced in TECHNICAL_SPEC.md or PHASE_4_BUILD_PLAN.md does not exist yet, say so explicitly.
- Before using any function, type, or export, confirm it exists in the actual code. Do not assume an API shape — read the source.
- Tag uncertain claims inline: [spec] = stated in a project doc (name it); [code] = verified by reading the actual file; [assumed] = inferred, not verified, flag before relying on it.
- "I don't know" is a valid answer. When info is not in project files or the codebase, say so instead of generating plausible-sounding content.

### Locked Decisions
- ARCHITECTURE_DECISIONS.md holds the 22 locked architecture decisions. Do not re-derive or second-guess them. Read it before making any architectural choice.
- When chat numbering and the Critical Path in PHASE_4_BUILD_PLAN.md disagree, Critical Path is canonical.

### Numbers
- Any number (token count, cost, limit, timeout) shows its derivation or its source doc. No bare figures. If derivation cannot be shown, do not state the number.

### Objection-First
- Before any significant implementation choice or non-obvious conclusion, state the top 1-2 reasons it could be wrong, then proceed.

### End-of-Session Gate (mandatory, per TECHNICAL_SPEC.md section 13)
- Run pnpm build (no TypeScript errors) and pnpm lint (clean) before declaring done.
- Every new migration has a corresponding .down.sql file.
- Every new env var is added to .env.example.
- Wrap noisy verification commands in rtk per the rtk section above.

### Scope
- One coherent unit of work per session (one API route, one component, one worker) per TECHNICAL_SPEC.md section 13. Do not sprawl across package boundaries.
