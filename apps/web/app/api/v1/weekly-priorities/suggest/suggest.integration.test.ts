// @vitest-environment node
//
// Tests for POST /api/v1/weekly-priorities/suggest core logic (runSuggest, Chat 057 —
// DECISION B). The route is STATELESS (no DB), so this drives runSuggest directly with
// @vesper/ai suggestWeeklyPriorities MOCKED — no Anthropic key, no DB, no gate needed
// (the ai/command precedent). Asserts: a valid body yields { suggestions } (3–5), the
// parsed input is forwarded to the model verbatim, and an invalid body throws 400.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vesper/ai', () => ({
  suggestWeeklyPriorities: vi.fn(),
}));

import { suggestWeeklyPriorities } from '@vesper/ai';
import { ApiError } from '@vesper/shared';
import { runSuggest } from './operations';

const suggestMock = vi.mocked(suggestWeeklyPriorities);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runSuggest', () => {
  it('returns { suggestions } (3–5) and forwards the parsed input to the model', async () => {
    suggestMock.mockResolvedValue(['Ship beta', 'Call bank', 'Plan Q3', 'Rest weekend']);

    const body = {
      outstandingTasks: [
        { title: 'Ship beta', priority: 'high', estimatedMinutes: 120 },
        { title: 'Call bank', priority: 'medium' },
      ],
      priorWeekCompletion: { completed: 3, total: 5, priorPriorities: ['Old one'] },
    };

    const res = await runSuggest(body);

    expect(res.suggestions).toHaveLength(4);
    expect(res.suggestions).toContain('Ship beta');
    expect(suggestMock).toHaveBeenCalledTimes(1);
    // The parsed body is forwarded verbatim (shape mirrors WeeklyPrioritiesInput).
    expect(suggestMock).toHaveBeenCalledWith({
      outstandingTasks: body.outstandingTasks,
      priorWeekCompletion: body.priorWeekCompletion,
    });
  });

  it('defaults outstandingTasks to [] when omitted', async () => {
    suggestMock.mockResolvedValue(['a', 'b', 'c']);
    await runSuggest({ priorWeekCompletion: { completed: 0, total: 0 } });
    expect(suggestMock).toHaveBeenCalledWith({
      outstandingTasks: [],
      priorWeekCompletion: { completed: 0, total: 0 },
    });
  });

  it('throws a 400 ApiError on a body missing priorWeekCompletion', async () => {
    const err = (await runSuggest({ outstandingTasks: [] }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.httpStatus).toBe(400);
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('throws a 400 ApiError on extra keys (strict schema)', async () => {
    const err = (await runSuggest({
      priorWeekCompletion: { completed: 1, total: 2 },
      bogus: true,
    }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.httpStatus).toBe(400);
  });
});
