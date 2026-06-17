// Canonical client factory + inferred type.
export { createDrizzleClient } from './client';
export type { Database } from './client';

// Service-role-with-user-filter wrapper + the query contract it enforces.
export { withUser } from './withUserFilter';
export type { UserScopedQuery } from './queries';

// Deprecated aliases — retained so no existing importer breaks.
export { createDb } from './client';
export type { Db } from './client';

// Schema barrel.
export { schema } from './client';
export * from './schema';

// Re-export the drizzle-orm query operators consumers need. The monorepo resolves
// two drizzle-orm instances (differing only by the @types/react peer hash); a
// consumer that imports `eq`/`sql` straight from 'drizzle-orm' can land on the
// OTHER instance than the one our schema tables are built with, producing spurious
// cross-instance Column/SQL type errors under exactOptionalPropertyTypes. Importing
// these from @vesper/db guarantees the same instance as the tables.
export { eq, and, sql, desc } from 'drizzle-orm';
