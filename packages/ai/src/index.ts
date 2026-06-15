export { anthropicProvider, anthropicSdk, MODELS } from './client';
export type { Model } from './client';
export { voiceGate } from './voiceGate';
export { getFallbackPlan } from './fallback';

// Chat 016 additions: SDK wrappers, cache config, cost tracker, prompt-versioning types.
export * from './cacheConfig';
export * from './streamText';
export * from './generateText';
export * from './generateObject';
export * from './cost/tracker';
export * from './prompts/types';

export * from './prompts/dailyPlanSynthesis';
export * from './prompts/weekly-review';
export * from './prompts/template-selection';
export * from './prompts/nl-command';
export * from './prompts/calendar-classify';
export * from './prompts/checkin-question';
export * from './prompts/empathy-regeneration';

// Chat 021: context builders + cache wiring (supersedes the pre-111 context.ts stub).
export { buildPlanContext } from './context/planContext';
export type { PlanContext, CalendarEvent, PendingTask } from './context/planContext';
export { buildUserContext } from './context/userContext';
export type { UserContext } from './context/userContext';
export { buildTemplateSubset } from './context/templateSubset';
export type {
  TemplateSubset,
  WorkoutTemplate,
  RecipeTemplate,
} from './context/templateSubset';
export { recordCacheObservation, classifyCacheOutcome } from './context/cacheObservability';
export type { CacheObservation, CacheOutcome } from './context/cacheObservability';
