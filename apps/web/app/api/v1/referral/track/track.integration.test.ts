// @vitest-environment node
//
// Integration tests for POST /api/v1/referral/track, driven against the chat-002
// local-Supabase test DB. resolveReferralCode is exercised against real Postgres
// (valid vs unresolved code); referralTrackResponse is exercised with NO DB so
// the exact §9 cookie attributes are asserted fully offline.
//
// Gated on VESPER_DB_TESTS (see profile.integration.test.ts for run instructions).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, users, sql, eq, type Database } from '@vesper/db';
import {
  resolveReferralCode,
  referralTrackResponse,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
} from './trackReferral';

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Referral track — resolveReferralCode (integration)', () => {
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

  async function seedUserWithCode(code: string): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`ref-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    await db.update(users).set({ referralCode: code }).where(eq(users.id, id));
    return id;
  }

  it('resolves a valid referral code', async () => {
    await seedUserWithCode('k4nx8q');
    const res = await resolveReferralCode(db, 'k4nx8q');
    expect(res).toEqual({ resolved: true, code: 'k4nx8q' });
  });

  it('does not resolve an unknown code', async () => {
    const res = await resolveReferralCode(db, 'zzzzzz');
    expect(res).toEqual({ resolved: false });
  });

  it('does not resolve a null or shape-invalid code', async () => {
    expect(await resolveReferralCode(db, null)).toEqual({ resolved: false });
    expect(await resolveReferralCode(db, 'has spaces')).toEqual({ resolved: false });
  });
});

// No DB needed — pure §9 response-shape assertions, run offline.
describe('Referral track — referralTrackResponse (cookie + redirect)', () => {
  it('valid code → 302 + vesper_ref cookie with exact attributes', () => {
    const res = referralTrackResponse({ resolved: true, code: 'k4nx8q' });

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBeTruthy();

    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('vesper_ref=k4nx8q');
    expect(cookie).toContain(`Max-Age=${REFERRAL_COOKIE_MAX_AGE_SECONDS}`);
    expect(REFERRAL_COOKIE_MAX_AGE_SECONDS).toBe(2592000); // 30 days
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    // HttpOnly intentionally absent — the client reads the cookie for UTM (§9).
    expect(cookie.toLowerCase()).not.toContain('httponly');
  });

  it('unresolved code → 404 with NO cookie set', () => {
    const res = referralTrackResponse({ resolved: false });
    expect(res.status).toBe(404);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });
});
