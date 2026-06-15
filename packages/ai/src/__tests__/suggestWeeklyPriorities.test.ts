import { afterEach, describe, expect, it, vi } from 'vitest';

const generateObjectMock = vi.fn();
vi.mock('../generateObject', () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

import { suggestWeeklyPriorities } from '../suggestWeeklyPriorities';

afterEach(() => {
  vi.clearAllMocks();
});

describe('suggestWeeklyPriorities', () => {
  it('returns the suggestions array', async () => {
    generateObjectMock.mockResolvedValue({
      object: { suggestions: ['Ship the API', 'Rest more', 'Review finances'] },
    });
    await expect(
      suggestWeeklyPriorities({
        outstandingTasks: [{ title: 'Ship the API', priority: 'high', estimatedMinutes: 120 }],
        priorWeekCompletion: { completed: 2, total: 4, priorPriorities: ['Launch beta'] },
      }),
    ).resolves.toEqual(['Ship the API', 'Rest more', 'Review finances']);
  });

  it('uses Sonnet per TECHNICAL_SPEC.md §5 (weekly review reasoning)', async () => {
    generateObjectMock.mockResolvedValue({
      object: { suggestions: ['A', 'B', 'C'] },
    });
    await suggestWeeklyPriorities({
      outstandingTasks: [],
      priorWeekCompletion: { completed: 0, total: 0 },
    });
    const params = generateObjectMock.mock.calls[0]![0] as {
      model: string;
      callType: string;
    };
    expect(params.model).toBe('claude-sonnet-4-6');
    expect(params.callType).toBe('weekly-review');
  });

  it('rejects a model response with fewer than 3 suggestions (Zod min)', async () => {
    // The real wrapper validates against the schema; simulate a rejection here.
    generateObjectMock.mockRejectedValue(new Error('schema validation failed: too few'));
    await expect(
      suggestWeeklyPriorities({
        outstandingTasks: [],
        priorWeekCompletion: { completed: 1, total: 3 },
      }),
    ).rejects.toThrow();
  });
});
