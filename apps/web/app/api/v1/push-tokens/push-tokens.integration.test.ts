// @vitest-environment node
//
// Tests for the Push Tokens API group.
//
// Two suites:
//   * "Push token validation (pure)" — ungated PushTokenRequestSchema assertions.
//   * "Push Tokens API (integration)" — gated on VESPER_DB_TESTS; drives
//     upsertPushToken / deletePushToken directly against the chat-002
//     local-Supabase test DB: the 201 insert path, the 200 ON CONFLICT
//     (user_id, device_id) update path (token refreshed, no duplicate row), and
//     the scoped delete.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { PushTokenRequestSchema } from './schemas';
import { upsertPushToken, deletePushToken } from './operations';

// --- Pure validation suite (ungated, no DB) ----------------------------------

describe('Push token validation (pure)', () => {
  it('requires deviceId/platform/token; liveActivityToken optional+nullable; strict', () => {
    expect(
      PushTokenRequestSchema.safeParse({ deviceId: 'd', platform: 'ios', token: 't' }).success,
    ).toBe(true);
    expect(
      PushTokenRequestSchema.safeParse({
        deviceId: 'd',
        platform: 'ios',
        token: 't',
        liveActivityToken: null,
      }).success,
    ).toBe(true);
    expect(
      PushTokenRequestSchema.safeParse({ platform: 'ios', token: 't' }).success,
    ).toBe(false); // no deviceId
    expect(
      PushTokenRequestSchema.safeParse({ deviceId: 'd', platform: 'desktop', token: 't' }).success,
    ).toBe(false); // bad platform
    expect(
      PushTokenRequestSchema.safeParse({ deviceId: 'd', platform: 'ios', token: 't', x: 1 }).success,
    ).toBe(false); // strict
  });
});

// --- Integration suite (gated on VESPER_DB_TESTS) ----------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';
const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Push Tokens API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`push-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  async function countTokens(userId: string, deviceId: string): Promise<number> {
    const rows = (await db.execute(sql`
      SELECT count(*)::int AS n FROM push_tokens
      WHERE user_id = ${userId}::uuid AND device_id = ${deviceId}
    `)) as unknown as Array<{ n: number }>;
    return rows[0]!.n;
  }

  it('upsert returns created=true on first insert (201 path)', async () => {
    const userId = await seedUser();
    const res = await upsertPushToken(db, userId, {
      deviceId: 'dev-1',
      platform: 'ios',
      token: 'tok-1',
      liveActivityToken: null,
    });
    expect(res.created).toBe(true);
    expect(res.data.pushToken).toEqual({ deviceId: 'dev-1', platform: 'ios' });
  });

  it('upsert on (user_id, device_id) conflict updates in place, created=false (200 path)', async () => {
    const userId = await seedUser();
    await upsertPushToken(db, userId, {
      deviceId: 'dev-1',
      platform: 'ios',
      token: 'tok-1',
    });
    const res = await upsertPushToken(db, userId, {
      deviceId: 'dev-1',
      platform: 'ios',
      token: 'tok-2',
    });
    expect(res.created).toBe(false);
    expect(await countTokens(userId, 'dev-1')).toBe(1); // no duplicate row

    const rows = (await db.execute(sql`
      SELECT token FROM push_tokens WHERE user_id = ${userId}::uuid AND device_id = 'dev-1'
    `)) as unknown as Array<{ token: string }>;
    expect(rows[0]!.token).toBe('tok-2'); // refreshed
  });

  it('delete removes the scoped row and returns true; missing row returns false', async () => {
    const userId = await seedUser();
    await upsertPushToken(db, userId, { deviceId: 'dev-1', platform: 'ios', token: 'tok-1' });

    expect(await deletePushToken(db, userId, 'dev-1')).toBe(true);
    expect(await countTokens(userId, 'dev-1')).toBe(0);
    expect(await deletePushToken(db, userId, 'dev-1')).toBe(false); // idempotent
  });
});
