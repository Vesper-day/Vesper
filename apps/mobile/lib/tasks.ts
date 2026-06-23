// Thin mobile client for the task pool (Chat 054-W — parity with the web Tasks
// surface). Wraps the EXISTING /api/v1/tasks route set (chat 028) through the
// shared mobile API client (lib/api/client) — it does NOT re-implement CRUD and
// does NOT open a second transport or session path (mirrors lib/calendarEvents.ts).
//
// Field mapping (camelCase request/response <-> snake_case column) is handled by the
// route; this module speaks the route's camelCase contract verbatim:
//   title <-> title, estimatedMinutes <-> estimated_minutes, deadline <-> deadline,
//   priority <-> priority, status <-> status, completedAt <-> completed_at.
//
// completed_at is SERVER-managed (set when status -> completed, cleared when status
// leaves completed): this module NEVER sends completedAt. user_id is session-derived
// by the route and NEVER sent.
import { apiClient } from './api/client';

export type Priority = 'low' | 'medium' | 'high';
// The stored task status enum (§3) — PATCH accepts all three.
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
// The GET ?status filter is NARROWER than the enum (§9): only pending | completed
// are valid query values. in_progress would 400, so the type forbids passing it.
export type TaskStatusFilter = 'pending' | 'completed';

/** Mirrors the §9 serialized task (operations.ts TaskResponse) — NO createdAt /
 * updatedAt. deadline & completedAt are ISO-8601 strings or null. */
export interface Task {
  id: string;
  title: string;
  estimatedMinutes: number;
  deadline: string | null; // ISO 8601
  priority: Priority;
  status: TaskStatus;
  completedAt: string | null; // ISO 8601
}

interface TaskListResponse {
  tasks: Task[];
}

/** Create payload — title + estimatedMinutes required; deadline OMITTED when not
 * given (the route's create schema accepts no `null` deadline). */
export interface CreateTaskInput {
  title: string;
  estimatedMinutes: number;
  deadline?: string; // ISO 8601
  priority?: Priority;
}

/** Partial-update payload — every field optional; `deadline: null` clears it. */
export interface UpdateTaskInput {
  title?: string;
  estimatedMinutes?: number;
  deadline?: string | null; // ISO 8601, or null to clear
  priority?: Priority;
  status?: TaskStatus;
}

/**
 * Thrown when estimatedMinutes is not a whole number > 0. The DB CHECK and the route
 * also reject this, but the client rejects early for instant UX feedback — and so an
 * invalid write never leaves the device (mirrors calendarEvents' InvertedRangeError).
 */
export class InvalidEstimateError extends Error {
  constructor(message = 'Estimated minutes must be a whole number greater than zero.') {
    super(message);
    this.name = 'InvalidEstimateError';
  }
}

function assertValidEstimate(minutes: number): void {
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new InvalidEstimateError();
  }
}

/**
 * List the user's tasks. The route returns a FIXED server order (priority DESC, then
 * deadline ASC NULLS LAST) and exposes no sort param. `status` is the only filter and
 * accepts ONLY pending | completed (omit for all) — in_progress is filtered client-side.
 */
export async function listTasks(status?: TaskStatusFilter): Promise<Task[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiClient.get<TaskListResponse>(`/tasks${qs}`);
  return res.tasks;
}

/**
 * Create one task. Rejects an invalid estimate before the network call. deadline is
 * sent only when provided; priority only when provided (else the DB default applies).
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  assertValidEstimate(input.estimatedMinutes);
  const body: Record<string, unknown> = {
    title: input.title,
    estimatedMinutes: input.estimatedMinutes,
  };
  if (input.deadline !== undefined) body.deadline = input.deadline;
  if (input.priority !== undefined) body.priority = input.priority;
  return apiClient.post<Task>('/tasks', body);
}

/**
 * Partial-update one task by id. Only the provided fields are sent; `deadline: null`
 * clears the deadline. completedAt is never sent (server-managed off the status
 * transition). Rejects an invalid estimate before the network call.
 */
export async function updateTask(taskId: string, patch: UpdateTaskInput): Promise<Task> {
  if (patch.estimatedMinutes !== undefined) assertValidEstimate(patch.estimatedMinutes);
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.estimatedMinutes !== undefined) body.estimatedMinutes = patch.estimatedMinutes;
  // `deadline` is included when the KEY is present — including an explicit null,
  // which clears it. (Absent key => deadline untouched.)
  if ('deadline' in patch) body.deadline = patch.deadline;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.status !== undefined) body.status = patch.status;
  return apiClient.patch<Task>(`/tasks/${taskId}`, body);
}

/** Hard-delete one task by id (route returns 204; the client maps it to void). */
export async function deleteTask(taskId: string): Promise<void> {
  await apiClient.delete<void>(`/tasks/${taskId}`);
}
