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

// Chat 023: AI operation scaffolds (not yet invoked; called by later chats).
export {
  parsePlanEditCommand,
  PlanEditCommandSchema,
} from './parsePlanEditCommand';
export type {
  PlanEditCommand,
  AddBlockInput,
  ParseTelemetry,
  ParsePlanEditCommandOptions,
} from './parsePlanEditCommand';
// Chat 029: butler-tone confirmation copy for the NL command endpoint. Constants
// (not a runtime model call) so the unknown-branch clarification is deterministic.
export {
  confirmationLineFor,
  UNKNOWN_COMMAND_CLARIFICATION,
} from './confirmation';
export { selectWorkoutTemplate } from './selectWorkoutTemplate';
export type { WorkoutSelectionInput } from './selectWorkoutTemplate';
export { selectRecipeTemplate } from './selectRecipeTemplate';
export type { RecipeSelectionInput } from './selectRecipeTemplate';
export { classifyCalendarEvent, CalendarClassificationSchema } from './classifyCalendarEvent';
export { classifyCalendarEventsBatch } from './classifyCalendarEventsBatch';
export { generateCheckInQuestion } from './generateCheckInQuestion';
export type { CheckInContext } from './generateCheckInQuestion';
export { suggestWeeklyPriorities } from './suggestWeeklyPriorities';
export type { OutstandingTask, WeeklyPrioritiesInput } from './suggestWeeklyPriorities';
export { generateRegenerationPrompt } from './generateRegenerationPrompt';
export type { RegenerationContext } from './generateRegenerationPrompt';

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

// Chat 022: daily-plan synthesis + three-step fallback chain.
export { synthesizePlan } from './synthesizePlan';
export type { DailyPlanChunk } from './synthesizePlan';
// APOLOGY_LINE is the fixed note prefix serveFallback prepends to a served
// fallback plan (LOCKED Decision 6). The chat-025 route is the orchestrating
// consumer: it detects "this plan was served from the fallback chain" by the
// note prefix and surfaces source:'fallback' + fallbackNotice. Re-exported here
// so that detection has a single source of truth (no duplicated magic string).
export { APOLOGY_LINE } from './synthesizePlan';
export { readBreakerState } from './synthesizePlan.circuitBreaker';
export type { BreakerState } from './synthesizePlan.circuitBreaker';
