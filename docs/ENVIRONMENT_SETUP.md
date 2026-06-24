# ENVIRONMENT_SETUP.md
## Vesper — Phase 3 Completion Record
**Project Week 5 · Completed: May 17, 2026 · Status: Complete**

---

## Summary

All 86 checklist items across Sections A–K are resolved. Two deferrals carry forward to Project Week 22 as planned. The monorepo is scaffolded, all packages pass TypeScript type-check, all MCPs are connected, all skills are installed, all environment variables are populated, and the final verification suite (items 82–86) passed in full. Phase 4 (V1 Build) begins Project Week 6.

### Week 22 Deferrals

- **Apple Developer Program ($99/yr)** — APNs, TestFlight, physical-device Live Activity testing, App Store submission. iOS development proceeds in the iOS Simulator until Week 22. (Apple Sign In is no longer deferred: it activates at Cutover step C-09 and is live for the chat 010 production deploy alongside Google OAuth and email magic link, per the App Store Review guideline 4.8 requirement that Sign in with Apple be offered whenever any other social login is offered.)
- **Domain purchase (vesper.day, ~$15–30)** — production redirect URLs, Stripe webhook URLs, Supabase Auth redirect allow-list, Resend sender verification, legal doc hosting. All configs use `localhost` or `*.vercel.app` until Week 22.

---

## Section A — Decisions Locked

| Item | Status | Notes |
|---|---|---|
| Domain TLD | Complete | vesper.day |
| Brand email convention | Complete | hello@vesper.day (placeholder until Wk 22) |
| Brand handle | Complete | getvesperday (all platforms) |
| Hero icon production path | Complete | Midjourney + Photoshop DIY |
| Ambient sound assets | Complete | Free libraries (Freesound.org / Mixkit) |
| Prototype validation | Complete | Informal friends + AI-assisted |

---

## Section B — Registrations & Accounts

### Social Handles

Handle `getvesperday` reserved on all platforms.

| Platform | Status | Notes |
|---|---|---|
| Domain watchlist (Namecheap/Porkbun) | Deferred to Week 22 | Purchase gated on prototype |
| X (Twitter) | Complete | |
| TikTok | Complete | |
| Instagram | Complete | |
| Threads | Complete | |
| Bluesky | Complete | |
| Reddit | Complete | |
| Indie Hackers | Complete | |
| BetaList | Complete | |
| Product Hunt (Coming Soon) | Complete | |
| Hacker News | Complete | |
| LinkedIn (Company page) | Complete | |
| GitHub org | Complete | Vesper-day/Vesper (private) |

### Service Accounts

| Service | Status | Notes |
|---|---|---|
| Supabase | Complete | Free tier; project URL + keys captured |
ercel | Complete | Pro ($20/month) — active from Phase 4 build
| Cloudflare | Complete | Free tier; Workers enabled |
| Stripe | Complete | Test mode only — live mode not activated |
| PostHog | Complete | Free tier; US data residency selected at project creation |
| Sentry | Complete | Free tier |
| Resend | Complete | Free tier; sandbox sender `onboarding@resend.dev` until Wk 22 |
| Termly | Complete | Legal doc generation |
| Anthropic API | Complete | Key generated; free credits active |
| Google Cloud | Complete | OAuth client + Calendar API; `calendar.readonly` scope configured |
| TheMealDB / ExerciseDB | Complete | Public APIs, no account needed. Ready for Phase 4 seed work. |

---

## Section C — Legal Documents

| Item | Status | Notes |
|---|---|---|
| Privacy policy (Termly draft) | Complete | Contact: placeholder personal email until Wk 22 |
| Terms of service (Termly draft) | Complete | |
| Cookie policy (Termly draft) | Complete | |
| Hosting on vesper.day | Deferred to Week 22 | Goes live with domain purchase |

---

## Section D — Local Development Environment

| Item | Status | Notes |
|---|---|---|
| Docker Desktop | Complete | |
| Node.js 20 LTS | Complete | |
| pnpm 9+ | Complete | |
| Supabase CLI | Complete | |
| Expo CLI | Complete | |
| Vercel CLI | Complete | |
| Cloudflare Wrangler CLI | Complete | |
| Stripe CLI | Complete | |
| All CLI `--version` checks | Complete | All pass |
| `supabase start` local stack | Complete | API: localhost:54321 · Studio: localhost:54323 |

