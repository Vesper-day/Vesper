// @vitest-environment node
//
// Tests for the AI Command endpoint (POST /api/v1/ai/command).
//
// The endpoint is STATELESS — no DB. The parser is mocked at the @vesper/ai
// boundary (partial mock: only parsePlanEditCommand is replaced, so the real
// confirmationLineFor + UNKNOWN_COMMAND_CLARIFICATION are exercised), so this
// whole suite runs under plain `pnpm test` with NO Anthropic key and NO Upstash
// env. The per-user rate limiter lives in route.ts (not operations.ts) and is
// lazy (no Redis client at import), so driving runAiCommand directly never
// touches Upstash.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlanEditCommand } from '@vesper/ai';

// Partial mock: keep every real export, swap only parsePlanEditCommand for a spy.
vi.mock('@vesper/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vesper/ai')>();
  return { ...actual, parsePlanEditCommand: vi.fn() };
});

import {
  parsePlanEditCommand,
  UNKNOWN_COMMAND_CLARIFICATION,
} from '@vesper/ai';
import { ApiError } from '@vesper/shared';
import { runAiCommand } from './operations';
import { AiCommandRequestSchema } from './schemas';

const parseMock = vi.mocked(parsePlanEditCommand);

beforeEach(() => {
  parseMock.mockReset();
});

// --- Pure validation suite (no DB, no mocks needed) --------------------------

describe('AI command validation (pure)', () => {
  it('requires a non-empty input and a YYYY-MM-DD planDate, rejects extras', () => {
    expect(
      AiCommandRequestSchema.safeParse({ input: 'Move gym to 7pm', planDate: '2026-06-01' })
        .success,
    ).toBe(true);
    expect(AiCommandRequestSchema.safeParse({ input: '', planDate: '2026-06-01' }).success).toBe(
      false,
    ); // empty input
    expect(AiCommandRequestSchema.safeParse({ input: 'x', planDate: '06/01/2026' }).success).toBe(
      false,
    ); // bad date shape
    expect(AiCommandRequestSchema.safeParse({ input: 'x' }).success).toBe(false); // no planDate
    expect(
      AiCommandRequestSchema.safeParse({ input: 'x', planDate: '2026-06-01', nope: 1 }).success,
    ).toBe(false); // strict
  });
});

// --- Behaviour suite (parser mocked) -----------------------------------------

describe('runAiCommand', () => {
  it('structured command: returns { command, confirmationLine } with the type-keyed line', async () => {
    const command: PlanEditCommand = {
      type: 'reschedule_block',
      blockId: '11111111-1111-1111-1111-111111111111',
      newStartTime: '2026-06-01T19:00:00Z',
      newEndTime: '2026-06-01T20:00:00Z',
    };
    parseMock.mockResolvedValue(command);

    const res = await runAiCommand({ input: 'Move gym to 7pm', planDate: '2026-06-01' });

    expect(parseMock).toHaveBeenCalledWith('Move gym to 7pm');
    expect(res.command).toEqual(command);
    expect(res.confirmationLine).toBe('Rescheduled.');
  });

  it('unknown command: returns type "unknown" with the voice-gated clarification constant', async () => {
    parseMock.mockResolvedValue({ type: 'unknown' });

    const res = await runAiCommand({ input: 'aksjdfh', planDate: '2026-06-01' });

    expect(res.command.type).toBe('unknown');
    expect(res.confirmationLine).toBe(UNKNOWN_COMMAND_CLARIFICATION);
  });

  it('invalid body: throws 400 INVALID_REQUEST before calling the parser', async () => {
    const err = (await runAiCommand({ input: '', planDate: 'nope' }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('INVALID_REQUEST');
    expect(err.httpStatus).toBe(400);
    expect(parseMock).not.toHaveBeenCalled();
  });
});
