import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the chat-016 generateText wrapper. In production this wrapper runs the chat-017
// voice gate internally before resolving; modifyRecipe relies on that single gate
// integration point (it must not double-gate). Mocking here keeps the Anthropic call
// out of every offline unit test.
const generateTextMock = vi.fn();
vi.mock('../generateText', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));

import { modifyRecipe, MODIFY_RECIPE_PROMPT_VERSION } from '../modifyRecipe';
import { RECIPE_MODIFY_VERSION } from '../prompts/recipe-modify';

afterEach(() => {
  vi.clearAllMocks();
});

describe('modifyRecipe', () => {
  it('returns the (voice-gated) wrapper text', async () => {
    generateTextMock.mockResolvedValue({ text: 'Lentil bolognese. Swap the beef for lentils.' });
    await expect(
      modifyRecipe({ recipeName: 'Bolognese', request: 'make it vegetarian' }),
    ).resolves.toBe('Lentil bolognese. Swap the beef for lentils.');
  });

  it('routes through Sonnet, the freeform call type, and freeform voice source', async () => {
    generateTextMock.mockResolvedValue({ text: 'Adjusted.' });
    await modifyRecipe({ recipeName: 'Bolognese', request: 'make it vegetarian' });
    const params = generateTextMock.mock.calls[0]![0] as {
      model: string;
      callType: string;
      voiceSource: string;
      prompt: string;
    };
    expect(params.model).toBe('claude-sonnet-4-6');
    expect(params.callType).toBe('freeform');
    expect(params.voiceSource).toBe('freeform');
  });

  it('includes the current instructions in the prompt only when provided', async () => {
    generateTextMock.mockResolvedValue({ text: 'Adjusted.' });

    await modifyRecipe({ recipeName: 'Bolognese', request: 'halve it' });
    const withoutInstructions = generateTextMock.mock.calls[0]![0] as { prompt: string };
    expect(withoutInstructions.prompt).not.toMatch(/Current instructions/);

    generateTextMock.mockClear();
    await modifyRecipe({
      recipeName: 'Bolognese',
      instructions: 'Brown the beef, add sauce.',
      request: 'halve it',
    });
    const withInstructions = generateTextMock.mock.calls[0]![0] as { prompt: string };
    expect(withInstructions.prompt).toMatch(/Current instructions/);
    expect(withInstructions.prompt).toMatch(/Brown the beef/);
  });

  it('pins the recipe-modify prompt version', () => {
    expect(MODIFY_RECIPE_PROMPT_VERSION).toBe(RECIPE_MODIFY_VERSION);
    expect(MODIFY_RECIPE_PROMPT_VERSION).toBe('v1-20260824');
  });
});
