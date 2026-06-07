import { streamText as aiStreamText, type CoreMessage } from 'ai';
import { anthropicProvider, MODELS, type Model } from './client';
import { getProviderOptions, type CallType } from './cacheConfig';
import { extractCachedTokens, trackCost } from './cost/tracker';
import { voiceGate, type VoiceSource } from './voiceGate';

// §5 entrypoint convention: streamText = streaming Sonnet (daily-plan synthesis).
export type StreamTextParams = {
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
 * Thin wrapper over the Vercel AI SDK's streamText. Defaults to Sonnet, applies the
 * call-type cache_control, and records cost once the stream completes (onFinish), where
 * the SDK reports final token usage.
 */
export function streamText(params: StreamTextParams) {
  const { model = MODELS.SONNET, callType = 'daily-plan', voiceSource = 'freeform', ...rest } =
    params;

  return aiStreamText({
    ...rest,
    model: anthropicProvider(model),
    providerOptions: getProviderOptions(callType),
    async onFinish({ usage, providerMetadata, text }) {
      trackCost(
        model,
        usage.promptTokens,
        usage.completionTokens,
        extractCachedTokens(providerMetadata),
      );

      // VOICE GATE: a stream cannot be retro-edited once emitted, so on completion the
      // gate runs as post-hoc enforcement/validation over the final text. It surfaces
      // an unrepairable violation by rejecting onFinish (the SDK routes that to the
      // stream's error channel).
      await voiceGate(text, { source: voiceSource });
    },
  });
}
