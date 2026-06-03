import { describe, it, expect } from 'vitest';
import { withUser } from './withUserFilter';
import type { Database } from './client';
import type { UserScopedQuery } from './queries';

// A fake Database is sufficient: these queries never touch `db`, they only
// prove the value/userId threading and the compile-time contract. `withUser`
// itself performs no SQL.
const fakeDb = {} as Database;

describe('withUser', () => {
  it('returns the query result and threads userId + args through', async () => {
    // Sample UserScopedQuery: userId first (required), then extra args.
    const getGreeting: UserScopedQuery<[greeting: string], string> =
      (userId, greeting) => async () => `${greeting}:${userId}`;

    const result = await withUser(fakeDb, 'user-123', getGreeting, 'hello');

    expect(result).toBe('hello:user-123');
  });

  it('injects the db instance into the curried query', async () => {
    let received: Database | undefined;
    const capturesDb: UserScopedQuery<[], true> = () => async (db) => {
      received = db;
      return true;
    };

    const ok = await withUser(fakeDb, 'user-abc', capturesDb);

    expect(ok).toBe(true);
    expect(received).toBe(fakeDb);
  });

  it('compile-time: a query missing the leading userId cannot be passed', async () => {
    // This query's first parameter is NOT `userId: string`, so it violates the
    // UserScopedQuery contract. Passing it to withUser MUST be a type error.
    // Validated by `tsc` (build / type-check); the @ts-expect-error fails the
    // build if this line ever stops being an error.
    const unsafeQuery = (count: number) => async () => count;

    // @ts-expect-error — first param is `count: number`, not `userId: string`.
    await withUser(fakeDb, 'user-123', unsafeQuery, 5);
  });
});
