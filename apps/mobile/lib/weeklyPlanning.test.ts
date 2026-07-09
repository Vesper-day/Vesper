// @vitest-environment node
//
// Unit tests for the mobile weekly-planning client (weeklyPlanning.ts, Chat 057). The
// module imports ./api/client (transitively supabase + expo-router + react-native,
// native at import) and ./calendarEvents (same) — so under the node env we mock
// ./api/client wholesale (pushTokens/calendarEvents test precedent). No real transport
// is touched.
//
// Coverage: each call hits the right METHOD + PATH; GET returns the camelCase weekly
// priorities verbatim; PUT sends ONLY { text, source } per item (never completedAt/id);
// the calendar read passes the Mon–Sun window; the completion read passes the target
// weekStart; the suggest seam POSTs the assembled input.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from './api/client';
import {
  getWeeklyPriorities,
  putWeeklyPriorities,
  suggestPriorities,
  getPriorWeekCompletion,
  listWeekEvents,
  weekWindow,
} from './weeklyPlanning';

const getMock = vi.mocked(apiClient.get);
const postMock = vi.mocked(apiClient.post);
const putMock = vi.mocked(apiClient.put);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getWeeklyPriorities', () => {
  it('GETs the current week (no query) and returns the camelCase shape verbatim', async () => {
    getMock.mockResolvedValue({
      weekPriorities: {
        id: 'row-1',
        weekStartDate: '2026-06-08',
        priorities: [{ text: 'Ship beta', source: 'user', completedAt: null }],
      },
    });

    const out = await getWeeklyPriorities();
    expect(getMock).toHaveBeenCalledWith('/weekly-priorities');
    expect(out.id).toBe('row-1');
    expect(out.priorities[0]).toEqual({ text: 'Ship beta', source: 'user', completedAt: null });
  });

  it('GETs with an encoded ?weekStart when a target Monday is given', async () => {
    getMock.mockResolvedValue({
      weekPriorities: { id: null, weekStartDate: '2026-06-08', priorities: [] },
    });
    await getWeeklyPriorities('2026-06-08');
    expect(getMock).toHaveBeenCalledWith('/weekly-priorities?weekStart=2026-06-08');
  });
});

describe('putWeeklyPriorities', () => {
  it('PUTs weekStartDate + items reduced to ONLY { text, source } (no completedAt/id)', async () => {
    putMock.mockResolvedValue({
      weekPriorities: { id: 'r', weekStartDate: '2026-06-08', priorities: [] },
    });

    // Caller passes items carrying extra fields — they must NOT reach the wire.
    const items = [
      { text: 'A', source: 'user' as const, completedAt: null, id: 'x' },
      { text: 'B', source: 'ai_suggested' as const },
      { text: 'C', source: 'user' as const },
    ] as unknown as Parameters<typeof putWeeklyPriorities>[1];

    await putWeeklyPriorities('2026-06-08', items);

    expect(putMock).toHaveBeenCalledTimes(1);
    const [path, body] = putMock.mock.calls[0]!;
    expect(path).toBe('/weekly-priorities');
    expect(body).toEqual({
      weekStartDate: '2026-06-08',
      priorities: [
        { text: 'A', source: 'user' },
        { text: 'B', source: 'ai_suggested' },
        { text: 'C', source: 'user' },
      ],
    });
    // Hard assertion: no completedAt/id crossed the boundary.
    const sent = body as { priorities: Array<Record<string, unknown>> };
    for (const item of sent.priorities) {
      expect(Object.keys(item).sort()).toEqual(['source', 'text']);
    }
  });
});

describe('suggestPriorities', () => {
  it('POSTs the assembled input to the seam and returns suggestions', async () => {
    postMock.mockResolvedValue({ suggestions: ['a', 'b', 'c'] });
    const input = {
      outstandingTasks: [{ title: 'T', priority: 'high' }],
      priorWeekCompletion: { completed: 2, total: 4 },
    };
    const out = await suggestPriorities(input);
    expect(postMock).toHaveBeenCalledWith('/weekly-priorities/suggest', input);
    expect(out).toEqual(['a', 'b', 'c']);
  });
});

describe('getPriorWeekCompletion', () => {
  it('GETs /weekly-review with the target weekStart', async () => {
    getMock.mockResolvedValue({
      weeklyReview: {
        weekStartDate: '2026-06-08',
        priorWeekStart: '2026-06-01',
        completed: 3,
        total: 5,
        rate: 0.6,
      },
    });
    const out = await getPriorWeekCompletion('2026-06-08');
    expect(getMock).toHaveBeenCalledWith('/weekly-review?weekStart=2026-06-08');
    expect(out.rate).toBeCloseTo(0.6, 5);
  });
});

describe('listWeekEvents (Mon–Sun window)', () => {
  it('weekWindow spans the Monday 00:00 → Sunday 23:59:59.999 UTC', () => {
    const w = weekWindow('2026-06-08');
    expect(w.start).toBe('2026-06-08T00:00:00.000Z');
    expect(w.end).toBe('2026-06-14T23:59:59.999Z'); // Sunday
  });

  it('reads calendar-events over the target-week Mon–Sun window', async () => {
    getMock.mockResolvedValue({ events: [] });
    await listWeekEvents('2026-06-08');
    expect(getMock).toHaveBeenCalledWith(
      '/calendar-events?start=2026-06-08T00%3A00%3A00.000Z&end=2026-06-14T23%3A59%3A59.999Z',
    );
  });
});
