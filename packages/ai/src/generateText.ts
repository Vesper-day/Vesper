import { generateText as aiGenerateText, type CoreMessage } from 'ai';

// Awaited shape of the SDK call, captured with named imports so the wrapper's return
// type is portable (avoids TS2742 from the spread result below).
type AiGenerateTextResult = Awaited<ReturnType<typeof aiGenerateText>>;
import { anthropicProvider, MODELS, type Model } from './client';
import { getProviderOptions, type CallType } from './cacheConfig';
import { extractCachedTokens, trackCost } from './cost/tracker';
import { voiceGate, type VoiceSource } from './voiceGate';

// §5 entrypoint convention: generateText = Sonnet freeform copy.
export type GenerateTextParams = {
  model?: Model;
  callType?: CallType;
  system?: string;
  prompt?: string;
  messages?: CoreMessage[];
  maxTokens?: number;
  temperature?: number;
  /**
   * Constraint level for the voice gate. The prompt's constraint metadata supplies
   * this; absent metadata DEFAULTS to 'freeform' (the safer, max-coverage path).
   */
  voiceSource?: VoiceSource;
};

/**
 * Thin wrapper over the Vercel AI SDK's generateText. Defaults to Sonnet, applies the
 * call-type cache_control, and records cost from the SDK-reported token usage.
 */
export async function generateText(
  params: GenerateTextParams,
): Promise<AiGenerateTextResult> {
  const { model = MODELS.SONNET, callType = 'freeform', voiceSource = 'freeform', ...rest } =
    params;

  const result = await aiGenerateText({
    ...rest,
    model: anthropicProvider(model),
    providerOptions: getProviderOptions(callType),
  });

  trackCost(
    model,
    result.usage.promptTokens,
    result.usage.completionTokens,
    extractCachedTokens(result.providerMetadata),
  );

  // VOICE GATE: run the model's text through the butler voice gate before returning.
  // The gate may rewrite (Haiku revision) or throw on an unrepairable violation.
  const text = await voiceGate(result.text, { source: voiceSource });
  return { ...result, text };
}
