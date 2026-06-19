// @vitest-environment node
//
// Tests for the Tasks API group (GET/POST /tasks, PATCH/DELETE /tasks/[taskId]).
//
// Two suites:
//   * "Tasks validation (pure)" — ungated; pure Zod-schema assertions that run
//     under plain `pnpm test` (no DB).
//   * "Tasks API (integration)" — gated on VESPER_DB_TESTS; drives the exported
//     DB-layer functions (listTasks/createTask/updateTask/deleteTask) directly
//     against the chat-002 local-Supabase test DB (Docker, direct connection
//     54322) so they assert real Postgres behaviour (the explicit priority CASE
//     ordering + deadline NULLS LAST, the CHECK(estimated_minutes>0), the
//     completed_at lifecycle, user-scoped 404) without standing up Supabase Auth.
//
// This file imports ONLY @vesper/db + @vesper/shared + ./operations — no
// rate-limiting / Upstash — so the ungated suite runs without any env. To run the
// integration suite:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test -- tasks.integration
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, tasks, sql, type Database } from '@vesper/db';
import { ApiError } from '@vesper/shared';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  PostTaskSchema,
  PatchTaskSchema,
  GetTasksQuerySchema,
} from './operations';

// --- Pure validation suite (ungated, no DB) ----------------------------------

describe('Tasks validation (pure)', () => {
  it('PostTaskSchema requires title + estimatedMinutes and rejects extras', () => {
    expect(PostTaskSchema.safeParse({ title: 'A', estimatedMinutes: 30 }).success).toBe(true);
    expect(PostTaskSchema.safeParse({ estimatedMinutes: 30 }).success).toBe(false); // no title
    expect(PostTaskSchema.safeParse({ title: 'A' }).success).toBe(false); // no estimatedMinutes
    expect(
      PostTaskSchema.safeParse({ title: 'A', estimatedMinutes: 30, nope: 1 }).success,
    ).toBe(false); // strict
  });

  it('PostTaskSchema enforces estimatedMinutes integer > 0 (mirrors DB CHECK)', () => {
    expect(PostTaskSchema.safeParse({ title: 'A', estimatedMinutes: 0 }).success).toBe(false);
    expect(PostTaskSchema.safeParse({ title: 'A', estimatedMinutes: -5 }).success).toBe(false);
    expect(PostTaskSchema.safeParse({ title: 'A', estimatedMinutes: 1.5 }).success).toBe(false);
    expect(PostTaskSchema.safeParse({ title: 'A', estimatedMinutes: 1 }).success).toBe(true);
  });

  it('PostTaskSchema accepts a valid ISO deadline and a priority enum, rejects junk', () => {
    expect(
      PostTaskSchema.safeParse({
        title: 'A',
        estimatedMinutes: 30,
        deadline: '2026-06-03T17:00:00Z',
        priority: 'high',
      }).success,
    ).toBe(true);
    expect(
      PostTaskSchema.safeParse({ title: 'A', estimatedMinutes: 30, deadline: 'soon' }).success,
    ).toBe(false);
    expect(
      PostTaskSchema.safeParse({ title: 'A', estimatedMinutes: 30, priority: 'urgent' }).success,
    ).toBe(false);
  });

  it('PatchTaskSchema requires at least one field and allows null deadline', () => {
    expect(PatchTaskSchema.safeParse({}).success).toBe(false); // empty -> refine fails
    expect(PatchTaskSchema.safeParse({ title: 'B' }).success).toBe(true);
    expect(PatchTaskSchema.safeParse({ deadline: null }).success).toBe(true); // clears
    expect(PatchTaskSchema.safeParse({ status: 'in_progress' }).success).toBe(true);
    expect(PatchTaskSchema.safeParse({ status: 'archived' }).success).toBe(false);
  });

  it('GetTasksQuerySchema accepts pending|completed|omit but NOT in_progress', () => {
    expect(GetTasksQuerySchema.safeParse({}).success).toBe(true);
    expect(GetTasksQuerySchema.safeParse({ status: 'pending' }).success).toBe(true);
    expect(GetTasksQuerySchema.safeParse({ status: 'completed' }).success).toBe(true);
    expect(GetTasksQuerySchema.safeParse({ status: 'in_progress' }).success).toBe(false);
  });
});

