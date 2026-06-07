import { generateObject as aiGenerateObject, type CoreMessage } from 'ai';
import type { z } from 'zod';
import { anthropicProvider, MODELS, type Model } from './client';
import { getProviderOptions, type CallType } from './cacheConfig';
import { extractCachedTokens, trackCost } from './cost/tracker';
import { voiceGate, type VoiceSource } from './voiceGate';

// §5 entrypoint convention: generateObject = Haiku structured output.
export type GenerateObjectParams<OBJECT> = {
  schema: z.ZodType<OBJECT>;
  model?: Model;
  callType?: CallType;
  system?: string;
  prompt?: string;
  messages?: CoreMessage[];
  /** Constraint level for the voice gate. Defaults to 'freeform' when absent. */
  voiceSource?: VoiceSource;
  /**
   * User-facing string fields the prompt metadata designates for voice-gating. Only
   * these top-level string fields are gated; any other (non-string) JSON passes through
   * unchanged. When omitted, the structured output is returned untouched.
   */
  voiceGateFields?: (keyof OBJECT)[];
};

/**
 * Thin wrapper over the Vercel AI SDK's generateObject. Defaults to Haiku, applies the
 * call-type cache_control, and records cost from the SDK-reported token usage.
 */
export async function generateObject<OBJECT>(params: GenerateObjectParams<OBJECT>) {
  const {
    schema,
    model = MODELS.HAIKU,
    callType = 'freeform',
    voiceSource = 'freeform',
    voiceGateFields,
    ...rest
  } = params;

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

  // VOICE GATE: only the prompt-designated user-facing string fields are gated. With
  // no designated fields the structured output passes through unchanged — arbitrary
  // non-string JSON is never voice-gated.
  if (voiceGateFields && voiceGateFields.length > 0) {
    const obj = result.object as unknown as Record<string, unknown>;
    const gated: Record<string, unknown> = { ...obj };
    for (const field of voiceGateFields) {
      const value = obj[field as string];
      if (typeof value === 'string') {
        gated[field as string] = await voiceGate(value, { source: voiceSource });
      }
    }
    return { ...result, object: gated as OBJECT };
  }

  return result;
}
