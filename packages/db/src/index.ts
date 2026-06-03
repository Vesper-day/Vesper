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
