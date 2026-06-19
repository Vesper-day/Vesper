// AI Command core logic (§9 POST /api/v1/ai/command), extracted from route.ts.
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config; the pure runAiCommand function is an invalid Route export, so it lives
// in this plain sibling module. route.ts imports it; the integration test drives
// it directly with parsePlanEditCommand mocked at the @vesper/ai boundary (no
// Anthropic key needed).
//
// STATELESS: no DB access. The parser (packages/ai/parsePlanEditCommand) is the
// single source of the structured command and its type union; we do NOT
// re-author parsing here. The parser's current scaffold consumes only `input`
// (its signature is (input, options) — `planDate` is not a parser argument), so
// we validate `planDate` per the §9 contract but pass only `input` to the parser.
import { parsePlanEditCommand, confirmationLineFor } from '@vesper/ai';
import { ApiError, ErrorCode } from '@vesper/shared';
import { AiCommandRequestSchema, type AiCommandResponse } from './schemas';

export async function runAiCommand(rawBody: unknown): Promise<AiCommandResponse> {
  const parsed = AiCommandRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      'Request body must be { input: non-empty string, planDate: YYYY-MM-DD }.',
    );
  }

  const command = await parsePlanEditCommand(parsed.data.input);
  return { command, confirmationLine: confirmationLineFor(command) };
}
