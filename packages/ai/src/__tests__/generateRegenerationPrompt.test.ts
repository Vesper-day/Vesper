import { afterEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.fn();
vi.mock('../generateText', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));

import { generateRegenerationPrompt } from '../generateRegenerationPrompt';

afterEach(() => {
  vi.clearAllMocks();
});

describe('generateRegenerationPrompt', () => {
  it('returns the (voice-gated) wrapper text', async () => {
    generateTextMock.mockResolvedValue({
      text: 'I see this still is not right. What would help most?',
    });
    await expect(generateRegenerationPrompt({ failedAttempts: 3 })).resolves.toBe(
      'I see this still is not right. What would help most?',
    );
  });

  it('routes through Sonnet, the empathy-regeneration call type, and freeform voice source', async () => {
    generateTextMock.mockResolvedValue({ text: 'What is not working for you?' });
    await generateRegenerationPrompt({ failedAttempts: 3, recentFeedback: 'too packed' });
    const params = generateTextMock.mock.calls[0]![0] as {
      model: string;
      callType: string;
      voiceSource: string;
    };
    expect(params.model).toBe('claude-sonnet-4-6');
    expect(params.callType).toBe('empathy-regeneration');
    expect(params.voiceSource).toBe('freeform');
  });
});
