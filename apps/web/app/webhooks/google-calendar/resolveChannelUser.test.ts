import { describe, it, expect, vi } from 'vitest';
import type { Database } from '@vesper/db';
import { resolveChannelUser } from './resolveChannelUser';

/** Fake Drizzle client whose execute() returns the given rows. */
function dbReturning(rows: unknown[]): Database {
  return { execute: vi.fn().mockResolvedValue(rows) } as unknown as Database;
}

describe('resolveChannelUser', () => {
  it('returns the user_id of the integration holding the channel_id', async () => {
    const db = dbReturning([{ user_id: 'user-123' }]);
    const result = await resolveChannelUser('chan-abc', db);
    expect(result).toBe('user-123');
    // One parameterized lookup, no per-row fanout.
    expect(db.execute as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
  });

  it('returns null when no integration holds that channel_id (still acked by the route)', async () => {
    const db = dbReturning([]);
    const result = await resolveChannelUser('unknown-channel', db);
    expect(result).toBeNull();
  });
});
