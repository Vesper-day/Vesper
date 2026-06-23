// @vitest-environment node
//
// Tests for the built-in calendar_events CRUD layer (TECHNICAL_SPEC §3 #25).
//
// Two suites:
//   * "Calendar event validation (pure)" — ungated schema assertions, incl. the
//     required inverted-range rejection (endTime <= startTime).
//   * "Calendar events CRUD (integration)" — gated on VESPER_DB_TESTS; drives the
//     operations directly against the local-Supabase test DB (push-tokens
//     precedent): a one-off create/read/update/delete round-trip, and that an
//     inverted-range create never reaches the DB (rejected by validation).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import {
  PostCalendarEventSchema,
  createCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
} from './operations';

// --- Pure validation suite (ungated, no DB) ----------------------------------

describe('Calendar event validation (pure)', () => {
  it('accepts a valid one-off event', () => {
    expect(
      PostCalendarEventSchema.safeParse({
        title: 'Dentist',
        startTime: '2026-06-22T09:00:00.000Z',
        endTime: '2026-06-22T10:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('rejects an inverted range (endTime <= startTime)', () => {
    expect(
      PostCalendarEventSchema.safeParse({
        title: 'Bad',
        startTime: '2026-06-22T10:00:00.000Z',
        endTime: '2026-06-22T09:00:00.000Z',
      }).success,
    ).toBe(false);
    // equal bounds also rejected (CHECK is strict >)
    expect(
      PostCalendarEventSchema.safeParse({
        title: 'Bad',
        startTime: '2026-06-22T09:00:00.000Z',
        endTime: '2026-06-22T09:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('accepts a valid rrule and rejects an unparseable one', () => {
    expect(
      PostCalendarEventSchema.safeParse({
        title: 'Standup',
        startTime: '2026-06-22T09:00:00.000Z',
        endTime: '2026-06-22T09:30:00.000Z',
        rrule: 'FREQ=WEEKLY;BYDAY=MO,WE',
      }).success,
    ).toBe(true);
    expect(
      PostCalendarEventSchema.safeParse({
        title: 'Standup',
        startTime: '2026-06-22T09:00:00.000Z',
        endTime: '2026-06-22T09:30:00.000Z',
        rrule: 'not-an-rrule',
      }).success,
    ).toBe(false);
  });

  it('is strict (rejects unknown keys)', () => {
    expect(
      PostCalendarEventSchema.safeParse({
        title: 'X',
        startTime: '2026-06-22T09:00:00.000Z',
        endTime: '2026-06-22T10:00:00.000Z',
        userId: 'spoofed',
      }).success,
    ).toBe(false);
  });
});

// --- Integration suite (gated on VESPER_DB_TESTS) ----------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';
const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Calendar events CRUD (integration)', () => {
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
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`cal-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  it('one-off create/read/update/delete round-trips', async () => {
    const userId = await seedUser();

    // CREATE
    const created = await createCalendarEvent(db, userId, {
      title: 'Dentist',
      startTime: '2026-06-22T09:00:00.000Z',
      endTime: '2026-06-22T10:00:00.000Z',
    });
    const eventId = created.event.id;
    expect(created.event.title).toBe('Dentist');
    expect(created.event.rrule).toBeNull();

    // READ (window that contains the event)
    const list = await listCalendarEvents(
      db,
      userId,
      '2026-06-22T00:00:00.000Z',
      '2026-06-23T00:00:00.000Z',
    );
    const found = list.events.find((e) => e.id === eventId);
    expect(found).toBeDefined();
    expect(found!.recurring).toBe(false);
    expect(new Date(found!.startTime).toISOString()).toBe('2026-06-22T09:00:00.000Z');

    // UPDATE (retitle + shift end)
    const updated = await updateCalendarEvent(db, userId, eventId, {
      title: 'Dentist (rescheduled)',
      endTime: '2026-06-22T10:30:00.000Z',
    });
    expect(updated.event.title).toBe('Dentist (rescheduled)');
    expect(new Date(updated.event.endTime).toISOString()).toBe('2026-06-22T10:30:00.000Z');

    // DELETE then confirm gone
    await deleteCalendarEvent(db, userId, eventId);
    const afterDelete = await listCalendarEvents(
      db,
      userId,
      '2026-06-22T00:00:00.000Z',
      '2026-06-23T00:00:00.000Z',
    );
    expect(afterDelete.events.find((e) => e.id === eventId)).toBeUndefined();
  });

  it('rejects an inverted-range create before it reaches the DB', async () => {
    const userId = await seedUser();
    await expect(
      createCalendarEvent(db, userId, {
        title: 'Bad',
        startTime: '2026-06-22T10:00:00.000Z',
        endTime: '2026-06-22T09:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });

    // nothing was inserted
    const count = (await db.execute(sql`
      SELECT count(*)::int AS n FROM calendar_events WHERE user_id = ${userId}::uuid
    `)) as unknown as Array<{ n: number }>;
    expect(count[0]!.n).toBe(0);
  });

  it('expands a recurring series on read without persisting instances', async () => {
    const userId = await seedUser();

    // Weekly Mon & Wed 09:00–09:30, series anchored on a Monday.
    const created = await createCalendarEvent(db, userId, {
      title: 'Standup',
      startTime: '2026-06-01T09:00:00.000Z', // Mon 2026-06-01
      endTime: '2026-06-01T09:30:00.000Z',
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE',
    });

    // One ISO week window: Mon 2026-06-08 .. Sun 2026-06-14 → expect Mon+Wed = 2.
    const list = await listCalendarEvents(
      db,
      userId,
      '2026-06-08T00:00:00.000Z',
      '2026-06-15T00:00:00.000Z',
    );
    const instances = list.events.filter((e) => e.id === created.event.id);
    expect(instances).toHaveLength(2);
    expect(instances.every((e) => e.recurring)).toBe(true);

    // The table still holds exactly ONE row — instances were not written back.
    const count = (await db.execute(sql`
      SELECT count(*)::int AS n FROM calendar_events WHERE user_id = ${userId}::uuid
    `)) as unknown as Array<{ n: number }>;
    expect(count[0]!.n).toBe(1);
  });
});
