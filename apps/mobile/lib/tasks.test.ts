// @vitest-environment node
//
// Unit tests for the mobile task client (tasks.ts). The module imports only
// ./api/client, which transitively pulls supabase + expo-router + react-native
// (native at import), so under the node test env we mock ./api/client wholesale
// (calendarEvents.test.ts / pushTokens.test.ts precedent). No real transport runs.
//
// Coverage: each method hits the right method + path; ?status passes ONLY
// pending|completed (type-forbidden in_progress can't reach the wire); create/update
// payload shapes are exact (deadline omitted vs sent; create never sends status);
// deadline:null clears on update; the estimate guard rejects before any network call.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from './api/client';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  InvalidEstimateError,
  type Task,
} from './tasks';

const getMock = vi.mocked(apiClient.get);
const postMock = vi.mocked(apiClient.post);
const patchMock = vi.mocked(apiClient.patch);
const deleteMock = vi.mocked(apiClient.delete);

const SAMPLE: Task = {
  id: 't1',
  title: 'Draft proposal',
  estimatedMinutes: 30,
  deadline: null,
  priority: 'medium',
  status: 'pending',
  completedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listTasks', () => {
  it('GETs /tasks with no query when status is omitted', async () => {
    getMock.mockResolvedValue({ tasks: [SAMPLE] });
    const out = await listTasks();
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/tasks');
    expect(out).toEqual([SAMPLE]);
  });

  it('passes ?status=pending and ?status=completed verbatim', async () => {
    getMock.mockResolvedValue({ tasks: [] });
    await listTasks('pending');
    expect(getMock).toHaveBeenCalledWith('/tasks?status=pending');
    await listTasks('completed');
    expect(getMock).toHaveBeenCalledWith('/tasks?status=completed');
  });
});

describe('createTask', () => {
  it('POSTs only title + estimatedMinutes when nothing else is given (no deadline, no status)', async () => {
    postMock.mockResolvedValue(SAMPLE);
    await createTask({ title: 'Draft proposal', estimatedMinutes: 30 });
    expect(postMock).toHaveBeenCalledTimes(1);
    const [path, body] = postMock.mock.calls[0]!;
    expect(path).toBe('/tasks');
    expect(body).toEqual({ title: 'Draft proposal', estimatedMinutes: 30 });
    expect(body).not.toHaveProperty('deadline');
    expect(body).not.toHaveProperty('status');
  });

  it('includes deadline + priority on create when provided', async () => {
    postMock.mockResolvedValue(SAMPLE);
    await createTask({
      title: 'Ship it',
      estimatedMinutes: 45,
      deadline: '2026-07-01T09:00:00.000Z',
      priority: 'high',
    });
    expect(postMock.mock.calls[0]![1]).toEqual({
      title: 'Ship it',
      estimatedMinutes: 45,
      deadline: '2026-07-01T09:00:00.000Z',
      priority: 'high',
    });
  });

  it('rejects a non-positive / non-integer estimate BEFORE any network call', async () => {
    await expect(createTask({ title: 'x', estimatedMinutes: 0 })).rejects.toBeInstanceOf(
      InvalidEstimateError,
    );
    await expect(createTask({ title: 'x', estimatedMinutes: -5 })).rejects.toBeInstanceOf(
      InvalidEstimateError,
    );
    await expect(createTask({ title: 'x', estimatedMinutes: 12.5 })).rejects.toBeInstanceOf(
      InvalidEstimateError,
    );
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe('updateTask', () => {
  it('PATCHes /tasks/:id with only the provided fields (incl. status: in_progress)', async () => {
    patchMock.mockResolvedValue({ ...SAMPLE, status: 'in_progress' });
    await updateTask('t1', { status: 'in_progress', priority: 'high' });
    expect(patchMock).toHaveBeenCalledTimes(1);
    const [path, body] = patchMock.mock.calls[0]!;
    expect(path).toBe('/tasks/t1');
    expect(body).toEqual({ status: 'in_progress', priority: 'high' });
    // completedAt is server-managed — never sent.
    expect(body).not.toHaveProperty('completedAt');
  });

  it('sends deadline:null to CLEAR the deadline (explicit null key)', async () => {
    patchMock.mockResolvedValue(SAMPLE);
    await updateTask('t1', { deadline: null });
    expect(patchMock.mock.calls[0]![1]).toEqual({ deadline: null });
  });

  it('omits deadline entirely when the key is absent', async () => {
    patchMock.mockResolvedValue(SAMPLE);
    await updateTask('t1', { title: 'Renamed' });
    const body = patchMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toEqual({ title: 'Renamed' });
    expect(body).not.toHaveProperty('deadline');
  });

  it('rejects an invalid estimate before the network call', async () => {
    await expect(updateTask('t1', { estimatedMinutes: 0 })).rejects.toBeInstanceOf(
      InvalidEstimateError,
    );
    expect(patchMock).not.toHaveBeenCalled();
  });
});

describe('deleteTask', () => {
  it('DELETEs /tasks/:id', async () => {
    deleteMock.mockResolvedValue(undefined as never);
    await deleteTask('t1');
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith('/tasks/t1');
  });
});