// --- Integration suite (gated on VESPER_DB_TESTS) ----------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Tasks API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // Deleting auth.users cascades to public.users -> tasks.
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`tasks-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  async function seedTask(
    userId: string,
    values: {
      title: string;
      estimatedMinutes?: number;
      priority?: 'low' | 'medium' | 'high';
      status?: 'pending' | 'in_progress' | 'completed';
      deadline?: Date | null;
    },
  ): Promise<string> {
    const [row] = await db
      .insert(tasks)
      .values({
        userId,
        title: values.title,
        estimatedMinutes: values.estimatedMinutes ?? 30,
        priority: values.priority ?? 'medium',
        status: values.status ?? 'pending',
        ...(values.deadline !== undefined ? { deadline: values.deadline } : {}),
      })
      .returning({ id: tasks.id });
    return row!.id;
  }

  // 1 — GET orders by priority DESC then deadline ASC NULLS LAST.
  it('GET orders by priority numeric DESC then deadline ASC NULLS LAST', async () => {
    const userId = await seedUser();
    await seedTask(userId, { title: 'high-dated', priority: 'high', deadline: new Date('2026-06-03T00:00:00Z') });
    await seedTask(userId, { title: 'high-undated', priority: 'high', deadline: null });
    await seedTask(userId, { title: 'medium', priority: 'medium', deadline: new Date('2026-06-01T00:00:00Z') });
    await seedTask(userId, { title: 'low', priority: 'low', deadline: new Date('2026-06-02T00:00:00Z') });

    const { tasks: list } = await listTasks(db, userId, undefined);
    expect(list.map((t) => t.title)).toEqual(['high-dated', 'high-undated', 'medium', 'low']);
  });

  // 2 — GET ?status=pending filters out completed tasks.
  it('GET ?status=pending returns only pending tasks', async () => {
    const userId = await seedUser();
    await seedTask(userId, { title: 'p1', status: 'pending' });
    await seedTask(userId, { title: 'done', status: 'completed' });

    const { tasks: list } = await listTasks(db, userId, 'pending');
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe('p1');
    expect(list[0]!.status).toBe('pending');
  });

  // 3 — POST creates a task; required cols set, defaults applied.
  it('POST creates a task with NOT NULL columns supplied and DB defaults applied', async () => {
    const userId = await seedUser();
    const res = await createTask(db, userId, {
      title: 'Review Q2 proposal',
      estimatedMinutes: 45,
      deadline: '2026-06-03T17:00:00Z',
    });

    expect(res.title).toBe('Review Q2 proposal');
    expect(res.estimatedMinutes).toBe(45);
    expect(res.priority).toBe('medium'); // default
    expect(res.status).toBe('pending'); // default
    expect(res.completedAt).toBeNull();
    expect(res.deadline).toBe(new Date('2026-06-03T17:00:00Z').toISOString());
  });

  // 4 — POST with estimatedMinutes <= 0 -> 400.
  it('POST with estimatedMinutes <= 0 returns 400 INVALID_REQUEST', async () => {
    const userId = await seedUser();
    const err = (await createTask(db, userId, {
      title: 'bad',
      estimatedMinutes: 0,
    }).catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('INVALID_REQUEST');
    expect(err.httpStatus).toBe(400);
  });

  // 5 — PATCH partial update changes only the provided field.
  it('PATCH partial update changes only the provided field', async () => {
    const userId = await seedUser();
    const taskId = await seedTask(userId, { title: 'old', priority: 'low', estimatedMinutes: 30 });

    const res = await updateTask(db, userId, taskId, { title: 'new', priority: 'high' });
    expect(res.title).toBe('new');
    expect(res.priority).toBe('high');
    expect(res.estimatedMinutes).toBe(30); // untouched
    expect(res.status).toBe('pending'); // untouched
  });

  // 6 — PATCH status lifecycle: ->completed sets completed_at, ->pending clears it.
  it('PATCH status=completed sets completedAt; status=pending clears it', async () => {
    const userId = await seedUser();
    const taskId = await seedTask(userId, { title: 'lifecycle', status: 'pending' });

    const completed = await updateTask(db, userId, taskId, { status: 'completed' });
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).not.toBeNull();

    const reopened = await updateTask(db, userId, taskId, { status: 'pending' });
    expect(reopened.status).toBe('pending');
    expect(reopened.completedAt).toBeNull();
  });

  // 7 — PATCH a task owned by another user -> 404.
  it('PATCH a task not owned by the auth user returns 404', async () => {
    const ownerId = await seedUser();
    const otherId = await seedUser();
    const taskId = await seedTask(ownerId, { title: 'owned' });

    const err = (await updateTask(db, otherId, taskId, { title: 'hijack' }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  // 8 — DELETE a task owned by another user -> 404.
  it('DELETE a task not owned by the auth user returns 404', async () => {
    const ownerId = await seedUser();
    const otherId = await seedUser();
    const taskId = await seedTask(ownerId, { title: 'owned' });

    const err = (await deleteTask(db, otherId, taskId).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  // 9 — DELETE returns void (204 semantics) then the row is gone.
  it('DELETE removes the row; a second delete returns 404', async () => {
    const userId = await seedUser();
    const taskId = await seedTask(userId, { title: 'to-delete' });

    await expect(deleteTask(db, userId, taskId)).resolves.toBeUndefined();

    const remaining = (await db.execute(
      sql`SELECT id FROM tasks WHERE id = ${taskId}::uuid`,
    )) as unknown as Array<{ id: string }>;
    expect(remaining).toHaveLength(0);

    const err = (await deleteTask(db, userId, taskId).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.httpStatus).toBe(404);
  });
});
