// @vitest-environment node
//
// Integration tests for GET /api/v1/referral/code, driven against the chat-002
// local-Supabase test DB via the exported getReferralCode helper.
//   - trial user (referral_code NULL — the default at EO 9) → not eligible (404).
//   - seeded active user with a referral_code + referral_credits rows → 200, with
//     counts scoped to beneficiary_role='referrer' and url built from
//     NEXT_PUBLIC_APP_URL.
//
// Gated on VESPER_DB_TESTS (see profile.integration.test.ts for run instructions).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, users, sql, eq, type Database } from '@vesper/db';
import { getReferralCode } from './getReferralCode';

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Referral code API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // Deleting auth.users cascades public.users → referral_credits (CASCADE).
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`rc-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  it('404 not_eligible for a trial user (referral_code NULL)', async () => {
    const id = await seedUser(); // default subscription_status='trial', code NULL
    const res = await getReferralCode(db, id);
    expect(res).toEqual({ eligible: false });
  });

  it('200 with scoped counts + env-built url for a seeded active user', async () => {
    const id = await seedUser();
    await db
      .update(users)
      .set({ subscriptionStatus: 'active', referralCode: 'k4nx8q' })
      .where(eq(users.id, id));

    // 2 applied + 1 pending (referrer) → referralCount 3, applied 2, pending 1.
    // 1 voided (referrer) and 1 applied REFEREE-role row are both excluded.
    // source_user_id omitted → NULL (column is nullable; ON DELETE SET NULL).
    await db.execute(sql`
      INSERT INTO referral_credits (recipient_user_id, triggering_event, status, beneficiary_role)
      VALUES
        (${id}::uuid, 'referee_converted', 'applied', 'referrer'),
        (${id}::uuid, 'referee_converted', 'applied', 'referrer'),
        (${id}::uuid, 'referee_converted', 'pending', 'referrer'),
        (${id}::uuid, 'referee_converted', 'voided',  'referrer'),
        (${id}::uuid, 'referee_converted', 'applied', 'referee')
    `);

    const res = await getReferralCode(db, id);
    expect(res.eligible).toBe(true);
    if (!res.eligible) throw new Error('unreachable');

    expect(res.data.code).toBe('k4nx8q');
    expect(res.data.referralCount).toBe(3); // voided + referee excluded
    expect(res.data.creditsApplied).toBe(2);
    expect(res.data.creditsPending).toBe(1);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    expect(res.data.url).toBe(`${baseUrl}/r/k4nx8q`);
  });
});