---

## Section E — Monorepo Initialization

| Item | Status | Notes |
|---|---|---|
| Turborepo monorepo init | Complete | Structural ref: create-t3-turbo (adapted — REST not tRPC, Supabase Auth not Better Auth) |
| turbo.json pipelines | Complete | build, lint, dev, test |
| Root package.json + pnpm-workspace.yaml | Complete | |
| apps/web (@vesper/web) | Complete | Next.js 15, App Router, TypeScript strict |
| apps/mobile (@vesper/mobile) | Complete | Expo SDK 52, iOS-only at V1, NativeWind |
| packages/db (@vesper/db) | Complete | Drizzle ORM; RLS-aware client pattern modelled on rphlmr/drizzle-supabase-rls |
| packages/shared (@vesper/shared) | Complete | Zod 3.x + date-fns 3.x; zero other external deps |
| packages/ai (@vesper/ai) | Complete | Anthropic SDK + @ai-sdk/anthropic wrapper |
| packages/ui (@vesper/ui) | Complete | Shared design tokens + Tailwind config only (not a component library) |
| pnpm type-check all packages | Complete | 10/10 pass |
| Initial commit pushed to GitHub | Complete | github.com/Vesper-day/Vesper (private) |

---

## Section F — Claude Code & MCPs

| Item | Status | Notes |
|---|---|---|
| Claude Code CLI (global) | Complete | |
| Connected to vesper repo | Complete | `C:\Users\saket\vesper` |
| MCP: Context7 | Complete | 2 tools |
| MCP: GitHub | Complete | 41 tools |
| MCP: Supabase | Complete | 29 tools; stdio transport; PAT auth via `SUPABASE_ACCESS_TOKEN` env var |
| MCP: Stripe | Complete | 31 tools |
| MCP: Sentry | Complete | 22 tools |
| MCP: Playwright | Complete | 23 tools; primary use begins Phase 5 |
| MCP: Vercel (optional) | Complete | Configured via `vercel mcp` CLI |
| MCP: Cloudflare (optional) | Complete | URL: `https://mcp.cloudflare.com/mcp` |

---

## Section G — Claude Code Skills

| Skill | Scope | Status | Active |
|---|---|---|---|
| caveman (JuliusBrussee) | Global (~/.claude/skills/) | Complete | Always on — ~65% output token reduction |
| marketingskills (coreyhaines31) | Project-local | Complete | Phase 6+ |
| stop-slop (hardikpandya) | Project-local | Complete | Phase 4+; all butler-voice content generation |
| context-engineering-kit (NeoLabHQ) | Project-local | Complete | Phase 4+; token efficiency |
| drizzle-best-practices (honra-io) | Project-local | Complete | Phase 4+; critical for all database layer work |
| superpowers (obra) | Project-local | Complete | Selective use; structured TDD for complex features |
| remotion-best-practices (remotion-dev) | Global | Complete | Auto-installed during Remotion setup |
| find-skills (vercel-labs) | Global | Complete | Auto-installed |

---

## Section H — Token-Saving Tools

| Item | Status | Notes |
|---|---|---|
| rtk (Rust terminal proxy) | Complete | 60–90% terminal output compression before Claude sees it |
| claude-usage dashboard | Complete | localhost:8080; reads Claude Code JSONL logs for per-session token/cost visibility |
| .claude/memory.md | Complete | Project memory loaded every session; caveman always-on wired in; stack and package names documented |

---

## Section I — Remotion

| Item | Status | Notes |
|---|---|---|
| Remotion install | Complete | Free license (solo founder, ≤3 people). Location: `vesper/remotion/` |
| Remotion Claude Code skill | Complete | Auto-installed during setup; symlinked to Claude Code |
| Test render (5-second video) | Complete | `out/test.mp4` confirmed; file deleted post-verification; `out/` gitignored |

---

## Section J — Environment Variables

