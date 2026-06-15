import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the chat-016 generateText wrapper. In production this wrapper runs the
// chat-017 voice gate internally before resolving; the function under test relies on
// that single gate integration point (it must not double-gate).
const generateTextMock = vi.fn();
vi.mock('../generateText', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));

import { generateCheckInQuestion } from '../generateCheckInQuestion';

afterEach(() => {
  vi.clearAllMocks();
});

describe('generateCheckInQuestion', () => {
  it('returns the (voice-gated) wrapper text', async () => {
    generateTextMock.mockResolvedValue({ text: 'How is your energy this morning?' });
    await expect(
      generateCheckInQuestion({ localDate: 'Monday, June 15', recentEnergyScores: [7, 6] }),
    ).resolves.toBe('How is your energy this morning?');
  });

  it('routes through Haiku, the checkin-question call type, and freeform voice source', async () => {
    generateTextMock.mockResolvedValue({ text: 'Ready to begin?' });
    await generateCheckInQuestion({ localDate: 'Tuesday', recentEnergyScores: [] });
    const params = generateTextMock.mock.calls[0]![0] as {
      model: string;
      callType: string;
      voiceSource: string;
    };
    expect(params.model).toBe('claude-haiku-4-5');
    expect(params.callType).toBe('checkin-question');
    expect(params.voiceSource).toBe('freeform');
  });

  it('handles an empty energy history without error', async () => {
    generateTextMock.mockResolvedValue({ text: 'Good morning. How are you?' });
    await expect(
      generateCheckInQuestion({ localDate: 'Wed', recentEnergyScores: [] }),
    ).resolves.toBe('Good morning. How are you?');
  });
});
