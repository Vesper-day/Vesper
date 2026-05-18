import { generateObject } from 'ai';
import { z } from 'zod';
import { anthropicProvider, MODELS } from './client';
import { VOICE_GATE_PROMPT, VOICE_GATE_VERSION } from './prompts/voice-gate';

const BLOCKED_PATTERNS: RegExp[] = [
  /[—–]/g,
  /!/g,
  /[\u{1F300}-\u{1FAFF}]/gu,
  /\bA\.?I\.?\b|\bartificial intelligence\b|\bmachine learning\b|\bAI-powered\b|\bas an AI\b/gi,
];

const GateResultSchema = z.discriminatedUnion('verdict', [
  z.object({ verdict: z.literal('pass') }),
  z.object({ verdict: z.literal('fail'), corrected: z.string() }),
]);

function regexPass(input: string): string {
  let out = input;
  for (const pattern of BLOCKED_PATTERNS) {
    out = out.replace(pattern, '');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).length;
}

export async function runVoiceGate(input: string): Promise<string> {
  const afterRegex = regexPass(input);

  if (wordCount(afterRegex) <= 30) return afterRegex;

  const { object } = await generateObject({
    model: anthropicProvider(MODELS.HAIKU),
    schema: GateResultSchema,
    system: VOICE_GATE_PROMPT,
    prompt: afterRegex,
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
  });

  if (object.verdict === 'pass') return afterRegex;
  return regexPass(object.corrected);
}

export { VOICE_GATE_VERSION };
