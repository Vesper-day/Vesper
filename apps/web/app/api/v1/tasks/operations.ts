// Task DB-layer core logic (§9 "Tasks"), shared by:
//   GET   /api/v1/tasks            -> listTasks
//   POST  /api/v1/tasks            -> createTask
//   PATCH /api/v1/tasks/[taskId]   -> updateTask
//   DELETE /api/v1/tasks/[taskId]  -> deleteTask
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config, so the pure functions + Zod schemas live in this plain sibling module
// (mirrors blocks/operations.ts). The route handlers import them; the integration
// tests drive them directly against the chat-002 local-Supabase test DB without
// standing up Supabase Auth (chat-026 precedent).
//
// SCHEMA SOURCE: the Drizzle `tasks` model in
// packages/db/src/schema/daily-planning.ts matches TECHNICAL_SPEC §3 "5. tasks"
// column-for-column (id, user_id, title, estimated_minutes NOT NULL + CHECK>0,
// deadline nullable, priority/status enums + defaults, completed_at nullable,
// both indexes incl. the partial deadline index). So — unlike blocks, which fell
// back to raw SQL for the completion_log column skew — we use the Drizzle query
// builder here. The ORM (non-raw) path runs the Date parser, so timestamptz
// columns come back as JS `Date` (not strings), and `.toISOString()` is safe.
import { z } from 'zod';
import { tasks, eq, and, sql, type Database } from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';

// --- Response contract (camelCase) ------------------------------------------
//
// §9 serializes ONLY these fields — note there is NO createdAt / updatedAt.
// deadline & completedAt are ISO-8601 strings or null.
export interface TaskResponse {
  id: string;
  title: string;
  estimatedMinutes: number;
  deadline: string | null; // ISO 8601
  priority: string;
  status: string;
  completedAt: string | null; // ISO 8601
}

export interface TaskListResponse {
  tasks: TaskResponse[];
}

type TaskRow = typeof tasks.$inferSelect;

