import { generateText as aiGenerateText, type CoreMessage } from 'ai';
import { anthropicProvider, MODELS, type Model } from './client';
import { getProviderOptions, type CallType } from './cacheConfig';
import { extractCachedTokens, trackCost } from './cost/tracker';

// §5 entrypoint convention: generateText = Sonnet freeform copy.
export type GenerateTextParams = {
  model?: Model;
  callType?: CallType;
  system?: string;
  prompt?: string;
  messages?: CoreMessage[];
  maxTokens?: number;
  temperature?: number;
};

/**
 * Thin wrapper over the Vercel AI SDK's generateText. Defaults to Sonnet, applies the
 * call-type cache_control, and records cost from the SDK-reported token usage.
 */
export async function generateText(params: GenerateTextParams) {
  const { model = MODELS.SONNET, callType = 'freeform', ...rest } = params;

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

  // VOICE-GATE SEAM: the Chat 017 voice gate plugs in here, post-generation.
  // Pass output through UNCHANGED for now. Do NOT import runVoiceGate or any gate
  // symbol — the real gate gains a `source` param later and wiring now would lock
  // a signature that changes.
  return result;
}