| Item | Status | Notes |
|---|---|---|
| apps/web/.env.local | Complete | All keys from Tech Spec §13 populated |
| apps/mobile/.env.local | Complete | `EXPO_PUBLIC_` prefixed keys populated |
| packages/db/.env.local | Complete | `SUPABASE_DB_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| .env.local gitignored at all levels | Complete | Verified at repo root and per-app |
| .env.example committed to repo | Complete | Sanitized placeholders only; no real values |

### Environment Variable Reference
    
All variables populated in `apps/web/.env.local`. Server-only variables are never exposed to the client bundle.

| Variable | Status | Context |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Complete | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Complete | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Complete | Server only |
| `STRIPE_SECRET_KEY` | Complete | Server only; test key |
| `STRIPE_WEBHOOK_SECRET` | Complete | Server only; captured from `stripe listen` |
| `STRIPE_PRICE_ID` | Complete | Server only; test price ID |
| `ANTHROPIC_API_KEY` | Complete | Server only |
| `RESEND_API_KEY` | Complete | Server only; sandbox sender active |
| `NEXT_PUBLIC_POSTHOG_KEY` | Complete | Public |
| `NEXT_PUBLIC_POSTHOG_HOST` | Complete | Public |
| `SENTRY_DSN` | Complete | Public (web) |
| `NEXT_PUBLIC_APP_URL` | Complete | `http://localhost:3000` until Wk 22 |
| `GOOGLE_CLIENT_ID` | Complete | Server only |
| `GOOGLE_CLIENT_SECRET` | Complete | Server only |
| `CLOUDFLARE_ACCOUNT_ID` | Complete | Server only |
| `CLOUDFLARE_API_TOKEN` | Complete | Server only |
| `APPLE_*` (Sign In OAuth) | Required at C-09 | Active for production deploy before chat 010 |
| `UPSTASH_REDIS_REST_URL` | Required at C-26 (Cutover) | Server only; Upstash Redis for rate limiting, circuit breaker, and idempotency locks |
| `UPSTASH_REDIS_REST_TOKEN` | Required at C-26 (Cutover) | Server only |

Note: Upstash QStash is not used. Deferred job delivery uses the `delayed_jobs` Postgres table. Cloudflare R2 is not used at V1; data export is deferred to V1.5.

---

## Section K — Final Verification

| Item | Status | Notes |
|---|---|---|
| `pnpm dev` → web boots at localhost:3000 | Complete | |
| `pnpm --filter @vesper/mobile dev` → Expo boots | Complete | iOS Simulator only until Wk 22 |
| `supabase db push` → migration test passes | Complete | Local stack. `migrations/` is empty (.gitkeep only) — first real migrations run in Phase 4. |
| `stripe listen` → tunnel active; `whsec_` captured | Complete | `STRIPE_WEBHOOK_SECRET` populated in .env.local |
| Claude Code reads TECHNICAL_SPEC.md | Complete | 17 tables, 14 enums confirmed in schema introspection |
| Supabase MCP schema introspection | Complete | 29 tools active; schema read successfully |
| Caveman skill activates | Complete | Active from session start; `.claude/memory.md` wires it in |

---

## What's Next — Phase 4 (V1 Build)

Phase 4 begins Project Week 6. Build Month 1 (Weeks 6–9):

- **Auth** — Supabase Auth configuration, Google OAuth callback, email magic link, and Apple Sign In live at V1. Apple Sign In activates at Cutover step C-09 ahead of the chat 010 production deploy.
- **Onboarding flow** — multi-step profile data collection, archetype selection, module toggles.
- **Core database schema** — first real `supabase db push` with migrations for all 17 tables and 14 enums.
- **Mobile shell (@vesper/mobile)** — Expo Router navigation, auth gate, plan view scaffold.
- **Web shell (@vesper/web)** — Next.js App Router structure, auth gate, marketing landing page scaffold.

First Claude Code session loads: `TECHNICAL_SPEC.md` (full) + PRD auth/onboarding sections + `packages/db` schema files. Scope: one coherent unit per session per Tech Spec §13 guidance.

---

*Phase 3 complete. Week 5 closed.*
