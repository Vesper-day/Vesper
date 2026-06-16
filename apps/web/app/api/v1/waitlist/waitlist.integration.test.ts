// @vitest-environment node
//
// Integration tests for POST /api/v1/waitlist, driven against the chat-002
// local-Supabase test DB. Exercises the raw-SQL insert directly (addToWaitlist):
// 201 on a new email, 409 (CONFLICT) on a duplicate (email UNIQUE, §16).
//
// Gated on VESPER_DB_TESTS (see profile.integration.test.ts for run instructions).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { ApiError } from '@vesper/shared';
import { addToWaitlist } from './addToWaitlist';

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Waitlist API (integration)', () => {
  let db: Database;
  const createdEmails: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // waitlist has no user FK; clean up by the emails this run inserted.
    for (const email of createdEmails.splice(0)) {
      await db.execute(sql`DELETE FROM waitlist WHERE email = ${email}`);
    }
  });

  function freshEmail(): string {
    const email = `wl-${crypto.randomUUID()}@example.com`;
    createdEmails.push(email);
    return email;
  }

  it('inserts a new waitlist row (201 path)', async () => {
    const email = freshEmail();
    const res = await addToWaitlist(db, { email, platformPreference: 'ios' });

    expect(typeof res.waitlisted.id).toBe('string');
    expect(res.waitlisted.email).toBe(email);
    expect(res.waitlisted.platformPreference).toBe('ios');

    // Exactly one row, with the platform_preference enum persisted.
    const rows = (await db.execute(sql`
      SELECT platform_preference, referral_source
      FROM waitlist WHERE email = ${email}
    `)) as unknown as Array<{
      platform_preference: string;
      referral_source: string | null;
    }>;
    expect(rows.length).toBe(1);
    expect(rows[0]?.platform_preference).toBe('ios');
    // referral_source is NOT in the §9 request → left null.
    expect(rows[0]?.referral_source).toBeNull();
  });

  it('throws CONFLICT (409) on a duplicate email', async () => {
    const email = freshEmail();
    await addToWaitlist(db, { email, platformPreference: 'android' });

    await expect(
      addToWaitlist(db, { email, platformPreference: 'ios' }),
    ).rejects.toMatchObject({ httpStatus: 409 });

    // And the thrown value is an ApiError.
    try {
      await addToWaitlist(db, { email, platformPreference: 'ios' });
      throw new Error('expected a CONFLICT throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).httpStatus).toBe(409);
    }
  });
});
