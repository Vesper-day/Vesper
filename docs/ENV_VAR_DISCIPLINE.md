# Environment Variable Discipline

---

## Source of Truth

`.env.example` at the repository root is the authoritative list of every environment variable used anywhere in the project.

Every new environment variable introduced in any chat must be added to `.env.example` before the session ends. This is part of the end-of-session gate in `CONTRIBUTING.md`.

`.env.example` contains placeholder values (empty strings, example URLs, or obviously fake keys). It is committed to the repository. Actual secrets are never committed.

---

## Client vs. Server Variables

Variables prefixed with `NEXT_PUBLIC_` are bundled into the Next.js client bundle and sent to the browser. They are visible to every user of the application.

**Rule:** `NEXT_PUBLIC_*` variables must never contain secrets, private keys, service role credentials, or any value that grants access to protected resources.

Safe for `NEXT_PUBLIC_*`:
- Supabase project URL (`NEXT_PUBLIC_SUPABASE_URL`)
- Supabase anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) — the anon key is public by design; RLS enforces access
- PostHog project API key (`NEXT_PUBLIC_POSTHOG_KEY`)
- PostHog host URL (`NEXT_PUBLIC_POSTHOG_HOST`)
- Sentry DSN (`NEXT_PUBLIC_SENTRY_DSN`) — DSNs are public identifiers, not secrets
- App URL (`NEXT_PUBLIC_APP_URL`)

Never `NEXT_PUBLIC_*`:
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS; server-only
- `STRIPE_SECRET_KEY` — full Stripe account access
- `ANTHROPIC_API_KEY` — billable API access
- `RESEND_API_KEY` — email send access
- Any webhook signing secrets

---

## Variable Naming Conventions

| Prefix / Pattern | Meaning |
|---|---|
| `NEXT_PUBLIC_` | Client-bundled; safe for browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; bypasses RLS |
| `SUPABASE_DB_URL` | Supavisor transaction-mode pooler connection string (serverless contexts) |
| `SUPABASE_DIRECT_URL` | Direct Postgres connection (local dev, migrations, `drizzle-kit pull` only) |
| `*_SECRET` | Signing secrets or private keys; server-only |
| `*_WEBHOOK_SECRET` | Webhook signature verification secrets; server-only |

---

## Adding a New Variable

1. Add the variable to `.env.example` with a placeholder value and a one-line comment explaining its purpose.
2. Add the variable to the Vercel dashboard (Project Settings → Environment Variables) for `preview` and `production` environments.
3. If the variable is consumed by a Cloudflare Worker, add it to `wrangler.toml` under `[vars]` (non-secrets) or via `wrangler secret put` (secrets).
4. If the variable is consumed by the local Supabase stack, add it to `supabase/config.toml` or reference it from `.env.local`.
5. Document the variable in `docs/TECHNICAL_SPEC.md §10` hosting tables if it is a primary infrastructure credential.

---

## Variable Inventory Reference

The complete variable list with hosting context is in `docs/TECHNICAL_SPEC.md §10` (Vercel, Supabase, and Cloudflare Workers subsections). The `.env.example` file at the repo root is the exhaustive runtime inventory.
