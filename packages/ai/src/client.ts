import Anthropic from '@anthropic-ai/sdk';
import { createAnthropic } from '@ai-sdk/anthropic';

export const anthropicSdk = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

export const anthropicProvider = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

export const MODELS = {
  HAIKU: 'claude-haiku-4-5',
  SONNET: 'claude-sonnet-4-6',
} as const;

export type Model = (typeof MODELS)[keyof typeof MODELS];
