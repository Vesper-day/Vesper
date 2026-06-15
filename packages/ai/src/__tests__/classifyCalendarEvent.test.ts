import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockType } from '@vesper/shared';

const generateObjectMock = vi.fn();
vi.mock('../generateObject', () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

import { classifyCalendarEvent } from '../classifyCalendarEvent';
import { classifyCalendarEventsBatch } from '../classifyCalendarEventsBatch';

afterEach(() => {
  vi.clearAllMocks();
});

// Deterministic stand-in for the model. Both the single and batch code paths route
// through the same mocked generateObject, so they share this exact rule.
function classify(summary: string): BlockType | null {
  const s = summary.toLowerCase();
  if (s.includes('gym') || s.includes('run')) return 'fitness';
  if (s.includes('standup') || s.includes('meeting') || s.includes('review')) return 'work';
  if (s.includes('lunch') || s.includes('dinner')) return 'nutrition';
  if (s.includes('dentist') || s.includes('doctor')) return 'medication';
  return null;
}

// The single classifier sends one bare summary; the batch classifier embeds a JSON
// array in the prompt. The mock dispatches on whichever shape it sees.
function installDeterministicMock(): void {
  generateObjectMock.mockImplementation(async (params: { prompt: string }) => {
    const arrayMatch = params.prompt.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const summaries = JSON.parse(arrayMatch[0]) as string[];
      return { object: { classifications: summaries.map(classify) } };
    }
    return { object: { blockType: classify(params.prompt) } };
  });
}

describe('classifyCalendarEvent', () => {
  it('returns a block type for a recognizable event', async () => {
    generateObjectMock.mockResolvedValue({ object: { blockType: 'fitness' } });
    await expect(classifyCalendarEvent('Morning gym session')).resolves.toBe('fitness');
  });

  it('returns null when the model declines to classify', async () => {
    generateObjectMock.mockResolvedValue({ object: { blockType: null } });
    await expect(classifyCalendarEvent('xyzzy')).resolves.toBeNull();
  });
});

describe('classifyCalendarEventsBatch', () => {
  it('returns an empty array without calling the model for empty input', async () => {
    const result = await classifyCalendarEventsBatch([]);
    expect(result).toEqual([]);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it('normalizes a short model response to one entry per input (pads with null)', async () => {
    generateObjectMock.mockResolvedValue({
      object: { classifications: ['work'] }, // only one returned for two inputs
    });
    const result = await classifyCalendarEventsBatch(['Standup', 'Gym']);
    expect(result).toEqual(['work', null]);
  });

  it('batched form returns the SAME per-event classifications as N single calls', async () => {
    installDeterministicMock();
    const summaries = [
      'Team standup',
      'Evening gym session',
      'Lunch with Sam',
      'Dentist appointment',
      'asdf unknowable event',
    ];

    const batched = await classifyCalendarEventsBatch(summaries);

    const individual: (BlockType | null)[] = [];
    for (const summary of summaries) {
      individual.push(await classifyCalendarEvent(summary));
    }

    expect(batched).toEqual(individual);
    expect(batched).toHaveLength(summaries.length);
  });
});