function serializeTask(row: TaskRow): TaskResponse {
  return {
    id: row.id,
    title: row.title,
    estimatedMinutes: row.estimatedMinutes,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    priority: row.priority,
    status: row.status,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

// --- Validation schemas ------------------------------------------------------

const ISO_DATETIME = { offset: true } as const;

const PRIORITIES = ['low', 'medium', 'high'] as const;
// PATCH accepts the FULL task_status_enum (in_progress is a real stored value
// for tasks, §3); the GET ?status filter is narrower (see GetTasksQuerySchema).
const TASK_STATUSES = ['pending', 'in_progress', 'completed'] as const;

export const PostTaskSchema = z
  .object({
    title: z.string().min(1),
    // estimatedMinutes: integer, strictly > 0 (mirrors the DB CHECK).
    estimatedMinutes: z.number().int().positive(),
    // deadline: SOFT-checked on CREATE — a past deadline is ACCEPTED (warn-tolerant,
    // never a hard 400); only ISO-8601 shape is enforced here.
    deadline: z.string().datetime(ISO_DATETIME).optional(),
    priority: z.enum(PRIORITIES).optional(),
  })
  .strict();

export type PostTaskInput = z.infer<typeof PostTaskSchema>;

export const PatchTaskSchema = z
  .object({
    title: z.string().min(1).optional(),
    estimatedMinutes: z.number().int().positive().optional(),
    // deadline NOT re-validated for "future" on PATCH; `null` clears it.
    deadline: z.string().datetime(ISO_DATETIME).nullable().optional(),
    priority: z.enum(PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.title !== undefined ||
      d.estimatedMinutes !== undefined ||
      d.deadline !== undefined ||
      d.priority !== undefined ||
      d.status !== undefined,
    { message: 'At least one field is required.' },
  );

export type PatchTaskInput = z.infer<typeof PatchTaskSchema>;

// GET ?status filter follows §9 as written (pending | completed | omit) — it does
// NOT expose in_progress, even though PATCH can set it. Defer to §9 for the filter.
export const GetTasksQuerySchema = z
  .object({
    status: z.enum(['pending', 'completed']).optional(),
  })
  .strict();

const TASK_UUID = z.string().uuid();

// --- GET /tasks --------------------------------------------------------------

/**
 * List all of the user's tasks, ordered by priority DESC then deadline ASC.
 *
 * Priority order uses an EXPLICIT numeric mapping (high=3, medium=2, low=1) — not
 * enum text/physical order. deadline ASC NULLS LAST means deadline-less tasks sort
 * after dated ones within a priority tier.
 *
 * @param statusParam raw `?status` value (string | null | undefined). Validated
 *   against pending|completed; anything else (incl. in_progress) -> 400.
 * Throws {@link ApiError} 400 (invalid status filter).
 */
export async function listTasks(
  db: Database,
  userId: string,
  statusParam: string | null | undefined,
): Promise<TaskListResponse> {
  const parsed = GetTasksQuerySchema.safeParse(
    statusParam == null ? {} : { status: statusParam },
  );
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid status filter.',
    );
  }
  const { status } = parsed.data;

  const where =
    status !== undefined
      ? and(eq(tasks.userId, userId), eq(tasks.status, status))
      : eq(tasks.userId, userId);

  const rows = await db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(
      sql`(CASE ${tasks.priority} WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 END) DESC, ${tasks.deadline} ASC NULLS LAST`,
    );

  return { tasks: rows.map(serializeTask) };
}

// --- POST /tasks -------------------------------------------------------------

/**
 * Create a task for the user. user_id comes from the authenticated session (NEVER
 * the body); title + estimatedMinutes are required; priority/status/timestamps
 * fall back to their DB defaults when omitted.
 * Throws {@link ApiError} 400 (validation).
 */
export async function createTask(
  db: Database,
  userId: string,
  rawBody: unknown,
): Promise<TaskResponse> {
  const parsed = PostTaskSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;

  const [row] = await db
    .insert(tasks)
    .values({
      userId,
      title: input.title,
      estimatedMinutes: input.estimatedMinutes,
      ...(input.deadline !== undefined ? { deadline: new Date(input.deadline) } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
    })
    .returning();

  if (!row) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Task insert returned no row.');
  }
  return serializeTask(row);
}

// --- PATCH /tasks/[taskId] ---------------------------------------------------

/**
 * Partial-update one of the user's tasks.
 *
 * completed_at lifecycle (not specified in §9 — chat-028 decision):
 *   - transition INTO status='completed'  -> set completed_at = now()
 *   - transition OUT of 'completed'       -> clear completed_at = NULL
 *   - status unchanged / non-status patch -> leave completed_at as-is
 * updated_at is maintained by the set_updated_at() trigger; we never set it here.
 *
 * Throws {@link ApiError}: 400 (validation), 404 (not found / not owned).
 */
export async function updateTask(
  db: Database,
  userId: string,
  taskId: unknown,
  rawBody: unknown,
  now: Date = new Date(),
): Promise<TaskResponse> {
  if (typeof taskId !== 'string' || !TASK_UUID.safeParse(taskId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Task not found.');
  }

  const parsed = PatchTaskSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;

  return db.transaction(async (tx) => {
    // Read current row (user-scoped). Not found / not owned -> 404. We need the
    // existing status to drive the completed_at lifecycle.
    const [existing] = await tx
      .select({ status: tasks.status })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .limit(1);
    if (!existing) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Task not found.');
    }

    const set: Partial<typeof tasks.$inferInsert> = {};
    if (input.title !== undefined) set.title = input.title;
    if (input.estimatedMinutes !== undefined) set.estimatedMinutes = input.estimatedMinutes;
    if (input.deadline !== undefined) {
      set.deadline = input.deadline === null ? null : new Date(input.deadline);
    }
    if (input.priority !== undefined) set.priority = input.priority;
    if (input.status !== undefined) {
      set.status = input.status;
      if (input.status === 'completed' && existing.status !== 'completed') {
        set.completedAt = now;
      } else if (input.status !== 'completed' && existing.status === 'completed') {
        set.completedAt = null;
      }
    }

    const [row] = await tx
      .update(tasks)
      .set(set)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();
    if (!row) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Task not found.');
    }
    return serializeTask(row);
  });
}

// --- DELETE /tasks/[taskId] --------------------------------------------------

/**
 * HARD-delete one of the user's tasks (DELETE FROM tasks). Throws {@link ApiError}
 * 404 when the row is absent or not owned by the caller.
 */
export async function deleteTask(
  db: Database,
  userId: string,
  taskId: unknown,
): Promise<void> {
  if (typeof taskId !== 'string' || !TASK_UUID.safeParse(taskId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Task not found.');
  }

  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });

  if (deleted.length === 0) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Task not found.');
  }
}
