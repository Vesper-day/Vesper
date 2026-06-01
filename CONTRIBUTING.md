# Contributing

This repository is a solo-founder project. These conventions apply to every Claude Code build session.

## End-of-Session Gate

Every chat session must end with a clean run of:

```bash
pnpm build && pnpm lint
```

from the repository root. No session is considered complete until both commands pass without errors or warnings.

## Migration Discipline

Migrations are forward-only in production. The rules:

- **Never edit a committed migration file.** Once a migration has been committed and pushed, it is immutable regardless of environment.
- **Always write a new forward migration.** If a previous migration introduced an error or needs adjustment, write a new migration that corrects it — do not amend the original.
- **`.down.sql` files exist for local resets only.** They allow `supabase db reset` to work during local development. They are never run in staging or production.
- **Consult `docs/MIGRATION_NUMBER_ALLOCATION.md`** before writing any migration to select the next available number.

Full explanation of the rationale: [docs/MIGRATION_DISCIPLINE.md](docs/MIGRATION_DISCIPLINE.md).

## Environment Variable Discipline

- **`.env.example` is the source of truth** for all environment variables used in the project.
- Every new environment variable introduced in any chat must be added to `.env.example` before the session ends.
- `NEXT_PUBLIC_*` keys are bundled into the client. They must never contain secrets.

Full reference: [docs/ENV_VAR_DISCIPLINE.md](docs/ENV_VAR_DISCIPLINE.md).
