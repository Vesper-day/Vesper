import { generateObject as aiGenerateObject, type CoreMessage } from 'ai';
import type { z } from 'zod';
import { anthropicProvider, MODELS, type Model } from './client';
import { getProviderOptions, type CallType } from './cacheConfig';
import { extractCachedTokens, trackCost } from './cost/tracker';

// §5 entrypoint convention: generateObject = Haiku structured output.
export type GenerateObjectParams<OBJECT> = {
  schema: z.ZodType<OBJECT>;
  model?: Model;
  callType?: CallType;
  system?: string;
  prompt?: string;
  messages?: CoreMessage[];
};

/**
 * Thin wrapper over the Vercel AI SDK's generateObject. Defaults to Haiku, applies the
 * call-type cache_control, and records cost from the SDK-reported token usage.
 */
export async function generateObject<OBJECT>(params: GenerateObjectParams<OBJECT>) {
  const { schema, model = MODELS.HAIKU, callType = 'freeform', ...rest } = params;

  const result = await aiGenerateObject<OBJECT>({
    ...rest,
    schema,
    model: anthropicProvider(model),
    providerOptions: getProviderOptions(callType),
  });

  trackCost(
    model,
    result.usage.promptTokens,
    result.usage.completionTokens,
    extractCachedTokens(result.providerMetadata),
  );

  // VOICE-GATE SEAM: the Chat 017 voice gate plugs in here, post-generation.
  // Structured output is returned UNCHANGED for now. Do NOT import runVoiceGate or any
  // gate symbol — the real gate gains a `source` param later and wiring now would lock
  // a signature that changes.
  return result;
}
