# Vesper

Vesper is an AI-powered daily planner for iOS and web. It ingests a user's full context — work calendar, fitness goals, nutrition, sleep, and errands — and generates a complete, block-based daily schedule in a calm butler tone. The target audience is young professionals who want adaptive planning across every domain of life, not just work scheduling.

The project is a solo-founder build using Turborepo (Next.js 15 web, Expo SDK 52 iOS, Supabase, Cloudflare Workers). V1 ships with Google OAuth, Apple Sign In, Stripe billing, and an Anthropic-powered planning engine backed by `claude-sonnet-4-6`.

## Contracts

| Document | Purpose |
|---|---|
| [docs/TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md) | Implementation contract — stack, schema, API routes, hosting, dev workflow |
| [docs/PRD.md](docs/PRD.md) | Product contract — features, flows, success criteria, V1 scope |
| [docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) | Twenty-two locked architecture decisions from Chat 001 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow conventions for every build session |

## Local Development Quickstart

**Prerequisites:** Docker Desktop, Node.js 20 LTS, pnpm 9+, Supabase CLI, Expo CLI, Vercel CLI, Cloudflare Wrangler CLI, Stripe CLI.

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables and fill in values
cp .env.example .env.local

# 3. Start Supabase local stack
supabase start
# API: http://localhost:54321  Studio: http://localhost:54323

# 4. Apply migrations
pnpm --filter @vesper/db db:migrate

# 5. Run all dev servers in parallel
pnpm dev

# 6. Verify build and lint pass (required at end of every session)
pnpm build && pnpm lint
```

**Type-check all packages:**

```bash
pnpm type-check
```

**Run tests:**

```bash
pnpm test
```

Full environment reference: [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md).
