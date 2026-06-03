# `@vesper/db` Client Pattern

How to open a database connection in Vesper and how per-user data isolation is
enforced. This is the canonical reference for the client factory, the two
connection variables, and the `withUser` wrapper.

## The two connection variables

There are exactly two database connection variables. Using the wrong one is a
correctness bug, not a style preference.

| Variable              | What it points at                              | Who uses it |
| --------------------- | ---------------------------------------------- | ----------- |
| `SUPABASE_DB_URL`     | Supavisor **transaction-mode pooler**          | Every **serverless** context: Vercel API routes, Cloudflare Workers, any edge runtime. |
| `SUPABASE_DIRECT_URL` | **Direct** Postgres connection (no pooler)     | Local dev scripts, the test smoke check, `supabase db push`, and `drizzle-kit pull`. |

There is no `SUPABASE_POOLER_URL`. The pooler URL is `SUPABASE_DB_URL`.

### Why the split

Serverless functions are short-lived and spin up many concurrent instances. A
transaction-mode pooler (Supavisor) multiplexes a small set of real Postgres
connections across all of them, which is the only way to stay within connection
limits at scale. Direct connections do not pool and would exhaust the database
under serverless fan-out.

Conversely, **DDL and schema introspection must use the direct connection**:

- `supabase db push` applies migrations (DDL). A transaction-mode pooler does
  not hold a stable session across statements, so DDL over the pooler is unsafe.
- `drizzle-kit pull` introspects the live schema to regenerate Drizzle types.
  Introspection over a txn-mode pooler is likewise unreliable.

Both of these therefore use `SUPABASE_DIRECT_URL`. `drizzle.config.ts` is wired
to `SUPABASE_DIRECT_URL` for exactly this reason.

## The client factory

```ts
import { createDrizzleClient } from '@vesper/db';

const db = createDrizzleClient();
```

`createDrizzleClient(connectionString?)`:

- Driver is **postgres-js**, always constructed with `{ prepare: false }`.
- If `connectionString` is omitted, it selects the connection variable from the
  environment:
  - `process.env.RUNTIME` set (worker/edge) **or** `NODE_ENV === 'production'`
    → `SUPABASE_DB_URL` (pooler)
  - otherwise (local dev) → `SUPABASE_DIRECT_URL` (direct)
- Throws a clear error if the selected variable is undefined.
- Returns a schema-bound Drizzle client; its type is exported as `Database`.

### Why `prepare: false` is mandatory

Supavisor transaction mode **does not support prepared statements**. With
prepare enabled, most Drizzle queries fail at runtime — and only in serverless,
because local development runs against a direct connection where prepared
statements work. The result is cryptic errors that do not reproduce locally.

`prepare: false` is set unconditionally. It is harmless on a direct connection,
so the factory never branches on which URL it received.

## Per-user isolation: `withUser`

The Drizzle client connects with the Supabase **service role**, which
**bypasses Row Level Security**. RLS is therefore not the per-user guard for
application reads/writes through this client — the application layer is.

To make "forgot to scope by user" impossible to ship, every query function is
typed as `UserScopedQuery` and routed through `withUser`:

```ts
export type UserScopedQuery<Args extends unknown[], R> = (
  userId: string,
  ...rest: Args
) => (db: Database) => Promise<R>;
```

`userId` is the required leading parameter, so a query that omits it does not
compile, and `withUser` cannot be called with it:

```ts
const db = createDrizzleClient();
const result = await withUser(db, user.id, someQuery, ...args);
```

Safety is enforced at **compile time** by the `UserScopedQuery` signature. We do
**not** inspect generated SQL strings at runtime: parameterized queries make
such inspection prone to false negatives, and it adds per-call overhead for no
real guarantee. Every concrete query must emit `eq(table.userId, userId)`.

## Smoke test

`packages/db/scripts/check-client.ts` (run with `tsx`) opens
`createDrizzleClient()` against `SUPABASE_DIRECT_URL` and runs `SELECT 1`. It
uses the direct connection because the **local** Supavisor pooler is not running
in development — there is no local pooler URL. True transaction-mode pooler
behavior (including the `prepare: false` requirement) is only verifiable
post-Cutover against the cloud Supabase project.
