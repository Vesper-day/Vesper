// @vitest-environment node
//
// Tests for POST /api/v1/internal/auth-event (internal, shared-secret).
//
// Two suites:
//   * "auth-event shared secret (pure)" — ungated. Exercises the route handler's
//     auth gate WITHOUT a DB: a missing header, a wrong header, and a missing
//     SERVER secret all reject 401 (the secret check throws before any DB work).
//   * "auth-event push-token deletion (integration)" — gated on VESPER_DB_TESTS.
//     Drives the operation AND the full route accept path against the chat-002
//     local-Supabase test DB (the route's createDrizzleClient() reads
//     SUPABASE_DIRECT_URL, which we point at the test DB), asserting every
//     push_tokens row for the user is removed.
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { POST } from './route';
import { deletePushTokensForUser } from './operations';

const ENDPOINT = 'http://localhost/api/v1/internal/auth-event';

function makeRequest(headers: Record<string, string>, body: unknown): Request {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

// --- Shared-secret gate (ungated, no DB) -------------------------------------

describe('auth-event shared secret (pure)', () => {
  const validBody = { userId: crypto.randomUUID(), eventType: 'sign-out' };

  afterEach(() => {
    delete process.env.AUTH_EVENT_SECRET;
  });

  it('rejects 401 when the secret header is absent', async () => {
    process.env.AUTH_EVENT_SECRET = 'shh-secret';
    const res = await POST(makeRequest({}, validBody));
    expect(res.status).toBe(401);
  });

  it('rejects 401 when the secret header is wrong', async () => {
    process.env.AUTH_EVENT_SECRET = 'shh-secret';
    const res = await POST(makeRequest({ 'x-auth-event-secret': 'nope' }, validBody));
    expect(res.status).toBe(401);
  });

  it('rejects 401 (fail closed) when the SERVER secret is unset', async () => {
    delete process.env.AUTH_EVENT_SECRET;
    const res = await POST(makeRequest({ 'x-auth-event-secret': 'anything' }, validBody));
    expect(res.status).toBe(401);
  });
});

// --- Push-token deletion (gated on VESPER_DB_TESTS) --------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';
const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('auth-event push-token deletion (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];
  const prevDirectUrl = process.env.SUPABASE_DIRECT_URL;

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
    // The route handler calls createDrizzleClient() with no arg -> SUPABASE_DIRECT_URL.
    process.env.SUPABASE_DIRECT_URL = TEST_DB_URL;
    process.env.AUTH_EVENT_SECRET = 'integration-secret';
  });

  afterAll(() => {
    if (prevDirectUrl === undefined) delete process.env.SUPABASE_DIRECT_URL;
    else process.env.SUPABASE_DIRECT_URL = prevDirectUrl;
    delete process.env.AUTH_EVENT_SECRET;
  });

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUserWithTokens(n: number): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`ae-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    for (let i = 0; i < n; i++) {
      await db.execute(sql`
        INSERT INTO push_tokens (user_id, platform, token, device_id)
        VALUES (${id}::uuid, 'ios', ${`tok-${i}`}, ${`dev-${i}`})
      `);
    }
    return id;
  }

  it('deletePushTokensForUser removes all rows and returns the count', async () => {
    const userId = await seedUserWithTokens(3);
    const deleted = await deletePushTokensForUser(db, userId);
    expect(deleted).toBe(3);
  });

  it('route accept path (correct secret) returns 200 and clears the tokens', async () => {
    const userId = await seedUserWithTokens(2);
    const res = await POST(
      makeRequest(
        { 'x-auth-event-secret': 'integration-secret' },
        { userId, eventType: 'sign-out' },
      ),
    );
    expect(res.status).toBe(200);

    const rows = (await db.execute(sql`
      SELECT count(*)::int AS n FROM push_tokens WHERE user_id = ${userId}::uuid
    `)) as unknown as Array<{ n: number }>;
    expect(rows[0]!.n).toBe(0);
  });
});
