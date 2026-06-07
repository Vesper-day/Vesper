import { streamText as aiStreamText, type CoreMessage } from 'ai';
import { anthropicProvider, MODELS, type Model } from './client';
import { getProviderOptions, type CallType } from './cacheConfig';
import { extractCachedTokens, trackCost } from './cost/tracker';

// §5 entrypoint convention: streamText = streaming Sonnet (daily-plan synthesis).
export type StreamTextParams = {
  model?: Model;
  callType?: CallType;
  system?: string;
  prompt?: string;
  messages?: CoreMessage[];
  maxTokens?: number;
  temperature?: number;
};

/**
 * Thin wrapper over the Vercel AI SDK's streamText. Defaults to Sonnet, applies the
 * call-type cache_control, and records cost once the stream completes (onFinish), where
 * the SDK reports final token usage.
 */
export function streamText(params: StreamTextParams) {
  const { model = MODELS.SONNET, callType = 'daily-plan', ...rest } = params;

  return aiStreamText({
    ...rest,
    model: anthropicProvider(model),
    providerOptions: getProviderOptions(callType),
    onFinish({ usage, providerMetadata }) {
      trackCost(
        model,
        usage.promptTokens,
        usage.completionTokens,
        extractCachedTokens(providerMetadata),
      );

      // VOICE-GATE SEAM: the Chat 017 voice gate plugs in here, after the stream
      // completes. The stream is passed through UNCHANGED for now. Do NOT import
      // runVoiceGate or any gate symbol — the real gate gains a `source` param later
      // and wiring now would lock a signature that changes.
    },
  });
}
