import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the chat-016 wrapper so tests run fully offline (no AI SDK, no API key).
const generateObjectMock = vi.fn();
vi.mock('../generateObject', () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

import {
  parsePlanEditCommand,
  PlanEditCommandSchema,
  type PlanEditCommand,
  type ParseTelemetry,
} from '../parsePlanEditCommand';

afterEach(() => {
  vi.clearAllMocks();
});

const UUID = '11111111-1111-4111-8111-111111111111';

function mockReturns(command: PlanEditCommand): void {
  generateObjectMock.mockResolvedValue({ object: command });
}

describe('parsePlanEditCommand', () => {
  it('returns the parsed reschedule_block command', async () => {
    mockReturns({
      type: 'reschedule_block',
      blockId: UUID,
      newStartTime: '2026-06-15T19:00:00.000Z',
    });
    const result = await parsePlanEditCommand('move gym to 7pm');
    expect(result).toEqual({
      type: 'reschedule_block',
      blockId: UUID,
      newStartTime: '2026-06-15T19:00:00.000Z',
    });
    // The structural command is schema-valid.
    expect(PlanEditCommandSchema.safeParse(result).success).toBe(true);
  });

  it('parses the unknown variant with no payload', async () => {
    mockReturns({ type: 'unknown' });
    const result = await parsePlanEditCommand('asldkfj gibberish');
    expect(result).toEqual({ type: 'unknown' });
  });

  it('PRIVACY: telemetry receives a SHA-256 hash, never the raw input', async () => {
    mockReturns({ type: 'complete_block', blockId: UUID });
    const events: ParseTelemetry[] = [];
    const rawInput = 'mark the morning workout done';

    await parsePlanEditCommand(rawInput, {
      onTelemetry: (e) => events.push(e),
    });

    expect(events).toHaveLength(1);
    const event = events[0]!;
    // 64 lowercase hex chars = SHA-256 digest.
    expect(event.inputHash).toMatch(/^[0-9a-f]{64}$/);
    // The raw utterance must not appear anywhere in the telemetry payload.
    expect(JSON.stringify(event)).not.toContain(rawInput);
    expect(event.commandType).toBe('complete_block');
  });

  it('does not call telemetry when no hook is supplied', async () => {
    mockReturns({ type: 'regenerate_plan' });
    await expect(parsePlanEditCommand('start over')).resolves.toEqual({
      type: 'regenerate_plan',
    });
  });

  it('routes the call through Haiku with the nl-command call type', async () => {
    mockReturns({ type: 'skip_block', blockId: UUID });
    await parsePlanEditCommand('skip lunch');
    const params = generateObjectMock.mock.calls[0]![0] as {
      model: string;
      callType: string;
    };
    expect(params.model).toBe('claude-haiku-4-5');
    expect(params.callType).toBe('nl-command');
  });
});
